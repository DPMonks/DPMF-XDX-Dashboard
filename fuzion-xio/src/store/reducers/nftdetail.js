import { actionTypes } from '../actionTypes/nftdetail';


const initialState = {
	onLoad: false,
	nftDetailsNFT: '',
	error: '',
}

const initialTradeHistoryState = {
	onLoad: false,
	tradeHistory: null,
	error: '',
};

const initialUpdateNftInfoState = {
	onLoad: false,
	updateNftInfo: null,
	error: '',
};

const initialCollectionState = {
	isSubmit: false,
	nftCollections: null,
	error: ""
}

export const nftDetailReducer = (state = initialState, action) => {
	switch (action.type) {
		case actionTypes.SINGLE_NFT_DETAIL_REQUEST:
			return {
				...state,
				isSubmit: ''
			};
		case actionTypes.SINGLE_NFT_DETAIL_SUCCESS:
			return {
				...state,
				nftDetailsNFT: action.payload,
				error: false
			};
		case actionTypes.SINGLE_NFT_DETAIL_FAILURE:
			return {
				...state,
				nftDetailsNFT: action.payload,
				error: action.payload.data,
			};

		default:
			return state;
	}
}

export const tradeHistoryReducer = (state = initialTradeHistoryState, action) => {
	switch (action.type) {
		case actionTypes.TRADEHISTORY_REQUEST:
			return {
				...state,
				onLoad: ''
			};
		case actionTypes.TRADEHISTORY_SUCCESS:
			return {
				...state,
				tradeHistory: action.payload,
				error: false
			};
		case actionTypes.TRADEHISTORY_FAILURE:
			return {
				...state,
				tradeHistory: action.payload,
				error: action.payload.data
			};

		default:
			return state;
	}
}


export const updateNftInfoReducer = (state = initialUpdateNftInfoState, action) => {
	switch (action.type) {
		case actionTypes.UPDATENFTINFO_REQUEST:
			return {
				...state,
				isSubmit: action.loader,
			};
		case actionTypes.UPDATENFTINFO_SUCCESS:
			return {
				...state,
				isSubmit: initialState.loader,
				updateNftInfo: action.payload,
				error: false,
			};
		case actionTypes.UPDATENFTINFO_FAILURE:
			return {
				...state,
				isSubmit: initialState.loader,
				updateNftInfo: action.payload,
				error: action.payload.data,
			};

		default:
			return state;
	}
};


export const collectionReducer = (state = initialCollectionState, action) => {
	switch (action.type) {
		case actionTypes.ADDCOLLECTION_REQUEST:
			return {
				...state,
				isSubmit: action.loader,
				nftCollections: initialCollectionState.nftCollections,
			};
		case actionTypes.ADDCOLLECTION_SUCCESS:
			return {
				...state,
				isSubmit: initialCollectionState.loader,
				nftCollections: action.payload,
				error: initialCollectionState.error,
			};
		case actionTypes.ADDCOLLECTION_FAILURE:
			return {
				...state,
				isSubmit: initialCollectionState.loader,
				nftCollections: initialCollectionState.nftCollections,
				error: action.payload.data,
			};
		case actionTypes.GETCOLLECTION_REQUEST:
			return {
				...state,
				isSubmit: initialCollectionState.isSubmit,
				nftCollections: initialCollectionState.nftCollections,
			};
		case actionTypes.GETCOLLECTION_SUCCESS:
			return {
				...state,
				isSubmit: initialCollectionState.loader,
				nftCollections: action.payload,
				error: initialCollectionState.error,
			};
		case actionTypes.GETCOLLECTION_FAILURE:
			return {
				...state,
				isSubmit: initialCollectionState.loader,
				nftCollections: initialCollectionState.nftCollections,
				error: action.payload.data,
			};
		case actionTypes.DELETECOLLECTION_REQUEST:
			return {
				...state,
				isSubmit: action.loader,
				nftCollections: initialCollectionState.nftCollections,
			};
		case actionTypes.DELETECOLLECTION_SUCCESS:
			return {
				...state,
				isSubmit: initialCollectionState.loader,
				nftCollections: action.payload,
				error: initialCollectionState.error,
			};
		case actionTypes.DELETECOLLECTION_FAILURE:
			return {
				...state,
				isSubmit: initialCollectionState.loader,
				nftCollections: initialCollectionState.nftCollections,
				error: action.payload.data,
			};
		default:
			return state;
	}
};
