import mongoose from "mongoose";

const tallySyncLogSchema = new mongoose.Schema({
  runType: {
    type: String,
    enum: ["prepare", "export-json", "export-xml"],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ["success", "failed"],
    required: true,
    index: true
  },
  summary: {
    type: String,
    trim: true,
    required: true
  },
  detail: {
    type: String,
    trim: true,
    default: ""
  },
  counts: {
    sales: { type: Number, default: 0 },
    purchases: { type: Number, default: 0 },
    ledgerEntries: { type: Number, default: 0 },
    cashEntries: { type: Number, default: 0 }
  },
  exportedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

const TallySyncLog = mongoose.model("TallySyncLog", tallySyncLogSchema);
export default TallySyncLog;
