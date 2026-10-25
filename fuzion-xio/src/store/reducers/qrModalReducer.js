import { actionTypes } from "../actionTypes/wallet";

const initialQrModalState = {
  visible: false,
  qr_url: null,
  uuid: null,
  next_url: null,
  title: null,
  bodyText: null
};

export const qrModalReducer = (state = initialQrModalState, action) => {
  switch (action.type) {
    case actionTypes.SHOW_PAYMENT_QR:
      return {
        visible: true,
        uuid: action.payload.uuid,
        qr_url: action.payload.qr_url,
        next_url: action.payload.next_url,
        title: action.payload.title ?? null,
        bodyText: action.payload.bodyText ?? null
      };
    case actionTypes.HIDE_PAYMENT_QR:
      return initialQrModalState;
    default:
      return state;
  }
};
