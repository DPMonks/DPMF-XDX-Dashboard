import { actionTypes } from "../actionTypes/profile";
import {
  createProfile,
  createFBXFile,
  getProfile,
  getBalAndLevel,
  validateProfile,
  getProfileVScore,
  getVScoreDashboard,
  getXioDashboard
} from "../services/profile";

/* create profile action */
export let createProfileAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.CREATE_PROFILE_REQUEST, loader: data.loader });
  const payload = await createProfile(data.data);
  const { status } = payload;
  if (status === 200) {
    dispatch({
      type: actionTypes.CREATE_PROFILE_SUCCESS,
      payload: payload.data
    });
  } else {
    dispatch({ type: actionTypes.CREATE_PROFILE_FAILURE, payload });
  }
};

/* create profile action */
export let createFBXFileAction = (data) => async () => {
  const payload = await createFBXFile(data.data);
  return payload.data;
};
/* Get profile details action */
export let getProfileAction = (data) => async (dispatch) => {
  const payload = await getProfile(data);
  dispatch({ type: actionTypes.RESET_PROFILE_DATA });
  return payload;
};

/* Get XIO balance and validator level details action*/
export let getBalAndLevelAction = (data) => async () => {
  const payload = await getBalAndLevel(data);
  return payload;
};

/* validate profile action */
export let validateProfileAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.VALIDATE_PROFILE_REQUEST, loader: data.loader });
  const payload = await validateProfile({ dispatch, ...data.data });
  const { status } = payload || {};
  if (status === 200) {
    dispatch({
      type: actionTypes.VALIDATE_PROFILE_SUCCESS,
      payload: payload.data
    });
  } else {
    dispatch({ type: actionTypes.VALIDATE_PROFILE_FAILURE, payload });
  }
};

/* Get profile vscore action */
export let getProfileVScoreAction = (data) => async () => {
  const payload = await getProfileVScore(data);
  return payload;
};

/* Get profile vscore dashboard action */
export let getVScoreDashboardAction = (data) => async () => {
  const payload = await getVScoreDashboard(data);
  return payload;
};

/* Get xio dashboard action */
export let getXioDashboardAction = (data) => async () => {
  const payload = await getXioDashboard(data);
  return payload;
};
