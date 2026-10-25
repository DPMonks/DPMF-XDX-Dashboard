import axios from "axios";
import config from "../../config.json";
import { checkTransactionStatusHelper } from "../../helper";
const token = localStorage.getItem("jwtToken");
//////////// GET SEND STATUS START///////
export const getSendStatus = async (data) => {
	const getBalanceCofig = {
		baseURL: config.LOCAL_API_URL,
		headers: {
			Authorization: `Basic ${token}`,
		},
		data,
		method: "post",
		url: "xrpl/SendCheckStaus",
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
//////////// GET SEND STATUS END///////

//////////// Get Receive nft service start///////
export const getAcceptNFTStatus = async (data) => {
	const getAcceptStatusCofig = {
		baseURL: config.LOCAL_API_URL,
		headers: {
			Authorization: `Basic ${token}`,
		},
		data,
		method: "post",
		url: "xrpl/CheckAcceptStatus",
	};

	try {
		const data = await axios(getAcceptStatusCofig);
		if (data.status === 200) {
			return data;
		}
	} catch (e) {
		return e.response;
	}
};
//////////// Get Receive nft service end///////

//////////// Accept NFT with QR + Xaman sign flow ///////
export const acceptNFTWithQR = async (data) => {
	const { dispatch, nft_id } = data;
	const acceptTransferConfig = {
		baseURL: config.LOCAL_API_URL,
		headers: {
			Authorization: `Basic ${token}`,
		},
		data: { nft_id },
		method: "post",
		url: "xrpl/AcceptTransferNft",
	};

	try {
		const acceptResp = await axios(acceptTransferConfig);
		if (acceptResp?.data?.balance === false) {
			return {
				status: 400,
				data: {
					error: true,
					balance: false,
					message: acceptResp?.data?.message || "Insufficient balance",
				},
			};
		}
		if (acceptResp?.status === 200 && acceptResp?.data?.success) {
			const { uuid, qr_url, next_url, pushed } = acceptResp.data;
			const resolvedQrUrl =
				qr_url || (uuid ? `https://xumm.app/sign/${uuid}_q.png` : null);
			const resolvedNextUrl =
				next_url || (uuid ? `https://xumm.app/sign/${uuid}` : null);
			const request = {
				uuid,
				nft_id,
				showQR: !pushed,
				qr_url: resolvedQrUrl,
				next_url: resolvedNextUrl,
				dispatch,
			};
			const status = await checkTransactionStatusHelper(
				request,
				"xrpl/acceptTransferStatus"
			);
			return status;
		}
		return acceptResp;
	} catch (e) {
		if (e?.isCancelled) {
			return { isCancelled: true };
		}
		return e.response;
	}
};
//////////// Accept NFT with QR end///////

//////////// Get declined nft service start///////
export const getDeclinedNFTStatus = async () => {
	const getDeclinedStatusCofig = {
		baseURL: config.LOCAL_API_URL,
		headers: {
			Authorization: `Basic ${token}`,
		},
		method: "post",
		url: "xrpl/ReceiverDeclinedDetails",
	};

	try {
		const data = await axios(getDeclinedStatusCofig);
		if (data.status === 200) {
			return data;
		}
	} catch (e) {
		return e.response;
	}
};
//////////// Get declined nft service end///////


//////////// Declined nft service start///////
export const declinedNFTRequest = async (data) => {
	const nft_id = data?.nft_id || data?.data?.nft_id;
	const declinedNFTRequestCofig = {
		baseURL: config.LOCAL_API_URL,
		headers: {
			Authorization: `Basic ${token}`,
		},
		data: { nft_id },
		method: "post",
		url: "xrpl/DeclineNft",
	};

	try {
		const response = await axios(declinedNFTRequestCofig);
		return response;
	} catch (e) {
		return e.response;
	}
};
////////////  Declined nft service end///////
