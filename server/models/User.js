import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ["superadmin", "admin", "sales", "stock", "accountant", "manager"],
        default: "sales"
    },
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    tokenVersion: {
        type: Number,
        default: 0
    },
    passwordResetTokenHash: {
        type: String,
        default: ""
    },
    passwordResetExpiresAt: {
        type: Date,
        default: null
    },
    passwordResetUsedAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Password hash before save
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to check password
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;
