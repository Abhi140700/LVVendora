import mongoose from "mongoose";

const posSessionSchema = new mongoose.Schema({
  sessionNo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  status: {
    type: String,
    enum: ["open", "closed"],
    default: "open"
  },
  openedAt: {
    type: Date,
    default: Date.now
  },
  businessDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  lastDayEndDate: {
    type: Date
  },
  lastDayEndAt: {
    type: Date
  },
  closedAt: {
    type: Date
  },
  openingCash: {
    type: Number,
    default: 0
  },
  closingCash: {
    type: Number,
    default: 0
  },
  expectedCash: {
    type: Number,
    default: 0
  },
  cashDifference: {
    type: Number,
    default: 0
  },
  expenseAmount: {
    type: Number,
    default: 0
  },
  expenseNote: {
    type: String,
    trim: true,
    default: ""
  },
  openedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

posSessionSchema.index({ openedBy: 1, status: 1, openedAt: -1 });

const POSSession = mongoose.model("POSSession", posSessionSchema);
export default POSSession;
