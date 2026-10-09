const express = require('express');
const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const AttendanceAudit = require('../models/AttendanceAudit');
const LeaveRequest = require('../models/LeaveRequest');
const OfficeSettings = require('../models/OfficeSettings');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth); // every route below needs a logged-in user

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admins only' });
  }
  next();
}

function employeeOnly(req, res, next) {
  if (req.user.role !== 'employee') {
    return res.status(403).json({ message: 'Employees only' });
  }
  next();
}

function todayStr() {
  // Local server date as YYYY-MM-DD. Fine for a single-office tool.
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function defaultOfficeSettings() {
  return { officeStartTime: '09:00', officeEndTime: '17:00', graceMinutes: 0, workingDays: [1, 2, 3, 4, 5] };
}

function timeToMinutes(value) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function publicOfficeSettings(settings) {
  return {
    officeStartTime: settings.officeStartTime,
    officeEndTime: settings.officeEndTime || defaultOfficeSettings().officeEndTime,
    graceMinutes: settings.graceMinutes,
    workingDays: settings.workingDays,
  };
}

async function getOfficeSettings() {
  const settings = await OfficeSettings.findOne({ key: 'default' }).lean();
  return settings || defaultOfficeSettings();
}

async function getOrCreateToday(userId) {
  const date = todayStr();
  let record = await Attendance.findOne({ user: userId, date });
  if (!record) {
    record = await Attendance.create({ user: userId, date });
  }
  return record;
}

async function getApprovedLeaveForDate(userId, date) {
  return LeaveRequest.findOne({
    employee: userId,
    status: 'approved',
    startDate: { $lte: date },
    endDate: { $gte: date },
  }).select('startDate endDate').lean();
}

function normalizeBreakSessions(record) {
  if (!Array.isArray(record.breakSessions)) {
    record.breakSessions = [];
  }

  if (!record.breakSessions.length && (record.breakIn || record.breakOut)) {
    const start = record.breakIn ? new Date(record.breakIn) : null;
    const end = record.breakOut ? new Date(record.breakOut) : null;
    if (start && !Number.isNaN(start.getTime())) {
      record.breakSessions.push({ start, end: end && !Number.isNaN(end.getTime()) ? end : null });
    }
  }

  const cleaned = [];
  for (const session of record.breakSessions) {
    if (!session || !session.start) continue;
    const start = new Date(session.start);
    const end = session.end ? new Date(session.end) : null;
    if (Number.isNaN(start.getTime())) continue;
    if (end && Number.isNaN(end.getTime())) continue;
    cleaned.push({ start, end });
  }

  record.breakSessions = cleaned;
  const activeBreak = record.breakSessions.find((session) => !session.end) || null;
  if (record.breakSessions.length === 0) {
    record.breakIn = null;
    record.breakOut = null;
    return record;
  }

  const lastBreak = record.breakSessions[record.breakSessions.length - 1];
  if (activeBreak) {
    record.breakIn = activeBreak.start;
    record.breakOut = null;
  } else {
    record.breakIn = lastBreak.start;
    record.breakOut = lastBreak.end;
  }
  return record;
}

function calculateTotalMinutes(record) {
  if (!record.checkIn || !record.checkOut) return 0;
  const breakMinutes = (record.breakSessions || []).reduce((total, session) => {
    if (!session.start || !session.end) return total;
    return total + (new Date(session.end) - new Date(session.start));
  }, 0);
  const totalMs = record.checkOut - record.checkIn - breakMinutes;
  return Math.max(0, Math.round(totalMs / 60000));
}

// GET /api/attendance/today -> today's record (or blank shape if none yet)
router.get('/today', async (req, res) => {
  const date = todayStr();
  const record = await Attendance.findOne({ user: req.user.id, date });
  const approvedLeave = req.user.role === 'employee'
    ? await getApprovedLeaveForDate(req.user.id, date)
    : null;
  const officeSchedule = publicOfficeSettings(await getOfficeSettings());
  if (!record) {
    return res.json({
      date,
      checkIn: null,
      breakIn: null,
      breakOut: null,
      checkOut: null,
      breakSessions: [],
      approvedLeave,
      officeSchedule,
    });
  }
  normalizeBreakSessions(record);
  res.json({ ...record.toObject(), approvedLeave, officeSchedule });
});

// POST /api/attendance/checkin
router.post('/checkin', async (req, res) => {
  if (req.user.role === 'employee' && await getApprovedLeaveForDate(req.user.id, todayStr())) {
    return res.status(403).json({ message: 'Your leave is approved for today. Check-in is unavailable.' });
  }
  const record = await getOrCreateToday(req.user.id);
  if (record.checkIn) {
    return res.status(400).json({ message: 'Already checked in today' });
  }
  record.checkIn = new Date();
  record.breakSessions = [];
  record.breakIn = null;
  record.breakOut = null;
  await record.save();
  res.json(record);
});

// POST /api/attendance/breakin
router.post('/breakin', async (req, res) => {
  const record = await getOrCreateToday(req.user.id);
  normalizeBreakSessions(record);
  if (!record.checkIn) return res.status(400).json({ message: 'Check in first' });
  if (record.checkOut) return res.status(400).json({ message: 'Already checked out for today' });
  if ((record.breakSessions || []).some((session) => !session.end)) {
    return res.status(400).json({ message: 'Already on break' });
  }

  record.breakSessions.push({ start: new Date(), end: null });
  normalizeBreakSessions(record);
  await record.save();
  res.json(record);
});

// POST /api/attendance/breakout
router.post('/breakout', async (req, res) => {
  const record = await getOrCreateToday(req.user.id);
  normalizeBreakSessions(record);
  const activeBreak = (record.breakSessions || []).find((session) => !session.end);
  if (!activeBreak) return res.status(400).json({ message: 'Start a break first' });
  activeBreak.end = new Date();
  normalizeBreakSessions(record);
  await record.save();
  res.json(record);
});

// POST /api/attendance/checkout
router.post('/checkout', async (req, res) => {
  const record = await getOrCreateToday(req.user.id);
  normalizeBreakSessions(record);
  if (!record.checkIn) return res.status(400).json({ message: 'Check in first' });
  if (record.checkOut) return res.status(400).json({ message: 'Already checked out today' });
  if ((record.breakSessions || []).some((session) => !session.end)) {
    return res.status(400).json({ message: 'End your break before checking out' });
  }

  record.checkOut = new Date();
  record.totalWorkMinutes = calculateTotalMinutes(record);

  await record.save();
  res.json(record);
});

// GET /api/attendance/history?limit=30 -> this user's past records, newest first
router.get('/history', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 30, 90);
  const records = await Attendance.find({ user: req.user.id }).sort({ date: -1 }).limit(limit).lean();
  const normalized = records.map((record) => {
    normalizeBreakSessions(record);
    return record;
  });
  res.json(normalized);
});

// GET /api/attendance/team-today  -> admin only: everyone's status today
router.get('/team-today', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admins only' });
  const date = todayStr();
  const records = await Attendance.find({ date }).populate('user', 'name email department');
  res.json(records);
});

// GET /api/attendance/team -> all employees and their current attendance flow
router.get('/team', adminOnly, async (req, res) => {
  try {
    const employees = await User.find({ role: 'employee' })
      .select('name email department')
      .sort({ name: 1 })
      .lean();
    const date = todayStr();
    const records = await Attendance.find({
      user: { $in: employees.map((employee) => employee._id) },
      date,
    }).lean();
    const recordsByUser = new Map(records.map((record) => [record.user.toString(), record]));
    const settings = await getOfficeSettings();
    const activeLeaves = await LeaveRequest.find({
      employee: { $in: employees.map((employee) => employee._id) },
      status: 'approved',
      startDate: { $lte: date },
      endDate: { $gte: date },
    }).select('employee').lean();
    const employeesOnLeave = new Set(activeLeaves.map((leave) => leave.employee.toString()));
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startHour, startMinute] = settings.officeStartTime.split(':').map(Number);
    const lateAfter = startHour * 60 + startMinute + settings.graceMinutes;
    const isWorkingDay = settings.workingDays.includes(now.getDay());

    res.json(employees.map((employee) => {
      const attendance = recordsByUser.get(employee._id.toString()) || null;
      if (attendance) normalizeBreakSessions(attendance);
      const activeBreak = attendance?.breakSessions?.find((session) => !session.end) || null;
      const checkInMinutes = attendance?.checkIn
        ? attendance.checkIn.getHours() * 60 + attendance.checkIn.getMinutes()
        : null;
      const checkOutMinutes = attendance?.checkOut
        ? attendance.checkOut.getHours() * 60 + attendance.checkOut.getMinutes()
        : null;
      const checkedInLate = checkInMinutes !== null && checkInMinutes > lateAfter;
      const checkedOutEarly = checkOutMinutes !== null
        && checkOutMinutes < timeToMinutes(publicOfficeSettings(settings).officeEndTime);
      let currentFlow = 'Not checked in';
      if (employeesOnLeave.has(employee._id.toString())) currentFlow = 'On leave';
      else if (!isWorkingDay) currentFlow = 'Off day';
      else if (attendance?.checkOut) {
        currentFlow = checkedOutEarly
          ? (checkedInLate ? 'Late · Early checkout' : 'Early checkout')
          : (checkedInLate ? 'Late · Checked out' : 'Checked out');
      }
      else if (activeBreak) currentFlow = checkedInLate ? 'Late · On break' : 'On break';
      else if (attendance?.checkIn) currentFlow = checkedInLate ? 'Late · Working' : 'Working';
      else if (currentMinutes > lateAfter) currentFlow = 'Absent';

      return { ...employee, attendance, currentFlow };
    }));
  } catch (err) {
    res.status(500).json({ message: 'Could not load employee list', error: err.message });
  }
});

// GET /api/attendance/team/settings -> schedule configuration (admin only)
router.get('/team/settings', adminOnly, async (req, res) => {
  try {
    res.json(publicOfficeSettings(await getOfficeSettings()));
  } catch (err) {
    res.status(500).json({ message: 'Could not load office settings', error: err.message });
  }
});

// PUT /api/attendance/team/settings -> update office schedule (admin only)
router.put('/team/settings', adminOnly, async (req, res) => {
  try {
    const { officeStartTime, officeEndTime, graceMinutes, workingDays } = req.body;
    if (typeof officeStartTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(officeStartTime)) {
      return res.status(400).json({ message: 'Office start time must be a valid 24-hour time' });
    }
    if (typeof officeEndTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(officeEndTime)) {
      return res.status(400).json({ message: 'Office end time must be a valid 24-hour time' });
    }
    if (timeToMinutes(officeEndTime) <= timeToMinutes(officeStartTime)) {
      return res.status(400).json({ message: 'Office end time must be later than office start time' });
    }
    if (!Number.isInteger(graceMinutes) || graceMinutes < 0 || graceMinutes > 180) {
      return res.status(400).json({ message: 'Grace period must be between 0 and 180 minutes' });
    }
    if (
      !Array.isArray(workingDays) ||
      workingDays.length === 0 ||
      workingDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
      new Set(workingDays).size !== workingDays.length
    ) {
      return res.status(400).json({ message: 'Select at least one valid working day' });
    }

    const settings = await OfficeSettings.findOneAndUpdate(
      { key: 'default' },
      { $set: { officeStartTime, officeEndTime, graceMinutes, workingDays: workingDays.sort((a, b) => a - b) } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json(publicOfficeSettings(settings));
  } catch (err) {
    res.status(500).json({ message: 'Could not save office settings', error: err.message });
  }
});

// POST /api/attendance/leave -> employee submits a leave request
router.post('/leave', employeeOnly, async (req, res) => {
  try {
    const { startDate, endDate, reason } = req.body;
    if (!isValidDateString(startDate) || !isValidDateString(endDate) || endDate < startDate) {
      return res.status(400).json({ message: 'Enter a valid leave date range' });
    }
    if (startDate < todayStr()) {
      return res.status(400).json({ message: 'Leave request dates cannot be in the past' });
    }
    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 500) {
      return res.status(400).json({ message: 'Reason is required and must be at most 500 characters' });
    }

    const overlapping = await LeaveRequest.findOne({
      employee: req.user.id,
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    });
    if (overlapping) {
      return res.status(409).json({ message: 'You already have a pending or approved request for these dates' });
    }

    const leave = await LeaveRequest.create({
      employee: req.user.id,
      startDate,
      endDate,
      reason: reason.trim(),
    });
    res.status(201).json(leave);
  } catch (err) {
    res.status(500).json({ message: 'Could not submit leave request', error: err.message });
  }
});

// GET /api/attendance/leave/mine -> employee's leave requests
router.get('/leave/mine', employeeOnly, async (req, res) => {
  try {
    const requests = await LeaveRequest.find({ employee: req.user.id })
      .sort({ createdAt: -1 })
      .populate('reviewedBy', 'name')
      .lean();
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Could not load leave requests', error: err.message });
  }
});

// GET /api/attendance/leave -> admin reviews leave requests
router.get('/leave', adminOnly, async (req, res) => {
  try {
    const requests = await LeaveRequest.find({})
      .sort({ createdAt: -1 })
      .populate('employee', 'name email department')
      .populate('reviewedBy', 'name')
      .lean();
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Could not load leave requests', error: err.message });
  }
});

// PATCH /api/attendance/leave/:requestId -> admin approves/rejects a pending request
router.patch('/leave/:requestId', adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.requestId)) {
      return res.status(400).json({ message: 'Invalid leave request id' });
    }
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be approved or rejected' });
    }
    const leave = await LeaveRequest.findOneAndUpdate(
      { _id: req.params.requestId, status: 'pending' },
      { $set: { status, reviewedBy: req.user.id, reviewedAt: new Date() } },
      { new: true }
    ).populate('employee', 'name email department');
    if (!leave) {
      return res.status(404).json({ message: 'Pending leave request not found' });
    }
    res.json(leave);
  } catch (err) {
    res.status(500).json({ message: 'Could not update leave request', error: err.message });
  }
});

// GET /api/attendance/team/history -> all employees' attendance history (admin only)
router.get('/team/history', adminOnly, async (req, res) => {
  try {
    const records = await Attendance.find({})
      .sort({ date: -1, createdAt: -1 })
      .populate({
        path: 'user',
        match: { role: 'employee' },
        select: 'name email department',
      })
      .lean();

    const normalized = records
      .filter((record) => record.user)
      .map((record) => {
        normalizeBreakSessions(record);
        return record;
      });

    res.json(normalized);
  } catch (err) {
    res.status(500).json({ message: 'Could not load attendance history', error: err.message });
  }
});

// GET /api/attendance/team/audit -> recent admin attendance edits
router.get('/team/audit', adminOnly, async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 100)
      : 50;
    const entries = await AttendanceAudit.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({ path: 'employee', select: 'name email department' })
      .populate({ path: 'admin', select: 'name email' })
      .lean();

    res.json(entries);
  } catch (err) {
    res.status(500).json({ message: 'Could not load attendance audit log', error: err.message });
  }
});

// GET /api/attendance/team/export.csv -> filtered attendance CSV (admin only)
router.get('/team/export.csv', adminOnly, async (req, res) => {
  try {
    const { from, to, employeeId } = req.query;
    const isDate = (value) => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const parsedDate = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
    };
    if ((from && !isDate(from)) || (to && !isDate(to))) {
      return res.status(400).json({ message: 'Dates must use YYYY-MM-DD format' });
    }
    if (from && to && from > to) {
      return res.status(400).json({ message: 'Start date must not be after end date' });
    }
    if (employeeId && !mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const query = {};
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }
    if (employeeId) {
      const employee = await User.findOne({ _id: employeeId, role: 'employee' }).select('_id');
      if (!employee) return res.status(404).json({ message: 'Employee not found' });
      query.user = employee._id;
    } else {
      const employeeIds = await User.find({ role: 'employee' }).distinct('_id');
      query.user = { $in: employeeIds };
    }

    const records = await Attendance.find(query)
      .sort({ date: -1 })
      .populate('user', 'name email department')
      .lean();
    const csvCell = (value) => {
      let cell = String(value ?? '');
      if (/^[\t\r ]*[=+\-@]/.test(cell)) cell = `'${cell}`;
      return `"${cell.replace(/"/g, '""')}"`;
    };
    const breakSummary = (record) => {
      const sessions = Array.isArray(record.breakSessions) ? record.breakSessions : [];
      if (!sessions.length) {
        if (record.breakIn && record.breakOut) {
          return `${record.breakIn.toISOString()}|${record.breakOut.toISOString()}`;
        }
        return '';
      }
      return sessions.map((session) => {
        const start = session.start ? new Date(session.start).toISOString() : '';
        const end = session.end ? new Date(session.end).toISOString() : 'Open';
        return `${start}|${end}`;
      }).join('; ');
    };
    const rows = [
      ['Employee', 'Email', 'Department', 'Date', 'Check In', 'Break Sessions', 'Check Out', 'Total Work Minutes'],
      ...records.filter((record) => record.user).map((record) => [
        record.user.name,
        record.user.email,
        record.user.department,
        record.date,
        record.checkIn ? record.checkIn.toISOString() : '',
        breakSummary(record),
        record.checkOut ? record.checkOut.toISOString() : '',
        record.totalWorkMinutes,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const filename = `attendance-${from || 'all'}-to-${to || 'all'}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Could not export attendance report', error: err.message });
  }
});

// PATCH /api/attendance/team/records/:recordId -> admin corrects attendance times
router.patch('/team/records/:recordId', adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.recordId)) {
      return res.status(400).json({ message: 'Invalid attendance record id' });
    }

    const timeFields = ['checkIn', 'checkOut'];
    const times = {};
    for (const field of timeFields) {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) {
        return res.status(400).json({ message: `The ${field} field is required` });
      }
      const value = req.body[field];
      if (value === null || value === '') {
        times[field] = null;
      } else if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
        times[field] = new Date(value);
      } else {
        return res.status(400).json({ message: `Invalid ${field} time` });
      }
    }

    let breakSessions;
    if (Array.isArray(req.body.breakSessions)) {
      breakSessions = [];
      for (const [index, session] of req.body.breakSessions.entries()) {
        if (!session || typeof session !== 'object' || typeof session.start !== 'string'
          || Number.isNaN(Date.parse(session.start))) {
          return res.status(400).json({ message: `Invalid start time for break ${index + 1}` });
        }
        let end = null;
        if (session.end !== null && session.end !== '') {
          if (typeof session.end !== 'string' || Number.isNaN(Date.parse(session.end))) {
            return res.status(400).json({ message: `Invalid end time for break ${index + 1}` });
          }
          end = new Date(session.end);
        }
        breakSessions.push({ start: new Date(session.start), end });
      }
    } else {
      const legacyFields = ['breakIn', 'breakOut'];
      for (const field of legacyFields) {
        if (!Object.prototype.hasOwnProperty.call(req.body, field)) {
          return res.status(400).json({ message: `The ${field} field is required` });
        }
        const value = req.body[field];
        if (value === null || value === '') {
          times[field] = null;
        } else if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
          times[field] = new Date(value);
        } else {
          return res.status(400).json({ message: `Invalid ${field} time` });
        }
      }
      breakSessions = times.breakIn || times.breakOut
        ? [{ start: times.breakIn || times.checkIn, end: times.breakOut }]
        : [];
    }

    if ((breakSessions.length || times.checkOut) && !times.checkIn) {
      return res.status(400).json({ message: 'Check in time is required before breaks or check out' });
    }
    if (times.checkIn && times.checkOut && times.checkOut < times.checkIn) {
      return res.status(400).json({ message: 'Check out must be after check in' });
    }
    if (breakSessions.filter((session) => !session.end).length > 1) {
      return res.status(400).json({ message: 'Only one break can be active at a time' });
    }
    if (breakSessions.some((session, index) => {
      const previousEnd = index === 0 ? times.checkIn : breakSessions[index - 1].end;
      return (previousEnd && session.start < previousEnd)
        || (session.end && session.end < session.start)
        || (session.end && times.checkOut && session.end > times.checkOut)
        || (!session.end && (index !== breakSessions.length - 1 || times.checkOut));
    })) {
      return res.status(400).json({ message: 'Break times must be chronological, non-overlapping, and within the attendance shift' });
    }

    const record = await Attendance.findById(req.params.recordId).populate({
      path: 'user',
      match: { role: 'employee' },
      select: 'name email department',
    });
    if (!record || !record.user) {
      return res.status(404).json({ message: 'Employee attendance record not found' });
    }

    const before = {
      checkIn: record.checkIn,
      breakIn: record.breakIn,
      breakOut: record.breakOut,
      checkOut: record.checkOut,
      breakSessions: normalizeBreakSessions(record).breakSessions,
      totalWorkMinutes: record.totalWorkMinutes,
    };

    Object.assign(record, times);
    record.breakSessions = breakSessions;
    normalizeBreakSessions(record);
    record.totalWorkMinutes = calculateTotalMinutes(record);

    const audit = await AttendanceAudit.create({
      attendance: record._id,
      employee: record.user._id,
      admin: req.user.id,
      date: record.date,
      before,
      after: {
        checkIn: record.checkIn,
        breakIn: record.breakIn,
        breakOut: record.breakOut,
        checkOut: record.checkOut,
        breakSessions: record.breakSessions || [],
        totalWorkMinutes: record.totalWorkMinutes,
      },
    });
    try {
      await record.save();
    } catch (saveError) {
      try {
        await AttendanceAudit.deleteOne({ _id: audit._id });
      } catch (auditCleanupError) {
        console.error('Failed to remove attendance audit after record save failed:', auditCleanupError);
      }
      throw saveError;
    }
    res.json({ message: 'Attendance times updated', record });
  } catch (err) {
    res.status(500).json({ message: 'Could not update attendance times', error: err.message });
  }
});

// GET /api/attendance/team/:userId/history -> an employee's attendance history (admin only)
router.get('/team/:userId/history', adminOnly, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.userId)) {
      return res.status(400).json({ message: 'Invalid employee id' });
    }

    const employee = await User.findOne({ _id: req.params.userId, role: 'employee' })
      .select('name email department')
      .lean();
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 90)
      : 30;
    const records = await Attendance.find({ user: employee._id })
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    res.json({ employee, records });
  } catch (err) {
    res.status(500).json({ message: 'Could not load employee history', error: err.message });
  }
});

module.exports = router;
