import { actionTypes } from "../actionTypes/nftsbyaddress";
import {
	getNFTsByAdressDetailService,
	burnNftIntService,
	saleNftIntService,
	cancelSaleNftIntService,
	buyNftIntService,
	sendNftIntService
} from "../services/nftsbyaddress";

export const NftsByAdressDetail = (data) => async (dispatch) => {
	dispatch({ type: actionTypes.NFTSBY_ADDRESS_REQUEST });
	const payload = await getNFTsByAdressDetailService(data);
	const { success } = payload;
	if (success) {
		dispatch({
			type: actionTypes.NFTSBY_ADDRESS_SUCCESS,
			payload,
		});
		return payload;
	} else {
		dispatch({ type: actionTypes.NFTSBY_ADDRESS_FAILURE, payload });
	}
};

export const burnNftInt = (data) => async (dispatch) => {
	dispatch({ type: actionTypes.BURNNFTINT_REQUEST,loader: data.loader });
	const payload = await burnNftIntService(data.data);
	const { success } = payload;
	if (success) {
		dispatch({ type: actionTypes.BURNNFTINT_SUCCESS, payload: payload });
	} else {
		dispatch({ type: actionTypes.BURNNFTINT_FAILURE, payload });
	}
};

export const saleNftInt = (data) => async (dispatch) => {
	dispatch({ type: actionTypes.SALENFTINT_REQUEST, loader: data.loader });
	const payload = await saleNftIntService(data.data);
	const { status } = payload;
	if (status === 200) {
		dispatch({ type: actionTypes.SALENFTINT_SUCCESS, payload: payload.data });
	} else {
		dispatch({ type: actionTypes.SALENFTINT_FAILURE, payload: payload });
	}
};

export const cancelSaleNftInt = (data) => async (dispatch) => {
	dispatch({ type: actionTypes.CANCELSALENFTINT_REQUEST, loader: data.loader });
	const payload = await cancelSaleNftIntService(data.data);
	const { status } = payload;
	if (status === 200) {
		dispatch({ type: actionTypes.CANCELSALENFTINT_SUCCESS, payload: payload.data });
	} else {
		dispatch({ type: actionTypes.CANCELSALENFTINT_FAILURE, payload: payload });
	}
};

export const buyNftInt = (data) => async (dispatch) => {
	dispatch({ type: actionTypes.BUYNFTINT_REQUEST, loader: data.loader });
	const payload = await buyNftIntService(data.data);
	const success = payload;
	if (success) {
		dispatch({ type: actionTypes.BUYNFTINT_SUCCESS, payload: payload });
	} else {
		dispatch({ type: actionTypes.BUYNFTINT_FAILURE, payload: payload });
	}
};

export const sendNftInt = (data) => async (dispatch) => {
	dispatch({ type: actionTypes.SENDNFTINT_REQUEST, loader: data.loader });
	const payload = await sendNftIntService(data.data);
	const { status } = payload;
	if (status === 200) {
		dispatch({ type: actionTypes.SENDNFTINT_SUCCESS, payload: payload.data });
	} else {
		dispatch({ type: actionTypes.SENDNFTINT_FAILURE, payload });
	}
};
