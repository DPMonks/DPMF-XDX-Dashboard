import axios from "axios";
import config from "../../config.json";
import { checkTransactionStatusHelper } from "../../helper";
const token = localStorage.getItem("jwtToken");

////////////////// MINT NFT OFFER DATA ///////////////////////////

export const mintNftOffer = async (data) => {
  const { dispatch, ...rest } = data;
  console.log(rest, "testing value");

  const mintOfferConfig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data: rest,
    method: "post",
    url: "xrpl/mintNftOffer"
  };

  try {
    const mintNftOfferData = await axios(mintOfferConfig);
    if (mintNftOfferData.status === 200) {
      const { uuid, offerIndex, pushed, qr_url, next_url } =
        mintNftOfferData.data;
      const request = {
        uuid,
        offerIndex,
        _id: rest._id,
        showQR: !pushed,
        qr_url,
        next_url,
        dispatch
      };
      const status = await checkTransactionStatusHelper(
        request,
        `xrpl/webhook`
      );
      console.log(status, "payload 1");
      return status;
    }
  } catch (e) {
    console.log(e.response, "payload 2");
    return e.response;
  }
};

////////////////// MINT NFT DATA ///////////////////////////

export const mintNft = async (data) => {
  const { dispatch, ...rest } = data;
  const mintCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data: rest,
    method: "post",
    url: "xrpl/mintNft"
  };
  try {
    const mintNftData = await axios(mintCofig);
    if (mintNftData.status === 200) {
      const { uuid, qr_url, next_url, pushed } = mintNftData.data;
      // Fallback URLs if backend doesn't return them (ensure QR modal always shows)
      const resolvedQrUrl =
        qr_url || (uuid ? `https://xumm.app/sign/${uuid}_q.png` : null);
      const resolvedNextUrl =
        next_url || (uuid ? `https://xumm.app/sign/${uuid}` : null);
      const request = {
        uuid,
        _id: rest._id,
        ...(dispatch && { dispatch }),
        ...(resolvedQrUrl &&
          resolvedNextUrl && {
            showQR: !pushed,
            qr_url: resolvedQrUrl,
            next_url: resolvedNextUrl
          })
      };
      const status = await checkTransactionStatusHelper(
        request,
        `xrpl/paymentStatus`
      );
      return status;
    }
  } catch (e) {
    return e.response;
  }
};

///////////////////// BURN NFT DATA ///////////////////////

export const burnNft = async (data) => {
  const { dispatch, ...rest } = data;
  const burnCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data: rest,
    method: "post",
    url: "xrpl/burnNft"
  };
  try {
    const burnNftData = await axios(burnCofig);
    if (burnNftData.status === 200) {
      const { uuid, qr_url, next_url, pushed } = burnNftData.data;
      const finalQrUrl = qr_url || `https://xumm.app/sign/${uuid}_q.png`;
      const finalNextUrl = next_url || `https://xumm.app/sign/${uuid}`;
      const request = {
        uuid,
        _id: rest._id,
        ...(dispatch && { dispatch }),
        showQR: !pushed,
        qr_url: finalQrUrl,
        next_url: finalNextUrl
      };
      const status = await checkTransactionStatusHelper(
        request,
        "xrpl/burnStatus"
      );
      return status;
    }
  } catch (e) {
    return e.response;
  }
};

///////////////////// SALE NFT DATA ///////////////////////

export const saleNft = async (data) => {
  const { dispatch, ...rest } = data;
  const saleCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data: rest,
    method: "post",
    url: "xrpl/saleNft"
  };
  try {
    const saleNftData = await axios(saleCofig);
    if (saleNftData.status === 200) {
      const { uuid, qr_url, next_url, pushed } = saleNftData.data;
      const finalQrUrl =
        qr_url || `https://xumm.app/sign/${uuid}_q.png`;
      const finalNextUrl =
        next_url || `https://xumm.app/sign/${uuid}`;
      const request = {
        uuid,
        _id: rest._id,
        amount: rest.amount,
        currency: rest.currency,
        issuerAdd: rest.issuerAdd || "",
        ...(dispatch && { dispatch }),
        showQR: !pushed,
        qr_url: finalQrUrl,
        next_url: finalNextUrl
      };
      const status = await checkTransactionStatusHelper(
        request,
        "xrpl/saleStatus"
      );
      return status;
    }
  } catch (e) {
    return e.response;
  }
};

///////////////////// CANCEL SALE NFT DATA ///////////////////////

export const cancelSaleNft = async (data) => {
  const { dispatch, ...rest } = data;
  const cancelSaleCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data: rest,
    method: "post",
    url: "xrpl/cancelSaleNft"
  };
  try {
    const cancelSaleNftData = await axios(cancelSaleCofig);
    if (cancelSaleNftData.status === 200) {
      const { uuid, qr_url, next_url, pushed } = cancelSaleNftData.data;
      const finalQrUrl = qr_url || `https://xumm.app/sign/${uuid}_q.png`;
      const finalNextUrl = next_url || `https://xumm.app/sign/${uuid}`;
      const request = {
        uuid,
        _id: rest._id,
        ...(dispatch && { dispatch }),
        showQR: !pushed,
        qr_url: finalQrUrl,
        next_url: finalNextUrl
      };
      const status = await checkTransactionStatusHelper(
        request,
        "xrpl/cancelSaleStatus"
      );
      return status;
    }
  } catch (e) {
    return e.response;
  }
};

///////////////////// BUY NFT DATA ///////////////////////

export const buyNft = async (data) => {
  const { dispatch, ...rest } = data;
  const buyCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data: rest,
    method: "post",
    url: "xrpl/buyNft"
  };
  try {
    const buyNftData = await axios(buyCofig);
    if (buyNftData.status === 200) {
      const { uuid, qr_url, next_url, pushed } = buyNftData.data;
      const finalQrUrl = qr_url || `https://xumm.app/sign/${uuid}_q.png`;
      const finalNextUrl = next_url || `https://xumm.app/sign/${uuid}`;
      const request = {
        uuid,
        _id: rest._id,
        ...(dispatch && { dispatch }),
        /* ShowQRModal only when Xaman did not push the payload to the app */
        showQR: !pushed,
        qr_url: finalQrUrl,
        next_url: finalNextUrl,
        title: "Buy NFT",
        bodyText:
          "Scan with XAMAN to sign your purchase on the XRPL ledger."
      };
      const status = await checkTransactionStatusHelper(
        request,
        "xrpl/buyNftStatus"
      );
      return status;
    }
  } catch (e) {
    return e.response;
  }
};

///////////////////// BID NFT DATA ///////////////////////

export const bidToken = async (data) => {
  const bidCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data,
    method: "post",
    url: "xrpl/bidNft"
  };
  try {
    const bidNftData = await axios(bidCofig);
    if (bidNftData.status === 200) {
      return bidNftData;
    }
  } catch (e) {
    return e.response;
  }
};

///////////////////// CANCEL BID NFT DATA ///////////////////////

export const bidCancelToken = async (data) => {
  const bidCancelCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data,
    method: "post",
    url: "xrpl/bidCancel"
  };
  try {
    const bidCancelNftData = await axios(bidCancelCofig);
    if (bidCancelNftData.status === 200) {
      return bidCancelNftData;
    }
  } catch (e) {
    return e.response;
  }
};

/////////////////////  BID AND BURN NFT DATA ///////////////////////

export const bidAndBurnToken = async (data) => {
  const bidAndBurnCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data,
    method: "post",
    url: "xrpl/bidAndBurn"
  };
  try {
    const bidAndBurnNftData = await axios(bidAndBurnCofig);
    if (bidAndBurnNftData.status === 200) {
      return bidAndBurnNftData;
    }
  } catch (e) {
    return e.response;
  }
};

//==============Total Minted Nft start=================

export const allMintedNft = async () => {
  const walletDisCofig = {
    baseURL: config.LOCAL_API_URL,
    method: "get",
    url: "xrpl/allMintedNft"
  };
  try {
    const allMintedNft = await axios(walletDisCofig);
    if (allMintedNft.status === 200) {
      return allMintedNft;
    }
  } catch (e) {
    return e.response;
  }
};

// ==================Delete NFT api call service===============

export const deleteNft = async (data) => {
  const deleteNftCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data,
    method: "delete",
    url: "nft/deleteNft"
  };
  try {
    const deltedNft = await axios(deleteNftCofig);
    if (deltedNft.status === 200) {
      return deltedNft;
    }
  } catch (e) {
    return e.response;
  }
};

export const totalTrade = async () => {
  const walletDisCofig = {
    baseURL: config.LOCAL_API_URL,
    method: "get",
    url: "nft/totalTradeHistory"
  };
  try {
    const totalTradeHistory = await axios(walletDisCofig);
    if (totalTradeHistory.status === 200) {
      return totalTradeHistory;
    }
  } catch (e) {
    return e.response;
  }
};

///////////////////// SEND NFT DATA ///////////////////////

export const sendNft = async (data) => {
  const { dispatch, ...rest } = data;
  const sendCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data: rest,
    method: "post",
    url: "xrpl/sendNft"
  };
  try {
    const sendNftData = await axios(sendCofig);
    if (sendNftData.status === 200) {
      const { uuid, qr_url, next_url, pushed } = sendNftData.data;
      const finalQrUrl = qr_url || `https://xumm.app/sign/${uuid}_q.png`;
      const finalNextUrl = next_url || `https://xumm.app/sign/${uuid}`;
      const request = {
        uuid,
        _id: rest._id,
        destAdd: rest.destAdd,
        ...(dispatch && { dispatch }),
        showQR: !pushed,
        qr_url: finalQrUrl,
        next_url: finalNextUrl
      };
      const status = await checkTransactionStatusHelper(
        request,
        "xrpl/sendStatus"
      );
      return status;
    }
  } catch (e) {
    return e.response;
  }
};

///////////////////// RECEIVE NFT DATA ///////////////////////

export const receiveNft = async (data) => {
  const receiveCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Bearer ${token}`
    },
    data,
    method: "post",
    url: "xrpl/receiveNft"
  };

  try {
    const receiveNftData = await axios(receiveCofig);
    if (receiveNftData.status === 200) {
      return receiveNftData;
    }
  } catch (e) {
    return e.response;
  }
};

/* CANCEL SEND NFT */

export const cancelSendNft = async (data) => {
  const { dispatch, ...rest } = data;
  const cancelSendCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data: rest,
    method: "post",
    url: "xrpl/cancelSendNft"
  };
  try {
    const cancelSendNftData = await axios(cancelSendCofig);
    if (cancelSendNftData.status === 200) {
      const { uuid, qr_url, next_url, pushed } = cancelSendNftData.data;
      const finalQrUrl = qr_url || `https://xumm.app/sign/${uuid}_q.png`;
      const finalNextUrl = next_url || `https://xumm.app/sign/${uuid}`;
      const request = {
        uuid,
        _id: rest._id,
        ...(dispatch && { dispatch }),
        showQR: !pushed,
        qr_url: finalQrUrl,
        next_url: finalNextUrl
      };
      const status = await checkTransactionStatusHelper(
        request,
        "xrpl/cancelSendStatus"
      );
      return status;
    }
  } catch (e) {
    return e.response;
  }
};

/* Place more offers api call — Phase 1 QR + Phase 2 poll (same pattern as send/sale) */
export const placeMoreOffer = async (data) => {
  const { dispatch, ...rest } = data;
  const placeMoreofferCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data: rest,
    method: "post",
    url: "xrpl/MakeOffer"
  };
  try {
    const placeMoreOfferData = await axios(placeMoreofferCofig);
    if (placeMoreOfferData.status === 200) {
      const { uuid, qr_url, next_url, pushed } = placeMoreOfferData.data;
      const finalQrUrl = qr_url || `https://xumm.app/sign/${uuid}_q.png`;
      const finalNextUrl = next_url || `https://xumm.app/sign/${uuid}`;
      const request = {
        uuid,
        _id: rest._id,
        amount: rest.amount,
        currency: rest.currency,
        issuerAdd: rest.issuerAdd,
        ...(dispatch && { dispatch }),
        showQR: true,
        qr_url: finalQrUrl,
        next_url: finalNextUrl,
        title: "Place Offer",
        bodyText:
          "Scan with XAMAN to sign your buy offer on the XRPL ledger."
      };
      const status = await checkTransactionStatusHelper(
        request,
        "xrpl/makeOfferStatus"
      );
      return status;
    }
  } catch (e) {
    return e.response;
  }
};

/* Get all placed offers api call */

export const getAllPlacedOffers = async (data) => {
  const getAllPlacedOffersCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data: { _id: data },
    method: "post",
    url: "xrpl/getAllOffers"
  };
  try {
    const getAllPlacedOffersData = await axios(getAllPlacedOffersCofig);
    if (getAllPlacedOffersData.status === 200) {
      return getAllPlacedOffersData;
    }
  } catch (e) {
    return e.response;
  }
};

/* Accept placed offer — Phase 1 QR + Phase 2 poll */
export const acceptPlacedOffer = async (data) => {
  const { dispatch, ...rest } = data;
  const acceptPlacedOffersCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data: rest,
    method: "post",
    url: "xrpl/acceptPlacedOffer"
  };
  try {
    const acceptPlacedOffersData = await axios(acceptPlacedOffersCofig);
    if (acceptPlacedOffersData.status === 200) {
      const { uuid, qr_url, next_url, pushed } = acceptPlacedOffersData.data;
      const finalQrUrl = qr_url || `https://xumm.app/sign/${uuid}_q.png`;
      const finalNextUrl = next_url || `https://xumm.app/sign/${uuid}`;
      const request = {
        uuid,
        _id: rest._id,
        offerId: rest.offerId,
        nft_buyer: rest.nft_buyer,
        nft_owner: rest.nft_owner,
        ...(dispatch && { dispatch }),
        showQR: !pushed,
        qr_url: finalQrUrl,
        next_url: finalNextUrl,
        title: "Accept offer",
        bodyText:
          "Scan with XAMAN to sign accepting the buy offer on the XRPL ledger."
      };
      const status = await checkTransactionStatusHelper(
        request,
        "xrpl/acceptPlacedOfferStatus"
      );
      return status;
    }
  } catch (e) {
    return e.response;
  }
};

/*All placed offer to be cancelled api call */
export const allCancelPlacedOffer = async () => {
  const allCancelPlacedOfferCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    method: "post",
    url: "xrpl/getAllCancelPlacedOffer"
  };
  try {
    const allCancelPlacedOfferData = await axios(allCancelPlacedOfferCofig);
    if (allCancelPlacedOfferData.status === 200) {
      return allCancelPlacedOfferData;
    }
  } catch (e) {
    return e.response;
  }
};

/* Cancel placed offer — Phase 1 QR + Phase 2 poll (same pattern as place offer / cancel send) */
export const cancelPlacedOffer = async (data) => {
  const { dispatch, ...rest } = data;
  const cancelPlacedOfferCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data: rest,
    method: "post",
    url: "xrpl/cancelPlaceOffer"
  };
  try {
    const cancelPlacedOfferRes = await axios(cancelPlacedOfferCofig);
    if (cancelPlacedOfferRes.status === 200) {
      const { uuid, qr_url, next_url, pushed } = cancelPlacedOfferRes.data;
      const finalQrUrl = qr_url || `https://xumm.app/sign/${uuid}_q.png`;
      const finalNextUrl = next_url || `https://xumm.app/sign/${uuid}`;
      const request = {
        uuid,
        _id: rest._id,
        nftOfferIndex: rest.nftOfferIndex,
        ...(dispatch && { dispatch }),
        showQR: true,
        qr_url: finalQrUrl,
        next_url: finalNextUrl,
        title: "Cancel offer",
        bodyText:
          "Scan with XAMAN to sign canceling your buy offer on the XRPL ledger."
      };
      const status = await checkTransactionStatusHelper(
        request,
        "xrpl/cancelPlaceOfferStatus"
      );
      return status;
    }
  } catch (e) {
    return e.response;
  }
};

/*All offers by Nft Owner */
export const allOfferByNftOwner = async () => {
  const allOfferByNftOwnerCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    method: "post",
    url: "xrpl/getOffersByNftOwner"
  };
  try {
    const allOfferDataByNftOwner = await axios(allOfferByNftOwnerCofig);
    if (allOfferDataByNftOwner.status === 200) {
      return allOfferDataByNftOwner;
    }
  } catch (e) {
    return e.response;
  }
};
