import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Container, Row, Col, Button, Modal, Form } from "react-bootstrap";
import { CopyToClipboard } from "react-copy-to-clipboard";
import "react-bootstrap-range-slider/dist/react-bootstrap-range-slider.css";
import { useJwt } from "react-jwt";
// import HashLoader from "react-spinners/HashLoader";
import { BeatLoader } from "react-spinners";
import Header from "../common/header";
import Footer from "../common/footer";
import detailNFT from "../../assets/NFT_detailBg.png";
import verifyImg from "../../assets/verifyImg.png";
import share from "../../assets/share.svg";
import bithomp from "../../assets/bitomp.svg";
import configData from "../../config.json";
import Userimage from "../../assets/defaultUser.jpg";
import Filetypecomman from "../common/Filetypecomman";
import MessageConst from "../../const/message.json";
import { useDispatch, useSelector } from "react-redux";
import Accordion from "react-bootstrap/Accordion";
import {
  NftsByAdressDetail,
  burnNftInt,
  saleNftInt,
  cancelSaleNftInt,
  buyNftInt,
  sendNftInt
} from "../../store/actions/nftsbyaddress";
import {
  getCollections,
  addCollection,
  deleteCollection,
  nftDetailAction
} from "../../store/actions/nftdetail";
import { checkImageExists, extractCIDFromURL, replaceHost } from "../../helper";
import * as Spinners from "react-loader-spinner";

const url = window.location.href;

function InteroperabilityDetail() {
  const [searchKey, setSearchKey] = useState(true);
  const [nft, setNFT] = useState(null);
  const [chkValue, setChkValue] = useState(true);
  const [loading, setLoading] = useState(false);
  const [attributes, setAttributes] = useState(null);
  const [showSaleModel, setShowSaleModel] = useState(false);
  const [saleAmountModel, setSaleAmountModel] = useState(null);
  const [currency, setCurrency] = useState("");
  const [tokenTicker, setTokenTicker] = useState(null);
  const [saleEnable, setSaleEnable] = useState(false);
  const [burnNftData, setBurnNftData] = useState(false);
  const [cancelSaleData, setCancelSaleData] = useState(false);
  const [showSendModel, setShowSendModel] = useState(false);
  const [desAddress, setDesAddress] = useState(null);
  const [collections, setCollections] = useState(null);
  const [isCollection, setIsCollection] = useState(null);
  const [collectVal, setCollectVal] = useState(null);

  const token = localStorage.getItem("jwtToken");

  const { decodedToken } = useJwt(token);
  const [discModal, setDiscModal] = useState(false);
  const openDiscModal = () => {
    setDiscModal(true);
  };

  const handleCloseDisc = () => setDiscModal(false);
  const override = {
    position: "absolute",
    left: "50%",
    top: "50%"
  };
  const navigate = useNavigate();
  const getParams = useParams();
  const { state } = useLocation();
  const dispatch = useDispatch();

  /* All reducer call */
  const [
    allNftDetails,
    burn,
    sale,
    cancelSale,
    buy,
    balance,
    send,
    nftCollection,
    nftdtl
  ] = useSelector((state) => [
    state.allNftsDetailByAddrReducer.allNftDetails,
    state.burnNftIntReducer,
    state.saleNftIntReducer,
    state.cancelSaleNftIntReducer,
    state.buyNftIntReducer,
    state.getBalanceReducer,
    state.sendNftIntReducer,
    state.collectionReducer,
    state.nftDetailReducer
  ]);

  const getImageURL = async (url) => {
    const CID = extractCIDFromURL(url);
    return (await checkImageExists(CID)) ? replaceHost(url) : url;
  };

  useEffect(() => {
    dispatch(
      getCollections({ page: null, walletAddress: getParams.id, type: 1 })
    );
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    try {
      let itemID = getParams.id;
      dispatch(nftDetailAction({ itemID, loader: true }));
    } catch (error) {
      console.log(error, "error in param");
      // toast.error(error.response.data.message, {
      //   toastId: "Nftdetail1111" + Date.now(),
      // });
    }
  }, [getParams]);

  useMemo(() => {
    (async () => {
      if (nftdtl.nftDetailsNFT !== "" && nftdtl.error === false) {
        const { data, totalNft, minData } = nftdtl.nftDetailsNFT;
        data.url = await getImageURL(data.image);
        data.owner = data.accountNumber;

        setNFT({ ...data, totalNft, ...minData });
        setAttributes(null);
        if (data?.metaDataUrl !== undefined) {
          try {
            const metaUrl = await getImageURL(data.metaDataUrl);
            const res = await fetch(metaUrl);
            const PropVal = await res.json();
            const propData =
              typeof PropVal.attributes === "string"
                ? JSON.parse(PropVal.attributes)
                : PropVal.attributes;
            // console.log(propData, "propData111")

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

            //  console.log(...arr, "check the arr")
            setAttributes([...propData, ...arr]);
          } catch (error) {
            return error;
          }
        }
      }
    })();
  }, [nftdtl]); // eslint-disable-line

  // get all nft by wallet address
  useEffect(() => {
    try {
      setNFT(null);
      setAttributes(null);
      setLoading(true);
      getNftDetailsByID();
    } catch (error) {
      toast.error(error.response.data.message, {
        toastId: "restNft" + Date.now()
      });
    }
  }, []); // eslint-disable-line

  // set metadata attributes
  useEffect(() => {
    if (typeof nft?.attributes === "string") {
      setAttributes(JSON.parse(nft?.attributes));
    } else {
      setAttributes(nft?.attributes);
    }
  }, [nft?.attributes]); // eslint-disable-line

  const getNftDetailsByID = (markerID) => {
    dispatch(
      markerID ? NftsByAdressDetail(markerID) : NftsByAdressDetail()
    ).then(async (resp) => {
      if (resp.success) {
        const { userNFTs, mkrId } = resp; // eslint-disable-line
        const data = await userNFTs.find((val) => {
          return val.NFTokenID === getParams?.id;
        });
        if (data) {
          return getNftInfo(data);
        }
        return getNftDetailsByID(mkrId);
      }
    });
  };

  const getNftInfo = async (data) => {
    if (data?.url === null) {
      data.url = `${configData.BGIMAGE_URL}bgimg.jpg`;
    }
    const res = data?.url
      ? await fetch(data?.url, { method: "HEAD" }, { mode: "no-cors" }).then(
          (req) =>
            req.headers.get("content-type") && {
              fileType:
                req.headers.get("content-type") === "model/gltf-binary"
                  ? "glb"
                  : req.headers.get("content-type").split("/")[1],
              contentType:
                req.headers.get("content-type") === "model/gltf-binary"
                  ? "glb"
                  : req.headers.get("content-type").split("/")[0]
            }
        )
      : { contentType: "image", fileType: "jpg" };
    setLoading(false);
    setNFT({ ...data, ...res });
    return;
  };

  // const twiceApiCall = (marker) => {
  //   dispatch(NftsByAdressDetail(marker)).then(async (resp) => {
  //     const { userNFTs, mkrId } = resp;
  //     const final = userNFTs.find((val) => val.NFTokenID === getParams?.id)
  //     if (final !== undefined) {
  //         getNftInfo(final)
  //         return;
  //     }else{
  //       twiceApiCall(mkrId)
  //     }
  //  });
  // };

  // get all nft by address and set filetype and contenttype
  // useEffect(() => {
  //   (async () => {
  //     if (!!allNftDetails) {
  //       setLoading(true)
  //       const { userNFTs } = allNftDetails;  // eslint-disable-line
  //       const data = await userNFTs.find((val) => {
  //         return val.NFTokenID === getParams?.id;
  //       });
  //       console.log(data, "check the data11111")
  //       getNftInfo(data)
  //       // if (data) {
  //       //     console.log("it is inside data")
  //       //     return getNftInfo(data)
  //       // }else{
  //       //   console.log("it is outside data")
  //       //   return twiceApiCall(mkrId);
  //       // }

  //     }
  //   })();
  // }, [allNftDetails]); // eslint-disable-line

  // handle check box
  const handleCheckBox = (check) => {
    if (check) {
      setChkValue(true);
    } else {
      setChkValue(false);
    }
  };

  // burn nft method
  const burnToken = async () => {
    setBurnNftData(true);
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
        NFTokenID: nft.NFTokenID
      };
      dispatch(burnNftInt({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "burnToken1" + Date.now()
      });
    }
  };

  // burn nft useeffect
  useEffect(() => {
    if (burnNftData) {
      if (burn.error === false) {
        toast.success(burn.burn.message, {
          toastId: "burnint311" + Date.now(),
          onClose: () => {
            setBurnNftData(false);
            navigate("/MyNFT");
          }
        });
      } else if (burn.error !== null) {
        toast.error(burn.error.message, {
          toastId: "burnint311" + Date.now()
        });
      }
    }
  }, [burn.error, burnNftData]); // eslint-disable-line

  // sale modal trigger method
  const showSaleModelButton = () => {
    // check checkbox is true or not
    if (chkValue !== true) {
      toast.warn(MessageConst.warningTermsandConditions, {
        toastId: "saleCheckBoxValueModel" + Date.now()
      });
      return;
    }
    setShowSaleModel(true);
  };

  // close modal handle method
  const handleCloseSaleModel = () => setShowSaleModel(false);

  // sale nft method for api
  const saleToken = async () => {
    let decimalregex = /^\d{0,12}(\.\d{0,6})?$/;
    let decimalregex1 = /^\d{0,15}(\.\d{0,15})?$/;

    // check user
    if (decodedToken.ac !== nft.owner) {
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
    if (currency === "XRP" && !decimalregex.test(saleAmountModel)) {
      return toast.warn(MessageConst.XRP_WRONG_DECIMAL, {
        toastId: "wrongdecimal" + Date.now()
      });
    }
    if (currency !== "XRP" && !decimalregex1.test(saleAmountModel)) {
      return toast.warn(MessageConst.ISSUED_WRONG_DECIMAL, {
        toastId: "wrongdecimal1" + Date.now()
      });
    }
    const Issuer = tokenTicker.find((i) => {
      return i.curr === currency;
    });

    // call api
    try {
      const data = {
        NFTokenID: nft.NFTokenID,
        amount: saleAmountModel,
        currency: currency,
        issuerAdd: currency === "XRP" ? "" : Issuer.issuer
      };
      dispatch(saleNftInt({ data, loader: true }));
      setSaleEnable(true);
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "saleToken1" + Date.now()
      });
    }
  };

  const handleSaleAmount = (e) => {
    setSaleAmountModel(e.target.value);
  };

  const handleCurrency = (e) => {
    setCurrency(e.target.value);
  };

  // get all currency useeffect
  useEffect(() => {
    if (balance?.currency !== null) {
      if (balance?.currency?.currency) {
        setTokenTicker(balance?.currency?.currency);
      } else {
        setTokenTicker([]);
      }
    }
  }, [balance]); // eslint-disable-line

  // salenft useeffect
  useEffect(() => {
    if (saleEnable) {
      if (sale?.sale) {
        setShowSaleModel(false);
        toast.success(sale.sale.message, {
          toastId: "salemsg1" + Date.now(),
          onClose: () => {
            setSaleEnable(false);
            dispatch(getNftDetailsByID());
            setChkValue(false);
          }
        });
      } else if (sale.error !== null) {
        setShowSaleModel(false);
        toast.error(sale.error.message, {
          toastId: "salemsg2" + Date.now(),
          onClose: () => {
            setSaleEnable(false);
            dispatch(getNftDetailsByID());
            setChkValue(false);
          }
        });
      }
    }
  }, [saleEnable, sale]); // eslint-disable-line

  const showBidModelButton = async () => {
    toast.info(MessageConst.messageForBidAndBurnFeature, {
      toastId: "cbidAndBurnTokenCheckBoxValue1111" + Date.now()
    });
  };

  const bidAndBurnToken = async () => {
    toast.info(MessageConst.messageForBidAndBurnFeature, {
      toastId: "cbidAndBurnTokenCheckBoxValue22222" + Date.now()
    });
  };

  /* Handle cancelSale NFT */
  const cancelSaleInt = async () => {
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
        tokenOffers: nft.nft_offer_index
      };
      dispatch(cancelSaleNftInt({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "cancelsaleTokenInt" + Date.now()
      });
    }
  };

  // cancelsale useeffect
  useEffect(() => {
    if (cancelSaleData) {
      if (cancelSale.cancelSale) {
        toast.success(cancelSale.cancelSale.message, {
          toastId: "cancelInt" + Date.now(),
          onClose: () => {
            dispatch(NftsByAdressDetail());
            setChkValue(false);
            setCancelSaleData(false);
          }
        });
      } else if (cancelSale.error !== null) {
        toast.error(cancelSale.error.message, {
          toastId: "cancelInt" + Date.now(),
          onClose: () => {
            dispatch(NftsByAdressDetail());
            setChkValue(false);
            setCancelSaleData(false);
          }
        });
      }
    }
  }, [cancelSaleData, cancelSale]); // eslint-disable-line

  const cancelBid = async () => {
    alert("cancel Bid");
  };

  // buynft method
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
      }, 1000);
      return;
    }
    if (nft.status === "sale") {
      try {
        let data = {
          nftOfferIndex: nft.nft_offer_index
        };
        dispatch(buyNftInt({ data, loader: true }));
      } catch (error) {
        toast.error(MessageConst.somethingWrongError, {
          toastId: "buynft1" + Date.now()
        });
      }
    } else if (nft.status === "bid" || nft.status === "bidandburn") {
      navigate(`/BidDetail/${nft.NFTokenID}`);
    } else {
      toast.error(MessageConst.WarningNotOnSale, {
        toastId: "buynft12" + Date.now()
      });
    }
  };

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
    // check user
    if (decodedToken.ac !== nft.owner) {
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
        nftDetail: nft,
        destAdd: desAddress
      };
      dispatch(sendNftInt({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "sendToken1" + Date.now()
      });
    }
  };

  useEffect(() => {
    if (send.error === false) {
      toast.success(send.send.message, {
        toastId: "salemsg1" + Date.now(),
        onClose: () => {
          navigate("/MyNFT");
        }
      });
    } else if (send.error !== null) {
      toast.error(send.error.message, {
        toastId: "salemsg2" + Date.now()
      });
    }
  }, [send.error]); // eslint-disable-line

  useEffect(() => {
    if (!!collections) {
      const data = collections.docs.find(
        (vl) =>
          vl.NFTokenID === getParams?.id &&
          vl.accountNumber === decodedToken?.ac
      );

      // if (collections.docs.length === 0) {
      //   setIsCollection(null);
      //   setCollectVal(null)
      // } else {

      if (!state) {
        // console.log(state, "check the state22", data)
        if (data !== undefined) {
          // console.log(state, "check the state", data)
          setIsCollection(true);
          setCollectVal(data);
          setLoading(false);
        } else {
          // console.log(state, "check the state1", data)
          setIsCollection(false);
          setCollectVal(data);
          setLoading(false);
        }
      } else {
        // console.log(state, "check the state", data)
        if (state.isValid == false) {
          setIsCollection(null);
          setCollectVal(null);
          setLoading(false);
        } else if (data !== undefined) {
          setIsCollection(true);
          setCollectVal(data);
          setLoading(false);
        } else {
          setIsCollection(false);
          setCollectVal(data);
          setLoading(false);
        }
      }
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

  const handleCollection = () => {
    const Id = getParams.id;
    dispatch(
      addCollection({
        nftDetail: nft,
        Id,
        wAddress: decodedToken?.ac,
        loader: true
      })
    );
  };

  const handleDeleteCollection = (id) => {
    dispatch(
      deleteCollection({
        walletAddress: decodedToken?.ac,
        wAddress: decodedToken?.ac,
        id,
        Id: nft?._id || id,
        loader: true
      })
    );
  };

  return (
    <React.Fragment>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg pt-4 DetailBG">
          {loading ? (
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
              <Container className="container">
                <Row className="auth-wrapper App align-items-center  ">
                  <Col xs={12} md={12} className="padding-top-bottom-25">
                    <h3 className="nft-details">NFT Detail</h3>
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
                              <img src={verifyImg} alt="" />
                              <span>Verify</span>
                            </p>
                          </a>
                        ) : (
                          ""
                        )}
                        <div className="likeCount">
                          <div className="countLike">
                            <p className="d-flex align-items-center justify-content-between">
                              {
                                // eslint-disable-next-line
                                <a className="like-button liked">
                                  <span className="like-icon">
                                    <div className="heart-animation-1"></div>
                                    <div className="heart-animation-2"></div>
                                  </span>
                                </a>
                              }
                              <span className="fa-fa-font-white-text">0</span>
                            </p>
                          </div>
                        </div>
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
                            <a className="share">
                              <p className="d-flex align-items-center w-100 mb-0 h-100 justify-content-center">
                                <img src={share} alt="" />
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
                      <h2 className="nft_name mt-4">{nft?.name}</h2>
                      <p className="nft_description">
                        {" "}
                        {nft?.description ? nft.description : ""}
                      </p>
                      <Accordion defaultActiveKey={["0", "1"]} alwaysOpen>
                        <Accordion.Item eventKey="0">
                          <Accordion.Header>ABOUT</Accordion.Header>
                          <Accordion.Body>
                            <div className="aboutDetail d-flex justify-content-between align-items-center">
                              <div className="owned">
                                <h4>Owned by</h4>
                                <p>{nft?.owner?.substring(0, 9)}...</p>
                                <img
                                  src={Userimage}
                                  alt=""
                                  className="rounded-circle width-25"
                                />
                              </div>
                              <div className="mintBy">
                                <h4>Minted by</h4>
                                <p>{nft?.Issuer?.substring(0, 9)}....</p>
                                <img
                                  src={Userimage}
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
                                  <p>{nft?.Issuer?.substring(0, 15)}</p>
                                </Col>
                              </Row>
                              <Row>
                                <Col className="text-left">
                                  <span>Token Currency</span>
                                </Col>
                                <Col className="text-right">
                                  <p>
                                    {nft?.amount} {nft?.currency}
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
                                    {" "}
                                    {nft?.NFTokenID ? (
                                      <a
                                        target="_blank"
                                        rel="noreferrer"
                                        href={`https://bithomp.com/explorer/${nft?.NFTokenID}`}
                                      >
                                        Nft ID <img src={bithomp} alt="" />
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
                                      : "-NA-"}
                                  </p>
                                </Col>
                              </Row>
                              <Row>
                                <Col className="text-left">
                                  <span>Flag</span>
                                </Col>
                                <Col className="text-right">
                                  <p>
                                    {nft?.Flags
                                      ? `${
                                          nft?.Flags === 11
                                            ? "Transferable , Burnable , OnlyXRP"
                                            : nft?.Flags === 10
                                            ? "Transferable , OnlyXRP"
                                            : nft?.Flags === 9
                                            ? "Transferable , Burnable"
                                            : "Transferable"
                                        }`
                                      : "-NA-"}
                                  </p>
                                </Col>
                              </Row>
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
                        <Filetypecomman
                          fileType={nft?.contentType}
                          image={
                            nft?.contentType === "glb"
                              ? replaceHost(nft?.url)
                              : nft?.url
                          }
                        />
                      </div>
                    </div>
                    <div className="nft_Price_Type">
                      <h4> {nft?.currency ? `${nft.currency}` : "XRP"}</h4>
                      <h4> {nft?.amount}</h4>
                    </div>
                    <div className="nft_property">
                      <h3>Property</h3>
                      {attributes ? (
                        attributes.map((val, i) => {
                          return (
                            <div
                              className="property_detail d-flex justify-content-between align-items-center mb-2"
                              key={i}
                            >
                              <p>
                                {val?.traitType !== undefined
                                  ? val?.traitType
                                  : val?.trait_type}
                              </p>
                              <p>
                                {" "}
                                {val?.traitValue !== undefined
                                  ? val?.traitValue
                                  : val?.value}
                              </p>
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
                          onChange={(e) => handleCheckBox(e.target.checked)}
                          className="checkbox-privacy-policy"
                          checked={chkValue}
                        ></input>
                        <span>
                          {" "}
                          I have read and agree to the terms of{" "}
                          <b
                            onClick={openDiscModal}
                            style={{ color: "#000", cursor: "pointer" }}
                          >
                            FUZION-XIO
                          </b>
                          .
                        </span>
                      </div>
                      <div className="detailsBtn d-flex">
                        {(() => {
                          if (
                            nft?.status === "minted" &&
                            token !== null &&
                            decodedToken?.ac === nft?.owner
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
                                &nbsp;
                                <Button
                                  variant="success"
                                  onClick={showSaleModelButton}
                                  className="BuyNFT-button"
                                >
                                  {" "}
                                  Sale
                                </Button>
                                &nbsp;
                                <Button
                                  variant="info"
                                  onClick={showBidModelButton}
                                  className="BuyNFT-button"
                                >
                                  {" "}
                                  Bid
                                </Button>
                                &nbsp;
                                <Button
                                  variant="primary"
                                  onClick={bidAndBurnToken}
                                  className="BuyNFT-button "
                                >
                                  Bid and Burn
                                  {/* {bidAndBurn.isSubmit ? (
                                    <BeatLoader
                                      sizeUnit="px"
                                      size={10}
                                      color="#FFF"
                                      loading
                                    />
                                  ) : (
                                    "Bid and Burn"
                                  )} */}
                                </Button>
                                <Button
                                  variant="success"
                                  onClick={showSendModelButton}
                                  className="BuyNFT-button width-22 sendNFT"
                                >
                                  Send
                                </Button>
                              </>
                            );
                          } else if (
                            nft?.status === "sale" &&
                            token !== null &&
                            decodedToken?.ac === nft?.owner
                          ) {
                            return (
                              <>
                                <Button
                                  variant="danger"
                                  onClick={cancelSaleInt}
                                  className="BuyNFT-button width-100 cancelNft"
                                >
                                  {cancelSale.isSubmit ? (
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
                            (nft?.status === "bid" ||
                              nft?.status === "bidandburn") &&
                            token !== null &&
                            decodedToken?.ac === nft?.owner
                          ) {
                            return (
                              <>
                                <Button
                                  variant="danger"
                                  onClick={cancelBid}
                                  className="BuyNFT-button width-100"
                                >
                                  {/* {cancel.isSubmit ? (
                                    <BeatLoader
                                      sizeUnit="px"
                                      size={10}
                                      color="#FFF"
                                      loading
                                    />
                                  ) : (
                                    "Cancel Bid"
                                  )} */}
                                </Button>
                              </>
                            );
                          } else {
                            return (
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
                            );
                          }
                        })()}
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
                        ))}
                    </div>
                  </Col>
                </Row>

                {/* sale modal start */}
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
                            image={nft?.url}
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
                          value={!!saleAmountModel && saleAmountModel}
                          onChange={handleSaleAmount}
                          className="form-control"
                          placeholder="Enter Amount"
                        ></input>
                      </Col>
                      <Col xs={6} md={6}>
                        <Form.Select
                          onChange={handleCurrency}
                          name="Currency"
                          aria-label="Default select example"
                          id="currency-dropdown"
                        >
                          <option value="">
                            {!!tokenTicker && tokenTicker.length > 0
                              ? "Currency"
                              : "No Currency"}
                          </option>
                          {!!nft && ["10", "11"].includes(nft.Flags) ? (
                            <option key="key" value="XRP">
                              XRP
                            </option>
                          ) : (
                            !!tokenTicker &&
                            tokenTicker.map((curr, index) => (
                              <option key={index} value={curr.curr}>
                                {curr.currency}
                              </option>
                            ))
                          )}
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
                            image={nft?.url}
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
                          type="submit"
                          className="form-control"
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

                {/* Terms and condition modal */}
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
                          By creating/minting an NFT on the RaDical-X
                          application or smart device applications, you (the
                          user) take full custody of the initial creation and
                          are responsible for its design, illustration, 3D video
                          or audio or anything similar displayed. By agreeing to
                          this disclaimer you remove all liabilities of the
                          design from the RaDical-X application and connections
                          to its creators, founders and partners.
                        </p>
                      </li>
                      <li>
                        <p>
                          The Design you create/mint must be your own personal
                          design, illustration, 3D video or audio. If you are
                          using content from another creator, company logo,
                          commercial brand or anything similar created by
                          someone else you must ask permission to use their
                          content and receive written consent before creating
                          your NFT.
                        </p>
                      </li>
                      <li>
                        <p>
                          Purchasing an NFT off the secondary market, or
                          otherwise acquiring the NFT through any other
                          legitimate means or method, the Holder receives full
                          and complete ownership, inclusive of commercial
                          rights, to the NFT and the corresponding unique
                          artwork.
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
                          advertise, distribute or otherwise market any NFT in
                          any project or derivative work that involves hate
                          speech, racism, pornography, or any other illegal or
                          unlawful content. Upon sale or transfer of the NFT,
                          any ownership or commercial rights are immediately
                          transferred to the new Holder.
                        </p>
                      </li>
                      <li>
                        <p>
                          No refunds shall be issued to any Holder upon a full
                          and complete lawful purchase of any NFT. In the event
                          that any Holder purchases an NFT through the secondary
                          market, the holder shall be held accountable and will
                          be bound by the Terms of Service which govern said
                          secondary market platform.
                        </p>
                      </li>
                      <li>
                        <p>
                          NFT’s may bear elements of transformative fan art or
                          caricatures which are rendered in good faith to add
                          humour and satire to the project. Any Holder of an NFT
                          bearing these elements has an individual
                          responsibility to determine the appropriateness of
                          subsequent usage. Any Attributes associated to an NFT
                          is used as a parody. These attributes are not
                          sponsored, endorsed by or affiliated by any affiliated
                          companies and/or third party licensors.
                        </p>
                      </li>
                      <li>
                        <p>
                          Participants in creating/minting NFTs agree to hold
                          the project Creative Team harmless for any losses
                          incurred as a consequence of creating/minting an NFT.
                          These potential losses include any fees for failed
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
                          arise, be imposed, or enforced as a result of minting
                          or reselling NFTs on the Fuzion-XIO
                          website/application.
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
                {/* </> */}
              </Container>
            </>
          )}
        </div>
      )}
      <Footer />
      {/* <div className={loading ? "parentDisable" : ""}>
        <HashLoader
          sizeUnit="px"
          size={100}
          color="#329be3"
          loading={loading}
          cssOverride={override}
        />
      </div> */}
    </React.Fragment>
  );
}

export default InteroperabilityDetail;
