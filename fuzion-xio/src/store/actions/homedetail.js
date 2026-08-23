import { actionTypes } from "../actionTypes/homedetail";
import { getHomeDetailServise } from "../services/homedetail";

export let homeNftDetail = (data) => async (dispatch) => {
	dispatch({ type: actionTypes.NFT_DETAIL_REQUEST });
	const payload = await getHomeDetailServise();
	const { status } = payload;
	if (status === 200) {
		dispatch({ type: actionTypes.NFT_DETAIL_SUCCESS, payload: payload.data });
	} else {
		dispatch({ type: actionTypes.NFT_DETAIL_FAILURE, payload });
	}
};
