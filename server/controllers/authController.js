import User from "../models/User.js";
import generateToken from "../config/jwt.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const RESET_TOKEN_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 15);

const hashResetToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const createResetToken = () => crypto.randomBytes(32).toString("hex");

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ message: "Invalid username or password" });

        const isMatch = await user.matchPassword(password);
        if (!isMatch) return res.status(401).json({ message: "Invalid username or password" });

        res.json({
            _id: user._id,
            username: user.username,
            role: user.role,
            token: generateToken(user._id, user.role, user.tokenVersion)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// @desc    Forgot password (generate reset token)
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
    try {
        const username = String(req.body.username || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const user = await User.findOne(username ? { username } : { email });

        if (!user) {
            return res.json({
                success: true,
                message: "If the account exists, a password reset message will be sent."
            });
        }

        const resetToken = createResetToken();
        user.passwordResetTokenHash = hashResetToken(resetToken);
        user.passwordResetExpiresAt = new Date(Date.now() + (RESET_TOKEN_TTL_MINUTES * 60 * 1000));
        user.passwordResetUsedAt = null;
        await user.save();

        const response = {
            success: true,
            message: "Password reset initiated. Complete delivery via email or OTP provider.",
            expiresAt: user.passwordResetExpiresAt,
        };

        if (process.env.NODE_ENV !== "production") {
            response.resetToken = resetToken;
        }

        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ message: "Token and new password are required" });
        }

        const tokenHash = hashResetToken(token);
        const user = await User.findOne({
            passwordResetTokenHash: tokenHash,
            passwordResetExpiresAt: { $gt: new Date() },
            passwordResetUsedAt: null
        });
        if (!user) return res.status(400).json({ message: "Invalid or expired reset token" });

        user.password = newPassword;
        user.tokenVersion = Number(user.tokenVersion || 0) + 1;
        user.passwordResetUsedAt = new Date();
        user.passwordResetTokenHash = "";
        user.passwordResetExpiresAt = null;
        await user.save();

        res.json({ message: "Password reset successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error" });
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
export const logout = async (req, res) => {
    res.json({ success: true, message: "Logged out successfully" });
};
