import axios from "axios";
import config from "../../config.json";
const token = localStorage.getItem("jwtToken");

export const likeNft = async (data) => {
	const antiBotCofig = {
		baseURL: config.LOCAL_API_URL,
		headers: {
			Authorization: `Basic ${token}`,
		},
		data,
		method: "post",
		url: "nft/like",
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