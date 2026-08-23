import axios from "axios";
import config from "../config.json";
import { actionTypes } from "../store/actionTypes/wallet";

const token = localStorage.getItem("jwtToken");

const activePolling = new Map(); // uuid → pollState

const cancelTransactionPolling = (uuid) => {
  if (activePolling.has(uuid)) {
    activePolling.get(uuid).cancelled = true;
    activePolling.delete(uuid);
    console.log(`⛔ Polling cancelled for uuid: ${uuid}`);
  }
};

const checkTransactionStatusHelper = (data, path) => {
  // keep original signature
  const {
    showQR,
    qr_url,
    next_url,
    dispatch,
    title,
    bodyText,
    ...requestData // rest is the actual request body
  } = data;

  const { uuid } = requestData;

  const pollInterval = 3000;
  const maxDuration = 10 * 60 * 1000;
  const startTime = Date.now();

  const pollState = { cancelled: false };
  if (uuid) activePolling.set(uuid, pollState);

  /* Always set QR URLs when uuid exists — API may omit qr_url (e.g. push-only); require dispatch */
  const effectiveQrUrl =
    (qr_url && String(qr_url).trim()) ||
    (uuid ? `https://xumm.app/sign/${uuid}_q.png` : null);
  const effectiveNextUrl =
    (next_url && String(next_url).trim()) ||
    (uuid ? `https://xumm.app/sign/${uuid}` : null);

  if (showQR && uuid && dispatch) {
    dispatch({
      type: actionTypes.SHOW_PAYMENT_QR,
      payload: {
        uuid,
        qr_url: effectiveQrUrl,
        next_url: effectiveNextUrl,
        title,
        bodyText
      }
    });
  }

  const hideQr = () => dispatch?.({ type: actionTypes.HIDE_PAYMENT_QR });

  return new Promise((resolve, reject) => {
    let pollInFlight = false;
    let intervalId = null;

    const tick = async () => {
      if (pollInFlight) return;
      pollInFlight = true;
      try {
        if (pollState.cancelled) {
          if (intervalId) clearInterval(intervalId);
          hideQr();
          activePolling.delete(uuid);
          return reject({
            isCancelled: true,
            message: "Transaction cancelled by user"
          });
        }

        if (Date.now() - startTime >= maxDuration) {
          if (intervalId) clearInterval(intervalId);
          hideQr();
          activePolling.delete(uuid);
          return reject({
            error: true,
            message: "You have exceeded the 10 minute time limit"
          });
        }

        const resp = await axios({
          baseURL: config.LOCAL_API_URL,
          headers: {
            Authorization: `Basic ${token}`,
            Accept: "application/json"
          },
          data: requestData,
          method: "post",
          url: path
        });

        if (resp?.data?.status === "completed" || resp?.status === 200) {
          if (intervalId) clearInterval(intervalId);
          hideQr();
          activePolling.delete(uuid);
          return resolve(resp);
        }
      } catch (error) {
        if (intervalId) clearInterval(intervalId);
        hideQr();
        activePolling.delete(uuid);
        return reject(error);
      } finally {
        pollInFlight = false;
      }
    };

    intervalId = setInterval(tick, pollInterval);
    tick();
  });
};

// const checkTransactionStatusHelper = (data, path) => {
//   const pollInterval = 3000; // Check every 3 seconds
//   const maxDuration = 10 * 60 * 1000; // 10 minutes in milliseconds

//   const startTime = Date.now(); // Track when polling started

//   return new Promise((resolve, reject) => {
//     const interval = setInterval(async () => {
//       try {
//         const elapsed = Date.now() - startTime;

//         // Stop after 10 minutes
//         if (elapsed >= maxDuration) {
//           clearInterval(interval);
//           return reject("You have exceeded the 10 minute time limit");
//         }

//         const statusConfig = {
//           baseURL: config.LOCAL_API_URL,
//           headers: {
//             Authorization: `Basic ${token}`
//           },
//           data,
//           method: "post",
//           url: path
//         };

//         const resp = await axios(statusConfig);

//         // For example, if resp.data.status === "completed"
//         if (resp?.data?.status === "completed" || resp?.status === 200) {
//           clearInterval(interval); // Stop polling
//           return resolve(resp);
//         }
//       } catch (error) {
//         console.error(" Error checking status:", error.message);
//         clearInterval(interval);
//         return reject(error);
//       }
//     }, pollInterval);
//   });
// };

const uniqueArray = (arr, wallet) => {
  // Step 1: Normalize and group by collectionName
  const groups = arr
    .filter((v) => v.collectionName && v.collectionName.trim() !== "")
    .reduce((acc, current) => {
      const name = current.collectionName.trim().toLowerCase();
      if (!acc[name]) acc[name] = [];
      acc[name].push(current);
      return acc;
    }, {});

  const result = [];

  // Step 2: Select one unique record per group
  Object.values(groups).forEach((group) => {
    let selected = null;

    const hasWallet = group.some(
      ({ accountNumber }) => accountNumber === wallet
    );
    const purchased0 = group.find((v) => v.isPurchased === 0);
    const purchased1 = group.find((v) => v.isPurchased === 1);

    if (hasWallet) {
      // If wallet owns something in this collection
      if (
        purchased0 &&
        group.some((v) => v.IssuerAddr === wallet || v.IssuerAddr === null)
      ) {
        selected = purchased0;
      } else if (purchased1) {
        selected = purchased1;
      }
    } else {
      // Wallet not in this collection
      selected = purchased0 || purchased1;
    }

    if (selected) result.push(selected);
  });

  // Step 3: Remove duplicates if somehow same item got picked
  const unique = [];
  const seen = new Set();

  for (const item of result) {
    const key = `${item.collectionName?.trim().toLowerCase()}-${
      item.IssuerAddr
    }-${item.accountNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  // console.log(unique, "✅ final unique result");

  return unique;
};

// const uniqueArray = (arr, wallet) => {
//   const res = Object.values(
//     arr
//       .filter((vl) => vl.collectionName !== "")
//       .reduce((acc, current) => {
//         (acc[current.collectionName.trim()] =
//           acc[current.collectionName.trim()] || []).push(current);
//         return acc;
//       }, {})
//   );

//   const Arr = [];
//   res.forEach((vl) => {
//     if (vl.find(({ accountNumber }) => accountNumber === wallet)) {
//       if (vl.some((v1) => v1.isPurchased === 0)) {
//         if (vl.find((v2) => v2.IssuerAddr === wallet)) {
//           Arr.push(vl.find(({ isPurchased }) => isPurchased === 0));
//         } else if (vl.find((v2) => v2.IssuerAddr === null)) {
//           Arr.push(vl.find(({ isPurchased }) => isPurchased === 0));
//         }
//       }
//       if (vl.some((v1) => v1.isPurchased === 1)) {
//         Arr.push(vl.find(({ isPurchased }) => isPurchased === 1));
//       }
//     } else if (vl.some(({ accountNumber }) => accountNumber !== wallet)) {
//       if (vl.some(({ isPurchased }) => isPurchased === 0)) {
//         Arr.push(vl.find(({ isPurchased }) => isPurchased === 0));
//       } else if (vl.some(({ isPurchased }) => isPurchased === 1)) {
//         Arr.push(vl.find(({ isPurchased }) => isPurchased === 1));
//       }
//     }
//   });

//   console.log(Arr, "resp in data");

//   return Arr.filter((vl) => vl);
// };

const replaceHost = (url) => {
  const CID = url.split("/").pop();
  let finalUrl;
  if (url.indexOf("model") !== -1) {
    const urlSplitted = url.split("/ipfs/")[1];
    finalUrl = `${config.ipfs_p}${urlSplitted}`;
  } else {
    finalUrl = `${config.ipfs_p}${CID}`;
  }
  return finalUrl;
};

const extractCIDFromURL = (url) => {
  const regex = /ipfs\/([^/]+)/; // Matches the CID part in the URL
  const match = url.match(regex);
  return match ? match[1] : null; // Return CID or null if not found
};

const checkImageExists = async (cid) => {
  const url = `${config.ipfs_p}${cid}`;

  try {
    const response = await fetch(url, { method: "HEAD" });
    return response.ok;
  } catch (error) {
    // console.error("Error checking image:", error);
    return false;
  }
};

const encodeUnicodeToBase64 = (str) => {
  return btoa(unescape(encodeURIComponent(str)));
};

const decodeBase64ToUnicode = (base64) => {
  return decodeURIComponent(escape(atob(base64)));
};

const base64ToArrayBuffer = (base64) => {
  const binaryString = atob(base64.split(",")[1] || base64);
  const length = binaryString.length;
  const arrayBuffer = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    arrayBuffer[i] = binaryString.charCodeAt(i);
  }
  return arrayBuffer;
};

const checkFileType = async (file) => {
  const response = await fetch(file, {
    method: "HEAD"
  });
  const contentType = response.headers.get("Content-Type");
  return contentType;
};

const detectModelMimeType = async (url) => {
  try {
    const named =
      typeof url === "string"
        ? url.toLowerCase()
        : String(url?.name || "").toLowerCase();
    if (named.endsWith(".usdz")) return "usdz";
    if (named.endsWith(".obj")) return "obj";
    if (named.endsWith(".fbx")) return "fbx";
    if (named.endsWith(".glb")) return "glb";
    if (named.endsWith(".gltf")) return "gltf";
    if (typeof url !== "string") return null;

    // Only request the first 4KB of the file
    const res = await fetch(url, { headers: { Range: "bytes=0-4095" } });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} - cannot fetch partial content`);
    }

    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // GLB magic header = "glTF"
    if (
      bytes[0] === 0x67 && // g
      bytes[1] === 0x6c && // l
      bytes[2] === 0x54 && // T
      bytes[3] === 0x46 // F
    ) {
      return "glb";
    }

    // Try to parse as JSON (GLTF)
    const text = new TextDecoder().decode(buffer);
    if (
      text.trim().startsWith("{") &&
      text.includes('"asset"') &&
      text.includes('"version"')
    ) {
      return "gltf";
    }

    // FBX headers
    if (
      text.includes("Kaydara FBX Binary") ||
      text.includes("FBXHeaderExtension")
    ) {
      return "fbx";
    }

    return null;
  } catch (err) {
    console.error("⚠️ Failed to detect model type:", err);
    return null;
  }
};

const sortByNameASCOrder = (array) => {
  if (!Array.isArray(array) || array.length === 0) return array;

  return [...array].sort((a, b) => {
    const numA = Number(a?.name?.match(/#\s*(\d+)/)?.[1] ?? Infinity);
    const numB = Number(b?.name?.match(/#\s*(\d+)/)?.[1] ?? Infinity);
    return numA - numB;
  });
};

const sortByTitleASCOrder = (array) => {
  if (!Array.isArray(array) || array.length === 0) return array;

  // Try to find a field that contains a '#' in the first object
  const sample = array.find((obj) =>
    Object.values(obj).some((v) => typeof v === "string" && v.includes("#"))
  );

  if (!sample) return array; // nothing with '#', return unchanged

  const fieldName = Object.keys(sample).find(
    (key) => typeof sample[key] === "string" && sample[key].includes("#")
  );

  // Sort based on numeric value after #
  return [...array].sort((a, b) => {
    const numA = parseInt(a?.[fieldName]?.match(/#(\d+)/)?.[1] || 0);
    const numB = parseInt(b?.[fieldName]?.match(/#(\d+)/)?.[1] || 0);
    return numA - numB;
  });
};

const isGreaterOrEqual = (a, b) => {
  // Remove leading zeros
  a = a.replace(/^0+/, "") || "0";
  b = b.replace(/^0+/, "") || "0";

  // Split into whole + decimal
  let [aWhole, aDec = ""] = a.split(".");
  let [bWhole, bDec = ""] = b.split(".");

  // Compare whole number length
  if (aWhole.length !== bWhole.length) {
    return aWhole.length > bWhole.length;
  }

  // Compare whole numbers
  if (aWhole !== bWhole) {
    return aWhole >= bWhole;
  }

  // Compare decimal parts
  const maxLen = Math.max(aDec.length, bDec.length);
  aDec = aDec.padEnd(maxLen, "0");
  bDec = bDec.padEnd(maxLen, "0");

  return aDec >= bDec;
};

const makeCancellable = (promise) => {
  let isCancelled = false;

  const wrappedPromise = new Promise((resolve, reject) => {
    promise
      .then((val) =>
        isCancelled ? reject({ isCancelled: true }) : resolve(val)
      )
      .catch((err) =>
        isCancelled ? reject({ isCancelled: true }) : reject(err)
      );
  });

  return {
    promise: wrappedPromise,
    cancel: () => {
      isCancelled = true;
    }
  };
};

export {
  makeCancellable,
  encodeUnicodeToBase64,
  decodeBase64ToUnicode,
  checkFileType,
  detectModelMimeType,
  base64ToArrayBuffer,
  checkTransactionStatusHelper,
  cancelTransactionPolling,
  uniqueArray,
  replaceHost,
  extractCIDFromURL,
  checkImageExists,
  sortByTitleASCOrder,
  sortByNameASCOrder,
  isGreaterOrEqual
};
