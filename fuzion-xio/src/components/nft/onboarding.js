import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";

const STEPS = [
  {
    title: "Connect a wallet",
    copy: "Xaman signs XRPL transactions. Connect from the header to create a free profile."
  },
  {
    title: "XRPL assets",
    copy: "NFTs settle in XRP or any issued currency. The wallet downloads a trustline when you first use an IOU."
  },
  {
    title: "Mint",
    copy: "Create NFT accepts images, audio, video, PDF, and 3D. Prepared packs can sit ready before you mint."
  },
  {
    title: "Trade",
    copy: "List, offer, sweep, or bid. Every fill takes a 0.1% desk fee plus creator royalty. Network cost is XRPL reserve and drops."
  }
];

function Onboarding() {
  const [searchKey, setSearchKey] = useState(true);
  const [step, setStep] = useState(0);

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">First time here?</p>
            <h1>
              {step + 1}. {STEPS[step].title}
            </h1>
            <p>{STEPS[step].copy}</p>
            <button
              type="button"
              className="lgOut11"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
            >
              Back
            </button>
            <button
              type="button"
              className="lgOut11"
              onClick={() => setStep((value) => Math.min(STEPS.length - 1, value + 1))}
            >
              Next
            </button>
            <p>
              <Link to="/explore">Explore</Link>
              {" · "}
              <Link to="/ramp">Buy base assets</Link>
              {" · "}
              <Link to="/discover">Discover</Link>
            </p>
          </Container>
        </div>
      )}
      <Footer />
    </>
  );
}

export default Onboarding;
