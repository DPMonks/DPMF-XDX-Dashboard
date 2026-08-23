import axios from "axios";
import config from "../../config.json";
import { checkTransactionStatusHelper } from "../../helper";
// import axiosRetry from 'axios-retry';
// axiosRetry(axios, { retries: 3 });
// import api from "./api";

const token = localStorage.getItem("jwtToken");

//////////// QR CODE STRAT///////
export const walletConnect = async (data) => {
  const walletCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data,
    method: "post",
    url: "xumm/connect"
  };

  try {
    const wallet = await axios(walletCofig);
    if (wallet.status === 200) {
      return wallet;
    }
  } catch (e) {
    return e.response;
  }
};
//////////// QR CODE END///////
//////////// ACCOUNT DETAIL STRAT///////
export const accountDetail = async (data) => {
  const uuidCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data,
    method: "post",
    url: "xumm/accountDetail"
  };

  try {
    const accountDetail = await axios(uuidCofig);
    if (accountDetail.status === 200) {
      return accountDetail;
    }
  } catch (e) {
    return e.response;
  }
};
//////////// ACCOUNT DETAIL END///////

export const profileFee = async (id) => {
  const feeConfig = {
    baseURL: config.LOCAL_API_URL,
    // headers: {
    //   Authorization: `Basic ${token}`
    // },
    method: "get",
    url: `xumm/checkProfileRegistartionFee/${id}`
  };

  try {
    const fee = await axios(feeConfig);
    if (fee.status === 200) {
      return fee;
    }
  } catch (e) {
    return e.response;
  }
};

//////////// GET BALANCE STRAT///////
export const getBalanceDetail = async (data) => {
  const getBalanceCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data,
    method: "post",
    url: "xumm/getBalance"
  };

  try {
    const balance = await axios(getBalanceCofig);
    if (balance.status === 200) {
      return balance;
    }
  } catch (e) {
    return e.response;
  }
};
//////////// GET BALANCE END///////

//////////// GET registrationFee///////
export const registrationFeeApi = async (data) => {
  const { dispatch, ...requestBody } = data;
  const getBalanceCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data: requestBody,
    method: "post",
    url: "xumm/registrationFee"
  };

  try {
    const balance = await axios(getBalanceCofig);
    if (balance.status === 200) {
      const { uuid, qr_url, next_url, pushed, next } = balance.data;
      if (!uuid) {
        return balance;
      }
      const finalQrUrl =
        qr_url || (uuid ? `https://xumm.app/sign/${uuid}_q.png` : null);
      const finalNextUrl =
        next_url || next || (uuid ? `https://xumm.app/sign/${uuid}` : null);
      const request = {
        uuid,
        token: requestBody.token,
        account: requestBody.account,
        dispatch,
        showQR: !pushed,
        qr_url: finalQrUrl,
        next_url: finalNextUrl,
        title: "Registration",
        bodyText:
          "Scan with XAMAN to sign in and register your wallet for a FREE profile."
      };
      const status = await checkTransactionStatusHelper(
        request,
        "/xumm/checkRegistrationFee"
      );
      return status;
    }
    return balance;
  } catch (e) {
    if (e?.isCancelled) {
      return {
        status: 400,
        data: {
          success: false,
          cancelled: true,
          message: e.message || "Transaction cancelled by user"
        }
      };
    }
    if (e.response == undefined) {
      return e;
    }
    return e.response;
  }
};
//////////// GET registrationFee///////

// async function checkTransactionStatus(data) {
//   let retries = 0;
//   const maxRetries = 15; // Stop polling after 10 tries (~30 seconds)

//   return new Promise((resolve, reject) => {
//     const interval = setInterval(async () => {
//       try {
//         const registrationConfig = {
//           baseURL: config.LOCAL_API_URL,
//           headers: {
//             Authorization: `Basic ${token}`
//           },
//           data,
//           method: "post",
//           url: "xumm/checkRegistrationFee"
//         };

//         if (++retries >= maxRetries) {
//           clearInterval(interval);
//           reject("You have exceeded time limit");
//         }
//         // start from here

//         const resp = await axios(registrationConfig);
//         clearInterval(interval); // Stop polling
//         resolve(resp);
//       } catch (error) {
//         // console.error("❌ Error checking status:", error);
//         clearInterval(interval); // Stop polling
//         reject(error.response);
//       }
//     }, 3000); // Check every 3 seconds
//   });
// }

//////////// DIS CONNECT STRAT///////
export const walletDisConnect = async (data) => {
  const walletDisCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data,
    method: "post",
    url: "xumm/disConnect"
  };

  try {
    const disCon = await axios(walletDisCofig);
    if (disCon.status === 200) {
      return disCon;
    }
  } catch (e) {
    return e.response;
  }
};

// Create payment before create an NFT
export const createPayment = async (data) => {
  const paymentConfig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${token}`
    },
    data,
    method: "post",
    url: "nft/createPayment"
  };

  try {
    const payment = await axios(paymentConfig);
    return payment;
  } catch (error) {
    return error.response;
  }
};

export const checkPaymentStatus = async ({ uuid, signal }) => {
  const paymentConfig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Accept: "application/json"
    },
    method: "get",
    url: "nft/check-payment-status/" + uuid,
    signal
  };

  try {
    const paymentStatus = await axios(paymentConfig);
    return paymentStatus;
  } catch (error) {
    if (axios.isCancel(error) || error.name === "CanceledError") {
      console.log("checkPaymentStatus request cancelled");
      throw error;
    }

    console.error(error.response, "Payment Status Error:", error.message);
    return error.response;
  }
};

export const cancelPaymentStatusApi = async ({ uuid }) => {
  const paymentCancelConfig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Accept: "application/json"
    },
    method: "delete",
    url: "nft/payment/status/" + uuid
  };

  try {
    const paymentCancelStatus = await axios(paymentCancelConfig);
    return paymentCancelStatus;
  } catch (error) {
    console.error(error.response, "Payment cancel Error:", error.message);
    return error.response;
  }
};

export const getMintedOfferById = async (walletToken) => {
  const mintOfferConfig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    method: "get",
    url: `mintoffer/getbyissuer/${walletToken}`
  };

  try {
    const mintOfferStatus = await axios(mintOfferConfig);
    return mintOfferStatus;
  } catch (error) {
    console.error(error.response, "get mint offer Error:", error.message);
    return error.response;
  }
};

export const getAllMintedOffer = async () => {
  const allmintOfferConfig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    method: "get",
    url: `mintoffer/get`
  };

  try {
    const allmintOfferStatus = await axios(allmintOfferConfig);
    return allmintOfferStatus;
  } catch (error) {
    console.error(error.response, "get all mint offer Error:", error.message);
    return error.response;
  }
};
