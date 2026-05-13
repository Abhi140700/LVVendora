import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ROLE_GROUPS, canAccessItem, getCurrentRole } from "../../utils/permissions";

const popularSearchGroups = [
  {
    title: "Popular Searches",
    items: [
      ["bx-home-circle", "Analytics", "/"],
      ["bx-shape-circle", "CRM", "/"],
      ["bx-store", "eCommerce", "/sales/pos", ROLE_GROUPS.salesOps],
      ["bx-list-ol", "User List", "/masters/party", ROLE_GROUPS.stockOps],
    ],
  },
  {
    title: "Apps & Pages",
    items: [
      ["bx-calendar", "Calendar", "/"],
      ["bx-list-ol", "Invoice List", "/sales/invoice", ROLE_GROUPS.salesRead],
      ["bx-user", "Account Settings", "/settings/company", ROLE_GROUPS.settingsOps],
      ["bx-window-open", "Dialog Examples", "/settings", ROLE_GROUPS.settingsOps],
    ],
  },
  {
    title: "User Interface",
    items: [
      ["bx-font", "Typography", "/settings", ROLE_GROUPS.settingsOps],
      ["bx-id-card", "Advanced Cards", "/"],
      ["bx-box", "Icons", "/settings", ROLE_GROUPS.settingsOps],
      ["bx-id-card", "Widget Cards", "/"],
    ],
  },
  {
    title: "Forms & Charts",
    items: [
      ["bx-file", "Form Layouts", "/purchase/entry", ROLE_GROUPS.stockOps],
      ["bx-check", "Form Validation", "/settings", ROLE_GROUPS.settingsOps],
      ["bx-dots-horizontal-rounded", "Form Wizard", "/settings", ROLE_GROUPS.settingsOps],
      ["bx-line-chart", "E-Charts", "/"],
    ],
  },
];

const searchablePages = [
  ["Dashboards", "bx-home-circle", "Dashboard Analytics", "/"],
  ["Apps", "bx-store", "eCommerce Dashboard", "/sales/pos", ROLE_GROUPS.salesOps],
  ["Apps", "bx-book-open", "Reports Hub", "/reports", ROLE_GROUPS.financeRead],
  ["Apps", "bx-map", "Manage Receive", "/manage-receive", ROLE_GROUPS.stockOps],
  ["Sales", "bx-store-alt", "POS Billing", "/sales/pos", ROLE_GROUPS.salesOps],
  ["Sales", "bx-receipt", "Sales Invoice", "/sales/invoice", ROLE_GROUPS.salesRead],
  ["Sales", "bx-revision", "Sales Return", "/sales/return", ROLE_GROUPS.salesOps],
  ["Purchase", "bx-cart-add", "Purchase List", "/purchase/list", ROLE_GROUPS.stockOps],
  ["Purchase", "bx-plus-circle", "New Purchase", "/purchase/entry", ROLE_GROUPS.stockOps],
  ["Purchase", "bx-barcode", "Label Printing", "/label-printing", ROLE_GROUPS.stockOps],
  ["Inventory", "bx-package", "Inventory", "/inventory", ROLE_GROUPS.stockOps],
  ["Inventory", "bx-line-chart", "Stock Dashboard", "/inventory/stock-dashboard", ROLE_GROUPS.stockOps],
  ["Inventory", "bx-box", "Stock Transfer", "/inventory/stock-transfer", ROLE_GROUPS.stockOps],
  ["Accounting", "bx-wallet", "Cash Book", "/accounting/cash-book", ROLE_GROUPS.financeOps],
  ["Accounting", "bx-receipt", "Receipt Entry", "/accounting/receipt-entry", ROLE_GROUPS.financeOps],
  ["Reports", "bx-bar-chart-alt-2", "Sales Report", "/reports/sales", ROLE_GROUPS.financeRead],
  ["Reports", "bx-line-chart", "Profit & Loss", "/reports/profit-loss", ROLE_GROUPS.financeRead],
  ["Settings", "bx-cog", "Company Settings", "/settings/company", ROLE_GROUPS.settingsOps],
];

export default function GlobalSearchModal({ isOpen = false, onClose }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);
  const role = getCurrentRole();

  useEffect(() => {
    if (!isOpen) return;
    const frameId = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frameId);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    setQuery("");
  }, [isOpen]);
  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return popularSearchGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(([, , , allowedRoles]) => canAccessItem({ allowedRoles }, role)),
        }))
        .filter((group) => group.items.length > 0);
    }

    const grouped = searchablePages.reduce((acc, [group, icon, label, href, allowedRoles]) => {
      if (!canAccessItem({ allowedRoles }, role)) return acc;
      const haystack = `${group} ${label}`.toLowerCase();
      if (!haystack.includes(normalized)) return acc;
      acc[group] = acc[group] || [];
      acc[group].push([icon, label, href]);
      return acc;
    }, {});

    return Object.entries(grouped).map(([title, items]) => ({ title, items }));
  }, [query, role]);

  return (
    <>
      {isOpen ? <div className="modal-backdrop fade show"></div> : null}
      <div
        className={`modal fade app-search-modal${isOpen ? " show d-block" : ""}`}
        id="globalSearchModal"
        tabIndex="-1"
        aria-hidden={isOpen ? "false" : "true"}
        role={isOpen ? "dialog" : undefined}
        aria-modal={isOpen ? "true" : undefined}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose?.();
        }}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content global-search-shell" onMouseDown={(event) => event.stopPropagation()}>
          <div className="global-search-header">
            <i className="bx bx-search"></i>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search pages, reports, vouchers..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              data-global-search-input
            />
            <span className="global-search-esc">ESC</span>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close"></button>
          </div>
          <div className={`global-search-body${query ? " is-results" : ""}`} data-global-search-body>
            {groups.length ? (
              groups.map((group) => (
                <section className="global-search-group" key={group.title}>
                  <h6>{group.title}</h6>
                  <div className="global-search-list">
                    {group.items.map(([icon, label, href]) => (
                      <Link className="global-search-item" to={href} onClick={onClose} key={`${group.title}-${label}`}>
                        <i className={`bx ${icon}`}></i>
                        <span>{label}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <section className="global-search-empty">
                <i className="bx bx-search-alt"></i>
                <h6>No results found</h6>
                <p>Try searching for sales, purchase, stock, cash, or settings.</p>
              </section>
            )}
          </div>
        </div>
        </div>
      </div>
    </>
  );
}
