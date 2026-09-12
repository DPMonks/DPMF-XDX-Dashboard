import {
	getSendStatus,
	acceptNFTWithQR,
	getDeclinedNFTStatus,
	declinedNFTRequest
} from "../services/send";


/////////////////// Get send status action start////////////////
export let sendStatusAction = (data) => async (dispatch) => {
	const payload = await getSendStatus(data.data);
	return payload;
};
/////////////////// Get send status action end////////////////


///////////////////Receive nft with QR + Xaman sign action start////////////////
export let checkAcceptAction = (val) => async (dispatch) => {
	const payload = await acceptNFTWithQR({
		dispatch,
		nft_id: val.nft_id,
	});
	if (payload?.data?.balance === false) {
		return {
			data: {
				error: true,
				balance: false,
				message: payload?.data?.message || "Insufficient balance",
			},
		};
	}
	if (payload?.status === 200 && payload?.data?.success) {
		return {
			data: {
				success: true,
				message: payload?.data?.message || "NFT received",
			},
		};
	}
	if (payload?.isCancelled) {
		return { data: { cancelled: true } };
	}
	return {
		data: {
			error: true,
			message: payload?.data?.message || payload?.message || "Transaction failed",
			balance: payload?.data?.balance,
		},
	};
};
///////////////////Receive nft status action end////////////////


///////////////////Declined nft status action start////////////////
export let checkDeclinedNFTAction = () => async () => {
	const payload = await getDeclinedNFTStatus();
    return payload;
};
///////////////////Declined nft status action start////////////////

///////////////////Declined nft action start////////////////
export let declinedNFTRequestAction = (data) => async () => {
	const payload = await declinedNFTRequest(data);
    return payload;
};
///////////////////Declined nft action start///////////////

