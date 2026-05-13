import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../app/axios";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { getApiErrorMessage } from "../../utils/api";
import { notifyError, notifySuccess } from "../../utils/notify";

const ForgotPassword = () => {
    const [username, setUsername] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const { data } = await api.post("/auth/forgot-password", { username });

            notifySuccess(`Reset token sent: ${data.resetToken}`);
            setUsername("");
            navigate("/reset-password");
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
                    <h2 className="auth-panel__title">Forgot Password</h2>
                    <p className="auth-panel__subtitle">Enter the username to request a reset token.</p>
                </div>
                <label className="app-field">
                    <span className="app-field__label">Username</span>
                    <Input
                    type="text"
                    placeholder="Enter Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    />
                </label>
                <Button type="submit" className="auth-panel__submit">Send Reset Link</Button>
                <div className="auth-panel__links">
                    <Link to="/login">Back to login</Link>
                </div>
            </form>
        </div>
    );
};

export default ForgotPassword;
