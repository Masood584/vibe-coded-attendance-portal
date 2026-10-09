const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    reason: { type: String, required: true, trim: true, maxlength: 500 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ employee: 1, startDate: 1, endDate: 1, status: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
