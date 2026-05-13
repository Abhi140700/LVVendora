import mongoose from "mongoose";

const inventorySchema = new mongoose.Schema({
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Item",
    required: false,
    index: true
  },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
    index: true
  },

  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Brand",
    index: true
  },

  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },

  barcode: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },

  mrp: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isFinite,
      message: '{VALUE} is not a valid number'
    }
  },

  unit: {
    type: String,
    default: "PC"
  },

  stock: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isFinite,
      message: '{VALUE} is not a valid number'
    }
  },

  purchaseRate: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isFinite,
      message: '{VALUE} is not a valid number'
    }
  },

  sellingRate: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isFinite,
      message: '{VALUE} is not a valid number'
    }
  },

  lastPurchaseDate: {
    type: Date
  },

  // advanced tracking
  avgPurchaseRate: {
    type: Number,
    default: 0,
    validate: {
      validator: Number.isFinite,
      message: '{VALUE} is not a valid number'
    }
  },

  stockValue: {
    type: Number,
    default: 0,
    validate: {
      validator: Number.isFinite,
      message: '{VALUE} is not a valid number'
    }
  },

  locationStock: {
    type: Map,
    of: Number,
    default: {}
  }

}, { timestamps: true });

inventorySchema.index({ itemId: 1, category: 1, brand: 1, barcode: 1 });

const Inventory = mongoose.model("Inventory", inventorySchema);
export default Inventory;
