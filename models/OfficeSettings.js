const mongoose = require('mongoose');

const officeSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    officeStartTime: { type: String, default: '09:00' },
    officeEndTime: { type: String, default: '17:00' },
    graceMinutes: { type: Number, default: 0, min: 0, max: 180 },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OfficeSettings', officeSettingsSchema);
