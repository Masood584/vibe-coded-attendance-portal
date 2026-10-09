const mongoose = require('mongoose');

const auditBreakSessionSchema = new mongoose.Schema(
  {
    start: { type: Date, required: true },
    end: { type: Date, default: null },
  },
  { _id: false }
);

const attendanceTimesSchema = new mongoose.Schema(
  {
    checkIn: { type: Date, default: null },
    breakIn: { type: Date, default: null },
    breakOut: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    breakSessions: { type: [auditBreakSessionSchema], default: [] },
    totalWorkMinutes: { type: Number, default: 0 },
  },
  { _id: false }
);

const attendanceAuditSchema = new mongoose.Schema(
  {
    attendance: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendance', required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    before: { type: attendanceTimesSchema, required: true },
    after: { type: attendanceTimesSchema, required: true },
  },
  { timestamps: true }
);

attendanceAuditSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AttendanceAudit', attendanceAuditSchema);
