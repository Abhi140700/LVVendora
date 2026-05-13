export default function ReturnRegister() {
  return (
    <>
      <div className="container-fluid p-0 flex-grow-1">
              
          <div className="page-header card">
            <div className="card-body">
              <div>
                <nav aria-label="breadcrumb">
                  <ol className="breadcrumb mb-2">
                    <li className="breadcrumb-item"><a href="/">Home</a></li>
                    <li className="breadcrumb-item active" aria-current="page">Purchase Operations</li>
                  </ol>
                </nav>
                <p className="section-label">Purchase Operations</p>
                <h1>Return Register</h1>
                <p className="mb-0 text-muted">Review all purchase returns with debit note, inventory, and supplier settlement status.</p>
              </div>
              <div className="page-header-actions">
                <span className="metric-pill"><i className="bx bx-check-circle"></i> Ready</span>
                <button className="btn btn_style" type="button" data-bs-toggle="modal" data-bs-target="#pageActionModal">
                  <i className="bx bx-plus"></i><span>New</span>
                </button>
              </div>
            </div>
          </div>
              
          <section className="card app-card">
            <div className="card-header app-card-header">
              <div>
                <h2>Filters</h2>
                <p>Use consistent master data so downstream billing and reporting stay clean.</p>
              </div>
            </div>
            <div className="card-body">
              <form className="row g-3">
                <div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="field-0">Return No</label><input type="text" className="form-control" id="field-0" placeholder="Enter Return No" /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="field-1">Party</label><input type="text" className="form-control" id="field-1" placeholder="Enter Party" /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="field-2">Bill No</label><input type="text" className="form-control" id="field-2" placeholder="Enter Bill No" /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="field-3">GRN</label><input type="text" className="form-control" id="field-3" placeholder="Enter GRN" /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="field-4">From Date</label><input type="date" className="form-control" id="field-4" /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="field-5">To Date</label><input type="date" className="form-control" id="field-5" /></div><div className="col-12 col-sm-6 col-xl-3"><label className="form-label" htmlFor="field-6">Status</label><select className="form-select" id="field-6"><option>Select Status</option><option>Active</option><option>Default</option><option>Pending</option></select></div>
                <div className="col-12 d-flex flex-wrap gap-2 pt-2">
                  <button className="btn btn_style" type="button"><i className="bx bx-save"></i><span>Save</span></button>
                  <button className="btn btn_style inActive" type="reset"><i className="bx bx-reset"></i><span>Clear</span></button>
                </div>
              </form>
            </div>
          </section>
          <section className="card app-card app-datatable-card">
            <div className="card-body p-0">
              
          <div className="datatable-toolbar">
            <div className="datatable-toolbar-start">
              <label className="datatable-length">
                <span>Show</span>
                <select className="form-select form-select-sm datatable-page-size" aria-label="Rows per page">
                  <option selected>10</option>
                  <option>25</option>
                  <option>50</option>
                </select>
              </label>
              <button className="btn btn_style datatable-create" type="button"><i className="bx bx-plus"></i><span>Create Return</span></button>
            </div>
            <div className="datatable-toolbar-end">
              <button className="btn btn_style inActive datatable-tool-btn" type="button" data-bs-toggle="offcanvas" data-bs-target="#advancedFilterOffcanvas" aria-controls="advancedFilterOffcanvas">
                <i className="bx bx-filter-alt"></i><span>Filters</span>
              </button>
              <div className="dropdown">
                <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                  <i className="bx bx-columns"></i><span>Columns</span>
                </button>
                <div className="dropdown-menu dropdown-menu-end datatable-column-menu">
                  
              <label className="dropdown-item column-toggle-row">
                <input className="form-check-input" type="checkbox" checked />
                <span>Reference</span>
              </label>
              <label className="dropdown-item column-toggle-row">
                <input className="form-check-input" type="checkbox" checked />
                <span>Date</span>
              </label>
              <label className="dropdown-item column-toggle-row">
                <input className="form-check-input" type="checkbox" checked />
                <span>Party</span>
              </label>
              <label className="dropdown-item column-toggle-row">
                <input className="form-check-input" type="checkbox" checked />
                <span>Amount</span>
              </label>
              <label className="dropdown-item column-toggle-row">
                <input className="form-check-input" type="checkbox"  />
                <span>Status</span>
              </label>
                </div>
              </div>
              <div className="dropdown">
                <button className="btn btn_style inActive datatable-tool-btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                  <i className="bx bx-export"></i><span>Export</span>
                </button>
                <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                  <a className="dropdown-item" href="#"><i className="bx bx-file me-2"></i>CSV</a>
                  <a className="dropdown-item" href="#"><i className="bx bx-spreadsheet me-2"></i>Excel</a>
                  <a className="dropdown-item" href="#"><i className="bx bx-printer me-2"></i>Print</a>
                </div>
              </div>
              <div className="datatable-search">
                <input type="text" placeholder="Search Return Register" aria-label="Search Return Register" />
              </div>
              <select className="form-select datatable-status-filter" aria-label="Filter status">
                <option selected>Invoice Status</option>
                <option>Active</option>
                <option>Paid</option>
                <option>Pending</option>
                <option>Received</option>
              </select>
            </div>
          </div>
              
          <div className="datatable-bulk-bar">
            <div className="datatable-bulk-copy">
              <strong>0 selected</strong>
              <span>Choose rows to unlock bulk actions</span>
            </div>
            <div className="datatable-bulk-actions">
              <button className="btn btn_style inActive" type="button"><i className="bx bx-archive"></i><span>Archive</span></button>
              <button className="btn btn_style inActive" type="button"><i className="bx bx-export"></i><span>Export</span></button>
              <button className="btn btn_style inActive" type="button" data-bs-toggle="modal" data-bs-target="#confirmActionModal"><i className="bx bx-trash"></i><span>Delete</span></button>
            </div>
          </div>
              <div className="table-responsive app-table-wrap datatable-wrap">
                <table className="table app-table align-middle">
                  <thead>
                    <tr><th className="datatable-check-cell"><input className="form-check-input datatable-select-all" type="checkbox" aria-label="Select all rows" /></th><th><span className="sortable-heading">Return No<i className="bx bx-sort-up"></i></span></th><th><span className="sortable-heading">Return Date<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Party<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Bill No<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Items<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Debit Note<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Amount<i className="bx bx-sort"></i></span></th><th><span className="sortable-heading">Status<i className="bx bx-sort"></i></span></th><th className="text-end">Actions</th></tr>
                  </thead>
                  <tbody>
                    
                          <tr>
                            <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                            <td>PR-210</td><td>02 May 2026</td><td>Raj Fabrics</td><td>RF-7780</td><td>6</td><td>Pending</td><td>4,820.00</td><td><span className="status-badge status-warning">Draft</span></td>
                            <td className="text-end">
                              <div className="datatable-actions">
                                <button type="button" className="btn action-btn" aria-label="Delete"><i className="bx bx-trash"></i></button>
                                <button type="button" className="btn action-btn" aria-label="View"><i className="bx bx-show"></i></button>
                                <div className="dropdown">
                                  <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions">
                                  <i className="bx bx-dots-vertical-rounded"></i>
                                  </button>
                                  <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                    <a className="dropdown-item" href="#">Download</a>
                                    <a className="dropdown-item" href="#">Edit</a>
                                    <a className="dropdown-item" href="#">Duplicate</a>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                            <td>PR-209</td><td>28 Apr 2026</td><td>Kiran Garments</td><td>KG-981</td><td>2</td><td>DN-402</td><td>1,140.00</td><td><span className="status-badge status-success">Settled</span></td>
                            <td className="text-end">
                              <div className="datatable-actions">
                                <button type="button" className="btn action-btn" aria-label="Delete"><i className="bx bx-trash"></i></button>
                                <button type="button" className="btn action-btn" aria-label="View"><i className="bx bx-show"></i></button>
                                <div className="dropdown">
                                  <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions">
                                  <i className="bx bx-dots-vertical-rounded"></i>
                                  </button>
                                  <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                    <a className="dropdown-item" href="#">Download</a>
                                    <a className="dropdown-item" href="#">Edit</a>
                                    <a className="dropdown-item" href="#">Duplicate</a>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td className="datatable-check-cell"><input className="form-check-input" type="checkbox" aria-label="Select row" /></td>
                            <td>PR-208</td><td>24 Apr 2026</td><td>Mahalaxmi Textiles</td><td>MT-2241</td><td>11</td><td>DN-401</td><td>8,360.00</td><td><span className="status-badge status-primary">Approved</span></td>
                            <td className="text-end">
                              <div className="datatable-actions">
                                <button type="button" className="btn action-btn" aria-label="Delete"><i className="bx bx-trash"></i></button>
                                <button type="button" className="btn action-btn" aria-label="View"><i className="bx bx-show"></i></button>
                                <div className="dropdown">
                                  <button type="button" className="btn action-btn dropdown-toggle hide-arrow" data-bs-toggle="dropdown" aria-label="More actions">
                                  <i className="bx bx-dots-vertical-rounded"></i>
                                  </button>
                                  <div className="dropdown-menu dropdown-menu-end datatable-action-menu">
                                    <a className="dropdown-item" href="#">Download</a>
                                    <a className="dropdown-item" href="#">Edit</a>
                                    <a className="dropdown-item" href="#">Duplicate</a>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                    
          <tr className="table-state-row table-state-row-loading d-none">
            <td colSpan="10">
              <div className="table-skeleton-list" aria-label="Loading rows">
                <span></span><span></span><span></span>
              </div>
            </td>
          </tr>
          <tr className="table-state-row table-state-row-empty d-none">
            <td colSpan="10">
              <div className="empty-state compact">
                <span className="empty-state-icon"><i className="bx bx-search-alt"></i></span>
                <h6>No matching records</h6>
                <p>Try changing filters or clearing the search field.</p>
              </div>
            </td>
          </tr>
                  </tbody>
                </table>
              </div>
              <div className="pagination-row">
                <span>Showing 1 to 3 of 50 entries</span>
                <nav aria-label="Table pagination">
                  <ul className="pagination pagination-sm mb-0">
                    <li className="page-item disabled"><a className="page-link" href="#" aria-label="Previous"><i className="bx bx-chevron-left"></i></a></li>
                    <li className="page-item active"><a className="page-link" href="#">1</a></li>
                    <li className="page-item"><a className="page-link" href="#">2</a></li>
                    <li className="page-item"><a className="page-link" href="#">3</a></li>
                    <li className="page-item d-none d-sm-block"><a className="page-link" href="#">4</a></li>
                    <li className="page-item d-none d-sm-block"><a className="page-link" href="#">5</a></li>
                    <li className="page-item"><a className="page-link" href="#" aria-label="Next"><i className="bx bx-chevron-right"></i></a></li>
                  </ul>
                </nav>
              </div>
            </div>
          </section>
            </div>
          
      
      <div className="modal fade" id="pageActionModal" tabIndex="-1" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">New Return Register</h5>
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
