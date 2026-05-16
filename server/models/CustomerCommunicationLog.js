import mongoose from "mongoose";

const customerCommunicationLogSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Party",
    index: true
  },
  customerName: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true,
    index: true
  },
  channel: {
    type: String,
    enum: ["system", "email", "sms", "whatsapp", "call", "note"],
    default: "system",
    index: true
  },
  direction: {
    type: String,
    enum: ["inbound", "outbound", "internal"],
    default: "outbound"
  },
  category: {
    type: String,
    enum: ["bill", "broadcast", "payment", "loyalty", "service", "note"],
    default: "note",
    index: true
  },
  status: {
    type: String,
    enum: ["success", "failed", "pending"],
    default: "success",
    index: true
  },
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Sales",
    index: true
  },
  billNo: {
    type: String,
    trim: true
  },
  invoiceNo: {
    type: String,
    trim: true
  },
  message: {
    type: String,
    trim: true
  },
  error: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

customerCommunicationLogSchema.index({ customerId: 1, createdAt: -1 });
customerCommunicationLogSchema.index({ customerPhone: 1, createdAt: -1 });

const CustomerCommunicationLog = mongoose.model("CustomerCommunicationLog", customerCommunicationLogSchema);
export default CustomerCommunicationLog;
