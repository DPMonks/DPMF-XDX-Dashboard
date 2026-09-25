import { actionTypes } from '../actionTypes/like';


const initialState = {
	onLoad: false,
	nftDetail: '',
	error: '',
}
export const nftLikeReducer = (state = initialState, action) => {

	switch (action.type) {
		case actionTypes.LIKE_REQUEST:
			return {
				...state,
				isSubmit: '',
				nftDetail: initialState.nftDetail
			};
		case actionTypes.LIKE_SUCCESS:
			return {
				...state,
				onLoad: '',
				nftDetail: action.payload,
				error: false
			};
		case actionTypes.LIKE_FAILURE:
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