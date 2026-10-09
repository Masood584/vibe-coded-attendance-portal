const mongoose = require('mongoose');

const breakSessionSchema = new mongoose.Schema(
  {
    start: { type: Date, required: true },
    end: { type: Date, default: null },
  },
  { _id: false }
);

// One document per user per day (date stored as YYYY-MM-DD string, easy to query)
const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // e.g. "2026-09-08"
    checkIn: { type: Date, default: null },
    breakIn: { type: Date, default: null },
    breakOut: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    breakSessions: { type: [breakSessionSchema], default: [] },
    totalWorkMinutes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
