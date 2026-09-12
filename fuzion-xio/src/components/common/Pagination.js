import React from "react";
import Pagination from "react-bootstrap/Pagination";
import Spinner from "react-bootstrap/Spinner";
import { isMobile } from "react-device-detect";
import "bootstrap/dist/css/bootstrap.min.css";

const PaginationComponent = ({
  currentPage,
  totalPages,
  onPageChange,
  loading = false
}) => {
  const [activeAction, setActiveAction] = React.useState(null);
  if (totalPages <= 1) return null;

  /* ================= MOBILE ================= */
  if (isMobile) {
    return (
      <div className="mt-4 position-relative d-flex justify-content-center">
        {loading && (
          <div
            className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
            style={{
              backgroundColor: "rgba(255,255,255,0.6)",
              zIndex: 5,
              borderRadius: "24px"
            }}
          >
            <Spinner animation="border" size="sm" />
          </div>
        )}

        <div className="mobile-pagination-shell">
          {/* LEFT */}
          <div className="mobile-pagination-group">
            <button
              className={`pagination-fab ${
                activeAction === "first" ? "active" : ""
              }`}
              disabled={currentPage === 1 || loading}
              onClick={() => {
                setActiveAction("first");
                onPageChange(1);
              }}
            >
              <i className="fa-solid fa-angles-left" />
            </button>

            <button
              className={`pagination-fab ${
                activeAction === "prev" ? "active" : ""
              }`}
              disabled={currentPage === 1 || loading}
              onClick={() => {
                setActiveAction("prev");
                onPageChange(currentPage - 1);
              }}
            >
              <i className="fa-solid fa-chevron-left" />
            </button>
          </div>

          {/* CENTER */}
          <div className="pagination-center-chip">
            <span className="page-current">{currentPage}</span>
            <span className="page-separator">of</span>
            <span className="page-total">{totalPages}</span>
          </div>

          {/* RIGHT */}
          <div className="mobile-pagination-group">
            <button
              className={`pagination-fab ${
                activeAction === "next" ? "active" : ""
              }`}
              disabled={currentPage === totalPages || loading}
              onClick={() => {
                setActiveAction("next");
                onPageChange(currentPage + 1);
              }}
            >
              <i className="fa-solid fa-chevron-right" />
            </button>

            <button
              className={`pagination-fab ${
                activeAction === "last" ? "active" : ""
              }`}
              disabled={currentPage === totalPages || loading}
              onClick={() => {
                setActiveAction("last");
                onPageChange(totalPages);
              }}
            >
              <i className="fa-solid fa-angles-right" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ================= DESKTOP (unchanged) ================= */

  const items = [];

  items.push(
    <Pagination.First
      key="first"
      disabled={currentPage === 1 || loading}
      onClick={() => onPageChange(1)}
    />
  );

  items.push(
    <Pagination.Prev
      key="prev"
      disabled={currentPage === 1 || loading}
      onClick={() => onPageChange(currentPage - 1)}
    />
  );

  if (currentPage > 3) {
    items.push(
      <Pagination.Item key={1} onClick={() => onPageChange(1)}>
        1
      </Pagination.Item>
    );
    if (currentPage > 4) {
      items.push(<Pagination.Ellipsis key="start-ellipsis" disabled />);
    }
  }

  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  for (let page = startPage; page <= endPage; page++) {
    items.push(
      <Pagination.Item
        key={page}
        active={page === currentPage}
        onClick={() => onPageChange(page)}
      >
        {page}
      </Pagination.Item>
    );
  }

  if (currentPage < totalPages - 2) {
    if (currentPage < totalPages - 3) {
      items.push(<Pagination.Ellipsis key="end-ellipsis" disabled />);
    }
    items.push(
      <Pagination.Item
        key={totalPages}
        onClick={() => onPageChange(totalPages)}
      >
        {totalPages}
      </Pagination.Item>
    );
  }

  items.push(
    <Pagination.Next
      key="next"
      disabled={currentPage === totalPages || loading}
      onClick={() => onPageChange(currentPage + 1)}
    />
  );

  items.push(
    <Pagination.Last
      key="last"
      disabled={currentPage === totalPages || loading}
      onClick={() => onPageChange(totalPages)}
    />
  );

  return (
    <div className="d-flex align-items-center mt-4 position-relative">
      <Pagination size="sm" className="mb-0 flex-nowrap">
        {items}
      </Pagination>
    </div>
  );
};

export default PaginationComponent;
