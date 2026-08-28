import { actionTypes } from "../actionTypes/like";
import { likeNft } from "../services/like";

export let likeDispach = (data) => async (dispatch) => {
	dispatch({ type: actionTypes.LIKE_REQUEST, loader: data.loader });
	const payload = await likeNft(data.data);
	const { status } = payload;
	if (status === 200) {
		dispatch({ type: actionTypes.LIKE_SUCCESS, payload: payload.data });
	} else {
		dispatch({ type: actionTypes.LIKE_FAILURE, payload });
	}
};