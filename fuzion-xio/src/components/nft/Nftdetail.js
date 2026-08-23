import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { CopyToClipboard } from "react-copy-to-clipboard";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { Table, Tooltip } from "react-bootstrap";
import RangeSlider from "react-bootstrap-range-slider";
import "react-bootstrap-range-slider/dist/react-bootstrap-range-slider.css";
import Header from "../common/header";
import Footer from "../common/footer";
import Userimage from "../../assets/defaultpimage.jpg";
import Copysvg from "../../assets/copy.svg";
import { useJwt } from "react-jwt";
import { BeatLoader } from "react-spinners";
import Modal from "react-bootstrap/Modal";
import MessageConst from "../../const/message.json";
import Filetypecomman from "../common/Filetypecomman";
import detailNFT from "../../assets/NFT_detailBg.png";
import verifyImg from "../../assets/verifyImg.png";
import share from "../../assets/share.svg";
import bithomp from "../../assets/bitomp.svg";
import { useDispatch, useSelector } from "react-redux";
import { forceVisible } from "react-lazyload";
import Like from "./like/like";
import NftMarketplacePanel from "./NftMarketplacePanel";
import { profileBatchColor } from "../../helper/getProfileDetails";
import {
  nftDetailAction,
  tradeHistoryAction,
  updateNftInfoAction,
  addCollection,
  getCollections,
  deleteCollection,
  convertGLBtoUSDZ
} from "../../store/actions/nftdetail";
import { getBalanceAction } from "../../store/actions/wallet";
import Accordion from "react-bootstrap/Accordion";
import configData from "../../config.json";
import { assetsLabel, findTicker, mergeTickers, optionLabel } from "../../helper/assets";
import { ensureWalletTrustlines } from "../../helper/trustlines";
import * as Spinners from "react-loader-spinner";
import { isMobile, isIOS } from "react-device-detect";

// actions
import {
  mintNftOfferAction,
  mintNftAction,
  mintModalResetAction,
  mintOfferModalResetAction,
  saleModalResetAction,
  burnNftAction,
  saleNftAction,
  cancelSaleNftAction,
  buyNftAction,
  bidTokenAction,
  bidCancelTokenAction,
  deleteNftAction,
  sendNftAction,
  receiveNftAction,
  cancelSendNftAction,
  placeMoreOfferAction,
  getAllPlacedOffersAction,
  acceptPlacedOffersAction,
  cancelPlacedOffersAction
} from "../../store/actions/mintNFT";
import { getAllMintedOffers } from "../../store/actions/wallet";

import { getProfileAction } from "../../store/actions/profile";
import {
  checkImageExists,
  replaceHost,
  extractCIDFromURL,
  isGreaterOrEqual
} from "../../helper";
import axios from "axios";
import { ProgressBar } from "react-bootstrap";
import ShowQRModal from "../common/ShowQRModel";
// import ARViewer from "../common/ARModelViewer";

function Nftdetail() {
  const token = localStorage.getItem("jwtToken");
  const arRef = useRef(null);
  const hasFetched = useRef(false);
  const hasRunRef = useRef(false);
  const eventSourceRef = useRef(null);

  const { decodedToken } = useJwt(token);
  const [showMintModel, setShowMintModel] = useState(false);
  const [showSaleModel, setShowSaleModel] = useState(false);
  const [showBidModel, setShowBidModel] = useState(false);
  const [chkValue, setChkValue] = useState(true); /////////// terms and condition check box
  const [royaltyPerc, setRoyaltyPerc] = useState(0); //set royalty perc modal
  const [saleAmountModel, setSaleAmountModel] = useState(null); /////////// Sale amount Model
  const [bidAmountModel, setBidAmountModel] = useState(null); /////////// Bid amount Model
  const [bidDateModel, setBidDateModel] = useState(null); /////////// Bid Date Model
  const [nft, setNft] = useState(null); // set value for nft detail

  // set value for nft user detail
  const [mintinfo, setMintinfo] = useState({}); // set value for nft minted detail
  const [searchKey, setSearchKey] = useState(true);
  const [properties, setProperties] = useState(null);
  const [isSpinner, setIsSpinner] = useState(true);
  const [currency, setCurrency] = useState("");
  const [tokenTicker, setTokenTicker] = useState(null);
  const [catalogTicker, setCatalogTicker] = useState([]);
  const [ledgerOffers, setLedgerOffers] = useState(null);
  const [deskOffers, setDeskOffers] = useState([]);
  const [onlyXrpFlag, setOnlyXrpFlag] = useState(false);
  const [DNFTMutableFlag, setDNFTMutableFlag] = useState(false);
  const [burnFlag, setBurnFlag] = useState(false);
  const [tranFlag, setTransFlag] = useState(true);
  const [showSendModel, setShowSendModel] = useState(false);
  const [desAddress, setDesAddress] = useState(null);
  const [discModal, setDiscModal] = useState(false);
  const [showMoreOfferModal, setShowMoreOfferModal] = useState(false);
  const [moreOfferAmount, setMoreOfferamount] = useState(null);
  const [allPlacedOffers, setAllPlacedOffers] = useState(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [allProfile, setAllProfile] = useState(null);
  const [collections, setCollections] = useState(null);
  const [isCollection, setIsCollection] = useState(null);
  const [collectVal, setCollectVal] = useState(null);
  const [isCacheCleard, setIsCacheCleard] = useState(false);
  const [loadingAR, setLoadingAR] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [totalCollectons, setTotalCollections] = useState(0);
  const [finalDataOfMintedOffer, setfinalDataOfMintedOffer] = useState(null);
  const [isDisabled, setIsDisabled] = useState(false);
  const [events, setEvents] = useState(null);
  const [innerDataOfMintOffer, setInnerDataOfMintOffer] = useState(null);
  const url = window.location.href;

  const DATE_OPTIONS = {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  };

  const isOnlyXrpNft = (Number(mintinfo?.Flags) & 2) !== 0;

  const saleCurrencyOptions = useMemo(() => {
    if (isOnlyXrpNft) {
      return [{ value: "XRP", label: "XRP" }];
    }

    const issuedCurrencies = Array.isArray(tokenTicker)
      ? tokenTicker
          .filter((curr) => curr?.currency && curr.currency !== "XRP")
          .map((curr) => ({
            value: curr.curr || curr.currency,
            label: optionLabel(curr)
          }))
      : [];

    return [{ value: "XRP", label: "XRP" }, ...issuedCurrencies];
  }, [isOnlyXrpNft, tokenTicker]);

  const navigate = useNavigate();
  let getParams = useParams();
  const { state } = useLocation();

  let dispatch = useDispatch();

  const openDiscModal = () => {
    setDiscModal(true);
  };

  const handleCloseDisc = () => setDiscModal(false);

  const handleOfferMint = () => {
    if (!token) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "notconnectyet" + Date.now()
      });
      return;
    }

    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "checkBoxValue" + Date.now()
      });
      return;
    }
    setShowMintModel(true);
  };
  //////////////////////// CHECK box handle start/////////
  const handleCheckBox = () => {
    if (chkValue === false) {
      setChkValue(true);
    } else if (chkValue === true) {
      setChkValue(false);
    }
  };

  const getImageURL = async (url) => {
    const CID = extractCIDFromURL(url);
    return (await checkImageExists(CID)) ? replaceHost(url) : url;
  };

  //////////////////////// CHECK box handle ENd/////////
  //////////////////////// SALE AMOUNT handle start/////////
  const handleSaleAmount = (e) => {
    setSaleAmountModel(e.target.value);
  };
  //////////////////////// SALE AMOUNT handle ENd/////////

  //////////////////////// SALE AMOUNT handle start/////////
  const handleBidAmount = (e) => {
    setBidAmountModel(e.target.value);
  };
  const handleBidDate = (e) => {
    setBidDateModel(e.target.value);
  };
  //////////////////////// SALE AMOUNT handle ENd/////////

  ///////////////// REDUCER //////////////
  const [
    nftdtl,
    offerNft,
    mint,
    burn,
    sale,
    cancel,
    buy,
    bid,
    bidCancel,
    bidAndBurn,
    deleteNftReducer,
    tradeHistoryReducer,
    balance,
    send,
    receive,
    cancelSend,
    likeReducer,
    placeMoreoffer,
    getAllPlacedOffers,
    acceptPlacedoffersReducer,
    cancelPlacedOffer,
    updateNftInfo,
    nftCollection,
    { allMintedOffers }
  ] = useSelector((state) => [
    state.nftDetailReducer,
    state.mintNftOfferReducer,
    state.mintNftReducer,
    state.burnNftReducer,
    state.saleNftReducer,
    state.cancelSaleNftReducer,
    state.buyNftReducer,
    state.bidTokenReducer,
    state.bidCancelReducer,
    state.bidAndBurnTokenReducer,
    state.deleteNftReducer,
    state.tradeHistoryReducer.tradeHistory,
    state.getBalanceReducer,
    state.sendNftReducer,
    state.receiveNftReducer,
    state.cancelSendNftReducer,
    state.nftLikeReducer,
    state.placeMoreofferReducer,
    state.getAllPlacedoffersReducer,
    state.acceptPlacedoffersReducer,
    state.cancelPlacedOffersReducer,
    state.updateNftInfoReducer,
    state.collectionReducer,
    state.walletActionReducer
  ]);

  const { visible } = useSelector(
    (state) => state.qrModal // reads from shared reducer
  );

  ////////////////////////  MODEL START ///////

  //----------------- SALE MODEL START--------------//
  const handleCloseSaleModel = () => {
    setShowSaleModel(false);
    setSaleAmountModel(null);
    setCurrency("");
    dispatch(saleModalResetAction());
  };
  const showSaleModelButton = async () => {
    // check user
    if (decodedToken.ac !== nft.accountNumber) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "saleCheckUserModel" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      return;
    }
    // check checkbox is true or not
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "saleCheckBoxValueModel" + Date.now()
      });
      return;
    }
    setCurrency("XRP");
    setShowSaleModel(true);
  };
  //----------------- SALE MODEL END--------------//
  //----------------- BID MODEL START--------------//
  const handleCloseBidModel = () => setShowBidModel(false);
  const showBidModelButton = async () => {
    ///////////////////// FOR DEV-NET ONLY /////////////////////////////////
    toast.info(MessageConst.messageForBidAndBurnFeature, {
      toastId: "cbidAndBurnTokenCheckBoxValue1111" + Date.now()
    });
    return;
    /////////////////////////////// FOR DEV-NET ONLY//////////////////////////
    // check user
    // if (decodedToken.ac !== nft.accountNumber) {
    // 	toast.warn(MessageConst.errorConnectXummWallet, {
    // 		toastId: "bd" + Date.now(),
    // 	});
    // 	setTimeout(() => {
    // 		navigate("/Login");
    // 	}, 1000);
    // 	return;
    // }
    // // check checkbox is true or not
    // if (chkValue !== true) {
    // 	toast.warn(MessageConst.warningTermsandConditions, {
    // 		toastId: "bd1" + Date.now(),
    // 	});
    // 	return;
    // }
    // setShowBidModel(true);
  };

  // useEffect(() => {
  //   if (!nft) return; // exit early if still null
  //   if (isMobile && isIOS && !hasRunRef.current) {
  //     hasRunRef.current = true; // Prevent multiple conversions
  //     if (["gltf", "glb"].includes(nft.contentType)) {
  //       setLoadingAR(true); // start loading
  //       dispatch(convertGLBtoUSDZ(nft.image)).then((res) => {
  //         if (res?.status === 200) {
  //           setUsdzPath(res.data.dataUri);
  //         }
  //         setLoadingAR(false); // done loading
  //       });
  //     }
  //   }
  // }, [nft, isMobile, isIOS, dispatch]);

  const getCollectionCount = () => {
    if (!!nft) {
      if (nft?.name && !nft.name.includes("#")) {
        setTotalCollections(0);
      } else {
        axios
          .get(
            `${configData.LOCAL_API_URL}collection/get/${
              nft.name.split("#")[0]
            }`
          )
          .then((res) => {
            if (res.data) {
              const { data } = res.data;
              setTotalCollections(data.length);
            }
          });
      }
    }
  };

  useEffect(() => {
    if (visible) {
      handleCloseMintModel();
      handleCloseSaleModel();
      handleCloseMoreOfferModal();
    }
  }, [visible]);

  useEffect(() => {
    if (showSaleModel && isOnlyXrpNft) {
      setCurrency("XRP");
    }
  }, [showSaleModel, isOnlyXrpNft]);

  // GET ALL COLLECTIONS
  useEffect(() => {
    if (!!nft) {
      getCollectionCount(nft);
      dispatch(getAllMintedOffers());
    }
  }, [dispatch, nft]);

  useEffect(() => {
    if (!!allMintedOffers && allMintedOffers?.data && !!nft) {
      let data = allMintedOffers.data;
      if (!!token) {
        data = data.filter((vl) => vl.accountNumber !== decodedToken.ac);
      }
      setInnerDataOfMintOffer(data.flatMap((vl) => vl.NftDetails));
      const mintedNftsDetail = data
        .flatMap((vl) => vl.NftDetails)
        .find((v) => v.nftid === nft._id && v.isMinted === false);
      setfinalDataOfMintedOffer(mintedNftsDetail);
    }
  }, [allMintedOffers, nft, token]);

  // useEffect(() => {
  // }, [dispatch, nft]);

  //----------------- BID MODEL END--------------//
  ////////////////////////  MODEL END ///////
  useEffect(() => {
    if (!nft) {
      setTimeout(() => {
        forceVisible();
      }, 100);
    }
  }, [nft]);

  /////////////////// REDUCER ALL DATA //////////////////
  useEffect(() => {
    dispatch(
      getCollections({ page: null, walletAddress: getParams.id, type: 1 })
    );

    window.scrollTo(0, 0);
    setTimeout(() => {
      setIsSpinner(false);
    }, 3000);
  }, []);

  useEffect(() => {
    if (!!collections) {
      const data = collections.docs.find(
        (vl) => vl.walletAddr === decodedToken?.ac
      );

      // console.log("isCollection", data, "data is sdfasfasdfasdf", state);

      // if (collections.docs.length === 0) {
      //   setIsCollection(null);
      //   setCollectVal(null)
      // } else {
      // if (!state) {
      // console.log(state, "check the state22", data)
      if (!!token) {
        if (data) {
          setIsCollection(true);
          setCollectVal(data);
        } else {
          // console.log(state, "check the state1", data)
          setIsCollection(false);
          setCollectVal(data);
        }
      } else {
        setIsCollection(false);
        setCollectVal(data);
      }
      // }
      //  else {
      // console.log(state, "check the state", data)
      // if (state.isValid == false ) {
      //   setIsCollection(null);
      //   setCollectVal(null);
      // } else
      // if (data !== undefined) {
      //   setIsCollection(true);
      //   setCollectVal(data);
      // } else {
      //   setIsCollection(false);
      //   setCollectVal(data);
      // }
      // }
      // }
    }
  }, [collections]);

  useEffect(() => {
    if (!!nftCollection.nftCollections) {
      const { data, message, deleted } = nftCollection.nftCollections;
      if (data) {
        setCollections(data);
      } else {
        if (deleted) {
          toast.error(message, {
            toastId: "deletecollection" + Date.now(),
            onClose: () => {
              dispatch(
                getCollections({
                  page: null,
                  walletAddress: getParams.id,
                  type: 1
                })
              );
            }
          });
        } else {
          toast.success(message, {
            toastId: "addcollection" + Date.now(),
            onClose: () => {
              dispatch(
                getCollections({
                  page: null,
                  walletAddress: getParams.id,
                  type: 1
                })
              );
            }
          });
        }
      }
    }
  }, [nftCollection]);

  useMemo(() => {
    (async () => {
      // console.log(nftdtl, "check the adfsdf");
      if (nftdtl.nftDetailsNFT !== "") {
        const { data, datauser, minData, totalNft } = nftdtl.nftDetailsNFT || {};
        if (data !== undefined) {
          data.image = await getImageURL(data.image);
          setNft({ ...data, totalNft });
          setMintinfo(minData);
          setProperties(null);
          if (data?.metaDataUrl !== undefined) {
            try {
              const metaUrl = await getImageURL(data.metaDataUrl);
              const res = await fetch(metaUrl);
              const PropVal = await res.json();
              const propData =
                PropVal.attributes !== undefined
                  ? typeof PropVal.attributes === "string"
                    ? JSON.parse(PropVal.attributes)
                    : PropVal.attributes
                  : [];

              const arr = [];
              if (PropVal?.collectionName) {
                arr.push({
                  traitType: "Collection Name",
                  traitValue: PropVal?.collectionName
                });
              }
              if (PropVal?.type) {
                arr.push({
                  traitType: "Type",
                  traitValue: PropVal?.type
                });
              }
              if (PropVal?.externalurl) {
                arr.push({
                  traitType: "External Url",
                  traitValue: PropVal?.externalurl
                });
              }

              if (PropVal?.metaverse) {
                arr.push({
                  traitType: "Metaverse",
                  traitValue: PropVal?.metaverse
                });
              }

              setProperties([...propData, ...arr]);
            } catch (error) {
              return error;
            }
          }
        }
      }
    })();
  }, [nftdtl]); // eslint-disable-line

  let issuer = "NA";
  let mintedDate = "NA";
  if (mintinfo !== null) {
    issuer = mintinfo?.Issuer;
    mintedDate = new Date(mintinfo?.createdAt).toLocaleDateString(
      "en-US",
      DATE_OPTIONS
    );
  }

  ////////////////////////  ALL DATA FATCH ONLOAD START///////
  useEffect(() => {
    try {
      let itemID = getParams.id;
      dispatch(nftDetailAction({ itemID, loader: true }));
    } catch (error) {
      toast.error(error.response.data.message, {
        toastId: "Nftdetail1111" + Date.now()
      });
    }
  }, [getParams, likeReducer]); // eslint-disable-line

  ////////////////////////  ALL DATA FATCH ONLOAD END///////

  /* Trade history dispatch action */
  useEffect(() => {
    try {
      let nftId = getParams.id;
      dispatch(tradeHistoryAction({ nftId, loader: true }));
    } catch (error) {
      toast.error(error.response.data.message, {
        toastId: "Nfttradehistory" + Date.now()
      });
    }
  }, [getParams.id]); // eslint-disable-line

  ////////////////////////   FOR BUY START ///////

  useEffect(() => {
    if (buy.error === false) {
      toast.success(buy.buy.message, {
        toastId: "cbuy1" + Date.now()
      });
      setTimeout(() => {
        window.location.reload(false);
      }, 5000);
    } else if (buy.error !== null) {
      toast.error(buy.error.message, {
        toastId: "cabuy2" + Date.now()
      });
    }
  }, [buy.error]); // eslint-disable-line

  ////////////////////////  FOR BUY END ///////
  ////////////////////////  CANCEL FOR SALE START ///////
  useEffect(() => {
    if (cancel.error === false) {
      toast.success(cancel.cancelSale.message, {
        toastId: "cancel1" + Date.now()
      });
      setTimeout(() => {
        window.location.reload(false);
      }, 5000);
    } else if (cancel.error !== null) {
      toast.error(cancel.error.message, {
        toastId: "cancel2" + Date.now()
      });
    }
  }, [cancel.error]); // eslint-disable-line

  ////////////////////////  CANCEL FOR SALE END ///////
  ////////////////////////  FOR SALE START ///////
  useEffect(() => {
    if (sale.error === false) {
      toast.success(sale.sale.message, {
        toastId: "salemsg1" + Date.now(),
        onClose: () => {
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      });
      setTimeout(() => {
        window.location.reload(true);
      }, 5000);
    } else if (sale.error !== null) {
      toast.error(sale.error.message, {
        toastId: "salemsg2" + Date.now()
      });
    }
  }, [sale.error]); // eslint-disable-line
  ////////////////////////  FOR SALE END ///////

  ////////////////////////  FOR MINT OFFER START ///////
  useEffect(() => {
    if (offerNft.error === false) {
      toast.success(offerNft.mintOffer.message, {
        toastId: "offermint" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 3200);
    } else if (offerNft.error !== null) {
      toast.error(offerNft.error.message, {
        toastId: "offerminterror" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  }, [offerNft.error]); // eslint-disable-line

  ////////////////////////  FOR MINT START ///////
  useEffect(() => {
    if (mint.error === false) {
      toast.success(mint.mint.message, {
        toastId: "simint311" + Date.now()
      });
      setTimeout(() => {
        setNft(null);
        window.location.reload(false);
      }, 3000);
    } else if (mint.error !== null) {
      toast.error(mint.error.message, {
        toastId: "simint311" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  }, [mint.error]); // eslint-disable-line

  ////////////////////////  FOR MINT END ///////
  ////////////////////////  FOR BURN START ///////
  useEffect(() => {
    if (burn.error === false) {
      toast.success(burn.mint.message, {
        toastId: "siburn311" + Date.now()
      });
      setTimeout(() => {
        window.location.reload(false);
      }, 3000);
    } else if (burn.error !== null) {
      toast.error(burn.error.message, {
        toastId: "siburn311" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  }, [burn.error]); // eslint-disable-line

  ////////////////////////  FOR BURN END ///////

  ////////////////////////  FOR BID START ///////
  useEffect(() => {
    if (bid.error === false) {
      toast.success(bid.bid.message, {
        toastId: "sibid311" + Date.now()
      });
      setTimeout(() => {
        window.location.reload(false);
      }, 3000);
    } else if (bid.error !== null) {
      toast.error(bid.error.message, {
        toastId: "sibid311" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  }, [bid.error]); // eslint-disable-line

  ////////////////////////  FOR BID END ///////

  ////////////////////////  FOR CANCEL BID START ///////
  useEffect(() => {
    if (bidCancel.error === false) {
      toast.success(bidCancel.bidCancel.message, {
        toastId: "sigbidCancel311" + Date.now()
      });
      setTimeout(() => {
        window.location.reload(false);
      }, 3000);
    } else if (bidCancel.error !== null) {
      toast.error(bidCancel.error.message, {
        toastId: "sigbidCancel311" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  }, [bidCancel.error]); // eslint-disable-line

  ////////////////////////  FOR CANCEL BID END ///////

  ////////////////////////  FOR BID AND BURN START ///////
  useEffect(() => {
    if (bidAndBurn.error === false) {
      toast.success(bidAndBurn.bidAndBurn.message, {
        toastId: "sigbidAndBurn311" + Date.now()
      });
      setTimeout(() => {
        window.location.reload(false);
      }, 3000);
    } else if (bidAndBurn.error !== null) {
      toast.error(bidAndBurn.error.message, {
        toastId: "sigbidAndBurn311" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  }, [bidAndBurn.error]); // eslint-disable-line

  ////////////////////////  FOR BID AND BURN END ///////

  // Get Profile Info
  useEffect(() => {
    dispatch(getProfileAction({ wAddress: "" }))
      .then((pDetail) => {
        setAllProfile(pDetail.data.allProfile);
      })
      .catch((err) => console.log(err, "pdetails error"));
  }, []); // eslint-disable-line

  ////////////////////////  FOR BID AND BURN DISPACH START ///////
  const bidAndBurnToken = async () => {
    ///////////////////// FOR DEV-NET ONLY /////////////////////////////////
    toast.info(MessageConst.messageForBidAndBurnFeature, {
      toastId: "cbidAndBurnTokenCheckBoxValue22222" + Date.now()
    });
    return;
    /////////////////////////////// FOR DEV-NET ONLY//////////////////////////
    // check user
    // if (decodedToken.ac !== nft.accountNumber) {
    // 	toast.warn(MessageConst.errorConnectXummWallet, {
    // 		toastId: "bidAndBurnTokenCheckUser" + Date.now(),
    // 	});
    // 	setTimeout(() => {
    // 		window.location.reload(false);
    // 	}, 1000);
    // 	return;
    // }
    // check checkbox is true or not
    // if (chkValue !== true) {
    // 	toast.warn(MessageConst.warningTermsandConditions, {
    // 		toastId: "cbidAndBurnTokenCheckBoxValue" + Date.now(),
    // 	});
    // 	return;
    // }
    // call api

    // try {
    // 	let data = {
    // 		_id: nft._id,
    // 	};
    // 	dispatch(bidAndBurnTokenAction({ data, loader: true }));
    // } catch (error) {
    // 	toast.error(MessageConst.somethingWrongError, {
    // 		toastId: "bidAndBurnToken1" + Date.now(),
    // 	});
    // }
  };
  ////////////////////////  FOR BID AND BURN DISPACH END ///////

  ////////////////////////  FOR CANCEL BID DISPACH START ///////
  const cancelBid = async () => {
    // check user
    if (decodedToken.ac !== nft.accountNumber) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "cancelBidUser" + Date.now()
      });
      setTimeout(() => {
        navigate("/");
      }, 1000);
      return;
    }
    // check checkbox is true or not
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "cancelBidBoxValue" + Date.now()
      });
      return;
    }
    // call api
    try {
      let data = {
        _id: nft._id
      };
      dispatch(bidCancelTokenAction({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "cancelBid1" + Date.now()
      });
    }
  };
  ////////////////////////  FOR CANCEL BID DISPACH END ///////

  ////////////////////////  FOR BID DISPACH START ///////
  const bidToken = async () => {
    // check user
    if (decodedToken.ac !== nft.accountNumber) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "bidTokenCheckUser" + Date.now()
      });
      setTimeout(() => {
        navigate("/");
      }, 1000);
      return;
    }
    // check checkbox is true or not
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "bidTokenCheckBoxValue" + Date.now()
      });
      return;
    }

    // check AMOUNT
    if (bidAmountModel === null) {
      toast.warn(MessageConst.warningEnterPrice, {
        toastId: "sbidAmountModel" + Date.now()
      });
      return;
    }
    // check date and time
    if (bidDateModel === null) {
      toast.warn(MessageConst.warningSelectDateTime, {
        toastId: "sbidDateModel" + Date.now()
      });
      return;
    }

    try {
      let data = {
        _id: nft._id,
        amount: bidAmountModel,
        bidDateAndTime: bidDateModel
      };
      if (
        Date.parse(new Date()) < Date.parse(bidDateModel) &&
        Date.parse(bidDateModel) <
          Date.parse(new Date(new Date().setDate(new Date().getDate() + 2)))
      ) {
        dispatch(bidTokenAction({ data, loader: true }));
      } else {
        toast.warn(
          MessageConst.warningSelectDateBet +
            new Date() +
            " TO " +
            new Date(new Date().setDate(new Date().getDate() + 2)),
          {
            toastId: "sbidDateModel" + Date.now()
          }
        );
      }
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "bidToken1" + Date.now()
      });
    }
  };
  ////////////////////////  FOR BID DISPACH END ///////
  ////////////////////////  FOR BUY NFT DISPACH START ///////
  const buyNft = async () => {
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "buynft12111" + Date.now()
      });
      return;
    }
    if (decodedToken === null) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "buynft12" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      return;
    }
    if (nft.status === "sale") {
      try {
        let data = {
          _id: nft._id
        };
        dispatch(buyNftAction({ data, loader: true }));
      } catch (error) {
        toast.error(MessageConst.somethingWrongError, {
          toastId: "buynft1" + Date.now()
        });
      }
    } else if (nft.status === "bid" || nft.status === "bidandburn") {
      navigate(`/BidDetail/${nft._id}`);
    } else {
      toast.error(MessageConst.WarningNotOnSale, {
        toastId: "buynft12" + Date.now()
      });
    }
  };
  ////////////////////////  FOR BUY NFT DISPACH END ///////
  ////////////////////////  FOR CANCEL SALE TOKEN DISPACH START ///////
  const cancelSale = async () => {
    // check user
    if (decodedToken.ac !== nft.accountNumber) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "cancelSaleCheckUser" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return;
    }
    // check checkbox is true or not
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "cancelSaleCheckBoxValue" + Date.now()
      });
      return;
    }
    // call api
    try {
      let data = {
        _id: nft._id
      };
      dispatch(cancelSaleNftAction({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "cancelsaleToken1" + Date.now()
      });
    }
  };
  ////////////////////////  FOR CANCEL SALE TOKEN DISPACH END ///////
  ////////////////////////  FOR SALE TOKEN DISPACH START ///////

  const saleToken = async () => {
    let decimalregex = /^\d{0,12}(\.\d{0,6})?$/;
    let decimalregex1 = /^\d{0,15}(\.\d{0,15})?$/;

    // check user
    if (decodedToken.ac !== nft.accountNumber) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "saleCheckUser" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return;
    }
    // check checkbox is true or not
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "saleCheckBoxValue" + Date.now()
      });
      return;
    }
    // check checkbox is true or not
    if (saleAmountModel === null || saleAmountModel <= 0) {
      toast.warn(MessageConst.warningEnterPrice, {
        toastId: "ssaleAmountModel" + Date.now()
      });
      return;
    }
    if (!currency) {
      toast.warn(MessageConst.SELECT_CURRENCY, {
        toastId: "salecurrency" + Date.now()
      });
      return;
    }
    const saleTicker = findTicker(tokenTicker, currency);
    const saleCode = saleTicker?.currency || currency.split(":")[0];
    if (saleCode === "XRP" && !decimalregex.test(saleAmountModel)) {
      return toast.warn(MessageConst.XRP_WRONG_DECIMAL, {
        toastId: "wrongdecimal" + Date.now()
      });
    }
    if (saleCode !== "XRP" && !decimalregex1.test(saleAmountModel)) {
      return toast.warn(MessageConst.ISSUED_WRONG_DECIMAL, {
        toastId: "wrongdecimal1" + Date.now()
      });
    }

    // call api
    try {
      let data = {
        _id: nft._id,
        amount: saleAmountModel,
        currency: saleCode,
        issuerAdd: saleCode === "XRP" ? "" : saleTicker?.issuer || ""
      };
      dispatch(saleNftAction({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "saleToken1" + Date.now()
      });
    }
  };
  ////////////////////////  FOR SALE TOKEN DISPACH END ///////
  ////////////////////////  FOR BURN TOKEN DISPACH START ///////
  const burnToken = async () => {
    // check user
    if (decodedToken.ac !== nft.accountNumber) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "burnCheckUser" + Date.now()
      });
      setTimeout(() => {
        navigate("/");
      }, 1000);
      return;
    }
    // check checkbox is true or not
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "burnCheckBoxValue" + Date.now()
      });
      return;
    }
    // call api

    try {
      let data = {
        _id: nft._id
      };
      dispatch(burnNftAction({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "burnToken1" + Date.now()
      });
    }
  };
  ////////////////////////  FOR BURN TOKEN DISPACH END ///////
  const handleCloseMintModel = () => {
    setShowMintModel(false);
    // Reset modal fields
    setRoyaltyPerc(0);
    setTransFlag(true);
    setBurnFlag(false);
    setOnlyXrpFlag(false);
    setDNFTMutableFlag(false);
    setEvents(null);
    setIsDisabled(false);
    // Close SSE if open
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    // Clear loader state
    dispatch(mintModalResetAction());
    dispatch(mintOfferModalResetAction());
  };

  const showMintModelButton = () => {
    // check user
    if (decodedToken.ac !== nft.accountNumber) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "saleCheckUserModel" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return;
    }
    // check checkbox is true or not
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "saleCheckBoxValueModel" + Date.now()
      });
      return;
    }
    setShowMintModel(true);
  };

  const handleRoyaltyPerc = (e) => {
    setRoyaltyPerc(e.target.value);
  };

  const offerMintoken = async () => {
    setIsDisabled(true);

    const checkCurrency = tokenTicker.find(
      (vl) => vl.currency === finalDataOfMintedOffer.currency
    );

    if (!checkCurrency) {
      toast.error(MessageConst.CURRENCY_NOT_FOUND, {
        toastId: "currencyNotFound" + Date.now(),
        onClose: () => setIsDisabled(false)
      });
      return;
    }

    if (!isGreaterOrEqual(checkCurrency.value, finalDataOfMintedOffer.amount)) {
      toast.error(MessageConst.CURRENCY_AMOUNT_IS_LOW, {
        toastId: "loweramount" + Date.now(),
        onClose: () => setIsDisabled(false)
      });
      return;
    }

    setEvents({ step: 20, message: "Minting started..." });

    if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
      eventSourceRef.current = new EventSource(
        `${configData.LOCAL_API_URL}events/${nft._id}`
      );

      eventSourceRef.current.onmessage = (e) => {
        const parsed = JSON.parse(e.data);
        setEvents(parsed);
      };

      eventSourceRef.current.onerror = () => {
        console.log("SSE disconnected");
        eventSourceRef.current?.close();
      };
    }

    const data = {
      _id: nft._id,
      TransferFee: finalDataOfMintedOffer.transferFee,
      flag: finalDataOfMintedOffer.flag,
      currency: finalDataOfMintedOffer.currency,
      amount: finalDataOfMintedOffer.amount
    };

    dispatch(mintNftOfferAction({ data, loader: true }));
    setIsDisabled(false);
  };

  ////////////////////////  FOR MINT TOKEN DISPACH START ///////
  const mintToken = async () => {
    setIsDisabled(true);
    // check user
    if (decodedToken.ac !== nft.accountNumber) {
      toast.error(MessageConst.errorConnectXummWallet, {
        toastId: "mintCheckUser" + Date.now()
      });
      setTimeout(() => {
        setIsDisabled(false);
        window.location.reload();
      }, 1000);
      return;
    }
    // check checkbox is true or not
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "mintCheckBoxValue" + Date.now()
      });
      setIsDisabled(false);
      return;
    }

    let flag = await flagHandler(
      tranFlag,
      burnFlag,
      onlyXrpFlag,
      DNFTMutableFlag
    );
    // call api
    try {
      let data = {
        _id: nft._id,
        TransferFee: royaltyPerc * 1000,
        flag: flag
      };
      dispatch(mintNftAction({ data, loader: true }));
      setIsDisabled(false);
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "mintToken1" + Date.now()
      });
    }
  };

  const flagHandler = async (
    tranFlag,
    burnFlag,
    onlyXrpFlag,
    DNFTMutableFlag
  ) => {
    var arr = [];
    if (tranFlag) arr.push(8);
    if (burnFlag) arr.push(1);
    if (onlyXrpFlag) arr.push(2);
    if (DNFTMutableFlag) arr.push(16);
    arr.join(", ");
    return arr.reduce((a, b) => a + b, 0);
  };

  const getFlagValue = (flagval) => {
    const flag = Number(flagval);
    return {
      burnFlag: (flag & 1) !== 0, // 1
      onlyXrpFlag: (flag & 2) !== 0, // 2
      tranFlag: (flag & 8) !== 0, // 8
      DNFTMutableFlag: (flag & 16) !== 0 // 16
    };
  };

  ////////////////////////  FOR MINT TOKEN DISPACH END ///////
  // =============DELETE NFT RESPONSE============
  useEffect(() => {
    if (isCacheCleard) {
      if (deleteNftReducer.error === false) {
        toast.success(deleteNftReducer.deletedNft.message, {
          toastId: "deleteddone" + Date.now(),
          onClose: () => {
            setIsCacheCleard(false);
            setTimeout(() => {
              navigate("/");
            }, 3000);
          }
        });
      } else if (deleteNftReducer.error !== null) {
        toast.error(deleteNftReducer.error.message, {
          toastId: "deletederror" + Date.now(),
          onClose: () => {
            setIsCacheCleard(false);
            setTimeout(() => {
              navigate("/");
            }, 3000);
          }
        });
      }
    }
  }, [deleteNftReducer.error, isCacheCleard]); // eslint-disable-line

  // ===========DELETE NFT DISPATCH ACTION==========
  const deleteNft = async () => {
    // check user
    if (decodedToken.ac !== nft.accountNumber) {
      toast.error(MessageConst.errorConnectXummWallet, {
        toastId: "deleteCheckUser" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return;
    }
    // check checkbox is true or not
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "deleteCheckBoxValue" + Date.now()
      });
      return;
    }
    // call api
    try {
      setIsCacheCleard(true);
      let data = {
        _id: nft._id
      };
      dispatch(deleteNftAction({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "deleteToken1" + Date.now()
      });
    }
  };

  /* Issued currency for sale feature */
  const handleCurrency = (e) => {
    setCurrency(e.target.value);
  };

  useEffect(() => {
    fetch(`${configData.LOCAL_API_URL}assets/catalog`)
      .then((res) => res.json())
      .then((body) => setCatalogTicker(body.data?.assets || []))
      .catch(() => setCatalogTicker([]));
  }, []);

  useEffect(() => {
    const walletRows = Array.isArray(balance?.currency)
      ? balance.currency
      : balance?.currency?.currency || [];
    setTokenTicker(mergeTickers(catalogTicker, walletRows));
  }, [balance, catalogTicker]);

  useEffect(() => {
    const nftId = nft?.NFTokenID;
    if (nftId && /^[0-9A-Fa-f]{64}$/.test(nftId)) {
      fetch(`${configData.LOCAL_API_URL}assets/ledger/nft/${encodeURIComponent(nftId)}/offers`)
        .then((res) => res.json())
        .then((body) => setLedgerOffers(body.data || null))
        .catch(() => setLedgerOffers(null));
    } else {
      setLedgerOffers(null);
    }
    if (nft?._id) {
      fetch(`${configData.LOCAL_API_URL}market/offers?nftId=${encodeURIComponent(nft._id)}`)
        .then((res) => res.json())
        .then((body) => setDeskOffers(body.data || []))
        .catch(() => setDeskOffers([]));
    }
  }, [nft?._id, nft?.NFTokenID]);

  useEffect(() => {
    try {
      if (localStorage.getItem("jwtToken") !== null) {
        let data = {
          token: localStorage.getItem("jwtToken")
        };
        dispatch(getBalanceAction({ data, loader: true }));
      }
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "connectWallet1" + Date.now()
      });
    }
  }, [localStorage.getItem("jwtToken")]); // eslint-disable-line

  /* Send NFT functionality */

  const showSendModelButton = () => {
    // toast.info(MessageConst.messageForBidAndBurnFeature, {
    //   toastId: "cbidAndBurnTokenCheckBoxValue1111" + Date.now(),
    // });
    // // return;
    // // check checkbox is true or not
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "saleCheckBoxValueModel" + Date.now()
      });
      return;
    }
    setShowSendModel(true);
  };

  const handleCloseSendModel = () => setShowSendModel(false);

  const handleSendAdd = (e) => setDesAddress(e.target.value);

  const sendNft = () => {
    if (send?.isSubmit) return;
    // check user
    if (decodedToken.ac !== nft.accountNumber) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "sendCheckUser" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return;
    }
    // check checkbox is true or not
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "sendCheckBoxValue" + Date.now()
      });
      return;
    }
    if (desAddress === null || desAddress === "") {
      toast.warn(MessageConst.DADDRESS, {
        toastId: "sendDaddModel" + Date.now()
      });
      return;
    }
    if (desAddress?.trim() === decodedToken?.ac) {
      toast.error(MessageConst.SEND_SAME_ADDRESS, {
        toastId: "sendSameAddress" + Date.now()
      });
      return;
    }
    // call api
    try {
      let data = {
        _id: nft._id,
        destAdd: desAddress
      };
      dispatch(sendNftAction({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "sendToken1" + Date.now()
      });
    }
  };

  useEffect(() => {
    if (send.error === false) {
      toast.success(send.send.message, {
        toastId: "salemsg1" + Date.now()
      });
      setTimeout(() => {
        window.location.reload(true);
      }, 5000);
    } else if (send.error !== null) {
      toast.error(send.error.message, {
        toastId: "salemsg2" + Date.now()
      });
    }
  }, [send.error]); // eslint-disable-line

  /* Receive NFT functionality */
  const receiveNft = async () => {
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "receivenft12111" + Date.now()
      });
      return;
    }
    if (decodedToken === null) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "receivenft12" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return;
    }
    if (nft.status === "send") {
      try {
        let data = {
          _id: nft._id
        };
        dispatch(receiveNftAction({ data, loader: true }));
      } catch (error) {
        toast.error(MessageConst.somethingWrongError, {
          toastId: "receivenft1" + Date.now()
        });
      }
    } else if (nft.status === "bid" || nft.status === "bidandburn") {
      navigate(`/BidDetail/${nft._id}`);
    } else {
      toast.error(MessageConst.WarningNotOnSale, {
        toastId: "receivenft12" + Date.now()
      });
    }
  };

  useEffect(() => {
    if (receive.error === false) {
      toast.success(receive.receive.message, {
        toastId: "receive1" + Date.now()
      });
      setTimeout(() => {
        window.location.reload(false);
      }, 5000);
    } else if (receive.error !== null) {
      toast.error(receive.error.message, {
        toastId: "receive2" + Date.now()
      });
    }
  }, [receive.error]); // eslint-disable-line

  /* Cancel Send functionality  */

  const cancelSendNft = () => {
    // check user
    if (decodedToken.ac !== nft.accountNumber) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "cancelSendCheckUser" + Date.now()
      });
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      return;
    }
    // check checkbox is true or not
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "cancelSendCheckBoxValue" + Date.now()
      });
      return;
    }
    // call api
    try {
      let data = {
        _id: nft._id
      };
      dispatch(cancelSendNftAction({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "cancelsendToken1" + Date.now()
      });
    }
  };

  useEffect(() => {
    if (cancelSend.error === false) {
      toast.success(cancelSend.cancelSend.message, {
        toastId: "cancelsend1" + Date.now()
      });
      setTimeout(() => {
        window.location.reload(false);
      }, 5000);
    } else if (cancelSend.error !== null) {
      toast.error(cancelSend.error.message, {
        toastId: "cancelsend2" + Date.now()
      });
    }
  }, [cancelSend.error]); // eslint-disable-line

  /* More offer start*/
  const showMoreOfferModalMethod = () => {
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "MoreofferCheckBox" + Date.now()
      });
      return;
    }
    if (decodedToken === null) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "MoreofferCheckBox1" + Date.now(),
        onClose: () => {
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      });
      return;
    }
    setCurrency("XRP");
    setShowMoreOfferModal(true);
  };

  const handleCloseMoreOfferModal = () => {
    setShowMoreOfferModal(false);
    setMoreOfferamount(null);
    setCurrency("");
  };

  const handleMoreOfferAmount = (e) => setMoreOfferamount(e.target.value);

  const placeOffer = () => {
    let decimalregex = /^\d{0,12}(\.\d{0,6})?$/;
    let decimalregex1 = /^\d{0,15}(\.\d{0,15})?$/;
    //   // check user
    if (decodedToken.ac === nft.accountNumber) {
      toast.warn(MessageConst.MOREOFFER_SAME_OWNER, {
        toastId: "buyofferuserchaeck" + Date.now(),
        onClose: () => {
          setTimeout(() => window.location.reload(), 3000);
        }
      });
      return;
    }

    if (moreOfferAmount === null || moreOfferAmount === "") {
      toast.warn(MessageConst.MOREOFFER_BUY_AMOUNT, {
        toastId: "moreofferbuyamount" + Date.now()
      });
      return;
    }

    if (!currency) {
      toast.warn(MessageConst.SELECT_CURRENCY, {
        toastId: "salecurrency" + Date.now()
      });
      return;
    }
    const offerTicker = findTicker(tokenTicker, currency);
    const offerCode = offerTicker?.currency || currency.split(":")[0];
    if (offerCode === "XRP" && !decimalregex.test(moreOfferAmount)) {
      return toast.warn(MessageConst.XRP_WRONG_DECIMAL, {
        toastId: "wrongdecimal" + Date.now()
      });
    }
    if (offerCode !== "XRP" && !decimalregex1.test(moreOfferAmount)) {
      return toast.warn(MessageConst.ISSUED_WRONG_DECIMAL, {
        toastId: "wrongdecimal1" + Date.now()
      });
    }

    // call api
    try {
      let data = {
        _id: nft._id,
        amount: moreOfferAmount,
        currency: offerCode,
        issuerAdd: offerCode === "XRP" ? "" : offerTicker?.issuer || ""
      };
      //   // call api
      ensureWalletTrustlines(decodedToken?.ac, [
        { currency: offerCode, issuer: data.issuerAdd }
      ]);
      dispatch(placeMoreOfferAction({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "sendToken1" + Date.now()
      });
    }
  };

  useEffect(() => {
    if (placeMoreoffer.error === false) {
      toast.success(placeMoreoffer.placeMoreoffer.message, {
        toastId: "placeMoreoffer1" + Date.now(),
        onClose: () => {
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      });
    } else if (placeMoreoffer.error !== null) {
      toast.error(placeMoreoffer.error.message, {
        toastId: "placeMoreoffer2" + Date.now(),
        onClose: () => {
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      });
    }
  }, [placeMoreoffer.error]); // eslint-disable-line

  /* Dispatch order action */
  useEffect(() => {
    if (token !== null) {
      try {
        let nftId = getParams.id;
        dispatch(getAllPlacedOffersAction({ nftId, loader: true }));
      } catch (error) {
        toast.error(error.response.data.message, {
          toastId: "getAllOfferAction" + Date.now()
        });
      }
    }
  }, [getParams.id]); // eslint-disable-line

  useEffect(() => {
    if (getAllPlacedOffers.error === false) {
      setAllPlacedOffers(getAllPlacedOffers.getAllPlacedoffer.totalOffer);
    }
  }, [getAllPlacedOffers]); // eslint-disable-line

  const acceptOffer = (val) => {
    // check user
    if (decodedToken.ac !== nft.accountNumber) {
      toast.warn(MessageConst.ACCEPT_OFFER_OWNER, {
        toastId: "acceptofferCheckUser" + Date.now(),
        onClose: () => {
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      });
      return;
    } else {
      try {
        let data = {
          _id: nft._id,
          offerId: val.nftOfferIndex,
          nft_buyer: val.nft_buyer,
          nft_owner: val.nft_owner
        };
        dispatch(acceptPlacedOffersAction({ data, loader: true }));
      } catch (error) {
        toast.error(MessageConst.somethingWrongError, {
          toastId: "acceptOffer1" + Date.now()
        });
      }
    }
  };

  useEffect(() => {
    if (acceptPlacedoffersReducer.error === false) {
      toast.success(acceptPlacedoffersReducer.acceptPlacedoffer.message, {
        toastId: "acceptMoreoffer1" + Date.now(),
        onClose: () => {
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      });
    } else if (acceptPlacedoffersReducer.error !== null) {
      toast.error(acceptPlacedoffersReducer.error.message, {
        toastId: "acceptMoreoffer2" + Date.now(),
        onClose: () => {
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      });
    }
  }, [acceptPlacedoffersReducer]); // eslint-disable-line

  // cancel offer
  const cancelplacedOffer = (val) => {
    try {
      let data = {
        _id: val.nftObjId,
        nftOfferIndex: val.nftOfferIndex
      };
      setIsCancelled(true);
      dispatch(cancelPlacedOffersAction({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "cancelsendToken1" + Date.now()
      });
    }
  };

  // display cancel offer message after cancelation
  useEffect(() => {
    if (isCancelled) {
      if (cancelPlacedOffer.error === false) {
        toast.success(cancelPlacedOffer.cancelPlacedoffer.message, {
          toastId: "cancelbuyoffer1" + Date.now(),
          onClose: () => {
            setIsCancelled(false);
            navigate("/");
          }
        });
      } else if (cancelPlacedOffer.error !== null) {
        toast.error(cancelPlacedOffer.cancelPlacedoffer.data.message, {
          toastId: "cancelbuyoffer1" + Date.now(),
          onClose: () => {
            setIsCancelled(false);
          }
        });
      }
    }
  }, [cancelPlacedOffer.error, isCancelled]); // eslint-disable-line

  /* Update nft info dispatch action */
  useEffect(() => {
    hasFetched.current = false;
  }, [getParams?.id]);

  useEffect(() => {
    if (getParams?.id && !hasFetched.current) {
      try {
        let nftId = getParams.id;
        // fact checker
        dispatch(updateNftInfoAction({ nftId, loader: true }));
        hasFetched.current = true;
      } catch (error) {
        console.log(error, "error on update nft");
        // toast.error(error.response.data.message, {
        //   toastId: "updateNftInfo" + Date.now(),
        // });
      }
    }
  }, [getParams]); // eslint-disable-line

  useEffect(() => {
    if (!!updateNftInfo) {
      const { error } = updateNftInfo;
      if (error === false) {
        const data = updateNftInfo.updateNftInfo;
        if (data?.burned) {
          toast.info("NFT was updated on ledger and is no longer available.", {
            toastId: "updatenftinfoburned" + Date.now(),
            onClose: () => {
              navigate("/");
            }
          });
          return;
        }
        if (data && !data.unresolved) {
          getCollectionCount();
          dispatch(nftDetailAction({ itemID: getParams.id, loader: true }));
        }
      }
      if (error !== "") {
        if (error) {
          const message = updateNftInfo?.updateNftInfo?.data?.message;
          if (message) {
            toast.error(message, {
              toastId: "updatenftinfo" + Date.now(),
              onClose: () => {
                navigate("/");
              }
            });
          }
        }
        // comment the fact checker
        // else {
        //   dispatch(updateNftInfoAction({ nftId: getParams.id, loader: true }));
        // }
      }
    }
  }, [updateNftInfo]); // eslint-disable-line

  const handleCollection = () => {
    // check checkbox is true or not
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "checkprofileUser" + Date.now()
      });
      return;
    }

    // check user
    if (decodedToken === null) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "checkprofileUserModel" + Date.now()
      });
      return;
    }
    const Id = getParams.id;
    dispatch(
      addCollection({
        nftDetail: nft,
        Id,
        wAddress: decodedToken.ac,
        loader: true
      })
    );
  };

  // DFTToken Case
  const handleUpdateNFTinLedger = () => {
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "checkprofileUser" + Date.now()
      });
      return;
    }

    // check user
    if (decodedToken === null) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "checkprofileUserModel" + Date.now()
      });
      return;
    }

    const config = {
      headers: {
        Authorization: `Basic ${token}`
      }
    };

    axios
      .post(
        `${configData.LOCAL_API_URL}nft/create-update-payload`,
        {
          nftId: nft.NFTokenID,
          newUri:
            "https://radical-x.infura-ipfs.io/ipfs/QmPyvWzFKYjinjfsFP5LFxxWqTL3jbNrib6T3vPpFvZXDv"
        },
        config
      )
      .then((res) => {
        if (res.data && res.data.uuid) {
          const { uuid } = res.data;

          const interval = setInterval(async () => {
            try {
              const response = await axios.get(
                `${configData.LOCAL_API_URL}nft/verify-payload/${uuid}`,
                config // Ensure auth headers are passed if backend is protected
              );

              // Xaman API puts status inside the 'meta' object
              if (response.data.meta && response.data.meta.signed) {
                clearInterval(interval);
                console.log(
                  "Success: Transaction Signed",
                  response.data.response.txid
                );
              } else if (response.data.meta && response.data.meta.expired) {
                clearInterval(interval);
                console.log("Expired: User took too long");
              } else if (response.data.meta && response.data.meta.cancelled) {
                clearInterval(interval);
                console.log("Cancelled: User rejected the request");
              }
            } catch (err) {
              console.error("Polling error", err);
              // Optional: clearInterval(interval) if error is a 404 or 500
            }
          }, 4000);

          // REMOVED: clearInterval(interval); <--- This was killing your loop immediately
        }
      });
  };

  const handleDeleteCollection = (id) => {
    // check checkbox is true or not
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "deleteprofileUser" + Date.now()
      });
      return;
    }
    // check user
    if (decodedToken === null) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "deleteprofileUserModel" + Date.now()
      });
      return;
    }

    dispatch(
      deleteCollection({
        walletAddress: decodedToken?.ac,
        wAddress: decodedToken?.ac,
        id,
        Id: collectVal?.nftId || nft?._id || id,
        loader: true
      })
    );
  };

  // const getIpfsImage = (img) => {
  //   const last = img.substring(img.lastIndexOf("/") + 1, img.length);
  //   return last.indexOf('.') === -1 ? img?.split("/ipfs/")?.[1]?.startsWith("ba") ?  img : replaceHost(img) : img
  // }

  const tooltip = (
    <Tooltip id="tooltip">
      Before Accepting an <strong>OFFER</strong> for a NFT,{" "}
      <strong>CANCEL</strong> your <strong>FIXED</strong> sale to unlock and
      receive your XRP reserve.
    </Tooltip>
  );

  const getFlagDescription = (flags) => {
    // Ensure numeric (in case flags is a string)
    const value = Number(flags);

    const descriptions = [];

    if (value & 1) descriptions.push("Burnable"); // tfBurnable
    if (value & 2) descriptions.push("OnlyXRP"); // tfOnlyXRP
    if (value & 8) descriptions.push("Transferable"); // tfTransferable
    if (value & 16) descriptions.push("DNFT Mutable"); // tfMutable (dynamic NFT)

    if (descriptions.length === 0) return "N/A";

    return descriptions.join(", ");
  };

  const LoaderOrText = ({ loading, text }) =>
    loading ? (
      <BeatLoader sizeUnit="px" size={10} color="#FFF" loading />
    ) : (
      text
    );

  const isOwner = token && decodedToken?.ac === nft?.accountNumber;
  const prfImg = allProfile?.find(
    (v) => v.wAddress === nft?.accountNumber
  )?.pImage;

  const mintImg = allProfile?.find((v) => v.wAddress === issuer)?.pImage;
  const mintOfr = innerDataOfMintOffer?.find(
    (val) => val.nftid === getParams.id && val.isMinted === false
  );
  return (
    <React.Fragment>
      {/* <div
        style={{
          opacity: isActive ? 1 : 0,
          pointerEvents: isActive ? "auto" : "none",
          position: "absolute",
          inset: 0 // top:0; right:0; bottom:0; left:0
        }}
      >
        {!!nft && ["gltf", "glb"].includes(nft.contentType) && usdzPath && (
          <ARViewer
            ref={arRef}
            glbUrl={nft?.image || ""}
            usdzUrl={usdzPath}
            isIOS={isIOS}
          />
        )}
      </div> */}

      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg pt-4 DetailBG">
          <>
            <Container className="container">
              {isSpinner ? (
                <Row className="loader-class">
                  <Spinners.MutatingDots
                    visible={true}
                    height="100"
                    width="100"
                    color="#f531e9"
                    secondaryColor="#f531e9"
                    radius="12.5"
                    wrapperStyle={{
                      justifyContent: "center"
                    }}
                  />
                </Row>
              ) : (
                <>
                  <Row className="auth-wrapper App align-items-center  ">
                    <Col xs={12} md={12} className="padding-top-bottom-25">
                      <h3 className="nft-details">NFT Detail</h3>
                    </Col>
                    <Col xs={12} md={12} className="">
                      <h2 className="nft_name my-4 d-md-none d-block ms-3">
                        {nft?.name?.indexOf("#") === -1
                          ? nft?.name
                          : nft?.name?.indexOf(" #") === -1
                          ? nft?.name.split("#")[0] +
                            " #" +
                            nft?.name.split("#")[1]
                          : nft?.name}
                        <span className="dpmf-check">
                          {profileBatchColor(nft?.validation?.vScore || nft?.issuerVScore)}
                        </span>
                      </h2>
                    </Col>
                  </Row>
                  <Row className="pb-5 mainRow">
                    <Col
                      xs={12}
                      md={6}
                      lg={6}
                      xl={6}
                      className="order-1 order-md-0 order-lg-0 order-sm-0 order-xl-0"
                    >
                      <div className="nft_detail">
                        <div className="nft_Buttons_left d-flex align-items-center">
                          {nft?.NFTokenID ? (
                            <a
                              target="_blank"
                              rel="noreferrer"
                              href={`https://livenet.xrpl.org/nft/${nft?.NFTokenID}`}
                              className="verify"
                            >
                              <p className="d-flex align-items-center justify-content-between ">
                                <img loading="lazy" src={verifyImg} alt="" />
                                <span>Verify</span>
                              </p>
                            </a>
                          ) : (
                            ""
                          )}
                          {!!nft?.likes_data && (
                            <div className="likeCount">
                              <div className="countLike">
                                <p className="d-flex align-items-center justify-content-between">
                                  <Like post={nft?.likes_data} id={nft._id} />
                                </p>
                              </div>
                            </div>
                          )}
                          <CopyToClipboard
                            onCopy={() =>
                              toast.success("Link Copied", {
                                toastId: "copy" + Date.now()
                              })
                            }
                            text={url}
                          >
                            {
                              // eslint-disable-next-line
                              <a className="share cstmShareBTN">
                                <p className="d-flex align-items-center w-100 mb-0 h-100 justify-content-center">
                                  <img src={share} alt="" />
                                  <span>Share&nbsp;</span>
                                </p>
                              </a>
                            }
                          </CopyToClipboard>
                          {nft?.NFTokenID ? (
                            <a
                              target="_blank"
                              rel="noreferrer"
                              href={`https://bithomp.com/explorer/${nft?.NFTokenID}`}
                              className="share bitomp"
                            >
                              <p className="d-flex align-items-center w-100 mb-0 h-100 justify-content-center">
                                <img src={bithomp} alt="" />
                              </p>
                            </a>
                          ) : (
                            ""
                          )}
                        </div>
                        <h2 className="nft_name mt-4 d-md-block d-none">
                          {nft?.name?.indexOf("#") === -1
                            ? nft?.name
                            : nft?.name?.indexOf(" #") === -1
                            ? nft?.name.split("#")[0] +
                              " #" +
                              nft?.name.split("#")[1]
                            : nft?.name}
                          <span className="dpmf-check">
                            {profileBatchColor(
                              nft?.validation?.vScore || nft?.issuerVScore
                            )}
                          </span>
                        </h2>
                        {nft?.validation?.note && (
                          <p className="dpmf-muted">{nft.validation.note}</p>
                        )}
                        <p
                          className="nft_description"
                          style={{ whiteSpace: "pre-line" }}
                        >
                          {nft?.description}
                        </p>
                        <Accordion
                          defaultActiveKey={["0", "1", "2", "3", "v2-desk"]}
                          alwaysOpen
                        >
                          <NftMarketplacePanel
                            nft={nft}
                            address={decodedToken?.ac}
                          />
                          <Accordion.Item eventKey="0">
                            <Accordion.Header>ABOUT</Accordion.Header>
                            <Accordion.Body>
                              <div className="aboutDetail d-flex justify-content-between align-items-center">
                                <div className="owned">
                                  <div className="position-relative cstmAboutLink_CardBox">
                                    <h4>Owned by</h4>
                                    {token !== null ? (
                                      <>
                                        <Link
                                          to={"/Profile/" + nft?.accountNumber}
                                        >
                                          <p>
                                            {nft?.accountNumber?.substring(
                                              0,
                                              9
                                            )}
                                          </p>
                                        </Link>
                                        <i
                                          class="fa fa-link cstmFaLinkIcon"
                                          style={{ fontSize: 24 }}
                                        />{" "}
                                      </>
                                    ) : (
                                      <p>
                                        {nft?.accountNumber?.substring(0, 9)}
                                      </p>
                                    )}
                                  </div>
                                  <img
                                    src={(() => {
                                      if (!prfImg) return Userimage;
                                      if (prfImg.startsWith("https://ipfs"))
                                        return replaceHost(prfImg);
                                      return configData.LOCAL_API_URL + prfImg;
                                    })()}
                                    alt=""
                                    className="rounded-circle width-25"
                                  />
                                </div>
                                <div className="mintBy">
                                  <div className="position-relative cstmAboutLink_CardBox">
                                    <h4>Minted by</h4>
                                    {token !== null ? (
                                      <>
                                        <Link to={"/Profile/" + issuer}>
                                          <p>{issuer?.substring(0, 9)}</p>
                                        </Link>
                                        <i
                                          class="fa fa-link"
                                          style={{ fontSize: 24 }}
                                        />
                                      </>
                                    ) : (
                                      <p>{issuer?.substring(0, 9)}</p>
                                    )}
                                  </div>
                                  <img
                                    src={(() => {
                                      if (!mintImg) return Userimage;
                                      if (mintImg.startsWith("https://ipfs"))
                                        return replaceHost(mintImg);
                                      return configData.LOCAL_API_URL + mintImg;
                                    })()}
                                    alt=""
                                    className="rounded-circle width-25"
                                  />
                                </div>
                                <div className="collectible">
                                  <h4>Collection</h4>
                                  <p>
                                    {!!nft && totalCollectons > 0
                                      ? `${
                                          nft?.NumOfCopies
                                            ? nft.NumOfCopies
                                            : nft.name.split("#")[1]
                                        }/${totalCollectons}`
                                      : "N/A"}
                                  </p>
                                  <img
                                    src={Copysvg}
                                    alt=""
                                    className="rounded-circle width-25"
                                  />
                                </div>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="1">
                            <Accordion.Header>DETAILS</Accordion.Header>
                            <Accordion.Body>
                              <div className="nft_detail">
                                <Row>
                                  <Col className="text-left">
                                    <span>Issuer Address</span>
                                  </Col>
                                  <Col className="text-right">
                                    <p>{issuer?.substring(0, 20)}</p>
                                  </Col>
                                </Row>
                                <Row>
                                  <Col className="text-left">
                                    <span>Token Currency</span>
                                  </Col>
                                  <Col className="text-right">
                                    <p>
                                      {nft?.price} {nft?.currency}
                                    </p>
                                  </Col>
                                </Row>
                                <Row>
                                  <Col className="text-left">
                                    <span>NFT Standard</span>
                                  </Col>
                                  <Col className="text-right">
                                    <p>XLS-20</p>
                                  </Col>
                                </Row>
                                <Row>
                                  <Col className="text-left">
                                    <span>Blockchain</span>
                                  </Col>
                                  <Col className="text-right">
                                    <p>XRPL</p>
                                  </Col>
                                </Row>
                                <Row>
                                  <Col className="text-left">
                                    <span>File Type</span>
                                  </Col>
                                  <Col className="text-right">
                                    <p>{nft?.fileType}</p>
                                  </Col>
                                </Row>
                                <Row>
                                  <Col className="text-left">
                                    <span>Content Type</span>
                                  </Col>
                                  <Col className="text-right">
                                    <p>{nft?.contentType}</p>
                                  </Col>
                                </Row>
                                <Row>
                                  <Col className="text-left">
                                    <span>
                                      Nft ID{" "}
                                      {nft?.NFTokenID ? (
                                        <a
                                          target="_blank"
                                          rel="noreferrer"
                                          href={`https://bithomp.com/explorer/${nft?.NFTokenID}`}
                                        >
                                          {" "}
                                          <img src={bithomp} alt="" />
                                        </a>
                                      ) : (
                                        ""
                                      )}
                                    </span>
                                  </Col>
                                  <Col className="text-right">
                                    <p>
                                      {nft?.NFTokenID
                                        ? `${nft?.NFTokenID?.substring(
                                            0,
                                            8
                                          )}***${nft?.NFTokenID?.substring(
                                            (nft?.NFTokenID).length - 8
                                          )}`
                                        : "NA"}
                                    </p>
                                  </Col>
                                </Row>
                                <Row>
                                  <Col className="text-left">
                                    <span>Flag</span>
                                  </Col>
                                  <Col className="text-right">
                                    <p>
                                      {mintinfo?.Flags
                                        ? getFlagDescription(mintinfo?.Flags)
                                        : "NA"}
                                    </p>
                                  </Col>
                                </Row>
                                <Row>
                                  <Col className="text-left">
                                    <span>Minted On</span>
                                  </Col>
                                  <Col className="text-right">
                                    <p>{mintedDate}</p>
                                  </Col>
                                </Row>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="2">
                            <Accordion.Header>HISTORY</Accordion.Header>
                            <Accordion.Body>
                              <div className="history_detail">
                                <Table bordered hover className="mb-0">
                                  <thead>
                                    <tr>
                                      <th>Price(All)</th>
                                      <th>Address</th>
                                      <th>Date</th>
                                    </tr>
                                  </thead>
                                  <tbody className="tbody-details">
                                    {!!tradeHistoryReducer &&
                                    tradeHistoryReducer.history.length > 0 ? (
                                      tradeHistoryReducer.history.map(
                                        (val, i) => {
                                          return (
                                            <tr key={i}>
                                              <td>
                                                {val.price} {val.currency}
                                              </td>
                                              <td>
                                                {val.accountAdd.substring(0, 9)}{" "}
                                                *****{" "}
                                                {val.accountAdd.substring(
                                                  val.accountAdd.length - 5
                                                )}
                                              </td>
                                              <td>
                                                {new Date(
                                                  val.createdAt
                                                ).toLocaleDateString(
                                                  "en-US",
                                                  DATE_OPTIONS
                                                )}
                                              </td>
                                            </tr>
                                          );
                                        }
                                      )
                                    ) : (
                                      <tr>
                                        <td colSpan={3} align="center">
                                          No Data Found
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </Table>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="3">
                            <Accordion.Header>
                              All Buy Offers{" "}
                              {/* {allPlacedOffers?.length > 0 ? (
                                <p className="offer-info">
                                  &nbsp;&nbsp;<sup>*</sup>{" "}
                                  <span>
                                    NFT OWNER :<br />
                                    Before ACCEPTING a ‘OFFER’ for a NFT, CANCEL
                                    your FIXED sale to unlock and receive your XRP
                                    reserve..
                                  </span>
                                </p>
                              ) : (
                                ""
                              )} */}
                            </Accordion.Header>
                            <Accordion.Body>
                              <div className="history_detail">
                                <Table bordered hover className="mb-0">
                                  <thead>
                                    <tr>
                                      <th>Token</th>
                                      <th>Price</th>
                                      {/* <th>Date</th> */}
                                      <th>Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="tbody-details">
                                    {!!allPlacedOffers &&
                                    allPlacedOffers.length > 0 ? (
                                      allPlacedOffers.map((val) => {
                                        return (
                                          <tr>
                                            <td className="text-wrap">
                                              {val.buy_curr}
                                              {/* {val.nft_buyer.substring(0, 9)} ***** {val.nft_buyer.substring(val.nft_buyer.length - 5)} */}
                                            </td>
                                            <td className="text-wrap">
                                              {val.buy_amount}
                                            </td>
                                            {/* <td class="text-wrap">
                                          {new Date(
                                            val.createdAt
                                          ).toLocaleDateString(
                                            "en-US",
                                            DATE_OPTIONS
                                          )}
                                        </td> */}
                                            <td>
                                              {val?.nft_owner ===
                                              decodedToken.ac ? (
                                                nft?.status === "sale" ? (
                                                  <div className="align">
                                                    {" "}
                                                    {/* <i className="fa fa-check check-disable-icon"></i> */}
                                                    {/* <OverlayTrigger placement="top" overlay={tooltip}> */}
                                                    <Button
                                                      disabled
                                                      variant="success"
                                                      className="btn-offer-disabled"
                                                    >
                                                      Accept
                                                    </Button>
                                                    {/* </OverlayTrigger> */}
                                                    <small className="zerofees">
                                                      0.1% Fee
                                                    </small>
                                                  </div>
                                                ) : (
                                                  <div>
                                                    {" "}
                                                    <Button
                                                      variant="success"
                                                      className="btn-offer-disabled"
                                                      onClick={() =>
                                                        acceptOffer(val)
                                                      }
                                                    >
                                                      Accept
                                                    </Button>
                                                    {/* <i
                                                      className="fa fa-check check-icon"
                                                      onClick={() =>
                                                        acceptOffer(val)
                                                      }
                                                    ></i>{" "} */}
                                                    <small className="zerofees">
                                                      0.1% Fee
                                                    </small>
                                                  </div>
                                                )
                                              ) : null}
                                              &nbsp;&nbsp;
                                              {val.nft_id === nft?.NFTokenID &&
                                                val.nft_buyer ===
                                                  decodedToken.ac && (
                                                  <div className="align">
                                                    <Button
                                                      variant="danger"
                                                      className="btn-offer-disabled"
                                                      onClick={() =>
                                                        cancelplacedOffer(val)
                                                      }
                                                    >
                                                      Cancel
                                                    </Button>
                                                    {/* <i
                                                      className="fa fa-times times-icon"
                                                      onClick={() =>
                                                        cancelplacedOffer(val)
                                                      }
                                                    ></i> */}
                                                    <small className="zerofees">
                                                      0.1% Fee
                                                    </small>
                                                  </div>
                                                )}
                                            </td>
                                          </tr>
                                        );
                                      })
                                    ) : (
                                      <tr>
                                        <td colSpan={3} align="center">
                                          No Data Found
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </Table>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                          <Accordion.Item eventKey="ledger-offers">
                            <Accordion.Header>XRPL ledger offers</Accordion.Header>
                            <Accordion.Body>
                              <div className="history_detail">
                                <p className="dpmf-muted">
                                  Open buy and sell offers from `nft_buy_offers`
                                  / `nft_sell_offers`. Desk multi-asset offers
                                  are recorded separately.
                                </p>
                                <Table bordered hover className="mb-0">
                                  <thead>
                                    <tr>
                                      <th>Side</th>
                                      <th>Assets</th>
                                      <th>Owner</th>
                                      <th>Source</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(ledgerOffers?.offers || []).length ? (
                                      ledgerOffers.offers.map((row) => (
                                        <tr key={row.offerId}>
                                          <td>{row.side}</td>
                                          <td>
                                            {row.amount} {row.currency}
                                          </td>
                                          <td>
                                            {row.owner
                                              ? `${row.owner.slice(0, 8)}…`
                                              : "—"}
                                          </td>
                                          <td>{row.source}</td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={4} align="center">
                                          {nft?.NFTokenID &&
                                          /^[0-9A-Fa-f]{64}$/.test(nft.NFTokenID)
                                            ? "No open offers on the XRP Ledger"
                                            : "Demo token — enter a live NFTokenID on Assets"}
                                        </td>
                                      </tr>
                                    )}
                                    {deskOffers.map((row) => (
                                      <tr key={row._id}>
                                        <td>{row.kind || "desk"}</td>
                                        <td>{assetsLabel(row)}</td>
                                        <td>
                                          {row.from
                                            ? `${row.from.slice(0, 8)}…`
                                            : "—"}
                                        </td>
                                        <td>{row.source || "desk"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </Table>
                              </div>
                            </Accordion.Body>
                          </Accordion.Item>
                        </Accordion>
                      </div>
                    </Col>
                    <Col
                      xs={12}
                      md={6}
                      lg={6}
                      xl={6}
                      className="d-flex flex-column align-items-end order-0 order-md-1 order-lg-1 order-sm-1 order-xl-1 mb-5 "
                    >
                      <div className="nft_main w-100">
                        <img
                          src={detailNFT}
                          alt=""
                          className="detailNFT d-none d-md-block d-lg-block d-sm-block d-xl-block"
                        />
                        <div className="image_type">
                          {!nft ? (
                            <Spinners.ColorRing
                              visible={true}
                              height="80"
                              width="80"
                              ariaLabel="color-ring-loading"
                              wrapperStyle={{
                                justifyContent: "center",
                                position: "absolute",
                                top: "40%",
                                left: "40%"
                              }}
                              // wrapperClass="color-ring-wrapper"
                              colors={[
                                "#f531e9",
                                "#f531e9",
                                "#f531e9",
                                "#f531e9",
                                "#f531e9"
                              ]}
                            />
                          ) : (
                            <Filetypecomman
                              fileType={nft?.contentType}
                              image={nft?.image}
                              setIsActive={setIsActive}
                              ref={arRef}
                              // usdzPath={nft}
                            />
                          )}
                        </div>
                      </div>
                      <div className="nft_Price_Type">
                        <h4>
                          {mintOfr
                            ? mintOfr.currency
                            : nft?.currency
                            ? `${nft.currency}`
                            : "XRP"}
                        </h4>
                        <h4> {mintOfr ? mintOfr.amount : nft?.price}</h4>
                      </div>
                      <div className="nft_property">
                        <h3>Property</h3>
                        {!!properties && properties.length > 0 ? (
                          properties?.map((val, i) => {
                            return (
                              <div
                                className="property_detail d-flex justify-content-between align-items-center"
                                key={i}
                              >
                                <p>{val?.traitType}</p>
                                <p>{val?.traitValue}</p>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-white" style={{ fontSize: 14 }}>
                            No Record Found
                          </p>
                        )}
                      </div>
                      <div className="button_box">
                        <div className="detail-page-lightfont">
                          <input
                            type="checkbox"
                            name="checkbox"
                            onChange={handleCheckBox}
                            className="checkbox-privacy-policy"
                            checked={chkValue}
                          ></input>
                          <span>
                            {" "}
                            I have read and agree to terms of{" "}
                            <b
                              onClick={openDiscModal}
                              style={{ color: "#000", cursor: "pointer" }}
                            >
                              FUZION-XIO
                            </b>
                          </span>
                        </div>
                        {/* <div className="detailsBtn d-flex">
                          {(() => {
                            if (!!finalDataOfMintedOffer) {
                              return (
                                <>
                                  <Button
                                    variant="primary"
                                    onClick={handleOfferMint}
                                    className="BuyNFT-button width-100 cancelNft"
                                  >
                                    Mint NFT
                                  </Button>
                                </>
                              );
                            } else {
                              if (
                                nft?.status === "created" &&
                                token !== null &&
                                decodedToken?.ac === nft?.accountNumber
                              ) {
                                return (
                                  <>
                                    <Button
                                      variant="primary"
                                      onClick={showMintModelButton}
                                      className="BuyNFT-button width-48"
                                    >
                                      Mint NFT
                                    </Button>
                                    &nbsp;
                                    <Button
                                      variant="danger"
                                      onClick={deleteNft}
                                      className="BuyNFT-button width-48"
                                    >
                                      {deleteNftReducer.isSubmit ? (
                                        <BeatLoader
                                          sizeUnit="px"
                                          size={10}
                                          color="#FFF"
                                          loading
                                        />
                                      ) : (
                                        "Delete NFT"
                                      )}
                                    </Button>
                                  </>
                                );
                              } else if (
                                nft?.status === "minted" &&
                                token !== null &&
                                decodedToken?.ac === nft?.accountNumber
                              ) {
                                return (
                                  <>
                                    <Button
                                      variant="danger"
                                      onClick={burnToken}
                                      className="BuyNFT-button"
                                    >
                                      {burn.isSubmit ? (
                                        <BeatLoader
                                          sizeUnit="px"
                                          size={10}
                                          color="#FFF"
                                          loading
                                        />
                                      ) : (
                                        "Burn NFT"
                                      )}
                                    </Button>

                                    <Button
                                      variant="success"
                                      onClick={showSaleModelButton}
                                      className="BuyNFT-button"
                                    >
                                      Sale
                                    </Button>

                                    <Button
                                      variant="info"
                                      onClick={showBidModelButton}
                                      className="BuyNFT-button text-white"
                                    >
                                      {" "}
                                      Bid
                                    </Button>

                                    <Button
                                      variant="primary"
                                      onClick={bidAndBurnToken}
                                      className="BuyNFT-button"
                                    >
                                      {bidAndBurn.isSubmit ? (
                                        <BeatLoader
                                          sizeUnit="px"
                                          size={10}
                                          color="#FFF"
                                          loading
                                        />
                                      ) : (
                                        "Bid and Burn"
                                      )}
                                    </Button>
                                    <Button
                                      variant=""
                                      onClick={showSendModelButton}
                                      className="BuyNFT-button width-100 sendNFT"
                                    >
                                      Send
                                    </Button>
                                  </>
                                );
                              } else if (
                                nft?.status === "sale" &&
                                token !== null &&
                                decodedToken?.ac === nft?.accountNumber
                              ) {
                                return (
                                  <>
                                    <Button
                                      variant="danger"
                                      onClick={cancelSale}
                                      className="BuyNFT-button width-100 cancelNft"
                                    >
                                      {cancel.isSubmit ? (
                                        <BeatLoader
                                          sizeUnit="px"
                                          size={10}
                                          color="#FFF"
                                          loading
                                        />
                                      ) : (
                                        "Cancel Sale"
                                      )}
                                    </Button>
                                  </>
                                );
                              } else if (
                                nft?.status === "send" &&
                                token !== null &&
                                decodedToken?.ac === nft?.accountNumber
                              ) {
                                return (
                                  <>
                                    <Button
                                      variant="danger"
                                      onClick={cancelSendNft}
                                      className="BuyNFT-button width-100 cancelNft"
                                    >
                                      {cancelSend.isSubmit ? (
                                        <BeatLoader
                                          sizeUnit="px"
                                          size={10}
                                          color="#FFF"
                                          loading
                                        />
                                      ) : (
                                        "Cancel Send"
                                      )}
                                    </Button>
                                  </>
                                );
                              } else if (
                                (nft?.status === "bid" ||
                                  nft?.status === "bidandburn") &&
                                token !== null &&
                                decodedToken?.ac === nft?.accountNumber
                              ) {
                                return (
                                  <>
                                    <Button
                                      variant="danger"
                                      onClick={cancelBid}
                                      className="BuyNFT-button width-100"
                                    >
                                      {cancel.isSubmit ? (
                                        <BeatLoader
                                          sizeUnit="px"
                                          size={10}
                                          color="#FFF"
                                          loading
                                        />
                                      ) : (
                                        "Cancel Bid"
                                      )}
                                    </Button>
                                  </>
                                );
                              } else if (nft?.status === "send") {
                                return (
                                  <Button
                                    variant="success"
                                    onClick={receiveNft}
                                    className="BuyNFT-button width-100 cancelNft"
                                  >
                                    {receive.isSubmit ? (
                                      <BeatLoader
                                        sizeUnit="px"
                                        size={10}
                                        color="#FFF"
                                        loading
                                      />
                                    ) : (
                                      "Receive"
                                    )}
                                  </Button>
                                );
                              } else {
                                return (
                                  <>
                                    <Button
                                      variant="success"
                                      onClick={buyNft}
                                      className="BuyNFT-button width-100 cancelNft"
                                    >
                                      {buy.isSubmit ? (
                                        <BeatLoader
                                          sizeUnit="px"
                                          size={10}
                                          color="#FFF"
                                          loading
                                        />
                                      ) : (
                                        "Buy"
                                      )}
                                    </Button>

                                    <Button
                                      variant="success"
                                      onClick={showMoreOfferModalMethod}
                                      className="BuyNFT-button width-100 cancelNft"
                                    >
                                      Place offer
                                    </Button>
                                  </>
                                );
                              }
                            }
                          })()}
                        </div> */}
                        <div className="detailsBtn d-flex">
                          {finalDataOfMintedOffer ? (
                            <Button
                              variant="primary"
                              onClick={handleOfferMint}
                              className="BuyNFT-button width-100 cancelNft"
                            >
                              Mint NFT
                            </Button>
                          ) : nft?.status === "created" && isOwner ? (
                            <>
                              <Button
                                variant="primary"
                                onClick={showMintModelButton}
                                className="BuyNFT-button width-48"
                              >
                                Mint NFT
                              </Button>

                              <Button
                                variant="danger"
                                onClick={deleteNft}
                                className="BuyNFT-button width-48"
                              >
                                <LoaderOrText
                                  loading={deleteNftReducer.isSubmit}
                                  text="Delete NFT"
                                />
                              </Button>
                            </>
                          ) : nft?.status === "minted" && isOwner ? (
                            <>
                              <Button
                                variant="danger"
                                onClick={burnToken}
                                className="BuyNFT-button"
                              >
                                <LoaderOrText
                                  loading={burn.isSubmit}
                                  text="Burn NFT"
                                />
                              </Button>

                              <Button
                                variant="success"
                                onClick={showSaleModelButton}
                                className="BuyNFT-button"
                              >
                                Sale
                              </Button>

                              <Button
                                variant="info"
                                onClick={showBidModelButton}
                                className="BuyNFT-button text-white"
                              >
                                Bid
                              </Button>

                              <Button
                                variant="primary"
                                onClick={bidAndBurnToken}
                                className="BuyNFT-button"
                              >
                                <LoaderOrText
                                  loading={bidAndBurn.isSubmit}
                                  text="Bid and Burn"
                                />
                              </Button>

                              <Button
                                variant=""
                                onClick={showSendModelButton}
                                className="BuyNFT-button width-100 sendNFT"
                              >
                                Send
                              </Button>
                              {/* <Button
                                variant="success"
                                onClick={handleUpdateNFTinLedger}
                                className="BuyNFT-button width-100 cancelNft"
                              >
                                Modify NFT
                              </Button> */}
                            </>
                          ) : nft?.status === "sale" && isOwner ? (
                            <Button
                              variant="danger"
                              onClick={cancelSale}
                              className="BuyNFT-button width-100 cancelNft"
                            >
                              <LoaderOrText
                                loading={cancel.isSubmit}
                                text="Cancel Sale"
                              />
                            </Button>
                          ) : nft?.status === "send" && isOwner ? (
                            <Button
                              variant="danger"
                              onClick={cancelSendNft}
                              className="BuyNFT-button width-100 cancelNft"
                            >
                              <LoaderOrText
                                loading={cancelSend.isSubmit}
                                text="Cancel Send"
                              />
                            </Button>
                          ) : nft?.status === "bid" && isOwner ? (
                            <Button
                              variant="danger"
                              onClick={cancelBid}
                              className="BuyNFT-button width-100"
                            >
                              <LoaderOrText
                                loading={cancel.isSubmit}
                                text="Cancel Bid"
                              />
                            </Button>
                          ) : nft?.status === "bidandburn" && isOwner ? (
                            <Button
                              variant="danger"
                              onClick={cancelBid}
                              className="BuyNFT-button width-100"
                            >
                              <LoaderOrText
                                loading={cancel.isSubmit}
                                text="Cancel Bid"
                              />
                            </Button>
                          ) : nft?.status === "send" ? (
                            <Button
                              variant="success"
                              onClick={receiveNft}
                              className="BuyNFT-button width-100 cancelNft"
                            >
                              <LoaderOrText
                                loading={receive.isSubmit}
                                text="Receive"
                              />
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="success"
                                onClick={buyNft}
                                className="BuyNFT-button width-100 cancelNft"
                              >
                                <LoaderOrText
                                  loading={buy.isSubmit}
                                  text="Buy"
                                />
                              </Button>

                              <Button
                                variant="success"
                                onClick={showMoreOfferModalMethod}
                                className="BuyNFT-button width-100 cancelNft"
                              >
                                Place offer
                              </Button>
                            </>
                          )}
                        </div>
                        {isCollection !== null &&
                          (isCollection ? (
                            <Button
                              variant="danger"
                              onClick={() =>
                                handleDeleteCollection(collectVal._id)
                              }
                              className="BuyNFT-button width-100 cancelNft"
                            >
                              {nftCollection.isSubmit ? (
                                <BeatLoader
                                  sizeUnit="px"
                                  size={10}
                                  color="#FFF"
                                  loading
                                />
                              ) : (
                                "Remove NFT from Profile"
                              )}
                            </Button>
                          ) : (
                            <>
                              <Button
                                variant="success"
                                onClick={handleCollection}
                                className="BuyNFT-button width-100 cancelNft"
                              >
                                {nftCollection.isSubmit ? (
                                  <BeatLoader
                                    sizeUnit="px"
                                    size={10}
                                    color="#FFF"
                                    loading
                                  />
                                ) : (
                                  "ADD NFT to Profile"
                                )}
                              </Button>
                            </>
                          ))}
                        {/* isMobile && */}
                        {/* {
                          !!token && isMobile && (
                            //  nft?.usdzUrl && isIOS ? (
                            //   <a
                            //     rel="ar"
                            //     href={`${nft.usdzUrl}?filename=model.usdz`}
                            //     className="BuyNFT-button width-100 cancelNft"
                            //   >
                            //     {loadingAR ? "Preparing AR..." : "View NFT in AR"}
                            //   </a>
                            // ) : (
                            <Button
                              variant="success"
                              onClick={() => arRef.current?.activateAR()}
                              className="BuyNFT-button width-100 cancelNft"
                              disabled={!isActive || loadingAR}
                            >
                              {loadingAR ? "Preparing AR..." : "View NFT in AR"}
                            </Button>
                          )
                          // )
                        } */}
                      </div>
                    </Col>
                  </Row>
                </>
              )}
              <ShowQRModal
                onCancel={() => {
                  setShowMoreOfferModal(false);
                }}
              />

              {/* mint modal start*/}
              <Modal
                show={showMintModel}
                onHide={handleCloseMintModel}
                className="nftDetailModal"
                backdrop="static"
                keyboard={false}
              >
                <Modal.Header
                  closeButton={!isDisabled}
                  className="justify-content-center"
                >
                  <Modal.Title className="w-100 text-center">
                    {nft?.name}
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <Row>
                    <Col xs={12} md={12}>
                      <div className="img-center">
                        <Filetypecomman
                          fileType={nft?.contentType}
                          image={
                            nft?.image ? replaceHost(nft?.image) : nft?.image
                          }
                          height={326}
                        />
                      </div>
                    </Col>
                  </Row>
                  <br />
                  <Row className="modalRow">
                    <Col>
                      <Form.Check
                        type="switch"
                        label="Transferable"
                        checked={
                          finalDataOfMintedOffer
                            ? getFlagValue(finalDataOfMintedOffer.flag).tranFlag
                            : tranFlag
                        }
                        onChange={(e) => {
                          setTransFlag(e.target.checked);
                        }}
                        disabled={finalDataOfMintedOffer ? true : false}
                      />
                    </Col>
                    <Col>
                      <Form.Check
                        type="switch"
                        label="Burnable"
                        checked={
                          finalDataOfMintedOffer
                            ? getFlagValue(finalDataOfMintedOffer.flag).burnFlag
                            : burnFlag
                        }
                        onChange={(e) => {
                          setBurnFlag(e.target.checked);
                        }}
                        disabled={finalDataOfMintedOffer ? true : false}
                      />
                    </Col>
                    <Col>
                      <Form.Check
                        type="switch"
                        label="OnlyXRP"
                        checked={
                          finalDataOfMintedOffer
                            ? getFlagValue(finalDataOfMintedOffer.flag)
                                .onlyXrpFlag
                            : onlyXrpFlag
                        }
                        onChange={(e) => {
                          setOnlyXrpFlag(e.target.checked);
                        }}
                        disabled={finalDataOfMintedOffer ? true : false}
                      />
                    </Col>
                    <Col style={{ paddingTop: 12 }}>
                      <Form.Check
                        type="switch"
                        label="DNFT-Mutable"
                        checked={
                          finalDataOfMintedOffer
                            ? getFlagValue(finalDataOfMintedOffer.flag)
                                .DNFTMutableFlag
                            : DNFTMutableFlag
                        }
                        onChange={(e) => {
                          setDNFTMutableFlag(e.target.checked);
                        }}
                        disabled={finalDataOfMintedOffer ? true : false}
                      />
                    </Col>
                  </Row>
                  {finalDataOfMintedOffer && (
                    <>
                      <br />
                      <Row>
                        <Col xs={6} md={6}>
                          <label className="label-uppercase">Currency</label>
                          <input
                            type="text"
                            className="form-control"
                            value={finalDataOfMintedOffer.currency}
                            disabled="true"
                          />
                        </Col>
                        <Col xs={6} md={6}>
                          <label className="label-uppercase">Amount</label>
                          <input
                            type="text"
                            className="form-control"
                            value={finalDataOfMintedOffer.amount}
                            disabled="true"
                          />
                        </Col>
                      </Row>
                    </>
                  )}
                  <br />
                  <Row>
                    <Col xs={12} md={12}>
                      <label className="label-uppercase">
                        {finalDataOfMintedOffer
                          ? "ROYALTY 0-50%"
                          : "ADD ROYALTY 0-50%"}
                      </label>
                      <RangeSlider
                        value={
                          finalDataOfMintedOffer
                            ? finalDataOfMintedOffer.transferFee / 1000
                            : royaltyPerc
                        }
                        onChange={handleRoyaltyPerc}
                        min={0}
                        max={50}
                        tooltipLabel={(currentValue) => `${currentValue}%`}
                        tooltip="on"
                        className=""
                        disabled={finalDataOfMintedOffer ? true : false}
                      />
                    </Col>
                  </Row>
                  <br />
                  <Row>
                    <Col xs={12} md={12} className="margin-top1">
                      {events && events.step > 0 && (
                        <div className="status-text mt-3">
                          <ProgressBar
                            animated
                            now={events.step}
                            label={`${events.step}% completed`}
                          />
                        </div>
                      )}
                      <Button
                        variant="primary"
                        onClick={
                          finalDataOfMintedOffer ? offerMintoken : mintToken
                        }
                        type="submit"
                        className="form-control margin-top1"
                        disabled={isDisabled}
                      >
                        {mint.isSubmit || offerNft.isSubmit ? (
                          <BeatLoader
                            sizeUnit="px"
                            size={10}
                            color="#FFF"
                            loading
                          />
                        ) : (
                          "Mint NFT"
                        )}
                      </Button>
                    </Col>
                  </Row>
                </Modal.Body>
                <br />
              </Modal>
              {/* mint modal end */}

              {/* Sale Modal start*/}
              <Modal
                show={showSaleModel}
                onHide={handleCloseSaleModel}
                className="nftDetailModal"
              >
                <br />
                <Modal.Body>
                  <Row>
                    <Col xs={12} md={12}>
                      <div className="img-center">
                        <Filetypecomman
                          fileType={nft?.contentType}
                          image={
                            nft?.image ? replaceHost(nft?.image) : nft?.image
                          }
                          height={326}
                        />
                      </div>
                    </Col>
                  </Row>
                  <br />
                  <Row>
                    <Col xs={6} md={6}>
                      <input
                        type="number"
                        name="saleAmount"
                        value={saleAmountModel}
                        onChange={handleSaleAmount}
                        className="form-control"
                        placeholder="Enter Amount"
                      ></input>
                    </Col>
                    <Col xs={6} md={6}>
                      <Form.Select
                        value={currency}
                        onChange={handleCurrency}
                        name="Currency"
                        aria-label="Default select example"
                        id="currency-dropdown"
                        disabled={isOnlyXrpNft}
                      >
                        <option value="">
                          Currency
                        </option>
                        {saleCurrencyOptions.map((curr) => (
                          <option key={curr.value} value={curr.value}>
                            {curr.label}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                  </Row>
                  <br />
                  <Row>
                    <Col xs={12} md={12}>
                      <Button
                        variant="primary"
                        onClick={saleToken}
                        type="submit"
                        className="form-control"
                      >
                        {sale.isSubmit ? (
                          <BeatLoader
                            sizeUnit="px"
                            size={10}
                            color="#FFF"
                            loading
                          />
                        ) : (
                          "Sale NFT"
                        )}
                      </Button>
                    </Col>
                  </Row>
                </Modal.Body>
                <br />
              </Modal>
              {/* </> */}

              {/* <> */}
              <Modal
                show={showBidModel}
                onHide={handleCloseBidModel}
                className="nftDetailModal"
              >
                <br />
                <Modal.Body>
                  <Row>
                    <Col xs={12} md={12}>
                      <div className="img-center">
                        <Filetypecomman
                          fileType={nft?.contentType}
                          image={
                            nft?.image ? replaceHost(nft?.image) : nft?.image
                          }
                        />
                      </div>
                    </Col>
                  </Row>
                  <br />
                  <Row>
                    <Col xs={12} md={12}>
                      <input
                        type="number"
                        name="bidAmount"
                        value={bidAmountModel}
                        onChange={handleBidAmount}
                        className="form-control"
                        placeholder="Enter Amount"
                      ></input>
                    </Col>
                  </Row>
                  <br />
                  <Row>
                    <Col xs={12} md={12}>
                      <input
                        type="datetime-local"
                        name="bidDate"
                        min={new Date()}
                        max={
                          new Date(new Date().setDate(new Date().getDate() + 2))
                        }
                        value={bidDateModel}
                        onChange={handleBidDate}
                        className="form-control"
                        placeholder="Date And Time"
                      ></input>
                    </Col>
                  </Row>
                  <br />
                  <Row>
                    <Col xs={12} md={12}>
                      <Button
                        variant="primary"
                        onClick={bidToken}
                        type="submit"
                        className="form-control"
                      >
                        {bid.isSubmit ? (
                          <BeatLoader
                            sizeUnit="px"
                            size={10}
                            color="#FFF"
                            loading
                          />
                        ) : (
                          "Bid"
                        )}
                      </Button>
                    </Col>
                  </Row>
                </Modal.Body>
                <br />
              </Modal>
              {/* </> */}

              {/* Send Modal Start  */}
              <Modal
                show={showSendModel}
                onHide={handleCloseSendModel}
                className="nftDetailModal"
              >
                <Modal.Body>
                  <Row>
                    <Col xs={12} md={12}>
                      <div className="img-center">
                        <Filetypecomman
                          fileType={nft?.contentType}
                          image={
                            nft?.image ? replaceHost(nft?.image) : nft?.image
                          }
                          height={326}
                        />
                      </div>
                    </Col>
                  </Row>
                  <br />

                  <Col xs={12} md={12}>
                    <input
                      type="text"
                      name="dAddress"
                      value={desAddress}
                      onChange={handleSendAdd}
                      className="form-control"
                      placeholder="Destination Wallet Address"
                    ></input>
                  </Col>

                  <br />
                  <Row>
                    <Col xs={12} md={12}>
                      <Button
                        variant="primary"
                        onClick={sendNft}
                        type="button"
                        className="form-control"
                        disabled={send?.isSubmit}
                      >
                        {send.isSubmit ? (
                          <BeatLoader
                            sizeUnit="px"
                            size={10}
                            color="#FFF"
                            loading
                          />
                        ) : (
                          "Send"
                        )}
                      </Button>
                    </Col>
                  </Row>
                </Modal.Body>
                <br />
              </Modal>

              {/* Terms and conditions modal  */}
              <Modal
                show={discModal}
                onHide={handleCloseDisc}
                backdrop="static"
                className="privacyModal"
              >
                <Modal.Header closeButton className="px-md-5 px-lg-5 px-xl-5">
                  <Modal.Title>
                    <strong className="text-info">NFT DISCLAIMER</strong>
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body className="px-md-5 px-lg-5 px-xl-5 discBody">
                  <ul>
                    <li>
                      <p>
                        By creating/minting an NFT on the RaDical-X application
                        or smart device applications, you (the user) take full
                        custody of the initial creation and are responsible for
                        its design, illustration, 3D video or audio or anything
                        similar displayed. By agreeing to this disclaimer you
                        remove all liabilities of the design from the RaDical-X
                        application and connections to its creators, founders
                        and partners.
                      </p>
                    </li>
                    <li>
                      <p>
                        The Design you create/mint must be your own personal
                        design, illustration, 3D video or audio. If you are
                        using content from another creator, company logo,
                        commercial brand or anything similar created by someone
                        else you must ask permission to use their content and
                        receive written consent before creating your NFT.
                      </p>
                    </li>
                    <li>
                      <p>
                        Purchasing an NFT off the secondary market, or otherwise
                        acquiring the NFT through any other legitimate means or
                        method, the Holder receives full and complete ownership,
                        inclusive of commercial rights, to the NFT and the
                        corresponding unique artwork.
                      </p>
                    </li>
                    <li>
                      <p>
                        The License the Holder is receiving is solely for the
                        Licensed NFT which includes the right to use the NFT,
                        and the right to reproduce the NFT on tribute or
                        derivative art, merchandise, or sharing these rights
                        with third party projects.
                      </p>
                    </li>
                    <li>
                      <p>
                        The Creator agrees not to use, utilize, portray,
                        advertise, distribute or otherwise market any NFT in any
                        project or derivative work that involves hate speech,
                        racism, pornography, or any other illegal or unlawful
                        content. Upon sale or transfer of the NFT, any ownership
                        or commercial rights are immediately transferred to the
                        new Holder.
                      </p>
                    </li>
                    <li>
                      <p>
                        No refunds shall be issued to any Holder upon a full and
                        complete lawful purchase of any NFT. In the event that
                        any Holder purchases an NFT through the secondary
                        market, the holder shall be held accountable and will be
                        bound by the Terms of Service which govern said
                        secondary market platform.
                      </p>
                    </li>
                    <li>
                      <p>
                        NFT’s may bear elements of transformative fan art or
                        caricatures which are rendered in good faith to add
                        humour and satire to the project. Any Holder of an NFT
                        bearing these elements has an individual responsibility
                        to determine the appropriateness of subsequent usage.
                        Any Attributes associated to an NFT is used as a parody.
                        These attributes are not sponsored, endorsed by or
                        affiliated by any affiliated companies and/or third
                        party licensors.
                      </p>
                    </li>
                    <li>
                      <p>
                        Participants in creating/minting NFTs agree to hold the
                        project Creative Team harmless for any losses incurred
                        as a consequence of creating/minting an NFT. These
                        potential losses include any fees for failed
                        transactions, any excessive fees charged due to
                        website/application or smart contract issues, and any
                        loss of any NFT’s due to website/application or smart
                        contract malfunctions.
                      </p>
                    </li>
                    <li>
                      <p>
                        {" "}
                        NFTs are created purely as collectibles, not as
                        investment vehicles or substitutes for cryptocurrency.
                        We make absolutely no promise or guarantee that these
                        NFTs will subsequently retain monetary value in fiat,
                        cash or cryptocurrency.
                      </p>
                    </li>
                    <li>
                      <p>
                        Each Holder is solely and entirely responsible for any
                        and all Federal or State tax liabilities which may
                        arise, be imposed, or enforced as a result of minting or
                        reselling NFTs on the Fuzion-XIO website/application.
                      </p>
                    </li>
                    <li>
                      <p>
                        {" "}
                        You agree to waive any class action status, and any
                        legal dispute around the Fuzion-XIO Application which
                        you may choose to bring, can only be done on an
                        individual basis.
                      </p>
                    </li>
                  </ul>
                </Modal.Body>
              </Modal>

              {/* More Offer Modal Start  */}
              <Modal
                show={showMoreOfferModal}
                onHide={handleCloseMoreOfferModal}
                className="nftDetailModal"
              >
                <Modal.Body>
                  <Row>
                    <Col xs={12} md={12}>
                      <div className="img-center">
                        <h5>Create Buy Offer</h5>
                        <Filetypecomman
                          fileType={nft?.contentType}
                          image={
                            nft?.image ? replaceHost(nft?.image) : nft?.image
                          }
                        />
                      </div>
                    </Col>
                  </Row>
                  <br />

                  <Row>
                    <Col xs={6} md={6}>
                      <input
                        type="number"
                        name="saleAmount"
                        value={moreOfferAmount}
                        onChange={handleMoreOfferAmount}
                        className="form-control"
                        placeholder="Enter Amount"
                      ></input>
                    </Col>
                    <Col xs={6} md={6}>
                      <Form.Select
                        value={currency}
                        onChange={handleCurrency}
                        name="Currency"
                        aria-label="Default select example"
                        id="currency-dropdown"
                      >
                        <option value="">
                          Currency
                        </option>
                        {saleCurrencyOptions.map((curr) => (
                          <option key={curr.value} value={curr.value}>
                            {curr.label}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                  </Row>

                  <br />
                  <Row>
                    <Col xs={12} md={12}>
                      <Button
                        variant="primary"
                        onClick={placeOffer}
                        type="submit"
                        className="form-control"
                      >
                        {placeMoreoffer.isSubmit ? (
                          <BeatLoader
                            sizeUnit="px"
                            size={10}
                            color="#FFF"
                            loading
                          />
                        ) : (
                          "Place Offer"
                        )}
                      </Button>
                    </Col>
                  </Row>
                </Modal.Body>
                <br />
              </Modal>
            </Container>
          </>
        </div>
      )}
      <Footer />
    </React.Fragment>
  );
}

export default Nftdetail;
