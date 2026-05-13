import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../app/axios";
import lvVendoraLockup from "../../assets/img/lvvendora-dark.png";
import { getApiErrorMessage } from "../../utils/api";
import { notifyError } from "../../utils/notify";

const Login = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (event) => {
        event.preventDefault();
        setLoading(true);

        try {
            const { data } = await api.post("/auth/login", { username, password });

            localStorage.setItem("token", data.token);
            localStorage.setItem("role", data.role);
            localStorage.setItem("username", data.username || username);
            localStorage.setItem("rememberLogin", remember ? "true" : "false");

            navigate("/");
        } catch (error) {
            console.error(error);
            notifyError(getApiErrorMessage(error, "Server error"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-shell auth-page">
            <span className="auth-pattern auth-pattern-top" aria-hidden="true" />
            <span className="auth-pattern auth-pattern-bottom" aria-hidden="true" />

            <section className="auth-card" aria-labelledby="login-title">
                <Link className="auth-brand auth-brand--lvvendora" to="/" aria-label="LVVendora dashboard">
                    <img className="auth-brand-lockup" src={lvVendoraLockup} alt="LVVendora" />
                </Link>

                <h1 className="auth-title" id="login-title">Welcome to LVVendora!</h1>
                <p className="auth-subtitle">Smart POS. Smart Business.</p>

                <form className="auth-form" onSubmit={handleLogin}>
                    <div className="auth-field">
                        <label className="auth-label" htmlFor="login-email">Email or Username</label>
                        <input
                            className="form-control auth-control"
                            id="login-email"
                            type="text"
                            placeholder="Enter your email or username"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                            autoFocus
                            required
                        />
                    </div>

                    <div className="auth-field">
                        <label className="auth-label" htmlFor="login-password">Password</label>
                        <div className="auth-input-group">
                            <input
                                className="form-control"
                                id="login-password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                aria-describedby="password-toggle"
                                required
                            />
                            <button
                                className="auth-password-toggle"
                                id="password-toggle"
                                type="button"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                onClick={() => setShowPassword((current) => !current)}
                            >
                                <i className={showPassword ? "bx bx-show" : "bx bx-hide"} />
                            </button>
                        </div>
                    </div>

                    <div className="auth-options">
                        <label className="auth-check">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                checked={remember}
                                onChange={(event) => setRemember(event.target.checked)}
                            />
                            <span>Remember Me</span>
                        </label>
                        <Link className="auth-link" to="/forgot-password">Forgot Password?</Link>
                    </div>

                    <button className="auth-submit" type="submit" disabled={loading}>
                        {loading ? "Logging in..." : "Login"}
                    </button>
                </form>
            </section>

            <a className="auth-buy-now" href="#buy-now">Buy Now</a>
        </main>
    );
};

export default Login;
