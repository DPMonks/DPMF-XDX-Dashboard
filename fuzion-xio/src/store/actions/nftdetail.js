import { actionTypes } from "../actionTypes/nftdetail";
import {
  getSingleNftDetailServise,
  getTradeHistoryService,
  updateNftInfoService,
  addCollectionService,
  getCollectionService,
  deleteCollectionService,
  getNftByCollectionService,
  removeNftCollectionService,
  convertGLBtoUSDZService
} from "../services/nftdetail";

/*Single NFT details Action */
export let nftDetailAction = (data) => async (dispatch) => {
  dispatch({
    type: actionTypes.SINGLE_NFT_DETAIL_REQUEST,
    loader: data.loader
  });
  const payload = await getSingleNftDetailServise(data.itemID);
  const { status } = payload;
  if (status === 200) {
    dispatch({
      type: actionTypes.SINGLE_NFT_DETAIL_SUCCESS,
      payload: payload.data
    });
  } else {
    dispatch({ type: actionTypes.SINGLE_NFT_DETAIL_FAILURE, payload });
  }
};

/* Trade history Action */
export let tradeHistoryAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.TRADEHISTORY_REQUEST, loader: data.loader });
  const payload = await getTradeHistoryService(data.nftId);
  const { status } = payload;

  if (status === 200) {
    dispatch({ type: actionTypes.TRADEHISTORY_SUCCESS, payload });
  } else {
    dispatch({ type: actionTypes.TRADEHISTORY_FAILURE, payload });
  }
};

/* Update NFT info i.e. Issuer and Owner Action */
export let updateNftInfoAction = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.UPDATENFTINFO_REQUEST });
  const payload = await updateNftInfoService(data.nftId);
  const { status } = payload;
  if (status === 200) {
    dispatch({
      type: actionTypes.UPDATENFTINFO_SUCCESS,
      payload: payload.data
    });
  } else {
    dispatch({ type: actionTypes.UPDATENFTINFO_FAILURE, payload });
  }
};

/* Add NFT in Profile Collection */
export let addCollection = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.ADDCOLLECTION_REQUEST, loader: data.loader });

  const payload = await addCollectionService(data);
  const { status } = payload;
  if (status === 200) {
    dispatch({
      type: actionTypes.ADDCOLLECTION_SUCCESS,
      payload: payload.data
    });
  } else {
    dispatch({ type: actionTypes.ADDCOLLECTION_FAILURE, payload });
  }
};

/* Get all NFTs Collections */
export let getCollections =
  ({ page, walletAddress, type }) =>
  async (dispatch) => {
    dispatch({ type: actionTypes.GETCOLLECTION_REQUEST });
    const payload = await getCollectionService(page, walletAddress, type);
    const { status } = payload;
    if (status === 200) {
      dispatch({
        type: actionTypes.GETCOLLECTION_SUCCESS,
        payload: payload.data
      });
    } else {
      dispatch({ type: actionTypes.GETCOLLECTION_FAILURE, payload });
    }
  };

/* Delete NFT from Collections */
export let deleteCollection = (data) => async (dispatch) => {
  dispatch({ type: actionTypes.DELETECOLLECTION_REQUEST, loader: data.loader });
  const payload = await deleteCollectionService(data);
  const { status } = payload;
  if (status === 200) {
    dispatch({
      type: actionTypes.DELETECOLLECTION_SUCCESS,
      payload: payload.data
    });
  } else {
    dispatch({ type: actionTypes.DELETECOLLECTION_FAILURE, payload });
  }
};

export const getNftsByCollection =
  ({ page, collectionName, wltAddress, activeFilter }) =>
  async () => {
    const payload = await getNftByCollectionService(
      page,
      collectionName,
      wltAddress,
      activeFilter
    );
    return payload;
  };

export let removeNftCollection = (data) => async () => {
  const payload = await removeNftCollectionService(data);
  return payload;
};

export let convertGLBtoUSDZ = (data) => async () => {
  const payload = await convertGLBtoUSDZService(data);
  return payload;
};
