import { actionTypes } from "../actionTypes/profile";

const initialState = {
	isSubmit: false,
	createProfile: null,
	error: null,
};

const initialStateVProfile = {
	isSubmit: false,
	validateProfile: null,
	error: null,
};

/* create profile reducer */
export const createProfileReducer = (state = initialState, action) => {
	switch (action.type) {
		case actionTypes.CREATE_PROFILE_REQUEST:
			return {
				...state,
				isSubmit: action.loader,
			};
		case actionTypes.CREATE_PROFILE_SUCCESS:
			return {
				...state,
				isSubmit: initialState.loader,
				createProfile: action.payload,
				error: false,
			};
		case actionTypes.CREATE_PROFILE_FAILURE:
			return {
				...state,
				isSubmit: initialState.loader,
				createProfile: action.payload,
				error: action.payload.data,
			};

		default:
			return state;
	}
};

export const resteProfileData = (state = initialState, action) => {
	switch (action.type) {
		case actionTypes.RESET_PROFILE_DATA:
			return {
				...state,
				isSubmit: false,
				createProfile: initialState.createProfile,
				error: false,
			};
		default:
			return state;
	}

}

/* validate profile reducer */
export const validateProfileReducer = (state = initialStateVProfile, action) => {
	switch (action.type) {
		case actionTypes.VALIDATE_PROFILE_REQUEST:
			return {
				...state,
				isSubmit: action.loader,
				validateProfile: initialStateVProfile.validateProfile,
				error: initialStateVProfile.error,
			};
		case actionTypes.VALIDATE_PROFILE_SUCCESS:
			return {
				...state,
				isSubmit: initialStateVProfile.loader,
				validateProfile: action.payload,
				error: false,
			};
		case actionTypes.VALIDATE_PROFILE_FAILURE:
			return {
				...state,
				isSubmit: initialStateVProfile.loader,
				validateProfile: action.payload,
				error: action.payload.data,
			};

		default:
			return state;
	}
};