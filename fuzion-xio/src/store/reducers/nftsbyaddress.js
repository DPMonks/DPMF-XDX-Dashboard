import { actionTypes } from "../actionTypes/nftsbyaddress";

const initialState = {
	allNftDetails: null,
	error: "",
};

const burnNftIntInitialState = {
	isSubmit: false,
	burn: null,
	error: null,
};

const saleNftIntInitialState = {
	isSubmit: false,
	sale: null,
	error: null,
};

const cancelSaleNftInitInitialState = {
	isSubmit: false,
	cancelSale: null,
	error: null,
};

const buyNftInitInitialState = {
	isSubmit: false,
	buy: null,
	error: null,
};

const initialSendState = {
	isSubmit: false,
	send: null,
	error: null,
};

export const allNftsDetailByAddrReducer = (state = initialState, action) => {
	switch (action.type) {
		case actionTypes.NFTSBY_ADDRESS_REQUEST:
			return {
				...state,
				allNftDetails: initialState.allNftDetails,
				error: initialState.error,
			};
		case actionTypes.NFTSBY_ADDRESS_SUCCESS:
			return {
				...state,
				allNftDetails: action.payload,
				error: initialState.error,
			};
		case actionTypes.NFTSBY_ADDRESS_FAILURE:
			return {
				...state,
				allNftDetails: initialState.allNftDetails,
				error: action.payload.data,
			};

		default:
			return state;
	}
};

export const burnNftIntReducer = (state = burnNftIntInitialState, action) => {
	switch (action.type) {
		case actionTypes.BURNNFTINT_REQUEST:
			return {
				...state,
				isSubmit: action.loader,
				burn: burnNftIntInitialState.burn
			};
		case actionTypes.BURNNFTINT_SUCCESS:
			return {
				...state,
				isSubmit: burnNftIntInitialState.isSubmit,
				burn: action.payload,
				error: false,
			};
		case actionTypes.BURNNFTINT_FAILURE:
			return {
				...state,
				isSubmit: burnNftIntInitialState.isSubmit,
				burn: action.payload,
				error: action.payload.data,
			};
		default:
			return state
	}
};

export const saleNftIntReducer = (state = saleNftIntInitialState, action) => {
	switch (action.type) {
		case actionTypes.SALENFTINT_REQUEST:
			return {
				...state,
				isSubmit: action.loader,
				sale: saleNftIntInitialState.sale,
				error: saleNftIntInitialState.error
			};
		case actionTypes.SALENFTINT_SUCCESS:
			return {
				...state,
				isSubmit: saleNftIntInitialState.isSubmit,
				sale: action.payload,
				error: saleNftIntInitialState.error,
			};
		case actionTypes.SALENFTINT_FAILURE:
			return {
				...state,
				isSubmit: saleNftIntInitialState.isSubmit,
				sale: saleNftIntInitialState.sale,
				error: action.payload.data,
			};
		default:
			return state
	}
};


export const cancelSaleNftIntReducer = (state = cancelSaleNftInitInitialState, action) => {
	switch (action.type) {
		case actionTypes.CANCELSALENFTINT_REQUEST:
			return {
				...state,
				isSubmit: action.loader,
				cancelSale: cancelSaleNftInitInitialState.cancelSale,
				error: cancelSaleNftInitInitialState.error
			};
		case actionTypes.CANCELSALENFTINT_SUCCESS:
			return {
				...state,
				isSubmit: cancelSaleNftInitInitialState.isSubmit,
				cancelSale: action.payload,
				error: cancelSaleNftInitInitialState.error,
			};
		case actionTypes.CANCELSALENFTINT_FAILURE:
			return {
				...state,
				isSubmit: cancelSaleNftInitInitialState.isSubmit,
				cancelSale: cancelSaleNftInitInitialState.cancelSale,
				error: action.payload.data,
			};
		default:
			return state
	}
};

export const buyNftIntReducer = (state = buyNftInitInitialState, action) => {
	switch (action.type) {
		case actionTypes.BUYNFTINT_REQUEST:
			return {
				...state,
				isSubmit: action.loader,
			};
		case actionTypes.BUYNFTINT_SUCCESS:
			return {
				...state,
				isSubmit: buyNftInitInitialState.loader,
				buy: action.payload,
				error: false,
			};
		case actionTypes.BUYNFTINT_FAILURE:
			return {
				...state,
				isSubmit: buyNftInitInitialState.loader,
				buy: action.payload,
				error: action.payload.data,
			};
		default:
			return state
	}
};

/* SEND NFT REDUCER */

export const sendNftIntReducer = (state = initialSendState, action) => {
	switch (action.type) {
		case actionTypes.SENDNFTINT_REQUEST:
			return {
				...state,
				isSubmit: action.loader,
			};
		case actionTypes.SENDNFTINT_SUCCESS:
			return {
				...state,
				isSubmit: initialState.loader,
				send: action.payload,
				error: false,
			};
		case actionTypes.SENDNFTINT_FAILURE:
			return {
				...state,
				isSubmit: initialState.loader,
				send: action.payload,
				error: action.payload.data,
			};

		default:
			return state;
	}
};





