import { actionTypes } from "../actionTypes/mintNft";
import {
  mintNftOffer,
  mintNft,
  burnNft,
  saleNft,
  cancelSaleNft,
  buyNft,
  bidToken,
  bidCancelToken,
  bidAndBurnToken,
  allMintedNft,
  deleteNft,
  totalTrade,
  sendNft,
  receiveNft,
  cancelSendNft,
  placeMoreOffer,
  getAllPlacedOffers,
  acceptPlacedOffer,
  allCancelPlacedOffer,
  cancelPlacedOffer,
  allOfferByNftOwner
} from "../services/mintNft";

///////////////////////// MINT NFT OFFER ACTION ////////////////

// export let mintNftOfferAction = (data) => async (dispatch) => {
//   dispatch({ type: actionTypes.MINT_OFFER_REQUEST, loader: data.loader });
//   const payload = await mintNftOffer(data.data);
//   const { status } = payload;
//   if (status === 200) {
//     dispatch({ type: actionTypes.MINT_OFFER_SUCCESS, payload: payload.data });
//   } else {
//     dispatch({ type: actionTypes.MINT_OFFER_FAILURE, payload });
//   }
// };

export let mintNftOfferAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.MINT_OFFER_REQUEST, loader: data.loader });

  const payload = await mintNftOffer({ ...data.data, dispatch }); // inject dispatch

  if (!payload || payload?.isCancelled) {
    dispatch({ type: actionTypes.MINT_OFFER_MODAL_RESET });
    return;
  }

  const { status } = payload;
  if (status === 200) {
    dispatch({ type: actionTypes.MINT_OFFER_SUCCESS, payload: payload.data });
  } else {
    dispatch({ type: actionTypes.MINT_OFFER_FAILURE, payload });
  }
};

///////////////////////// MINT NFT ACTION ////////////////

export const mintNftAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.MINT_REQUEST, loader: data.loader });
  const payload = await mintNft({ ...data.data, dispatch });
  if (!payload || payload?.isCancelled) {
    dispatch({ type: actionTypes.MINT_MODAL_RESET });
    return;
  }
  const { status } = payload;
  if (status === 200) {
    dispatch({ type: actionTypes.MINT_SUCCESS, payload: payload.data });
  } else {
    dispatch({ type: actionTypes.MINT_FAILURE, payload });
  }
};

///////////////////////// MINT MODAL RESET ACTIONS ////////////////
export const mintModalResetAction = () => ({ type: actionTypes.MINT_MODAL_RESET });
export const mintOfferModalResetAction = () => ({
  type: actionTypes.MINT_OFFER_MODAL_RESET
});
export const saleModalResetAction = () => ({ type: actionTypes.SALE_MODAL_RESET });

/////////////////////////////////////// BURN NFT ACTION ///////////////////////////////

export let burnNftAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.BURN_REQUEST, loader: data.loader });
  try {
    const payload = await burnNft({ ...data.data, dispatch });
    if (!payload || payload?.isCancelled) {
      dispatch({ type: actionTypes.BURN_MODAL_RESET });
      return;
    }
    const { status } = payload;
    if (status === 200) {
      dispatch({ type: actionTypes.BURN_SUCCESS, payload: payload.data });
    } else {
      dispatch({ type: actionTypes.BURN_FAILURE, payload });
    }
  } catch (err) {
    dispatch({ type: actionTypes.BURN_MODAL_RESET });
    if (err?.isCancelled) return;
    dispatch({
      type: actionTypes.BURN_FAILURE,
      payload: err.response || { data: { message: err.message || "Payment declined" } }
    });
  }
};

///////////////////////////////////////  SALE ACTION ///////////////////////////////

export let saleNftAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.SALE_REQUEST, loader: data.loader });
  const payload = await saleNft({ ...data.data, dispatch });
  if (!payload || payload?.isCancelled) {
    dispatch({ type: actionTypes.SALE_MODAL_RESET });
    return;
  }
  const { status } = payload;
  if (status === 200) {
    dispatch({ type: actionTypes.SALE_SUCCESS, payload: payload.data });
  } else {
    dispatch({ type: actionTypes.SALE_FAILURE, payload });
  }
};

//////////////////////////////////////  CANCEL SALE ACTION ///////////////////////////////

export let cancelSaleNftAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.CANCEL_SALE_REQUEST, loader: data.loader });
  try {
    const payload = await cancelSaleNft({ ...data.data, dispatch });
    if (!payload || payload?.isCancelled) {
      dispatch({ type: actionTypes.CANCEL_SALE_MODAL_RESET });
      return;
    }
    const { status } = payload;
    if (status === 200) {
      dispatch({ type: actionTypes.CANCEL_SALE_SUCCESS, payload: payload.data });
    } else {
      dispatch({ type: actionTypes.CANCEL_SALE_FAILURE, payload });
    }
  } catch (err) {
    dispatch({ type: actionTypes.CANCEL_SALE_MODAL_RESET });
    if (err?.isCancelled) return;
    dispatch({
      type: actionTypes.CANCEL_SALE_FAILURE,
      payload: err.response || { data: { message: err.message || "Payment declined" } }
    });
  }
};

//////////////////////////////////////  BUY ACTION ///////////////////////////////

export let buyNftAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.BUY_REQUEST, loader: data.loader });
  try {
    const payload = await buyNft({ ...data.data, dispatch });
    if (!payload || payload?.isCancelled) {
      dispatch({ type: actionTypes.BUY_MODAL_RESET });
      return;
    }
    const { status } = payload;
    if (status === 200) {
      dispatch({ type: actionTypes.BUY_SUCCESS, payload: payload.data });
    } else {
      dispatch({ type: actionTypes.BUY_FAILURE, payload });
    }
  } catch (err) {
    dispatch({ type: actionTypes.BUY_MODAL_RESET });
    if (err?.isCancelled) return;
    dispatch({
      type: actionTypes.BUY_FAILURE,
      payload:
        err.response ||
        err.data ||
        { data: { message: err.message || "Payment declined" } }
    });
  }
};

//////////////////////////////////////  BID TOKEN ACTION ///////////////////////////////

export let bidTokenAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.BID_REQUEST, loader: data.loader });
  const payload = await bidToken(data.data);
  const { status } = payload;
  if (status === 200) {
    dispatch({ type: actionTypes.BID_SUCCESS, payload: payload.data });
  } else {
    dispatch({ type: actionTypes.BID_FAILURE, payload });
  }
};

////////////////////////////////////// CANCEL BID TOKEN ACTION ///////////////////////////////

export let bidCancelTokenAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.CANCEL_BID_REQUEST, loader: data.loader });
  const payload = await bidCancelToken(data.data);
  const { status } = payload;
  if (status === 200) {
    dispatch({ type: actionTypes.CANCEL_BID_SUCCESS, payload: payload.data });
  } else {
    dispatch({ type: actionTypes.CANCEL_BID_FAILURE, payload });
  }
};

//////////////////////////////////////  BID TOKEN ACTION ///////////////////////////////

export let bidAndBurnTokenAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.BID_AND_BURN_REQUEST, loader: data.loader });
  const payload = await bidAndBurnToken(data.data);
  const { status } = payload;
  if (status === 200) {
    dispatch({ type: actionTypes.BID_AND_BURN_SUCCESS, payload: payload.data });
  } else {
    dispatch({ type: actionTypes.BID_AND_BURN_FAILURE, payload });
  }
};

////////////////////////////////////// NUMBER OF MINTED ACTION///////////////////////////////

export let numberOfMintedAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.NUMBER_OF_MINTED_REQUEST, loader: data.loader });
  const payload = await allMintedNft();
  const { status } = payload;
  if (status === 200) {
    dispatch({
      type: actionTypes.NUMBER_OF_MINTED_SUCCESS,
      payload: payload.data
    });
  } else {
    dispatch({ type: actionTypes.NUMBER_OF_MINTED_FAILURE, payload });
  }
};

// ===================DELETE NFT ACTION==================

export let deleteNftAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.DELETENFT_REQUEST, loader: data.loader });
  const payload = await deleteNft(data.data);
  const { status } = payload;
  if (status === 200) {
    dispatch({ type: actionTypes.DELETENFT_SUCCESS, payload: payload.data });
  } else {
    dispatch({ type: actionTypes.DELETENFT_FAILURE, payload });
  }
};

/* Total traded NFT action */
export let totalTradeAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.TOTALTRADE_REQUEST, loader: data.loader });
  const payload = await totalTrade();
  const { status } = payload;
  if (status === 200) {
    dispatch({ type: actionTypes.TOTALTRADE_SUCCESS, payload: payload.data });
  } else {
    dispatch({ type: actionTypes.TOTALTRADE_FAILURE, payload });
  }
};

///////////////////////////////////////  SEND NFT ACTION ///////////////////////////////

export let sendNftAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.SEND_REQUEST, loader: data.loader });
  try {
    const payload = await sendNft({ ...data.data, dispatch });
    if (!payload || payload?.isCancelled) {
      dispatch({ type: actionTypes.SEND_MODAL_RESET });
      return;
    }
    const { status } = payload;
    if (status === 200) {
      dispatch({ type: actionTypes.SEND_SUCCESS, payload: payload.data });
    } else {
      dispatch({ type: actionTypes.SEND_FAILURE, payload });
    }
  } catch (err) {
    dispatch({ type: actionTypes.SEND_MODAL_RESET });
    if (err?.isCancelled) return;
    dispatch({
      type: actionTypes.SEND_FAILURE,
      payload: err.response || { data: { message: err.message || "Payment declined" } }
    });
  }
};

//////////////////////////////////////  RECEIVE NFT ACTION ///////////////////////////////

export let receiveNftAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.RECEIVE_REQUEST, loader: data.loader });
  const payload = await receiveNft(data.data);
  const { status } = payload;
  if (status === 200) {
    dispatch({ type: actionTypes.RECEIVE_SUCCESS, payload: payload.data });
  } else {
    dispatch({ type: actionTypes.RECEIVE_FAILURE, payload });
  }
};

//////////////////////////////////////  CANCEL SEND ACTION ///////////////////////////////

export let cancelSendNftAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.CANCEL_SEND_REQUEST, loader: data.loader });
  try {
    const payload = await cancelSendNft({ ...data.data, dispatch });
    if (!payload || payload?.isCancelled) {
      dispatch({ type: actionTypes.CANCEL_SEND_MODAL_RESET });
      return;
    }
    const { status } = payload;
    if (status === 200) {
      dispatch({ type: actionTypes.CANCEL_SEND_SUCCESS, payload: payload.data });
    } else {
      dispatch({ type: actionTypes.CANCEL_SEND_FAILURE, payload });
    }
  } catch (err) {
    dispatch({ type: actionTypes.CANCEL_SEND_MODAL_RESET });
    if (err?.isCancelled) return;
    dispatch({
      type: actionTypes.CANCEL_SEND_FAILURE,
      payload: err.response || { data: { message: err.message || "Payment declined" } }
    });
  }
};

/* PLACE MORE OFFER ACTION */
export let placeMoreOfferAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.PLACE_MOREOFFER_REQUEST, loader: data.loader });
  try {
    const payload = await placeMoreOffer({ ...data.data, dispatch });
    if (!payload || payload?.isCancelled) {
      dispatch({ type: actionTypes.PLACE_MOREOFFER_MODAL_RESET });
      return;
    }
    const { status } = payload;
    if (status === 200) {
      dispatch({
        type: actionTypes.PLACE_MOREOFFER_SUCCESS,
        payload: payload.data
      });
    } else {
      dispatch({ type: actionTypes.PLACE_MOREOFFER_FAILURE, payload });
    }
  } catch (err) {
    dispatch({ type: actionTypes.PLACE_MOREOFFER_MODAL_RESET });
    if (err?.isCancelled) return;
    dispatch({
      type: actionTypes.PLACE_MOREOFFER_FAILURE,
      payload:
        err.response ||
        err.data ||
        { data: { message: err.message || "Payment declined" } }
    });
  }
};

/* Get all placed offers */
export let getAllPlacedOffersAction = (data) => async (dispatch) => {
  dispatch({
    type: actionTypes.GET_ALLPLACEDOFFER_REQUEST,
    loader: data.loader
  });
  const payload = await getAllPlacedOffers(data.nftId);
  const { status } = payload;
  if (status === 200) {
    dispatch({
      type: actionTypes.GET_ALLPLACEDOFFER_SUCCESS,
      payload: payload.data
    });
  } else {
    dispatch({ type: actionTypes.GET_ALLPLACEDOFFER_FAILURE, payload });
  }
};

/* Accept placed offers action (QR + poll) */
export let acceptPlacedOffersAction = (data) => async (dispatch) => {
  dispatch({
    type: actionTypes.ACCEPT_PLACEDOFFER_REQUEST,
    loader: data.loader
  });
  try {
    const payload = await acceptPlacedOffer({ ...data.data, dispatch });
    if (!payload || payload?.isCancelled) {
      dispatch({ type: actionTypes.ACCEPT_PLACEDOFFER_MODAL_RESET });
      return;
    }
    const { status } = payload;
    if (status === 200) {
      dispatch({
        type: actionTypes.ACCEPT_PLACEDOFFER_SUCCESS,
        payload: payload.data
      });
    } else {
      dispatch({ type: actionTypes.ACCEPT_PLACEDOFFER_FAILURE, payload });
    }
  } catch (err) {
    dispatch({ type: actionTypes.ACCEPT_PLACEDOFFER_MODAL_RESET });
    if (err?.isCancelled) return;
    dispatch({
      type: actionTypes.ACCEPT_PLACEDOFFER_FAILURE,
      payload:
        err.response ||
        err.data ||
        { data: { message: err.message || "Payment declined" } }
    });
  }
};

/* All placed offer to be cancelled action */
export let allCancelPlacedOffersAction = (data) => async () => {
  const payload = await allCancelPlacedOffer(data);
  return payload;
};

/* Cancel placed offer action (QR + poll, same as place offer) */
export let cancelPlacedOffersAction = (data) => async (dispatch) => {
  dispatch({
    type: actionTypes.CANCEL_PLACEDOFFERS_REQUEST,
    loader: data.loader
  });
  try {
    const payload = await cancelPlacedOffer({ ...data.data, dispatch });
    if (!payload || payload?.isCancelled) {
      dispatch({ type: actionTypes.CANCEL_PLACEDOFFERS_MODAL_RESET });
      return;
    }
    const { status } = payload;
    if (status === 200) {
      dispatch({
        type: actionTypes.CANCEL_PLACEDOFFERS_SUCCESS,
        payload: payload.data
      });
    } else {
      dispatch({ type: actionTypes.CANCEL_PLACEDOFFERS_FAILURE, payload });
    }
  } catch (err) {
    dispatch({ type: actionTypes.CANCEL_PLACEDOFFERS_MODAL_RESET });
    if (err?.isCancelled) return;
    dispatch({
      type: actionTypes.CANCEL_PLACEDOFFERS_FAILURE,
      payload:
        err.response ||
        err.data ||
        { data: { message: err.message || "Payment declined" } }
    });
  }
};

/* All buy offers received to owner */
export let allOfferByNftOwnerAction = () => async () => {
  const payload = await allOfferByNftOwner();
  return payload;
};
