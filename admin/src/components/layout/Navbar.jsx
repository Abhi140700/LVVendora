import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../app/axios";

const severityClass = {
  danger: "text-danger",
  warning: "text-warning",
  success: "text-success",
  info: "text-primary",
  primary: "text-primary",
};

const relativeTime = (value) => {
  const date = value ? new Date(value) : new Date();
  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export default function Navbar({ onOpenSidebar, onOpenSearch }) {
  const navigate = useNavigate();
  const [notificationFeed, setNotificationFeed] = useState({
    unreadCount: 0,
    items: [],
    channels: { system: true, email: false, sms: false, whatsapp: false },
  });

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const { data: payload } = await api.get("/notifications");
        if (active) {
          setNotificationFeed(payload.data || { unreadCount: 0, items: [] });
        }
      } catch {
        if (active) {
          setNotificationFeed((current) => ({ ...current, unreadCount: 0, items: [] }));
        }
      }
    };

    loadNotifications();
    const interval = window.setInterval(loadNotifications, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    navigate("/login", { replace: true });
  };

  return (
    <nav className="navbar-custom">
                      <button className="mobile-menu-btn" type="button" onClick={onOpenSidebar} aria-label="Open sidebar">
                          <i className="bx bx-menu"></i>
                      </button>
                      <button className="search-wrapper" type="button" onClick={onOpenSearch} data-global-search-open>
                          <i className="bx bx-search"></i>
                          <span>Search [CTRL + K]</span>
                      </button>
                      <div className="nav-right">
                          <ul className="navbar-nav flex-row align-items-center ms-md-auto">
                              <li className="nav-item dropdown-language navbar-dropdown dropdown me-2 me-xl-0">
                                  <button className="nav-link dropdown-toggle hide-arrow navbar-icon-btn" type="button" data-bs-toggle="dropdown" aria-label="Language">
                                      <i className="icon-base bx bx-globe icon-md"></i>
                                  </button>
                                  <ul className="dropdown-menu dropdown-menu-end navbar-menu navbar-language-menu">
                                      <li><button className="dropdown-item active" type="button" data-language="en" data-text-direction="ltr"><span>English</span><i className="bx bx-check"></i></button></li>
                                      <li><button className="dropdown-item" type="button" data-language="fr" data-text-direction="ltr"><span>French</span></button></li>
                                      <li><button className="dropdown-item" type="button" data-language="ar" data-text-direction="rtl"><span>Arabic</span></button></li>
                                      <li><button className="dropdown-item" type="button" data-language="de" data-text-direction="ltr"><span>German</span></button></li>
                                  </ul>
                              </li>
                              <li className="nav-item dropdown navbar-dropdown me-2 me-xl-0">
                                  <button className="nav-link dropdown-toggle hide-arrow navbar-icon-btn" id="nav-theme" type="button" data-bs-toggle="dropdown" aria-label="Toggle theme">
                                      <i className="bx bx-sun icon-base icon-md theme-icon-active"></i>
                                      <span className="d-none ms-2" id="nav-theme-text">Toggle theme</span>
                                  </button>
                                  <ul className="dropdown-menu dropdown-menu-end navbar-menu navbar-theme-menu" aria-labelledby="nav-theme-text">
                                      <li><button type="button" className="dropdown-item active" data-bs-theme-value="light" aria-pressed="true"><i className="bx bx-sun"></i><span>Light</span><i className="bx bx-check ms-auto"></i></button></li>
                                      <li><button type="button" className="dropdown-item" data-bs-theme-value="dark" aria-pressed="false"><i className="bx bx-moon"></i><span>Dark</span></button></li>
                                      <li><button type="button" className="dropdown-item" data-bs-theme-value="system" aria-pressed="false"><i className="bx bx-desktop"></i><span>System</span></button></li>
                                  </ul>
                              </li>
                              <li className="nav-item navbar-dropdown me-2 me-xl-0">
                                  <button className="nav-link hide-arrow navbar-icon-btn" type="button" data-fullscreen-toggle aria-label="Toggle fullscreen">
                                      <i className="bx bx-fullscreen icon-base icon-md"></i>
                                  </button>
                              </li>
                              <li className="nav-item dropdown-shortcuts navbar-dropdown dropdown me-2 me-xl-0">
                                  <button className="nav-link dropdown-toggle hide-arrow navbar-icon-btn" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false" aria-label="Shortcuts">
                                      <i className="icon-base bx bx-grid-alt icon-md"></i>
                                  </button>
                                  <div className="dropdown-menu dropdown-menu-end p-0 navbar-panel navbar-shortcuts-panel">
                                      <div className="dropdown-menu-header border-bottom">
                                          <div className="dropdown-header d-flex align-items-center">
                                              <div>
                                                  <h6 className="mb-0">Shortcuts</h6>
                                                  <small>Fast access to daily workspaces</small>
                                              </div>
                                              <Link to="/settings" className="navbar-header-action ms-auto" aria-label="Manage shortcuts"><i className="bx bx-cog"></i></Link>
                                          </div>
                                      </div>
                                      <div className="dropdown-shortcuts-list">
                                          <Link className="dropdown-shortcuts-item" to="/sales/pos"><span className="dropdown-shortcuts-icon"><i className="bx bx-store-alt"></i></span><span><strong>POS Billing</strong><small>Fast counter billing</small></span></Link>
                                          <Link className="dropdown-shortcuts-item" to="/sales/invoice"><span className="dropdown-shortcuts-icon"><i className="bx bx-receipt"></i></span><span><strong>Sales Invoice</strong><small>GST invoice desk</small></span></Link>
                                          <Link className="dropdown-shortcuts-item" to="/label-printing"><span className="dropdown-shortcuts-icon"><i className="bx bx-printer"></i></span><span><strong>Label Printing</strong><small>Barcode queue</small></span></Link>
                                          <Link className="dropdown-shortcuts-item" to="/manage-receive"><span className="dropdown-shortcuts-icon"><i className="bx bx-package"></i></span><span><strong>Manage Receive</strong><small>Inward release</small></span></Link>
                                          <Link className="dropdown-shortcuts-item" to="/accounting/cash-book"><span className="dropdown-shortcuts-icon"><i className="bx bx-wallet"></i></span><span><strong>Cash Book</strong><small>Day end cash</small></span></Link>
                                          <Link className="dropdown-shortcuts-item" to="/reports"><span className="dropdown-shortcuts-icon"><i className="bx bx-bar-chart-alt-2"></i></span><span><strong>Reports</strong><small>Business reports</small></span></Link>
                                      </div>
                                  </div>
                              </li>
                              <li className="nav-item dropdown-notifications navbar-dropdown dropdown me-3 me-xl-2">
                                  <button className="nav-link dropdown-toggle hide-arrow navbar-icon-btn" type="button" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false" aria-label="Notifications">
                                      <span className="position-relative"><i className="icon-base bx bx-bell icon-md"></i>{notificationFeed.unreadCount > 0 ? <span className="badge rounded-pill bg-danger badge-dot badge-notifications border"></span> : null}</span>
                                  </button>
                                  <ul className="dropdown-menu dropdown-menu-end p-0 navbar-panel navbar-notifications-panel">
                                      <li className="dropdown-menu-header border-bottom">
                                          <div className="dropdown-header d-flex align-items-center">
                                              <div>
                                                  <h6 className="mb-0">Notifications</h6>
                                                  <small>System alerts and task reminders</small>
                                              </div>
                                              <span className="badge bg-label-primary ms-auto">{notificationFeed.unreadCount} New</span>
                                          </div>
                                      </li>
                                      <li className="dropdown-notifications-list">
                                          {notificationFeed.items?.length ? notificationFeed.items.map((notification) => (
                                            <button className="dropdown-item dropdown-notification-item" type="button" key={notification.id} onClick={() => navigate(notification.to || "/dashboard")}>
                                              <span className={`navbar-event-icon ${severityClass[notification.severity] || "text-primary"}`}><i className={notification.icon || "bx bx-bell"}></i></span>
                                              <span>
                                                <strong>{notification.title}</strong>
                                                <small>{notification.message}</small>
                                                <em>{relativeTime(notification.createdAt)}</em>
                                              </span>
                                            </button>
                                          )) : (
                                            <button className="dropdown-item dropdown-notification-item" type="button" onClick={() => navigate("/dashboard")}>
                                              <span className="navbar-event-icon text-success"><i className="bx bx-check-circle"></i></span>
                                              <span><strong>No urgent alerts</strong><small>Your system notification feed is clear.</small><em>now</em></span>
                                            </button>
                                          )}
                                      </li>
                                      <li className="border-top"><Link className="dropdown-item navbar-footer-link" to="/dashboard">View dashboard alerts</Link></li>
                                  </ul>
                              </li>
                              <li className="nav-item navbar-dropdown dropdown-user dropdown">
                                  <button className="nav-link dropdown-toggle hide-arrow p-0" type="button" data-bs-toggle="dropdown" aria-label="User menu">
                                      <div className="avatar avatar-online">
                                          <img className="avatar-img" src="https://ui-avatars.com/api/?name=User&background=696cff&color=fff&rounded=true" width="38" height="38" alt="User" />
                                      </div>
                                  </button>
                                  <ul className="dropdown-menu dropdown-menu-end navbar-menu navbar-user-menu">
                                      <li><Link className="dropdown-item navbar-user-card" to="/settings/company"><img className="avatar-img" src="https://ui-avatars.com/api/?name=User&background=696cff&color=fff&rounded=true" width="40" height="40" alt="" /><span><strong>John Doe</strong><small>Admin</small></span></Link></li>
                                      <li><div className="dropdown-divider"></div></li>
                                      <li><Link className="dropdown-item" to="/masters/party"><i className="bx bx-user"></i><span>My Profile</span></Link></li>
                                      <li><Link className="dropdown-item" to="/settings/company"><i className="bx bx-cog"></i><span>Settings</span></Link></li>
                                      <li><Link className="dropdown-item" to="/accounting/payment-entry"><i className="bx bx-credit-card"></i><span>Billing Plan</span><span className="badge rounded-pill bg-danger ms-auto">4</span></Link></li>
                                      <li><div className="dropdown-divider"></div></li>
                                      <li><Link className="dropdown-item" to="/reports/profit-loss"><i className="bx bx-rupee"></i><span>Pricing</span></Link></li>
                                      <li><Link className="dropdown-item" to="/reports"><i className="bx bx-help-circle"></i><span>FAQ</span></Link></li>
                                      <li><div className="dropdown-divider"></div></li>
                                      <li><button className="dropdown-item text-danger" type="button" onClick={logout}><i className="bx bx-power-off"></i><span>Log Out</span></button></li>
                                  </ul>
                              </li>
                          </ul>
                      </div>
                  </nav>
  );
}
