import { actionTypes } from "../actionTypes/wallet";

const initialState = {
  isConnect: false,
  wallet: null,
  mintedOffers: null,
  allMintedOffers: null,
  error: null
};
const initialAccountState = {
  isConnect: false,
  account: null,
  error: null
};
const initialBalancetState = {
  isConnect: false,
  currency: null,
  error: null
};
const initialRegistrationFeetState = {
  isConnect: false,
  data: null,
  error: null
};

const initialDisConState = {
  isConnect: false,
  data: null,
  error: null
};

const initialPaymentState = {
  isSubmit: false,
  paymentInfo: null,
  error: null,
  qrModal: {
    visible: false,
    qr_url: null,
    uuid: null,
    next_url: null
  }
};

export const walletActionReducer = (state = initialState, action) => {
  switch (action.type) {
    case actionTypes.WALLET_CONNECT_REQUEST:
      return {
        ...state,
        isConnect: action.loader
      };
    case actionTypes.WALLET_CONNECT_SUCCESS:
      return {
        ...state,
        isConnect: initialState.loader,
        wallet: action.payload
      };
    case actionTypes.WALLET_CONNECT_FAILURE:
      return {
        ...state,
        isConnect: initialState.loader,
        wallet: action.payload,
        error: action.payload.data
      };

    case actionTypes.CREATE_PLACED_OFFER_BY_OWNER_SUCCESS:
      return {
        ...state,
        isConnect: initialState.loader,
        mintedOffers: action.payload,
        error: initialState.error
      };

    case actionTypes.GET_ALLPLACED_OFFER_BY_OWNER_SUCCESS:
      return {
        ...state,
        isConnect: initialState.loader,
        allMintedOffers: action.payload,
        error: initialState.error
      };
    default:
      return state;
  }
};

export const accountDetailReducer = (state = initialAccountState, action) => {
  switch (action.type) {
    case actionTypes.ACCOUNT_DETAIL_REQUEST:
      return {
        ...state,
        isConnect: action.loader
      };
    case actionTypes.ACCOUNT_DETAIL_SUCCESS:
      return {
        ...state,
        isConnect: initialState.loader,
        account: action.payload
      };
    case actionTypes.ACCOUNT_DETAIL_FAILURE:
      return {
        ...state,
        isConnect: initialState.loader,
        account: action.payload,
        error: action.payload.data
      };

    default:
      return state;
  }
};

export const getBalanceReducer = (state = initialBalancetState, action) => {
  switch (action.type) {
    case actionTypes.GET_BALANCE_REQUEST:
      return {
        ...state,
        isConnect: action.loader
      };
    case actionTypes.GET_BALANCE_SUCCESS:
      return {
        ...state,
        isConnect: initialState.loader,
        currency: action.payload
      };
    case actionTypes.GET_BALANCE_FAILURE:
      return {
        ...state,
        isConnect: initialState.loader,
        currency: action.payload,
        error: action.payload.data
      };

    default:
      return state;
  }
};

export const registrationFeeReducer = (
  state = initialRegistrationFeetState,
  action
) => {
  switch (action.type) {
    case actionTypes.REGISTRATION_FEE_REQUEST:
      return {
        ...state,
        isConnect: action.loader
      };
    case actionTypes.REGISTRATION_FEE_SUCCESS:
      return {
        ...state,
        isConnect: initialState.loader,
        data: action.payload
      };
    case actionTypes.REGISTRATION_FEE_FAILURE:
      return {
        ...state,
        isConnect: initialState.loader,
        data: action.payload,
        error: action.payload.data
      };
    default:
      return state;
  }
};

export const walletDisConnectReducer = (state = initialDisConState, action) => {
  switch (action.type) {
    case actionTypes.WALLET_DISCONNECT_REQUEST:
      return {
        ...state,
        isConnect: action.loader
      };
    case actionTypes.WALLET_DISCONNECT_SUCCESS:
      return {
        ...state,
        isConnect: initialState.loader,
        data: action.payload
      };
    case actionTypes.WALLET_DISCONNECT_FAILURE:
      return {
        ...state,
        isConnect: initialState.loader,
        data: action.payload,
        error: action.payload.data
      };

    default:
      return state;
  }
};

export const IPFSPaymentReducer = (state = initialPaymentState, action) => {
  switch (action.type) {
    case actionTypes.CREATE_PAYMENT_REQUEST:
      return {
        ...state,
        isSubmit: action.loader,
        paymentInfo: initialPaymentState.paymentInfo,
        error: initialPaymentState.error
      };
    case actionTypes.CREATE_PAYMENT_SUCCESS:
      return {
        ...state,
        isSubmit: initialPaymentState.isSubmit,
        paymentInfo: action.payload,
        error: initialPaymentState.error
      };
    case actionTypes.CREATE_PAYMENT_FAILURE:
      return {
        ...state,
        isSubmit: initialPaymentState.isSubmit,
        paymentInfo: initialPaymentState.paymentInfo,
        error: action.payload.data,
        qrModal: {
          visible: false,
          qr_url: null,
          uuid: null,
          next_url: null,
          title: null,
          bodyText: null,
          tokenPaymentWorkaround: false
        }
      };
    case actionTypes.SHOW_PAYMENT_QR:
      return {
        ...state,
        qrModal: {
          visible: true,
          qr_url: action.payload.qr_url,
          uuid: action.payload.uuid,
          next_url: action.payload.next_url,
          title: action.payload.title ?? null,
          bodyText: action.payload.bodyText ?? null,
          tokenPaymentWorkaround: action.payload.tokenPaymentWorkaround ?? false
        },
        isSubmit: initialPaymentState.isSubmit,
        paymentInfo: initialPaymentState.paymentInfo,
        error: initialPaymentState.error
      };
    case actionTypes.HIDE_PAYMENT_QR:
      return {
        ...state,
        qrModal: { visible: false, qr_url: null, uuid: null, next_url: null },
        isSubmit: initialPaymentState.isSubmit,
        paymentInfo: initialPaymentState.paymentInfo,
        error: initialPaymentState.error
      };
    default:
      return state;
  }
};
