import axios from "axios";
import config from "../../config.json";
const token = localStorage.getItem("jwtToken");

/*Get Single NFT details api call service */
export const getSingleNftDetailServise = async (data) => {
  const loginCofig = {
    baseURL: config.LOCAL_API_URL,
    method: "get",
    url: `nft/getNftDetail/${data}`
  };

  try {
    const getSingleNFTDeatail = await axios(loginCofig);
    if (getSingleNFTDeatail.status === 200) {
      return getSingleNFTDeatail;
    }
  } catch (e) {
    return e.response;
  }
};

/* Get trade history of single NFT api call service */
export const getTradeHistoryService = async (Id) => {
  const historyConfig = {
    baseURL: config.LOCAL_API_URL,
    method: "post",
    url: `nft/getTradeHistory/${Id}`
  };
  try {
    const getTradeHistory = await axios(historyConfig);
    if (getTradeHistory.status === 200) {
      return getTradeHistory.data;
    }
  } catch (error) {
    return error.response;
  }
};

/* Update NFT info api call service */
export const updateNftInfoService = async (id) => {
  const updateNftInfoCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    method: "post",
    url: `nft/updateNftinfo/${id}`
  };
  try {
    const updatedNftInfo = await axios(updateNftInfoCofig);
    if (updatedNftInfo.status === 200) {
      return updatedNftInfo;
    }
  } catch (e) {
    return e.response;
  }
};

/* Add NFT in collection api call service */
export const addCollectionService = async (data) => {
  const addCollectionCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    method: "post",
    data: {
      Id: data.Id,
      nftDetail: data.nftDetail,
      wAddress: data.wAddress,
      walletAddress: data.wAddress
    },
    url: `collection/create`
  };
  try {
    const addCollectionInfo = await axios(addCollectionCofig);
    if (addCollectionInfo.status === 200) {
      return addCollectionInfo;
    }
  } catch (e) {
    return e.response;
  }
};

/* Get all NFT's collection api call service */
export const getCollectionService = async (page, walletAddress, type) => {
  const getCollectionCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    method: "post",
    data: { walletAddress, type },
    url: `collection/get/${page}`
  };
  try {
    const getCollectionInfo = await axios(getCollectionCofig);
    if (getCollectionInfo.status === 200) {
      return getCollectionInfo;
    }
  } catch (e) {
    return e.response;
  }
};

/* Delete NFT from collection api call service */
export const deleteCollectionService = async (data) => {
  const deleteCollectionCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    method: "delete",
    url: `collection/delete/${encodeURIComponent(JSON.stringify(data))}`
  };
  try {
    const deleteCollectionInfo = await axios(deleteCollectionCofig);
    if (deleteCollectionInfo.status === 200) {
      return deleteCollectionInfo;
    }
  } catch (e) {
    return e.response;
  }
};

/* Get NFT by collection api call service */
export const getNftByCollectionService = async (
  page,
  collectionName,
  wltAddress,
  activeFilter
) => {
  const getCollectionCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    method: "post",
    data: { page, collectionName, wltAddress, activeFilter },
    url: `nft/getCollectionsByName`
  };
  try {
    const getCollectionInfo = await axios(getCollectionCofig);
    if (getCollectionInfo.status === 200) {
      return getCollectionInfo;
    }
  } catch (e) {
    return e.response;
  }
};

/*Remove collection from profile */
export const removeNftCollectionService = async (val) => {
  const removeCollectionConfig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data: val,
    method: "patch",
    url: "nft/removeNftCollection"
  };
  try {
    const removeCollection = await axios(removeCollectionConfig);
    if (removeCollection.status === 200) {
      return removeCollection;
    }
  } catch (e) {
    return e.response;
  }
};

/*Remove collection from profile */
export const convertGLBtoUSDZService = async (val) => {
  const convertToUSDZConfig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    method: "get",
    url: `nft/convert?ipfsUrl=${encodeURIComponent(val)}`
  };

  try {
    const convertGBLToUSDZ = await axios(convertToUSDZConfig);
    if (convertGBLToUSDZ.status === 200) {
      return convertGBLToUSDZ;
    }
  } catch (e) {
    return e.response;
  }
};
