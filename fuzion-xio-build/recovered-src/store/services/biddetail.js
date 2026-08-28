import axios from "axios";
import config from "../../config.json";
const token = localStorage.getItem("jwtToken");

///////////////////// BID NFT DETAIL DATA ///////////////////////
export const didDetail = async (data) => {

	const bidCofig = {
		baseURL: config.LOCAL_API_URL,
		headers: {
			Authorization: `Basic ${token}`,
		},
		data,
		method: "get",
		url: `xrpl/bidNftDetail/${data}`,
	};

	try {
		const bidSingleNFTDeatail = await axios(bidCofig);
		if (bidSingleNFTDeatail.status === 200) {
			return bidSingleNFTDeatail;
		}
	} catch (e) {
		return e.response;
	}
};

///////////////////// ANTI BOT DATA ///////////////////////

export const antiBot = async (data) => {

	const antiBotCofig = {
		baseURL: config.LOCAL_API_URL,
		headers: {
			Authorization: `Basic ${token}`,
		},
		data,
		method: "post",
		url: "xrpl/antiBot",
	};


	try {
		const antiBotData = await axios(antiBotCofig);
		if (antiBotData.status === 200) {
			return antiBotData;
		}
	} catch (e) {
		return e.response;
	}
};

