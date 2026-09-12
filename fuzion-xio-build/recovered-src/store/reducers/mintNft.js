import { actionTypes } from "../actionTypes/mintNft";

const initialState = {
  isSubmit: false,
  mint: null,
  error: null
};

const initialMintOfferState = {
  isSubmit: false,
  mintOffer: null,
  error: null
};

const initialSaleState = {
  isSubmit: false,
  sale: null,
  error: null
};
const initialCancelSaleState = {
  isSubmit: false,
  cancelSale: null,
  error: null
};
const initialBuyNftState = {
  isSubmit: false,
  buy: null,
  error: null
};
const initialBidTokenState = {
  isSubmit: false,
  bid: null,
  error: null
};
const initialBidCancelState = {
  isSubmit: false,
  bidCancel: null,
  error: null
};
const initialBidAndBurnTokenState = {
  isSubmit: false,
  bidAndBurn: null,
  error: null
};
const initialNumberOfMinted = {
  onLoad: false,
  numberOfMinted: null,
  error: null
};
const initialDeleteNftState = {
  isSubmit: false,
  deletedNft: null,
  error: null
};
const initialTotalTrade = {
  loader: false,
  totalTrade: null,
  error: null
};
const initialSendState = {
  isSubmit: false,
  send: null,
  error: null
};
const initialReceiveState = {
  isSubmit: false,
  receive: null,
  error: null
};
const initialCancelSendState = {
  isSubmit: false,
  cancelSend: null,
  error: null
};
const initialPlaceMoreofferState = {
  isSubmit: false,
  placeMoreoffer: null,
  error: null
};
const initialGetAllOfferState = {
  isSubmit: false,
  getAllPlacedoffer: null,
  error: null
};
const initialacceptPlacedOfferState = {
  isSubmit: false,
  acceptPlacedoffer: null,
  error: null
};

const cancelPlacedOfferState = {
  isSubmit: false,
  cancelPlacedoffer: null,
  error: null
};

////////////////////////////////// MINT NFT OFFER REDUCEN ///////////////////////
export const mintNftOfferReducer = (state = initialMintOfferState, action) => {
  switch (action.type) {
    case actionTypes.MINT_OFFER_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.MINT_OFFER_SUCCESS:
      return {
        ...state,
        isSubmit: false,
        mintOffer: action.payload,
        error: false
      };
    case actionTypes.MINT_OFFER_FAILURE:
      return {
        ...state,
        isSubmit: false,
        mintOffer: action.payload,
        error: action.payload.data
      };
    case actionTypes.MINT_OFFER_MODAL_RESET:
      return { ...initialMintOfferState };

    default:
      return state;
  }
};

////////////////////////////////// MINT NFT REDUCEN ///////////////////////
export const mintNftReducer = (state = initialState, action) => {
  switch (action.type) {
    case actionTypes.MINT_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.MINT_SUCCESS:
      return {
        ...state,
        isSubmit: false,
        mint: action.payload,
        error: false
      };
    case actionTypes.MINT_FAILURE:
      return {
        ...state,
        isSubmit: false,
        mint: action.payload,
        error: action.payload.data
      };
    case actionTypes.MINT_MODAL_RESET:
      return { ...initialState };

    default:
      return state;
  }
};

////////////////////////////////// BURN NFT REDUCER ///////////////////////

export const burnNftReducer = (state = initialState, action) => {
  switch (action.type) {
    case actionTypes.BURN_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.BURN_SUCCESS:
      return {
        ...state,
        isSubmit: initialState.loader,
        mint: action.payload,
        error: false
      };
    case actionTypes.BURN_FAILURE:
      return {
        ...state,
        isSubmit: initialState.loader,
        mint: action.payload,
        error: action.payload?.data ?? action.payload
      };
    case actionTypes.BURN_MODAL_RESET:
      return { ...initialState };

    default:
      return state;
  }
};

////////////////////////////////// SALE NFT REDUCER ///////////////////////

export const saleNftReducer = (state = initialSaleState, action) => {
  switch (action.type) {
    case actionTypes.SALE_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.SALE_SUCCESS:
      return {
        ...state,
        isSubmit: initialState.loader,
        sale: action.payload,
        error: false
      };
    case actionTypes.SALE_FAILURE:
      return {
        ...state,
        isSubmit: initialState.loader,
        sale: action.payload,
        error: action.payload.data
      };
    case actionTypes.SALE_MODAL_RESET:
      return { ...initialSaleState };

    default:
      return state;
  }
};

////////////////////////////////// CANCEL SALE NFT REDUCER ///////////////////////

export const cancelSaleNftReducer = (
  state = initialCancelSaleState,
  action
) => {
  switch (action.type) {
    case actionTypes.CANCEL_SALE_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.CANCEL_SALE_SUCCESS:
      return {
        ...state,
        isSubmit: initialState.loader,
        cancelSale: action.payload,
        error: false
      };
    case actionTypes.CANCEL_SALE_FAILURE:
      return {
        ...state,
        isSubmit: initialState.loader,
        cancelSale: action.payload,
        error: action.payload.data
      };
    case actionTypes.CANCEL_SALE_MODAL_RESET:
      return { ...initialCancelSaleState };

    default:
      return state;
  }
};

////////////////////////////////// BUY NFT REDUCER ///////////////////////

export const buyNftReducer = (state = initialBuyNftState, action) => {
  switch (action.type) {
    case actionTypes.BUY_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.BUY_SUCCESS:
      return {
        ...state,
        isSubmit: initialState.loader,
        buy: action.payload,
        error: false
      };
    case actionTypes.BUY_FAILURE:
      return {
        ...state,
        isSubmit: initialState.loader,
        buy: action.payload,
        error: action.payload.data
      };
    case actionTypes.BUY_MODAL_RESET:
      return { ...initialBuyNftState };

    default:
      return state;
  }
};

////////////////////////////////// BID NFT REDUCER ///////////////////////

export const bidTokenReducer = (state = initialBidTokenState, action) => {
  switch (action.type) {
    case actionTypes.BID_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.BID_SUCCESS:
      return {
        ...state,
        isSubmit: initialState.loader,
        bid: action.payload,
        error: false
      };
    case actionTypes.BID_FAILURE:
      return {
        ...state,
        isSubmit: initialState.loader,
        bid: action.payload,
        error: action.payload.data
      };

    default:
      return state;
  }
};

////////////////////////////////// CANCEL BUY NFT REDUCER ///////////////////////

export const bidCancelReducer = (state = initialBidCancelState, action) => {
  switch (action.type) {
    case actionTypes.CANCEL_BID_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.CANCEL_BID_SUCCESS:
      return {
        ...state,
        isSubmit: initialState.loader,
        bidCancel: action.payload,
        error: false
      };
    case actionTypes.CANCEL_BID_FAILURE:
      return {
        ...state,
        isSubmit: initialState.loader,
        bidCancel: action.payload,
        error: action.payload.data
      };

    default:
      return state;
  }
};

////////////////////////////////// BID NFT REDUCER ///////////////////////

export const bidAndBurnTokenReducer = (
  state = initialBidAndBurnTokenState,
  action
) => {
  switch (action.type) {
    case actionTypes.BID_AND_BURN_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.BID_AND_BURN_SUCCESS:
      return {
        ...state,
        isSubmit: initialState.loader,
        bidAndBurn: action.payload,
        error: false
      };
    case actionTypes.BID_AND_BURN_FAILURE:
      return {
        ...state,
        isSubmit: initialState.loader,
        bidAndBurn: action.payload,
        error: action.payload.data
      };

    default:
      return state;
  }
};

////////////////////////////////// NUMBER OF MINTED  ///////////////////////

export const numberOfMintedReducer = (
  state = initialNumberOfMinted,
  action
) => {
  switch (action.type) {
    case actionTypes.NUMBER_OF_MINTED_REQUEST:
      return {
        ...state,
        onLoad: action.loader
      };
    case actionTypes.NUMBER_OF_MINTED_SUCCESS:
      return {
        ...state,
        onLoad: initialState.loader,
        numberOfMinted: action.payload,
        error: false
      };
    case actionTypes.NUMBER_OF_MINTED_FAILURE:
      return {
        ...state,
        onLoad: initialState.loader,
        numberOfMinted: action.payload,
        error: action.payload.data
      };
    default:
      return state;
  }
};

// ===============DELETE NFT REDUCER=================

export const deleteNftReducer = (state = initialDeleteNftState, action) => {
  switch (action.type) {
    case actionTypes.DELETENFT_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.DELETENFT_SUCCESS:
      return {
        ...state,
        isSubmit: initialState.loader,
        deletedNft: action.payload,
        error: false
      };
    case actionTypes.DELETENFT_FAILURE:
      return {
        ...state,
        isSubmit: initialState.loader,
        deletedNft: action.payload,
        error: action.payload.data
      };

    default:
      return state;
  }
};

export const totalTradeReducer = (state = initialTotalTrade, action) => {
  switch (action.type) {
    case actionTypes.TOTALTRADE_REQUEST:
      return {
        ...state,
        loader: action.loader
      };
    case actionTypes.TOTALTRADE_SUCCESS:
      return {
        ...state,
        loader: initialTotalTrade.loader,
        totalTrade: action.payload,
        error: false
      };
    case actionTypes.TOTALTRADE_FAILURE:
      return {
        ...state,
        loader: initialTotalTrade.loader,
        totalTrade: initialTotalTrade.totalTrade,
        error: action.payload.data
      };

    default:
      return state;
  }
};

////////////////////////////////// SEND NFT REDUCER ///////////////////////

export const sendNftReducer = (state = initialSendState, action) => {
  switch (action.type) {
    case actionTypes.SEND_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.SEND_SUCCESS:
      return {
        ...state,
        isSubmit: initialState.loader,
        send: action.payload,
        error: false
      };
    case actionTypes.SEND_FAILURE:
      return {
        ...state,
        isSubmit: initialState.loader,
        send: action.payload,
        error: action.payload?.data ?? action.payload
      };
    case actionTypes.SEND_MODAL_RESET:
      return { ...initialSendState };

    default:
      return state;
  }
};

////////////////////////////////// RECEIVE NFT REDUCER ///////////////////////

export const receiveNftReducer = (state = initialReceiveState, action) => {
  switch (action.type) {
    case actionTypes.RECEIVE_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.RECEIVE_SUCCESS:
      return {
        ...state,
        isSubmit: initialState.loader,
        receive: action.payload,
        error: false
      };
    case actionTypes.RECEIVE_FAILURE:
      return {
        ...state,
        isSubmit: initialState.loader,
        receive: action.payload,
        error: action.payload.data
      };

    default:
      return state;
  }
};

////////////////////////////////// CANCEL SALE NFT REDUCER ///////////////////////

export const cancelSendNftReducer = (
  state = initialCancelSendState,
  action
) => {
  switch (action.type) {
    case actionTypes.CANCEL_SEND_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.CANCEL_SEND_SUCCESS:
      return {
        ...state,
        isSubmit: initialState.loader,
        cancelSend: action.payload,
        error: false
      };
    case actionTypes.CANCEL_SEND_FAILURE:
      return {
        ...state,
        isSubmit: initialState.loader,
        cancelSend: action.payload,
        error: action.payload?.data ?? action.payload
      };
    case actionTypes.CANCEL_SEND_MODAL_RESET:
      return { ...initialCancelSendState };

    default:
      return state;
  }
};

/* place moreoffer reducer */

export const placeMoreofferReducer = (
  state = initialPlaceMoreofferState,
  action
) => {
  switch (action.type) {
    case actionTypes.PLACE_MOREOFFER_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.PLACE_MOREOFFER_SUCCESS:
      return {
        ...state,
        isSubmit: initialState.loader,
        placeMoreoffer: action.payload,
        error: false
      };
    case actionTypes.PLACE_MOREOFFER_FAILURE:
      return {
        ...state,
        isSubmit: initialState.loader,
        placeMoreoffer: action.payload,
        error: action.payload.data
      };
    case actionTypes.PLACE_MOREOFFER_MODAL_RESET:
      return { ...initialPlaceMoreofferState };

    default:
      return state;
  }
};

/* Get all placed offers reducer*/

export const getAllPlacedoffersReducer = (
  state = initialGetAllOfferState,
  action
) => {
  switch (action.type) {
    case actionTypes.GET_ALLPLACEDOFFER_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.GET_ALLPLACEDOFFER_SUCCESS:
      return {
        ...state,
        isSubmit: initialState.loader,
        getAllPlacedoffer: action.payload,
        error: false
      };
    case actionTypes.GET_ALLPLACEDOFFER_FAILURE:
      return {
        ...state,
        isSubmit: initialState.loader,
        getAllPlacedoffer: action.payload,
        error: action.payload.data
      };

    default:
      return state;
  }
};

/* Accept placed offer reducer */
export const acceptPlacedoffersReducer = (
  state = initialacceptPlacedOfferState,
  action
) => {
  switch (action.type) {
    case actionTypes.ACCEPT_PLACEDOFFER_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.ACCEPT_PLACEDOFFER_SUCCESS:
      return {
        ...state,
        isSubmit: initialState.loader,
        acceptPlacedoffer: action.payload,
        error: false
      };
    case actionTypes.ACCEPT_PLACEDOFFER_FAILURE:
      return {
        ...state,
        isSubmit: initialState.loader,
        acceptPlacedoffer: action.payload,
        error: action.payload.data
      };
    case actionTypes.ACCEPT_PLACEDOFFER_MODAL_RESET:
      return { ...initialacceptPlacedOfferState };

    default:
      return state;
  }
};

/* All cancel placed offer reducer */
export const cancelPlacedOffersReducer = (
  state = cancelPlacedOfferState,
  action
) => {
  switch (action.type) {
    case actionTypes.CANCEL_PLACEDOFFERS_REQUEST:
      return {
        ...state,
        isSubmit: action.loader
      };
    case actionTypes.CANCEL_PLACEDOFFERS_SUCCESS:
      return {
        ...state,
        isSubmit: initialState.loader,
        cancelPlacedoffer: action.payload,
        error: false
      };
    case actionTypes.CANCEL_PLACEDOFFERS_FAILURE:
      return {
        ...state,
        isSubmit: initialState.loader,
        cancelPlacedoffer: action.payload,
        error: action.payload.data
      };
    case actionTypes.CANCEL_PLACEDOFFERS_MODAL_RESET:
      return { ...cancelPlacedOfferState };

    default:
      return state;
  }
};
