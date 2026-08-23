import { actionTypes } from '../actionTypes/homedetail';


const initialState = {
	onLoad: false,
	nftDetail: '',
	error: '',
}
export const homeDetailReducer = (state = initialState, action) => {

	switch (action.type) {
		case actionTypes.NFT_DETAIL_REQUEST:
			return {
				...state,
			};
		case actionTypes.NFT_DETAIL_SUCCESS:
			return {
				...state,
				nftDetail: action.payload,
				error: false
			};
		case actionTypes.NFT_DETAIL_FAILURE:
			return {
				...state,
				nftDetail: action.payload,
				error: action.payload.data,
			};

		default:
			return state;
	}
}