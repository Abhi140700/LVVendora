import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../app/axios";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { getApiErrorMessage } from "../../utils/api";
import { notifyError, notifySuccess } from "../../utils/notify";

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [token, setToken] = useState(() => searchParams.get("token") || "");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!token.trim()) {
            notifyError("Reset token is required");
            return;
        }

        if (newPassword !== confirmPassword) {
            notifyError("Passwords do not match");
            return;
        }

        try {
            await api.post("/auth/reset-password", { token: token.trim(), newPassword });

            notifySuccess("Password reset successfully!");
            navigate("/login");
        } catch (err) {
            console.error(err);
            notifyError(getApiErrorMessage(err, "Server error"));
        }
    };

    return (
        <div className="auth-layout auth-layout--single">
            <form onSubmit={handleSubmit} className="auth-panel app-card">
                <div className="auth-panel__top">
                    <span className="auth-panel__eyebrow">Recovery</span>
                    <h2 className="auth-panel__title">Reset Password</h2>
                    <p className="auth-panel__subtitle">Use the reset token and set a new password for the account.</p>
                </div>
                <label className="app-field">
                    <span className="app-field__label">Reset Token</span>
                    <Input
                    type="text"
                    placeholder="Reset token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    required
                    />
                </label>
                <label className="app-field">
                    <span className="app-field__label">New Password</span>
                    <Input
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    />
                </label>
                <label className="app-field">
                    <span className="app-field__label">Confirm Password</span>
                    <Input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    />
                </label>
                <Button type="submit" className="auth-panel__submit">Reset Password</Button>
                <div className="auth-panel__links">
                    <Link to="/login">Back to login</Link>
                </div>
            </form>
        </div>
    );
};

export default ResetPassword;
