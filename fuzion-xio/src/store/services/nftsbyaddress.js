import axios from "axios";
import config from "../../config.json";
const token = localStorage.getItem("jwtToken");

function interoperabilityMarkerSegment(marker) {
	if (marker === undefined || marker === null || marker === "null") {
		return "null";
	}
	if (typeof marker === "object") {
		return encodeURIComponent(JSON.stringify(marker));
	}
	return encodeURIComponent(String(marker));
}

export const getNFTsByAdressDetailService = async (marker) => {
	const nftCofig = {
		baseURL: config.LOCAL_API_URL,
		headers: {
			Authorization: `Basic ${token}`,
		},
		method: "get",
		url: `interoperability/getaccallnfts/${interoperabilityMarkerSegment(marker)}`,
	};
	
	try {
		const getNftDeatailsByAddress = await axios(nftCofig);
		if (getNftDeatailsByAddress.status === 200) {
			return getNftDeatailsByAddress.data;
		}
	} catch (e) {
		return e.response;
	}
};

export const burnNftIntService = async (data) => {
	const burnnftcofig = {
		baseURL: config.LOCAL_API_URL,
		headers: {
			Authorization: `Bearer ${token}`,
		},
		data,
		method: "post",
		url: "interoperability/burnNft",
	};
	try {
		const burnNftInt = await axios(burnnftcofig);
		if (burnNftInt.status === 200) {
			return burnNftInt.data;
		}
	} catch (error) {
		return error.response;
	}
};

export const saleNftIntService = async (data) => {
	const salenftconfig = {
		baseURL: config.LOCAL_API_URL,
		headers: {
			Authorization: `Bearer ${token}`,
		},
		data,
		method: "post",
		url: "interoperability/saleNft",
	};
	try {
		const saleNftInt = await axios(salenftconfig);
		if (saleNftInt.status === 200) {
			return saleNftInt;
		}
	} catch (error) {
		return error.response;
	}
};

export const cancelSaleNftIntService = async (data) => {
  
	const cancelsaleconfig = {
		baseURL: config.LOCAL_API_URL,
		headers: {
			Authorization: `Bearer ${token}`,
		},
		data,
		method: "post",
		url: "interoperability/cancelSaleNft",
	};
	try {
		const cancelSaleInt = await axios(cancelsaleconfig);
		if (cancelSaleInt.status === 200) {
			return cancelSaleInt;
		}
	} catch (error) {
		return error.response;
	}
};

export const buyNftIntService = async (data) => {
	const buynftconfig = {
		baseURL: config.baseURL,
		header: {
			Authorization: `Bearer ${token}`,
		},
		data,
		method: "post",
		url: "interoperability/buyNft",
	};
	try {
		const buyNftInt = await axios(buynftconfig);
		if (buyNftInt.status === 200) {
			return buyNftInt;
		}
	} catch (error) {
		return error.response;
	}
};

/* SEND NFT DATA */

export const sendNftIntService = async (data) => {
	const sendCofig = {
		baseURL: config.LOCAL_API_URL,
		headers: {
			Authorization: `Bearer ${token}`,
		},
		data,
		method: "post",
		url: "interoperability/sendNft",
	};
	try {
		const sendNftData = await axios(sendCofig);
		if (sendNftData.status === 200) {
			return sendNftData;
		}
	} catch (e) {
		return e.response;
	}
};
