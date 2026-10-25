import { actionTypes } from "../actionTypes/biddetail";
import { didDetail, antiBot } from "../services/biddetail";

////////////////////////////////////// BID DEATIL ACTION ///////////////////////////////
export let bidDetailAction = (data) => async (dispatch) => {

	dispatch({ type: actionTypes.BID_DETAIL_REQUEST, loader: data.loader });
	const payload = await didDetail(data.itemID);
	const { status } = payload;
	if (status === 200) {
		dispatch({ type: actionTypes.BID_DETAIL_SUCCESS, payload: payload.data });
	} else {
		dispatch({ type: actionTypes.BID_DETAIL_FAILURE, payload });
	}
};

//////////////////////////////////////  ANTI BOT ACTION ///////////////////////////////

export let antiBotAction = (data) => async (dispatch) => {


	dispatch({ type: actionTypes.ANTI_BOT_REQUEST, loader: data.loader });
	const payload = await antiBot(data.data);

	const { status } = payload;
	if (status === 200) {
		dispatch({ type: actionTypes.ANTI_BOT_SUCCESS, payload: payload.data });
	} else {
		dispatch({ type: actionTypes.ANTI_BOT_FAILURE, payload });
	}
};



