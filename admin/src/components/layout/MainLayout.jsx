import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import GlobalSearchModal from "./GlobalSearchModal";
import TemplateCustomizer from "./TemplateCustomizer";

function usePageDomBehavior() {
  useEffect(() => {
    const onSelectAll = (event) => {
      const checkbox = event.target;
      if (!checkbox.matches(".datatable-select-all")) return;
      const table = checkbox.closest("table");
      table?.querySelectorAll("tbody .form-check-input").forEach((rowCheckbox) => {
        rowCheckbox.checked = checkbox.checked;
      });
    };

    document.addEventListener("change", onSelectAll);
    return () => {
      document.removeEventListener("change", onSelectAll);
    };
  }, []);
}

export default function MainLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  usePageDomBehavior();

  const closeMobileSidebar = useCallback(() => setMobileOpen(false), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const syncMenuMode = useCallback((mode) => {
    setCollapsed(mode === "collapsed");
  }, []);

  const toggleSidebar = () => {
    if (typeof window === "undefined" || window.innerWidth >= 992) {
      setCollapsed((value) => !value);
    } else {
      closeMobileSidebar();
    }
  };

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") closeMobileSidebar();
      const searchShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (searchShortcut) {
        event.preventDefault();
        openSearch();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [closeMobileSidebar, openSearch]);

  useEffect(() => {
    const openFromDomTrigger = (event) => {
      if (event.target.closest("[data-global-search-open], .search-wrapper")) {
        event.preventDefault();
        openSearch();
      }
    };

    document.addEventListener("click", openFromDomTrigger);
    return () => document.removeEventListener("click", openFromDomTrigger);
  }, [openSearch]);

  useEffect(() => {
    const fullscreenBtn = document.querySelector("[data-fullscreen-toggle]");
    const fullscreenIcon = fullscreenBtn?.querySelector("i");
    const syncFullscreenButton = () => {
      const isFullscreen = Boolean(document.fullscreenElement);
      fullscreenIcon?.classList.toggle("bx-fullscreen", !isFullscreen);
      fullscreenIcon?.classList.toggle("bx-exit-fullscreen", isFullscreen);
      fullscreenBtn?.setAttribute("aria-label", isFullscreen ? "Exit fullscreen" : "Enter fullscreen");
    };
    const toggleFullscreen = () => {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else document.documentElement.requestFullscreen?.();
    };
    fullscreenBtn?.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", syncFullscreenButton);
    syncFullscreenButton();
    return () => {
      fullscreenBtn?.removeEventListener("click", toggleFullscreen);
      document.removeEventListener("fullscreenchange", syncFullscreenButton);
    };
  });

  return (
    <>
      <div className={`layout-wrapper${collapsed ? " sidebar-is-collapsed" : ""}`} data-sidebar-collapsed={collapsed ? "true" : "false"}>
        <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onToggle={toggleSidebar} onNavigate={closeMobileSidebar} />
        <div className={`sidebar-backdrop${mobileOpen ? " show" : ""}`} id="sidebar-backdrop" onClick={closeMobileSidebar}></div>
        <main className="layout-page">
          <Navbar onOpenSidebar={() => setMobileOpen(true)} onOpenSearch={openSearch} />
          {children || <Outlet />}
        </main>
      </div>
      <GlobalSearchModal isOpen={searchOpen} onClose={closeSearch} />
      <TemplateCustomizer onMenuModeChange={syncMenuMode} />
    </>
  );
}
