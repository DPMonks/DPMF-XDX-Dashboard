import { combineReducers } from "redux";
import { qrModalReducer } from "../reducers/qrModalReducer";
import {
  walletActionReducer,
  accountDetailReducer,
  getBalanceReducer,
  registrationFeeReducer,
  walletDisConnectReducer,
  IPFSPaymentReducer
} from "../reducers/wallet";
import {
  nftDetailReducer,
  tradeHistoryReducer,
  updateNftInfoReducer,
  collectionReducer
} from "../reducers/nftdetail";
import {
  mintNftOfferReducer,
  mintNftReducer,
  burnNftReducer,
  saleNftReducer,
  cancelSaleNftReducer,
  buyNftReducer,
  bidTokenReducer,
  bidCancelReducer,
  bidAndBurnTokenReducer,
  numberOfMintedReducer,
  deleteNftReducer,
  totalTradeReducer,
  sendNftReducer,
  receiveNftReducer,
  cancelSendNftReducer,
  placeMoreofferReducer,
  getAllPlacedoffersReducer,
  acceptPlacedoffersReducer,
  cancelPlacedOffersReducer
} from "../reducers/mintNft";
import { bidDetailReducer, antiBotReducer } from "../reducers/biddetail";
import { homeDetailReducer } from "../reducers/homedeatail";
import {
  allNftsDetailByAddrReducer,
  burnNftIntReducer,
  saleNftIntReducer,
  cancelSaleNftIntReducer,
  buyNftIntReducer,
  sendNftIntReducer
} from "../reducers/nftsbyaddress";
import { nftLikeReducer } from "../reducers/like";
import {
  createProfileReducer,
  validateProfileReducer,
  resteProfileData
} from "../reducers/profile";
export default combineReducers({
  // wallet start //
  walletActionReducer,
  IPFSPaymentReducer,
  accountDetailReducer,
  getBalanceReducer,
  registrationFeeReducer,
  walletDisConnectReducer,
  // wallet end //
  // NFT START//
  nftDetailReducer,
  mintNftOfferReducer,
  mintNftReducer,
  burnNftReducer,
  saleNftReducer,
  cancelSaleNftReducer,
  buyNftReducer,
  bidTokenReducer,
  bidCancelReducer,
  bidAndBurnTokenReducer,
  numberOfMintedReducer,
  deleteNftReducer,
  tradeHistoryReducer,
  updateNftInfoReducer,
  totalTradeReducer,
  sendNftReducer,
  receiveNftReducer,
  cancelSendNftReducer,
  // NFT END//

  /* More Offer Start*/
  placeMoreofferReducer,
  getAllPlacedoffersReducer,
  acceptPlacedoffersReducer,
  cancelPlacedOffersReducer,
  /* More Offer End*/

  bidDetailReducer,
  antiBotReducer,
  // HOME START//
  homeDetailReducer,
  nftLikeReducer,
  //HOME END//

  // interoperability all reducer
  allNftsDetailByAddrReducer,
  burnNftIntReducer,
  saleNftIntReducer,
  cancelSaleNftIntReducer,
  buyNftIntReducer,
  sendNftIntReducer,

  // profile reducers
  createProfileReducer,
  validateProfileReducer,
  resteProfileData,

  // collections
  collectionReducer,
  qrModal: qrModalReducer
});
