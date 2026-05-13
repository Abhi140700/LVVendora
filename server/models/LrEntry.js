import mongoose from "mongoose";

const lrEntrySchema = new mongoose.Schema({
  lrId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  lrNo: {
    type: String,
    trim: true,
    default: ""
  },
  bale: {
    type: Number,
    default: 0
  },
  godown: {
    type: String,
    trim: true,
    default: ""
  },
  transporter: {
    type: String,
    trim: true,
    default: ""
  },
  partyName: {
    type: String,
    trim: true,
    default: ""
  },
  inwardDate: {
    type: Date
  },
  hundekari: {
    type: String,
    trim: true,
    default: ""
  },
  transportCharges: {
    type: Number,
    default: 0
  },
  hamaliCharges: {
    type: Number,
    default: 0
  },
  narration: {
    type: String,
    trim: true,
    default: ""
  },
  firmName: {
    type: String,
    trim: true,
    default: ""
  },
  billNo: {
    type: String,
    trim: true,
    default: ""
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

const LrEntry = mongoose.model("LrEntry", lrEntrySchema);
export default LrEntry;
