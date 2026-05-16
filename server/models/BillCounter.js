import mongoose from "mongoose";

const billCounterSchema = new mongoose.Schema({
  mode: {
    type: String,
    enum: ["CASH", "ADVANCE", "CREDIT"],
    required: true,
    index: true
  },
  currentNumber: {
    type: Number,
    default: 0,
    min: 0
  },
  prefix: {
    type: String,
    trim: true,
    default: ""
  },
  financialYear: {
    type: String,
    trim: true,
    required: true,
    index: true
  }
}, { timestamps: true });

billCounterSchema.index({ mode: 1, financialYear: 1 }, { unique: true });

const BillCounter = mongoose.model("BillCounter", billCounterSchema);
export default BillCounter;
