import axios from "axios";
import config from "../../config.json";

export const getHomeDetailServise = async () => {
	const loginCofig = {
		baseURL: config.LOCAL_API_URL,
		method: "get",
		url: "nft/home",
	};

	try {
		const getHomeDeatail = await axios(loginCofig);
		if (getHomeDeatail.status === 200) {
			return getHomeDeatail;
		}
		return { status: getHomeDeatail?.status || 0, data: {} };
	} catch (e) {
		return e.response || { status: 0, data: { message: e.message } };
	}
};