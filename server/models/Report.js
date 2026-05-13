import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  reportType: {
    type: String,
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  payload: {
    type: Object,
    default: {}
  }
}, { timestamps: true });

const Report = mongoose.model("Report", reportSchema);
export default Report;
