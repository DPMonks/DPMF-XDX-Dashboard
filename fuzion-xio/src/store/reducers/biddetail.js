import { actionTypes } from '../actionTypes/biddetail';


const initialState = {
	onLoad: false,
	nftDetail: '',
	error: '',
}
const initialAntiBotState = {
	isSubmit: false,
	antiBot: null,
	error: null,
}
////////////////////////////////// BID DETAIL REDUCER ///////////////////////
export const bidDetailReducer = (state = initialState, action) => {
	switch (action.type) {
		case actionTypes.BID_DETAIL_REQUEST:
			return {
				...state,
				isSubmit: '',
			};
		case actionTypes.BID_DETAIL_SUCCESS:
			return {
				...state,
				onLoad: '',
				nftDetail: action.payload,
				error: false
			};
		case actionTypes.BID_DETAIL_FAILURE:
			return {
				...state,
				onLoad: initialState.loader,
				nftDetail: action.payload,
				error: action.payload.data,
			};

		default:
			return state;
	}
}

////////////////////////////////// ANTI BOT REDUCER ///////////////////////

export const antiBotReducer = (state = initialAntiBotState, action) => {
	switch (action.type) {
		case actionTypes.ANTI_BOT_REQUEST:
			return {
				...state,
				isSubmit: action.loader,
			};
		case actionTypes.ANTI_BOT_SUCCESS:
			return {
				...state,
				isSubmit: initialState.loader,
				antiBot: action.payload,
				error: false,
			};
		case actionTypes.ANTI_BOT_FAILURE:
			return {
				...state,
				isSubmit: initialState.loader,
				antiBot: action.payload,
				error: action.payload.data,
			};

		default:
			return state;
	}
};


