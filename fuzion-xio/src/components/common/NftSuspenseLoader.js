import React, { useEffect, useState } from "react";
import FUSIONLOGO from "../../assets/fusion-logo.png";

const icons = [
  "/asset/nft-icon1.png",
  "/asset/nft-icon2.png",
  "/asset/nft-icon3.png",
  "/asset/eth.png",
  "/asset/xrpl.png",
  "/asset/token.png"
];

const NftSuspenseLoader = () => {
  return (
    <div className="nft-loader-container">
      <div className="nft-center-content text-center">
        <img src={FUSIONLOGO} width="150" />
        <p className="mt-3 fs-5 fw-semibold text-dark">
          Loading your NFT Universe...
        </p>
      </div>
    </div>
  );
};

export default NftSuspenseLoader;
