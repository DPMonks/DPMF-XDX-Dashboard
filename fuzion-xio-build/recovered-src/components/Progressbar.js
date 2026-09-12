import React from "react";
import { ProgressBar, Card } from "react-bootstrap";

const ProgressBarComponent = ({ totalOffers, collection, compact = false }) => {
  const minted = totalOffers.filter(
    (vl) => vl.isMinted && vl.collection === collection
  ).length;
  const total = totalOffers.filter((vl) => vl.collection === collection).length;

  const percentage = total > 0 ? ((minted / total) * 100).toFixed(0) : 0;

  if (compact) {
    return (
      <div className="collection-progress-card compact">
        <div className="collection-progress-stats">
          <span>{minted}/{total}</span>
        </div>
        <ProgressBar
          now={percentage}
          variant={percentage >= 50 ? "success" : "warning"}
          className="collection-progress-bar compact"
        />
      </div>
    );
  }

  return (
    <Card className="shadow-sm p-2 rounded-4 text-center collection-progress-card">
      <div className="mb-2 text-muted">
        Minted: <strong>{minted}</strong> | Total Offers:{" "}
        <strong>{total}</strong>
      </div>
      {minted > 0 && (
        <ProgressBar
          now={percentage}
          label={`${percentage}% minted`}
          variant={percentage >= 50 ? "success" : "warning"}
          className="collection-progress-bar"
          style={{ height: "20px", borderRadius: "10px" }}
        />
      )}
    </Card>
  );
};

export default ProgressBarComponent;
