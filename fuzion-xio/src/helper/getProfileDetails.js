// import { useDispatch } from "react-redux";
// import { getProfileAction } from "../store/actions/profile";
import NFT3 from "../assets/defaultpimage.jpg";
import tickbadge from '../../src/assets/tick.png';
import goldbadge from "../../src/assets/goldbadge.png";
import bluebadge from "../../src/assets/bluebadge.png";


    
export const getProfileDetails = (profileArray, allMintedNfts, nftTokenId ) => {  
  if(!!allMintedNfts && allMintedNfts != undefined && !!profileArray && profileArray != undefined){  
  const IssuerToken = allMintedNfts?.find((vl) => vl.NFTokenID === nftTokenId );
  const profileDetails = !!profileArray && profileArray?.find((vl) => vl.wAddress === IssuerToken?.Issuer);
  return {
    pName: profileDetails?.pName != undefined ? profileDetails.pName : "N/A",  // eslint-disable-line
    pImage: profileDetails?.pImage != undefined && !!profileDetails.pImage ? profileDetails.pImage :  NFT3  // eslint-disable-line
  };
 }else{
  return {
    pName: "N/A",  // eslint-disable-line
    pImage: NFT3  // eslint-disable-line
  };
 }
};


export const profileBatchColor = (vScore) => {
  const n = Number(vScore) || 0;
  if (n >= 10000) {
    return <img src={goldbadge} alt="gold verified checkmark" />;
  }
  if (n >= 100) {
    return <img src={bluebadge} alt="blue verified checkmark" />;
  }
  return <img src={tickbadge} alt="unverified tick" />;
};
