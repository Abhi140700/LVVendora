import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import lvVendoraMark from "../../assets/img/lv-vendora-mark.png";
import useAppSettings from "../../hooks/useAppSettings";
import { getCompanyAcronym } from "../../utils/appSettings";
import { filterSidebarSections, getCurrentRole } from "../../utils/permissions";
import { sidebarSections } from "./sidebarConfig";

function isActivePath(item, pathname) {
  if (item.path) return item.path === pathname;
  return item.children?.some((child) => child.path === pathname);
}

export default function Sidebar({ collapsed, mobileOpen, onToggle, onNavigate }) {
  const { pathname } = useLocation();
  const appSettings = useAppSettings();
  const role = getCurrentRole();
  const companyName = appSettings.companyName || "LVVendora";
  const companyAcronym = getCompanyAcronym(companyName);
  const visibleSections = useMemo(() => filterSidebarSections(sidebarSections, role), [role]);
  const initialOpen = useMemo(() => {
    const open = {};
    visibleSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.children?.some((child) => child.path === pathname)) open[item.id] = true;
      });
    });
    return open;
  }, [pathname, visibleSections]);
  const [openMenus, setOpenMenus] = useState(initialOpen);

  const toggleMenu = (id) => setOpenMenus((current) => ({ ...current, [id]: !current[id] }));

  return (
    <aside id="sidebar" className={`sidebar${collapsed ? " collapsed" : ""}${mobileOpen ? " show" : ""}`}>
      <div className="sidebar-brand">
        <NavLink to="/" className="app-brand" onClick={onNavigate}>
          <span className="app-brand-logo">
            <img src={lvVendoraMark} alt={companyName} />
          </span>
          <span className="app-brand-text" title={companyName}>{companyAcronym}</span>
        </NavLink>
        <button className="sidebar-toggle" id="toggle-btn" type="button" onClick={onToggle} aria-label="Toggle sidebar">
          <i className="bx bx-chevron-left"></i>
        </button>
      </div>

      <div className="sidebar-menu">
        {visibleSections.map((section, sectionIndex) => (
          <div key={`${section.header}-${sectionIndex}`}>
            <div className="menu-header">{section.header}</div>
            {section.items.map((item) => {
              const active = isActivePath(item, pathname);

              if (item.children) {
                const open = Boolean(openMenus[item.id]);
                return (
                  <div key={item.id}>
                    <button
                      type="button"
                      className={`menu-item menu-dropdown-toggle${active ? " active" : ""}`}
                      aria-expanded={open}
                      aria-controls={item.id}
                      onClick={() => toggleMenu(item.id)}
                    >
                      <i className={item.icon}></i>
                      <span className="menu-text">{item.label}</span>
                      <i className="bx bx-chevron-down menu-arrow"></i>
                    </button>
                    <div className={`menu-dropdown${open ? " open" : ""}`} id={item.id}>
                      <div className="submenu">
                        {item.children.map((child) => (
                          <NavLink
                            key={child.path}
                            to={child.path}
                            onClick={onNavigate}
                            className={`menu-item${child.path === pathname ? " active" : ""}`}
                          >
                            {child.label}
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <NavLink key={item.path} to={item.path} onClick={onNavigate} className={`menu-item${active ? " active" : ""}`}>
                  <i className={item.icon}></i>
                  <span className="menu-text">{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}
