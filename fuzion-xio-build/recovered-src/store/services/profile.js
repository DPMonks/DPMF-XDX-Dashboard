import axios from "axios";
import config from "../../config.json";
import { checkTransactionStatusHelper } from "../../helper";

const token = localStorage.getItem("jwtToken");

/* create profile api call */
export const createProfile = async (data) => {
  const createProfileCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data,
    method: "post",
    url: "profile/createprofile"
  };
  try {
    const createProfileData = await axios(createProfileCofig);
    if (createProfileData.status === 200) {
      return createProfileData;
    }
  } catch (e) {
    return e.response;
  }
};

export const createFBXFile = async (data) => {
  const createFBXCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data,
    method: "post",
    url: "profile/createfbxfile"
  };
  try {
    const createFBXData = await axios(createFBXCofig);
    if (createFBXData.status === 200) {
      return createFBXData;
    }
  } catch (e) {
    return e.response;
  }
};

/** Remove server-side staged model files after IPFS pin succeeds. */
export const cleanupStagedUploads = async (paths) => {
  const t = localStorage.getItem("jwtToken");
  try {
    const res = await axios({
      baseURL: config.LOCAL_API_URL,
      headers: { Authorization: `Basic ${t}` },
      method: "post",
      url: "profile/cleanup-staged-uploads",
      data: { paths }
    });
    return res.status === 200;
  } catch (e) {
    console.error("cleanupStagedUploads:", e?.message || e);
    return false;
  }
};

/*Get profile details */
export const getProfile = async (data) => {
  const getProfileCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data,
    method: "post",
    url: "profile/getProfile"
  };
  try {
    const getProfileData = await axios(getProfileCofig);
    if (getProfileData.status === 200) {
      return getProfileData;
    }
  } catch (e) {
    return e.response;
  }
};

/*Get profile XIO balance and validator level details */
export const getBalAndLevel = async (data) => {
  const getProfileCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data,
    method: "post",
    url: "profile/getbalanceandlevel"
  };
  try {
    const getProfileData = await axios(getProfileCofig);
    if (getProfileData.status === 200) {
      return getProfileData;
    }
  } catch (e) {
    return e.response;
  }
};

/* validate profile api call */
export const validateProfile = async (data) => {
  const { dispatch, ...rest } = data;
  const createProfileCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data: rest,
    method: "post",
    url: "profile/verifyprofile"
  };
  try {
    const createProfileData = await axios(createProfileCofig);
    if (createProfileData.status === 200) {
      const { uuid, qr_url, next_url, pushed } = createProfileData.data;
      if (!uuid) {
        return createProfileData;
      }
      const finalQrUrl = qr_url || `https://xumm.app/sign/${uuid}_q.png`;
      const finalNextUrl = next_url || `https://xumm.app/sign/${uuid}`;
      const request = {
        uuid,
        ...rest,
        ...(dispatch && { dispatch }),
        showQR: !pushed,
        qr_url: finalQrUrl,
        next_url: finalNextUrl,
        title: "Validate Profile",
        bodyText:
          "Scan with XAMAN to sign the payment and validate this profile."
      };
      const status = await checkTransactionStatusHelper(
        request,
        "profile/verifyprofilestatus"
      );
      return status;
    }
    return createProfileData;
  } catch (e) {
    return e.response || e;
  }
};

/*Get profile vpoint */
export const getProfileVScore = async (data) => {
  const getProfileVScoreCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data,
    method: "post",
    url: "profile/getvpoint"
  };
  try {
    const getProfileVScore = await axios(getProfileVScoreCofig);
    if (getProfileVScore.status === 200) {
      return getProfileVScore;
    }
  } catch (e) {
    return e.response;
  }
};

/*Get profile vscoreDashboard */
export const getVScoreDashboard = async (data) => {
  const getVScoreDashboardCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data,
    method: "get",
    url: "profile/scoreboardvpoint"
  };
  try {
    const getVScoreDashboard = await axios(getVScoreDashboardCofig);
    if (getVScoreDashboard.status === 200) {
      return getVScoreDashboard;
    }
  } catch (e) {
    return e.response;
  }
};

/*Get profile xioDashboard */
export const getXioDashboard = async (data) => {
  const getXioDashboardCofig = {
    baseURL: config.LOCAL_API_URL,
    headers: {
      Authorization: `Basic ${token}`
    },
    data,
    method: "get",
    url: "profile/xiodashboard"
  };
  try {
    const getXioDashboard = await axios(getXioDashboardCofig);
    if (getXioDashboard.status === 200) {
      return getXioDashboard;
    }
  } catch (e) {
    return e.response;
  }
};
