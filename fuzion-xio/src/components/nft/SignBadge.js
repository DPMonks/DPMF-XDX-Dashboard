import React from "react";

function SignBadge({ row }) {
  if (row?.signed) {
    return (
      <span className="dpmf-badge" title={row.txid ? `Ledger ${row.txid}` : "Signed in Xaman"}>
        Signed
      </span>
    );
  }
  return (
    <span className="dpmf-badge dpmf-badge-paper" title="Desk paper fill — not Xaman-signed">
      Paper
    </span>
  );
}

export default SignBadge;
