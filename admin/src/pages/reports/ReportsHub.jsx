export default function ReportsHub() {
  return (
    <>
      <div className="container-fluid p-0 flex-grow-1">
              
          <div className="page-header card">
            <div className="card-body">
              <div>
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb mb-2">
                    <li className="breadcrumb-item"><a href="/">Home</a></li>
                    <li className="breadcrumb-item active" aria-current="page">Reports</li>
                  </ol>
                </nav>
                <p className="section-label">Reports</p>
                <h1>Reports Hub</h1>
                <p className="mb-0 text-muted">Launch operational, sales, purchase, inventory, GST, accounting, and profit reports.</p>
              </div>
              <div className="page-header-actions">
                <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                <button className="btn btn_style" type="button" data-bs-toggle="modal" data-bs-target="#pageActionModal">
                  <i className="bx bx-plus"></i><span>New</span>
                </button>
              </div>
            </div>
          </div>
              
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-xl-4"><a className="module-card" href="/reports/sales"><i className="bx bx-line-chart"></i><span>Sales Report</span><small>Open report</small></a></div><div className="col-12 col-sm-6 col-xl-4"><a className="module-card" href="/reports/purchase"><i className="bx bx-cart"></i><span>Purchase Report</span><small>Open report</small></a></div><div className="col-12 col-sm-6 col-xl-4"><a className="module-card" href="/reports/stock"><i className="bx bx-package"></i><span>Stock Report</span><small>Open report</small></a></div><div className="col-12 col-sm-6 col-xl-4"><a className="module-card" href="/reports/gst"><i className="bx bx-receipt"></i><span>GST Report</span><small>Open report</small></a></div><div className="col-12 col-sm-6 col-xl-4"><a className="module-card" href="/reports/profit-loss"><i className="bx bx-trending-up"></i><span>Profit & Loss</span><small>Open report</small></a></div><div className="col-12 col-sm-6 col-xl-4"><a className="module-card" href="/accounting/ledger-list"><i className="bx bx-book"></i><span>Ledger List</span><small>Open report</small></a></div>
          </div>
            </div>
          
      
      <div className="modal fade" id="pageActionModal" tabIndex="-1" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">New Reports Hub</h5>
                  <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div className="modal-body">
                  <p className="text-muted mb-3">Use the page form or table action menu to continue this workflow.</p>
                  <div className="quick-action-list">
                    <button className="quick-action" type="button"><i className="bx bx-plus"></i><span>Create record</span></button>
                    <button className="quick-action" type="button"><i className="bx bx-import"></i><span>Import data</span></button>
                    <button className="quick-action" type="button"><i className="bx bx-printer"></i><span>Print view</span></button>
                  </div>
                </div>
              </div>
            </div>
          </div>
    </>
  );
}
