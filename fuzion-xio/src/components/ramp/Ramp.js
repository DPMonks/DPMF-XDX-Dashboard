import { useState } from "react";
import Header from "../common/header";
import Footer from "../common/footer";

export default function Ramp() {
  const [partner, setPartner] = useState("stably");

  return (
    <>
      <Header />
      <div className="gradientBg createNewNFT" align="center">
        <div className="dpmf-market" style={{ maxWidth: 720, margin: "0 auto", textAlign: "left" }}>
          <p className="dpmf-kicker">Fiat on-ramp</p>
          <h1>Buy base assets</h1>
          <p className="dpmf-muted">
            Design-ready partner slot. Custodial or non-custodial ramps can be
            swapped here. XRPL settlement stays on-ledger after the buy.
          </p>
          <label>
            Partner
            <select value={partner} onChange={(e) => setPartner(e.target.value)}>
              <option value="stably">Stably (live iframe)</option>
              <option value="future-custodial">Future custodial</option>
              <option value="future-noncustodial">Future non-custodial</option>
            </select>
          </label>
        </div>
        {partner === "stably" ? (
          <iframe
            src="https://ramp-beta.stably.io"
            height="680"
            width="420"
            className="mt-3 mb-3"
            title="Fiat ramp"
          />
        ) : (
          <p className="dpmf-muted mt-3">
            Integration point reserved for {partner}. Card/bank UI will land here.
          </p>
        )}
      </div>
      <Footer />
    </>
  );
}
