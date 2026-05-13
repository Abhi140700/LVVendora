import { useEffect, useState } from "react";

const defaultConfig = {
  primaryColor: "#696cff",
  theme: "light",
  skin: "default",
  menu: "expanded",
  navbar: "sticky",
  content: "compact",
  direction: "ltr",
  semiDark: false,
};

const storageKey = "app_template_customizer_v3";

function readSettings() {
  try {
    return { ...defaultConfig, ...(JSON.parse(localStorage.getItem(storageKey)) || {}) };
  } catch {
    return defaultConfig;
  }
}

function hexToRgb(hex) {
  const cleanHex = hex.replace("#", "");
  const bigint = parseInt(cleanHex, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

export default function TemplateCustomizer({ onMenuModeChange }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(readSettings);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(state));
    const html = document.documentElement;
    const body = document.body;
    const rgb = hexToRgb(state.primaryColor);

    html.setAttribute("dir", state.direction);
    html.setAttribute("data-bs-theme", state.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : state.theme);
    html.style.setProperty("--app-primary", state.primaryColor);
    html.style.setProperty("--app-primary-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    html.style.setProperty("--primary", state.primaryColor);
    html.style.setProperty("--primary-hover", state.primaryColor);
    html.style.setProperty("--primary-light", `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.16)`);

    body.classList.toggle("navbar-sticky", state.navbar === "sticky");
    body.classList.toggle("navbar-static", state.navbar === "static");
    body.classList.toggle("navbar-hidden", state.navbar === "hidden");
    body.classList.toggle("content-compact", state.content === "compact");
    body.classList.toggle("content-wide", state.content === "wide");
    body.classList.toggle("skin-default", state.skin === "default");
    body.classList.toggle("skin-bordered", state.skin === "bordered");
    body.classList.toggle("semi-dark", Boolean(state.semiDark));
    onMenuModeChange?.(state.menu);
  }, [state, onMenuModeChange]);

  const setOption = (key, value) => setState((current) => ({ ...current, [key]: value }));
  const reset = () => {
    localStorage.removeItem(storageKey);
    setState(defaultConfig);
  };

  const optionClass = (key, value, extra = "") => `customizer-option${extra ? ` ${extra}` : ""}${state[key] === value ? " active" : ""}`;
  const colors = ["#696cff", "#009688", "#ffab00", "#ff3e1d", "#2196f3"];

  return (
    <>
      <button type="button" className="customizer-toggler" onClick={() => setOpen(true)}>
        <i className="bx bx-cog"></i>
      </button>
      <aside className={`template-customizer${open ? " show" : ""}`}>
        <div className="customizer-header">
          <div>
            <h5>Template Customizer</h5>
            <p>Customize and preview in real time</p>
          </div>
          <div className="customizer-actions">
            <button type="button" onClick={reset} aria-label="Reset"><i className="bx bx-refresh"></i></button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close"><i className="bx bx-x"></i></button>
          </div>
        </div>
        <div className="customizer-body">
          <span className="customizer-section-title">Theming</span>
          <div className="customizer-group">
            <h6>Primary Color</h6>
            <div className="color-options">
              {colors.map((color) => (
                <button key={color} type="button" className={`color-option${state.primaryColor === color ? " active" : ""}`} style={{ "--color": color }} onClick={() => setOption("primaryColor", color)}></button>
              ))}
              <label className="color-picker-option" aria-label="Choose custom primary color">
                <input type="color" value={state.primaryColor} onChange={(event) => setOption("primaryColor", event.target.value)} />
                <span><i className="bx bx-palette"></i></span>
              </label>
            </div>
          </div>
          <div className="customizer-group">
            <h6>Theme</h6>
            <div className="option-grid three">
              <button type="button" className={optionClass("theme", "light")} onClick={() => setOption("theme", "light")}><i className="bx bx-sun"></i><span>Light</span></button>
              <button type="button" className={optionClass("theme", "dark")} onClick={() => setOption("theme", "dark")}><i className="bx bx-moon"></i><span>Dark</span></button>
              <button type="button" className={optionClass("theme", "system")} onClick={() => setOption("theme", "system")}><i className="bx bx-desktop"></i><span>System</span></button>
            </div>
          </div>
          <div className="customizer-group">
            <h6>Skins</h6>
            <div className="option-grid two">
              <button type="button" className={optionClass("skin", "default", "preview-option")} onClick={() => setOption("skin", "default")}><span className="mini-layout"></span><span>Default</span></button>
              <button type="button" className={optionClass("skin", "bordered", "preview-option")} onClick={() => setOption("skin", "bordered")}><span className="mini-layout"></span><span>Bordered</span></button>
            </div>
          </div>
          <div className="customizer-switch-row">
            <h6>Semi Dark</h6>
            <label className="switch"><input type="checkbox" checked={state.semiDark} onChange={(event) => setOption("semiDark", event.target.checked)} /><span></span></label>
          </div>
          <hr />
          <span className="customizer-section-title">Layout</span>
          <div className="customizer-group">
            <h6>Menu (Navigation)</h6>
            <div className="option-grid two">
              <button type="button" className={optionClass("menu", "expanded", "preview-option")} onClick={() => setOption("menu", "expanded")}><span className="mini-layout"></span><span>Expanded</span></button>
              <button type="button" className={optionClass("menu", "collapsed", "preview-option")} onClick={() => setOption("menu", "collapsed")}><span className="mini-layout collapsed-preview"></span><span>Collapsed</span></button>
            </div>
          </div>
          <div className="customizer-group">
            <h6>Navbar Type</h6>
            <div className="option-grid three">
              <button type="button" className={optionClass("navbar", "sticky", "preview-option")} onClick={() => setOption("navbar", "sticky")}><span className="mini-layout"></span><span>Sticky</span></button>
              <button type="button" className={optionClass("navbar", "static", "preview-option")} onClick={() => setOption("navbar", "static")}><span className="mini-layout"></span><span>Static</span></button>
              <button type="button" className={optionClass("navbar", "hidden", "preview-option")} onClick={() => setOption("navbar", "hidden")}><span className="mini-layout no-navbar"></span><span>Hidden</span></button>
            </div>
          </div>
          <div className="customizer-group">
            <h6>Content</h6>
            <div className="option-grid two">
              <button type="button" className={optionClass("content", "compact", "preview-option")} onClick={() => setOption("content", "compact")}><span className="mini-layout content-compact-preview"></span><span>Compact</span></button>
              <button type="button" className={optionClass("content", "wide", "preview-option")} onClick={() => setOption("content", "wide")}><span className="mini-layout content-wide-preview"></span><span>Wide</span></button>
            </div>
          </div>
          <div className="customizer-group">
            <h6>Direction</h6>
            <div className="option-grid two">
              <button type="button" className={optionClass("direction", "ltr", "preview-option")} onClick={() => setOption("direction", "ltr")}><span className="mini-layout"></span><span>Left to Right (En)</span></button>
              <button type="button" className={optionClass("direction", "rtl", "preview-option")} onClick={() => setOption("direction", "rtl")}><span className="mini-layout rtl-preview"></span><span>Right to Left (Ar)</span></button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
