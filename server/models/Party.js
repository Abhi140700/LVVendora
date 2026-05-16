import mongoose from "mongoose";

const partySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  partyType: {
    type: String,
    enum: ["party", "customer", "transporter", "supplierAgent", "firm", "salesman", "warehouse"],
    default: "party",
    index: true
  },
  customerType: {
    type: String,
    enum: ["retail", "wholesale", "vip"],
    default: "retail",
    index: true
  },
  creditLimit: {
    type: Number,
    default: 0,
    min: 0
  },
  segmentTags: {
    type: [String],
    default: []
  },
  loyaltyCardNo: {
    type: String,
    trim: true,
    index: true
  },
  loyaltyAppliedAt: {
    type: Date
  },
  loyaltyEnrollmentFee: {
    type: Number,
    default: 0,
    min: 0
  },
  loyaltyOpeningPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  salesmanCode: {
    type: Number,
    sparse: true,
    index: true
  },
  contactPerson: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true,
    index: true
  },
  location: {
    type: String,
    trim: true
  },
  dateOfBirth: {
    type: Date
  },
  anniversary: {
    type: Date
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  addressLine1: {
    type: String,
    trim: true
  },
  addressLine2: {
    type: String,
    trim: true
  },
  city: {
    type: String,
    trim: true
  },
  state: {
    type: String,
    trim: true
  },
  stateCode: {
    type: String,
    trim: true
  },
  pincode: {
    type: String,
    trim: true
  },
  gstNo: {
    type: String,
    trim: true,
    uppercase: true
  },
  bankName: {
    type: String,
    trim: true
  },
  bankBranch: {
    type: String,
    trim: true
  },
  accountNo: {
    type: String,
    trim: true
  },
  ifsc: {
    type: String,
    trim: true,
    uppercase: true
  },
  notes: {
    type: String,
    trim: true
  },
  whatsappOptIn: {
    type: Boolean,
    default: true
  },
  ledgerBalance: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

partySchema.index({ name: 1, partyType: 1 }, { unique: true });

const Party = mongoose.model("Party", partySchema);
export default Party;
