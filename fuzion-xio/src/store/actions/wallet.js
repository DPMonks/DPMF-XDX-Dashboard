import axios from "axios";
import { makeCancellable } from "../../helper";
import { actionTypes } from "../actionTypes/wallet";
import {
  walletConnect,
  accountDetail,
  getBalanceDetail,
  registrationFeeApi,
  walletDisConnect,
  createPayment,
  checkPaymentStatus,
  getMintedOfferById,
  getAllMintedOffer,
  profileFee,
  cancelPaymentStatusApi
} from "../services/wallet";

/////////////////// QR CODE start////////////////

export let connectWalletAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.WALLET_CONNECT_REQUEST, loader: data.loader });
  const payload = await walletConnect(data.formDataInput);
  const { status } = payload;
  if (status === 200) {
    dispatch({
      type: actionTypes.WALLET_CONNECT_SUCCESS,
      payload: payload.data
    });
  } else {
    dispatch({ type: actionTypes.WALLET_CONNECT_FAILURE, payload });
  }
};
/////////////////// QR CODE END////////////////

/////////////////// ACCOUNT DETAIL start////////////////
export let accountDetailAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.ACCOUNT_DETAIL_REQUEST, loader: data.loader });
  const payload = await accountDetail(data.data);
  const status = payload?.status;
  if (status === 200) {
    dispatch({
      type: actionTypes.ACCOUNT_DETAIL_SUCCESS,
      payload: payload.data
    });
    return;
  }
  if (status === 202) {
    // Still waiting for the wallet. Do not error — a reload here aborts sign-in.
    return;
  }
  dispatch({
    type: actionTypes.ACCOUNT_DETAIL_FAILURE,
    payload: { data: payload?.data || payload || { message: "Xaman sign-in failed" } }
  });
};

/////////////////// ACCOUNT DETAIL END////////////////

// get profile fee
export const getProfileFee = async (id) => {
  const payload = await profileFee(id);
  const { status } = payload;
  if (status === 200) {
    return payload.data;
  }
};

/////////////////// GET BALANCE start////////////////
export let getBalanceAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.GET_BALANCE_REQUEST, loader: data.loader });
  const payload = await getBalanceDetail(data.data);
  const { status } = payload;
  if (status === 200) {
    dispatch({ type: actionTypes.GET_BALANCE_SUCCESS, payload: payload.data });
  } else {
    dispatch({ type: actionTypes.GET_BALANCE_FAILURE, payload });
  }
};

/////////////////// GET BALANCE END////////////////

/////////////////// Registration Charge////////////////
export let registrationFee = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.REGISTRATION_FEE_REQUEST, loader: data.loader });
  const payload = await registrationFeeApi({ ...data.data, dispatch });

  if (!payload || typeof payload.status !== "number") {
    dispatch({ type: actionTypes.REGISTRATION_FEE_FAILURE, payload: payload ?? {} });
    return {
      success: false,
      cancelled: payload?.isCancelled,
      message: payload?.message
    };
  }

  const { status } = payload;
  if (status === 200) {
    dispatch({
      type: actionTypes.REGISTRATION_FEE_SUCCESS,
      payload: payload.data
    });
    return payload.data;
  } else {
    dispatch({ type: actionTypes.REGISTRATION_FEE_FAILURE, payload });
    return payload.data ?? { success: false };
  }
};
/////////////////// Registration Charge////////////////

/////////////////// Disconnect wallet START////////////////
export let disConnectWalletAction = (data) => async (dispatch) => {
  dispatch({
    type: actionTypes.WALLET_DISCONNECT_REQUEST,
    loader: data.loader
  });
  const payload = await walletDisConnect(data.formDataInput);
  const { status } = payload;
  if (status === 200) {
    dispatch({
      type: actionTypes.WALLET_DISCONNECT_SUCCESS,
      payload: payload.data
    });
  } else {
    dispatch({ type: actionTypes.WALLET_DISCONNECT_FAILURE, payload });
  }
};
/////////////////// Disconnect wallet end ////////////////

// create payment for IPFS accound based on total nft count

let abortController = null;
let currentPaymentUuid = null;

export const createPaymentForIPFS = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.CREATE_PAYMENT_REQUEST, loader: data.loader });

  try {
    const payload = await createPayment(data.data);
    if (!payload || payload.status !== 200) {
      return dispatch({ type: actionTypes.CREATE_PAYMENT_FAILURE, payload });
    }

    const { uuid, pushed, qr_url, next_url } = payload.data;
    currentPaymentUuid = uuid; // store uuid for cancellation

    if (!pushed) {
      dispatch({
        type: actionTypes.SHOW_PAYMENT_QR,
        payload: { uuid, qr_url, next_url }
      });
    }

    if (uuid) {
      abortController = new AbortController(); // create abort controller

      try {
        const payload1 = await checkPaymentStatus({
          uuid,
          signal: abortController.signal // pass signal
        });

        const { status } = payload1;
        if (status === 200) {
          dispatch({ type: actionTypes.HIDE_PAYMENT_QR });
          dispatch({
            type: actionTypes.CREATE_PAYMENT_SUCCESS,
            payload: payload1.data
          });
        } else if (status === 400) {
          dispatch({ type: actionTypes.HIDE_PAYMENT_QR });
          dispatch({
            type: actionTypes.CREATE_PAYMENT_FAILURE,
            payload: payload1
          });
        }
      } catch (e) {
        console.log(e, "check signal error");
      } finally {
        abortController = null;
        currentPaymentUuid = null;
      }
    }
  } catch (error) {
    dispatch({ type: actionTypes.HIDE_PAYMENT_QR });
    dispatch({
      type: actionTypes.CREATE_PAYMENT_FAILURE,
      payload: { error: true, message: "Payment creation failed" }
    });
  }
};

// Cancel both frontend request AND backend polling
export const cancelPayment = () => async (dispatch) => {
  // 1. Abort the frontend HTTP request
  if (abortController) {
    abortController.abort();
    abortController = null;
  }

  // 2. Tell backend to stop polling
  if (currentPaymentUuid) {
    try {
      await cancelPaymentStatusApi({ uuid: currentPaymentUuid });
    } catch (e) {
      console.warn("Cancel request failed:", e.message);
    }
    currentPaymentUuid = null;
  }

  dispatch({ type: actionTypes.HIDE_PAYMENT_QR });
};

// export const createPaymentForIPFS = (data) => async (dispatch) => {
//   dispatch({ type: actionTypes.CREATE_PAYMENT_REQUEST, loader: data.loader });

//   try {
//     const payload = await createPayment(data.data);
//     if (!payload || payload.status !== 200) {
//       return dispatch({ type: actionTypes.CREATE_PAYMENT_FAILURE, payload });
//     }

//     const { uuid, pushed, qr_url, next_url } = payload.data;

//     // ✅ If push failed → show QR modal
//     if (!pushed) {
//       dispatch({
//         type: actionTypes.SHOW_PAYMENT_QR,
//         payload: { uuid, qr_url, next_url }
//       });
//     }

//     // const { uuid } = payload.data;
//     if (uuid) {
//       // const interval = setInterval(async () => {
//       const payload1 = await checkPaymentStatus({ uuid });
//       const { status } = payload1;
//       if (status === 200) {
//         dispatch({ type: actionTypes.HIDE_PAYMENT_QR });
//         dispatch({
//           type: actionTypes.CREATE_PAYMENT_SUCCESS,
//           payload: payload1.data
//         });
//       } else if (status === 400) {
//         dispatch({ type: actionTypes.HIDE_PAYMENT_QR });
//         dispatch({
//           type: actionTypes.CREATE_PAYMENT_FAILURE,
//           payload: payload1
//         });
//       }
//       // 	clearInterval(interval);
//       // }, 5000);
//     }
//   } catch (error) {
//     console.error("❌ Error creating payment:", error);
//     dispatch({ type: actionTypes.HIDE_PAYMENT_QR });
//     dispatch({
//       type: actionTypes.CREATE_PAYMENT_FAILURE,
//       payload: { error: true, message: "Payment creation failed" }
//     });
//   }
// };

export const getMintedOffersByIsser = (walletToken) => async (dispatch) => {
  const payload = await getMintedOfferById(walletToken);
  const { status } = payload;

  if (status === 200) {
    dispatch({
      type: actionTypes.CREATE_PLACED_OFFER_BY_OWNER_SUCCESS,
      payload: payload.data
    });
  }
};

export const getAllMintedOffers = () => async (dispatch) => {
  const payload = await getAllMintedOffer();
  const { status } = payload;

  if (status === 200) {
    dispatch({
      type: actionTypes.GET_ALLPLACED_OFFER_BY_OWNER_SUCCESS,
      payload: payload.data
    });
  }
};

// const connectWebSocket = (uuid) => {
//     const socket = new WebSocket("ws://192.168.1.7:3000"); // Connect to backend WebSocket

//     socket.onopen = () => {
//       console.log("✅ WebSocket connected!");
//       socket.send(JSON.stringify({ type: "subscribe", uuid }));
//     };

//     socket.onmessage = (message) => {
//       const data = JSON.parse(message.data);
//       if (data.type === "payment_status") {
//          return data.status;
//       }
//     };

//     socket.onclose = () => {
//       console.log("❌ WebSocket disconnected");
//     };
//   };
