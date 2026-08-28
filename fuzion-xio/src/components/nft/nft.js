import React, { useState, useEffect } from "react";
import "react-toastify/dist/ReactToastify.css";
import { Link, useNavigate } from "react-router-dom";
import { useJwt } from "react-jwt";
import { Row, Col, Card, Container, Image } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import Filetype from "../common/Filetype";
import { toast } from "react-toastify";
import MessageConst from "../../const/message.json";
import { useDispatch, useSelector } from "react-redux";
import { homeNftDetail } from "../../store/actions/homedetail";
import { likeDispach } from "../../store/actions/like";
import { getBalanceAction } from "../../store/actions/wallet";
import { Swiper, SwiperSlide } from "swiper/react";
import {
  getProfileAction,
  getProfileVScoreAction
} from "../../store/actions/profile";
import { getProfileDetails } from "../../helper/getProfileDetails";
import { profileBatchColor } from "../../helper/getProfileDetails";
import * as Spinners from "react-loader-spinner";
import { TABSARRAY } from "../../const";

// Dummy Image
import DummyProfile from "../../assets/defaultpimage.jpg";
import configData from "../../config.json";
import Carousel from "react-multi-carousel";
// import "react-multi-carousel/lib/styles.css";

import "./slider.css";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/pagination";
import "swiper/css/navigation";
import "react-multi-carousel/lib/styles.css";
// import arrowdown from "../../../src/assets/down-arrow.png";
// import arrowUp from '../../../src/assets/up-arrow.png';
import tokenbadge from "../../../src/assets/tokenimg.png";
// import tickbadge from '../../../src/assets/tick.png';

import {
  EffectCoverflow,
  Pagination,
  Navigation,
  Mousewheel,
  Autoplay
} from "swiper";

import { replaceHost } from "../../helper";
import LedgerMintsRail from "./LedgerMintsRail";

function Nft() {
  const token = localStorage.getItem("jwtToken");
  const navigate = useNavigate();
  const { decodedToken } = useJwt(token);
  const [listRc, setListRc] = useState(null);
  // const [listSallingCreater, setListSallingCreater] = useState([]);
  const [listTodayPicks, setListTodayPicks] = useState(null);
  const [likeCheck, setLikeCheck] = useState(false);
  const [listMostLikedNft, setListMostLikedNft] = useState(null);
  const [allMintedNfts, setAllMintedNfts] = useState(null);
  const [searchKey, setSearchKey] = useState(true);
  const [activeId, setActiveID] = useState([]);
  const [activeCardId, setActiveCardID] = useState([]);
  const [activeCardTId, setActiveCardTID] = useState([]);
  const [allProfile, setAllProfile] = useState(null);
  const [isActiveWallet, setIsActiveWallet] = useState(false);

  let dispatch = useDispatch();

  const [homedtl, likeStatus, balance] = useSelector((state) => [
    state.homeDetailReducer,
    state.nftLikeReducer,
    state.getBalanceReducer
  ]);

  const responsive = {
    superLargeDesktop: {
      breakpoint: { max: 4000, min: 3000 },
      items: 5
    },
    desktop: {
      breakpoint: { max: 3000, min: 1024 },
      items: 4
    },
    tablet: {
      breakpoint: { max: 1024, min: 464 },
      items: 3
    },
    mobile: {
      breakpoint: { max: 464, min: 0 },
      items: 1
    }
  };

  /////////// NFT DEATIL DISPACH AND SELECT START//////////
  useEffect(() => {
    try {
      dispatch(homeNftDetail({ loader: true }));
    } catch (error) {
      toast.error(error.response.data.message, {
        toastId: "Nftdetail1111" + Date.now()
      });
    }
  }, [likeStatus]); // eslint-disable-line

  useEffect(() => {
    if (homedtl.nftDetail !== "") {
      let {
        rcTop = [],
        todayPicks = [],
        mostLikedNft = [],
        allMintedNft = []
      } = homedtl.nftDetail || {};
      setTimeout(async () => {
        setListRc(await bindVscoreData(rcTop));
        setListTodayPicks(await bindVscoreData(todayPicks));
        if (Array.isArray(mostLikedNft) && mostLikedNft.length) {
          mostLikedNft = await Promise.all(
            mostLikedNft.map(async (vl) => ({
              ...vl,
              Nft: await bindVscoreData(vl.Nft)
            }))
          );
        }
        setListMostLikedNft(mostLikedNft);
      }, 200);
      setAllMintedNfts(allMintedNft);
    }
  }, [homedtl]); // eslint-disable-line

  /////////// NFT DEATIL DISPACH AND SELECT END//////////

  // //////////////////////// NFT LIKE DISPACH AND SELECT START ///////
  // useEffect(() => {
  //   if (likeStatus !== "" && likeCheck) {
  //     if (likeStatus.error === false) {
  //       toast.success(likeStatus.nftDetail.message, {
  //         toastId: "likeStatusSuccess" + Date.now(),
  //         onClose: () => {
  //           setListTodayPicks(likeStatus.nftDetail.data);
  //           setLikeCheck(false);
  //         },
  //       });
  //     } else if (likeStatus.error !== null) {
  //       toast.error(likeStatus.error.message, {
  //         toastId: "LikeStatusFailed" + Date.now(),
  //       });
  //     }
  //   }
  // }, [likeStatus, likeCheck]); // eslint-disable-line

  ////////////////////////  FOR CANCEL BID END ///////

  const likeDislike = async (val) => {
    setLikeCheck(true);
    try {
      //check user
      if (decodedToken === null) {
        toast.warn(MessageConst.errorConnectXummWallet, {
          toastId: "NFTLike" + Date.now()
        });
        return;
      }
      let data = {
        nftID: val
      };

      dispatch(likeDispach({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "bidToken1" + Date.now()
      });
    }
    dispatch(homeNftDetail({ loader: true }));
  };
  //////////////////////// NFT LIKE DISPACH AND SELECT END ///////

  // const CustomButtonGroup = ({ next, previous, goToSlide, carouselState }) => {  // eslint-disable-line
  //   // const { totalItems, currentSlide } = carouselState;
  //   return (
  //     <div className="custom-button-group">
  //       <button onClick={() => previous()}>
  //         <i className="fa fa-chevron-left" aria-hidden="true"></i>
  //       </button>
  //       <button onClick={() => next()}>
  //         <i className="fa fa-chevron-right" aria-hidden="true"></i>
  //       </button>
  //     </div>
  //   );
  // };

  const displayCardDetails = (e, id, type) => {
    e.stopPropagation();
    e.preventDefault();
    if (type === "nftcard") {
      const idList = activeId;
      if (idList.includes(id)) {
        const filterData = idList.filter((item) => item !== id);
        setActiveID(filterData);
      } else {
        setActiveID([...activeId, id]);
      }
    } else if (type === "todaypick") {
      const idList = activeCardTId;
      if (idList.includes(id)) {
        const filterData = idList.filter((item) => item !== id);
        setActiveCardTID(filterData);
      } else {
        setActiveCardTID([...activeCardTId, id]);
      }
    } else {
      const idList = activeCardId;
      if (idList.includes(id)) {
        const filterData = idList.filter((item) => item !== id);
        setActiveCardID(filterData);
      } else {
        setActiveCardID([...activeCardId, id]);
      }
    }
  };

  useEffect(() => {
    try {
      if (token !== null) {
        let data = {
          token: token
        };
        dispatch(getBalanceAction({ data, loader: true }));
      }
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "connectWallet1" + Date.now()
      });
    }
  }, [token]);

  /*for profile image in card and profile name */
  useEffect(() => {
    dispatch(getProfileAction({ wAddress: "" }))
      .then((pDetail) => {
        setAllProfile(pDetail?.data?.allProfile || []);
      })
      .catch((err) => console.log(err, "pdetails error"));
  }, []); // eslint-disable-line

  const getVScore = (NFTokenID) => {
    const IssuerToken = allMintedNfts?.find((vl) => vl.NFTokenID === NFTokenID);
    return dispatch(getProfileVScoreAction({ wAddress: IssuerToken?.Issuer }))
      .then((vScorePoint) => {
        const { vPointDetails } = vScorePoint?.data;
        return vPointDetails?.[0]?.totalVPoint;
      })
      .catch((err) => console.log(err, "vpoint error"));
  };

  const bindVscoreData = async (data) => {
    if (!Array.isArray(data)) return [];
    return await Promise.all(
      data.map(async (vl) => ({
        ...vl,
        vscore: vl?.NFTokenID ? await getVScore(vl.NFTokenID) : 0
      }))
    );
  };

  const checkXioBalance = () => {
    if (balance?.currency !== null) {
      const xioBalance = balance?.currency?.currency?.find(function (obj) {
        return obj.currency === "XIO";
      });
      if (xioBalance) {
        navigate("/createNft");
      } else {
        toast.error(MessageConst.XIOBALCHECK, {
          toastId: "xioBalCheck" + Date.now()
        });
      }
    }
  };

  const handleTabs = (url) => {
    if (url === "/createNft") {
      checkXioBalance();
    } else {
      navigate(url);
    }
  };

  return (
    <React.Fragment>
      <Header
        setSearchKey={setSearchKey}
        setIsActiveWallet={setIsActiveWallet}
      />
      {searchKey && (
        <div className={`gradientBg pt-${decodedToken ? 3 : 4}`}>
          <>
            {
              <Container fluid>
                <Row className="d-lg-none">
                  {TABSARRAY.map((post, i) => (
                    <Col
                      sm={12}
                      lg={12}
                      xs={12}
                      md={12}
                      className="mt-3"
                      key={i}
                    >
                      <Image
                        src={post.image}
                        width="100%"
                        height="100%"
                        onClick={() =>
                          isActiveWallet ? handleTabs(post.url) : ""
                        }
                        className="tabs-img"
                      />
                    </Col>
                  ))}
                </Row>
                <Row className="d-none d-lg-block">
                  <Carousel
                    additionalTransfrom={0}
                    partialVisible={false}
                    responsive={responsive}
                    swipeable={false}
                    draggable={false}
                    showDots={TABSARRAY.length > 4 ? true : false}
                    autoPlay={false}
                    shouldResetAutoplay={false}
                    renderDotsOutside={false}
                    arrows={true}
                    infinite={false}
                    // containerClass="carousel-class"
                    removeArrowOnDeviceType={["tablet", "mobile"]}
                  >
                    {TABSARRAY.map((post, i) => (
                      <Image
                        src={post.image}
                        width="100%"
                        height="80%"
                        onClick={() =>
                          isActiveWallet ? handleTabs(post.url) : ""
                        }
                        className="tabs-img"
                        key={i}
                      />
                    ))}
                  </Carousel>
                </Row>
                <br />
              </Container>
            }
            <LedgerMintsRail />
            <Container>
              <Row className="align-items-center">
                <Col md={6} xs={8}>
                  <p className="home-hading">Recommended NFTs</p>
                </Col>
                <Col md={6} xs={4} className="text-right">
                  {listRc !== undefined && listRc?.length === 0 ? (
                    ""
                  ) : (
                    <Link to={"/Nftlist/Recommended_collections"}>
                      <p className="see-all-button">SEE ALL</p>
                    </Link>
                  )}
                </Col>
              </Row>
            </Container>
            <Container fluid={true} className="px-0">
              {!listRc ? (
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
              ) : listRc !== undefined && listRc?.length === 0 ? (
                <Row>
                  <p className="text-center"> {MessageConst.NoDataFound}</p>
                </Row>
              ) : (
                // <Container className="carousal-main nftHomePage">
                <Swiper
                  effect={"coverflow"}
                  grabCursor={true}
                  centeredSlides={true}
                  loop={false}
                  slidesPerView={"auto"}
                  coverflowEffect={{
                    rotate: 0,
                    stretch: 0,
                    depth: 100,
                    modifier: 2.5
                  }}
                  autoplay={{
                    delay: 3000,
                    disableOnInteraction: false
                  }}
                  modules={[
                    EffectCoverflow,
                    Pagination,
                    Navigation,
                    Mousewheel,
                    Autoplay
                  ]}
                  mousewheel={true}
                  className="swiper_container"
                >
                  {listRc !== undefined &&
                    listRc?.map((post) => (
                      <SwiperSlide key={post._id}>
                        <Col
                          md={12}
                          xs={12}
                          key={post._id}
                          className={`${post.status} padding-15 `}
                        >
                          <Card
                            className={`${post.status} customShado p-3 mb-5 bg-white rounded shadowcstm corner-ribbon home-shadow-css`}
                          >
                            <div className="top-left-view">
                              <img
                                alt=""
                                src={
                                  allProfile?.find(
                                    (vl) => vl.wAddress === post?.accountNumber
                                  )?.pImage
                                    ? allProfile
                                        ?.find(
                                          (vl) =>
                                            vl.wAddress === post?.accountNumber
                                        )
                                        ?.pImage?.startsWith("https://ipfs") ||
                                      allProfile
                                        ?.find(
                                          (vl) =>
                                            vl.wAddress === post?.accountNumber
                                        )
                                        ?.pImage?.startsWith(
                                          "https://cloudflare-ipfs"
                                        )
                                      ? replaceHost(
                                          allProfile?.find(
                                            (vl) =>
                                              vl.wAddress ===
                                              post?.accountNumber
                                          )?.pImage
                                        )
                                      : allProfile
                                          ?.find(
                                            (vl) =>
                                              vl.wAddress ===
                                              post?.accountNumber
                                          )
                                          ?.pImage?.startsWith("uploads")
                                      ? `${
                                          configData.LOCAL_API_URL +
                                          allProfile?.find(
                                            (vl) =>
                                              vl.wAddress ===
                                              post?.accountNumber
                                          )?.pImage
                                        }`
                                      : DummyProfile
                                    : DummyProfile
                                }
                                className="img-circle-view"
                              />

                              <p className="top-left-text">
                                {token !== null ? (
                                  <Link to={"/Profile/" + post?.accountNumber}>
                                    {(() => {
                                      // if (allProfile?.find(vl => vl.wAddress === post?.accountNumber)?.pName) {
                                      //   return <h6 className="owner-name">{allProfile?.find(vl => vl.wAddress === post?.accountNumber)?.pName}</h6>
                                      // } else {
                                      return (
                                        post?.accountNumber?.substring(0, 9) +
                                        "***** " +
                                        post?.accountNumber?.substring(
                                          post?.accountNumber?.length - 5
                                        )
                                      );
                                      // }
                                    })()}
                                  </Link>
                                ) : (
                                  (() => {
                                    // if (allProfile?.find(vl => vl.wAddress === post?.accountNumber)?.pName) {
                                    //   return <h6 className="owner-name">{allProfile?.find(vl => vl.wAddress === post?.accountNumber)?.pName}</h6>
                                    // } else {
                                    return (
                                      post?.accountNumber?.substring(0, 9) +
                                      "***** " +
                                      post?.accountNumber?.substring(
                                        post?.accountNumber.length - 5
                                      )
                                    );
                                    // }
                                  })()
                                )}
                              </p>
                            </div>

                            <Link
                              className="a-link-display-none"
                              to={
                                post.status === "bidandburn" ||
                                post.status === "bid"
                                  ? "/BidDetail/" + post._id
                                  : "/Nftdetail/" + post._id
                              }
                            >
                              <Filetype
                                fileType={post.contentType}
                                image={replaceHost(post.image)}
                                profileImg={
                                  getProfileDetails(
                                    allProfile,
                                    allMintedNfts,
                                    post.NFTokenID
                                  )?.pImage
                                    ? getProfileDetails(
                                        allProfile,
                                        allMintedNfts,
                                        post.NFTokenID
                                      ).pImage.startsWith("https://ipfs") ||
                                      getProfileDetails(
                                        allProfile,
                                        allMintedNfts,
                                        post.NFTokenID
                                      ).pImage.startsWith(
                                        "https://cloudflare-ipfs"
                                      )
                                      ? replaceHost(
                                          getProfileDetails(
                                            allProfile,
                                            allMintedNfts,
                                            post.NFTokenID
                                          )?.pImage
                                        )
                                      : getProfileDetails(
                                          allProfile,
                                          allMintedNfts,
                                          post.NFTokenID
                                        ).pImage.startsWith("uploads/")
                                      ? `${
                                          configData.LOCAL_API_URL +
                                          getProfileDetails(
                                            allProfile,
                                            allMintedNfts,
                                            post.NFTokenID
                                          )?.pImage
                                        }`
                                      : DummyProfile
                                    : DummyProfile
                                }
                              />
                            </Link>

                            <Card.Body>
                              <div className="body-card">
                                <Card.Title className="cardNFTName">
                                  {post?.name == undefined
                                    ? "N/A"
                                    : post?.name?.length > 40
                                    ? post?.name?.substring(0, 40) + "..."
                                    : post?.name}
                                </Card.Title>
                                {/* <div className="d-flex justify-content-between flex-wrap">
                                    <div className="order-first">{(() => {
                                      const IssuerToken = allMintedNfts.find((vl) => vl.NFTokenID === post.NFTokenID);
                                      if (IssuerToken?.Issuer !== null && IssuerToken?.Issuer !== undefined) {
                                        if (token !== null) {
                                          return <Link to={"/Profile/" + IssuerToken?.Issuer}>{
                                            (() => {
                                              if (allProfile?.find(vl => vl.wAddress === IssuerToken?.Issuer)?.pName) {
                                                return <h6 className="owner-name">{allProfile?.find(vl => vl.wAddress === IssuerToken?.Issuer)?.pName}</h6>
                                              } else {
                                                return IssuerToken?.Issuer.substring(0, 9) + "***** " + IssuerToken?.Issuer.substring(IssuerToken?.Issuer.length - 5);
                                              }
                                            })()}</Link>
                                        } else {
                                          (() => {
                                            if (allProfile?.find(vl => vl.wAddress === IssuerToken?.Issuer)?.pName) {
                                              return <h6 className="owner-name">{allProfile?.find(vl => vl.wAddress === IssuerToken?.Issuer)?.pName}</h6>
                                            } else {
                                              return IssuerToken?.Issuer.substring(0, 9) + "***** " + IssuerToken?.Issuer.substring(IssuerToken?.Issuer.length - 5);
                                            }
                                          })()
                                        }
                                      } else {
                                        return "N/A";
                                      }
                                    })()}</div>
                                    <div className="mb-10 order-last d-flex">
                                      <div className="token-width"><img alt="" src={tokenbadge} /></div>
                                      <div className="token-tick">
                                        {profileBatchColor(post.vscore)}
                                      </div>
                                    </div>
                                  </div> */}
                                <div className="body-cart-para">
                                  <p>
                                    {(() => {
                                      const IssuerToken = allMintedNfts.find(
                                        (vl) => vl.NFTokenID === post.NFTokenID
                                      );
                                      if (
                                        IssuerToken?.Issuer !== null &&
                                        IssuerToken?.Issuer !== undefined
                                      ) {
                                        if (token !== null) {
                                          return (
                                            <Link
                                              to={
                                                "/Profile/" +
                                                IssuerToken?.Issuer
                                              }
                                            >
                                              {(() => {
                                                // if (allProfile?.find(vl => vl.wAddress === IssuerToken?.Issuer)?.pName) {
                                                //   return <h6 className="owner-name">{allProfile?.find(vl => vl.wAddress === IssuerToken?.Issuer)?.pName}</h6>
                                                // } else {
                                                return (
                                                  IssuerToken?.Issuer?.substring(
                                                    0,
                                                    9
                                                  ) +
                                                  "***** " +
                                                  IssuerToken?.Issuer?.substring(
                                                    IssuerToken?.Issuer.length -
                                                      5
                                                  )
                                                );
                                                // }
                                              })()}
                                            </Link>
                                          );
                                        } else {
                                          return (() => {
                                            // if (allProfile?.find(vl => vl.wAddress === IssuerToken?.Issuer)?.pName) {
                                            //   return <h6 className="owner-name">{allProfile?.find(vl => vl.wAddress === IssuerToken?.Issuer)?.pName}</h6>
                                            // } else {
                                            return (
                                              IssuerToken?.Issuer?.substring(
                                                0,
                                                9
                                              ) +
                                              "***** " +
                                              IssuerToken?.Issuer?.substring(
                                                IssuerToken?.Issuer.length - 5
                                              )
                                            );
                                            // }
                                          })();
                                        }
                                      } else {
                                        return "N/A";
                                      }
                                    })()}
                                  </p>
                                  <p className="right-item">
                                    <div className="home-css token-badge customTokenbadge">
                                      <img alt="" src={tokenbadge} />
                                    </div>
                                    <div className="tick-badge customTickbadge">
                                      {profileBatchColor(post.vscore)}
                                    </div>
                                  </p>
                                </div>
                                <hr className="hr-cls" />
                                <p className="cardNFTBYACount">
                                  {post.currency ? `${post.currency}` : "XRP"}
                                </p>
                                <p className="cardNFTBY">{post?.price}</p>
                              </div>

                              <div
                                className={
                                  activeCardId.includes(post._id)
                                    ? "cardnft-text card-h"
                                    : "cardnft-text card-h0"
                                }
                              >
                                <p className="text-center mb-0">
                                  <b className="cardNFTBY boldhead text-left slider">
                                    Issuer
                                  </b>
                                  <span className="cardNFTBYACount"></span>
                                </p>

                                <p className="text-center mb-0">
                                  <b className="boldhead text-left slider">
                                    Price
                                  </b>
                                  <span className="cardNFTBY">
                                    {post.price}
                                  </span>
                                </p>

                                <div className="badgeBox">
                                  <p className="text-center mb-0">
                                    <b className="boldhead text-left slider">
                                      Profile
                                    </b>
                                    <span className="cardNFTBY">
                                      {
                                        getProfileDetails(
                                          allProfile,
                                          allMintedNfts,
                                          post.NFTokenID
                                        ).pName
                                      }
                                    </span>
                                  </p>
                                </div>

                                <p className="text-center">
                                  <b className="boldhead text-left slider">
                                    Owner
                                  </b>
                                  <span className="cardNFTBY">
                                    {token !== null ? (
                                      <Link
                                        to={"/Profile/" + post?.accountNumber}
                                      >
                                        {post?.accountNumber?.substring(0, 9)}{" "}
                                        *****{" "}
                                        {post?.accountNumber?.substring(
                                          post?.accountNumber.length - 5
                                        )}
                                      </Link>
                                    ) : (
                                      `${post?.accountNumber?.substring(
                                        0,
                                        9
                                      )} *****
                               ${post?.accountNumber?.substring(
                                 post?.accountNumber.length - 5
                               )}`
                                    )}

                                    {/* {post?.accountNumber?.substring(0, 9)} *****{" "} */}
                                    {/* {post?.accountNumber?.substring( post?.accountNumber?.length - 5 )} */}
                                  </span>
                                </p>
                              </div>
                            </Card.Body>
                          </Card>
                        </Col>
                      </SwiperSlide>
                    ))}
                </Swiper>
              )}
            </Container>

            {/* <br /> */}
            {/* <Container>
              <Row>
                <Col md={6} xs={12}>
                  <p className="home-hading">Top Selling Creators</p>
                </Col>
                <Col md={6} xs={12} className="text-right"></Col>
              </Row>
            </Container> */}
            {/* {listSallingCreater?.length === 0 ? (
              <Row>
                <p className="text-center"> {MessageConst.NoDataFound}</p>
              </Row>
            ) : (
              <Container className="px-0">
                <Carouselauto
                  arrows={false}
                  responsive={responsive}
                  autoPlay={false}
                  swipeable={true}
                  autoPlaySpeed={false}
                  shouldResetAutoplay={false}
                  removeArrowOnDeviceType={["tablet", "mobile"]}
                  infinite={true}
                  customTransition="transform 500ms ease-in-out"
                  transitionDuration={800}
                  customButtonGroup={<CustomButtonGroup />}
                  partialVisible={false}
                >
                  {listSallingCreater?.map((post, i) => (
                    <Link
                      className="a-link-display-none"
                      to={"/Nftlist/" + post?.doc?.accountNumber}
                    >
                      <div className="topSellingP margin-top-20px">
                        <div className="sellingCard">
                          <div className="sellingLeft">
                            <Image
                              src={post?.doc?.image}
                              className="width-100-home-top circle"
                            />
                          </div>
                          <div className="sellingRight">
                            <p className="font-top-saller-top">
                              {" "}
                              {post?.doc?.accountNumber?.substring(
                                0,
                                9
                              )} ******{" "}
                              {post?.doc?.accountNumber?.substring(
                                post?.doc?.accountNumber.length - 8
                              )}{" "}
                            </p>
                            <p className="font-top-saller-bottom">
                              {post?.doc?.price}{" "}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </Carouselauto>
              </Container>
            )} */}

            <br />
            <br />
            <Container className="likedSection">
              <Row className="align-items-center">
                <Col md={6} xs={8}>
                  <p className="home-hading">Most Liked NFT</p>
                </Col>
                <Col md={6} xs={4} className="text-right">
                  {!!listMostLikedNft &&
                  (listMostLikedNft?.length === 0 ||
                    listMostLikedNft?.[0]?.Nft?.length === 0) ? (
                    ""
                  ) : (
                    <Link to={"/Nftlist/Recommended_collections"}>
                      <p className="see-all-button">SEE ALL</p>
                    </Link>
                  )}
                </Col>
              </Row>
              {!listMostLikedNft ? (
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
              ) : listMostLikedNft?.length === 0 &&
                listMostLikedNft?.find((vl) => vl.Nft)?.Nft?.length === 0 ? (
                <Row>
                  <br />
                  <br />
                  <p className="text-center"> {MessageConst.NoDataFound}</p>
                  <br />
                  <br />
                </Row>
              ) : (
                <Row className="mx-auto">
                  {listMostLikedNft?.map(
                    (post) =>
                      post.Nft.length > 0 && (
                        <Col
                          lg={4}
                          md={6}
                          xs={12}
                          key={post._id}
                          className={`${post.status} padding-15 `}
                        >
                          <Card
                            className={`${post.status} customShado p-3 mb-5 bg-white rounded shadowcstm corner-ribbon hcstm_ad`}
                          >
                            <div className="top-left-view">
                              <img
                                alt=""
                                src={
                                  allProfile?.find(
                                    (vl) =>
                                      vl.wAddress ===
                                      post?.Nft[0]?.accountNumber
                                  )?.pImage
                                    ? allProfile
                                        ?.find(
                                          (vl) =>
                                            vl.wAddress ===
                                            post?.Nft[0]?.accountNumber
                                        )
                                        ?.pImage?.startsWith("https://ipfs") ||
                                      allProfile
                                        ?.find(
                                          (vl) =>
                                            vl.wAddress ===
                                            post?.Nft[0]?.accountNumber
                                        )
                                        ?.pImage?.startsWith(
                                          "https://cloudflare-ipfs"
                                        )
                                      ? replaceHost(
                                          allProfile?.find(
                                            (vl) =>
                                              vl.wAddress ===
                                              post?.Nft[0]?.accountNumber
                                          )?.pImage
                                        )
                                      : allProfile
                                          ?.find(
                                            (vl) =>
                                              vl.wAddress ===
                                              post?.Nft[0]?.accountNumber
                                          )
                                          ?.pImage?.startsWith("uploads")
                                      ? `${
                                          configData.LOCAL_API_URL +
                                          allProfile?.find(
                                            (vl) =>
                                              vl.wAddress ===
                                              post?.Nft[0]?.accountNumber
                                          )?.pImage
                                        }`
                                      : DummyProfile
                                    : DummyProfile
                                }
                                className="img-circle-view"
                              />
                              <p className="top-left-text">
                                {token !== null ? (
                                  <Link
                                    to={
                                      "/Profile/" + post?.Nft[0]?.accountNumber
                                    }
                                  >
                                    {post?.Nft[0]?.accountNumber?.substring(
                                      0,
                                      9
                                    )}{" "}
                                    *****{" "}
                                    {post?.Nft[0]?.accountNumber?.substring(
                                      post?.Nft[0]?.accountNumber?.length - 5
                                    )}
                                  </Link>
                                ) : (
                                  `${post?.Nft[0]?.accountNumber?.substring(
                                    0,
                                    9
                                  )} *****
                               ${post?.Nft[0]?.accountNumber?.substring(
                                 post?.Nft[0]?.accountNumber?.length - 5
                               )}`
                                )}
                              </p>
                            </div>

                            <Link
                              className="a-link-display-none"
                              to={
                                post?.Nft[0]?.status === "bidandburn" ||
                                post?.Nft[0]?.status === "bid"
                                  ? "/BidDetail/" + post._id
                                  : "/Nftdetail/" + post._id
                              }
                            >
                              <Filetype
                                fileType={post?.Nft[0]?.contentType}
                                image={replaceHost(post?.Nft[0]?.image)}
                                profileImg={
                                  getProfileDetails(
                                    allProfile,
                                    allMintedNfts,
                                    post?.Nft[0]?.NFTokenID
                                  )?.pImage
                                    ? getProfileDetails(
                                        allProfile,
                                        allMintedNfts,
                                        post?.Nft[0]?.NFTokenID
                                      ).pImage.startsWith("https://ipfs") ||
                                      getProfileDetails(
                                        allProfile,
                                        allMintedNfts,
                                        post?.Nft[0]?.NFTokenID
                                      ).pImage.startsWith(
                                        "https://cloudflare-ipfs"
                                      )
                                      ? replaceHost(
                                          getProfileDetails(
                                            allProfile,
                                            allMintedNfts,
                                            post?.Nft[0]?.NFTokenID
                                          )?.pImage
                                        )
                                      : getProfileDetails(
                                          allProfile,
                                          allMintedNfts,
                                          post?.Nft[0]?.NFTokenID
                                        ).pImage.startsWith("uploads/")
                                      ? `${
                                          configData.LOCAL_API_URL +
                                          getProfileDetails(
                                            allProfile,
                                            allMintedNfts,
                                            post?.Nft[0]?.NFTokenID
                                          )?.pImage
                                        }`
                                      : DummyProfile
                                    : DummyProfile
                                }
                              />
                            </Link>
                            <Card.Body>
                              <div className="body-card">
                                <Card.Title className="cardNFTName">
                                  {post?.Nft[0]?.name?.length > 40
                                    ? post?.Nft[0]?.name?.substring(0, 40) +
                                      "..."
                                    : post?.Nft[0]?.name}
                                </Card.Title>
                                <p className="body-cart-para">
                                  {(() => {
                                    const IssuerToken = allMintedNfts.find(
                                      (vl) =>
                                        vl.NFTokenID === post?.Nft[0]?.NFTokenID
                                    );
                                    if (IssuerToken?.Issuer !== undefined) {
                                      if (token !== null) {
                                        return (
                                          <Link
                                            to={
                                              "/Profile/" + IssuerToken?.Issuer
                                            }
                                          >
                                            {IssuerToken?.Issuer?.substring(
                                              0,
                                              9
                                            ) +
                                              " ***** " +
                                              IssuerToken?.Issuer?.substring(
                                                IssuerToken?.Issuer?.length - 5
                                              )}
                                          </Link>
                                        );
                                      } else {
                                        return (
                                          IssuerToken?.Issuer?.substring(0, 9) +
                                          " ***** " +
                                          IssuerToken?.Issuer?.substring(
                                            IssuerToken?.Issuer?.length - 5
                                          )
                                        );
                                      }
                                    } else {
                                      return "N/A";
                                    }
                                  })()}
                                  <div className="token-badge customTokenbadge">
                                    <img alt="" src={tokenbadge} />
                                  </div>
                                  <div className="tick-badge customTickbadge">
                                    {profileBatchColor(post?.Nft[0]?.vscore)}
                                  </div>
                                </p>
                                <hr className="hr-cls" />
                                <p className="cardNFTBYACount">
                                  {" "}
                                  {post?.Nft[0]?.currency
                                    ? `${post?.Nft[0]?.currency}`
                                    : "XRP"}{" "}
                                  <div className="card-img-overlay-custome likeCount">
                                    <div>
                                      <p className="d-flex align-items-center">
                                        <div
                                          className="like-button liked"
                                          onClick={() => likeDislike(post._id)}
                                        >
                                          <span className="like-icon">
                                            <div className="heart-animation-1"></div>
                                            <div className="heart-animation-2"></div>
                                          </span>
                                        </div>
                                        <span className="fa-fa-font-white-text">
                                          {post?.count}
                                        </span>
                                      </p>
                                    </div>
                                  </div>
                                </p>
                                <p className="cardNFTBY">
                                  {post?.Nft[0]?.price}
                                </p>
                              </div>
                              {/* <div className="arrowdown-img mb-2 mt-0">
                                <img onClick={(e) => displayCardDetails(e, post.Nft[0]._id, 'nftcard')} alt="" src={activeId.includes(post.Nft[0]._id) ? arrowUp : arrowdown} />
                              </div> */}
                              {/* <div className={activeId.includes(post.Nft[0]._id) ? 'cardnft-text card-h' : 'cardnft-text card-h0'} > */}
                              {/* <p className="text-center mb-0">
                                <b className="cardNFTBY boldhead text-left card_nft">
                                  Issuer
                                </b>
                                <span className="cardNFTBYACount">
                                  {(() => {
                                    const IssuerToken = allMintedNfts.find(vl => vl.NFTokenID === post?.Nft[0]?.NFTokenID);
                                    if (IssuerToken?.Issuer !== undefined) {
                                      if (token !== null) {
                                        return <Link to={"/Profile/" + IssuerToken?.Issuer}>{IssuerToken.Issuer.substring(0, 9) + " ***** " + IssuerToken.Issuer.substring(IssuerToken.Issuer.length - 5)}</Link>
                                      } else {
                                        return IssuerToken.Issuer.substring(0, 9) + " ***** " + IssuerToken.Issuer.substring(IssuerToken.Issuer.length - 5)
                                      }
                                      // return IssuerToken.Issuer.substring(0, 9) + " ***** " + IssuerToken.Issuer.substring(IssuerToken.Issuer.length - 5);
                                    } else {
                                      return "N/A"
                                    }
                                  })()}
                                </span>
                              </p>

                              <div className="badgeBox">
                                <p className="text-center mb-0">
                                  <b className="boldhead text-left">Token </b>
                                  <span className="cardNFTBYACount">
                                    {" "}
                                    {post?.Nft[0]?.currency
                                      ? `${post?.Nft[0]?.currency}`
                                      : "XRP"}{" "}
                                  </span>
                                </p> */}

                              {/* <div className="token-badge customTokenbadge"><img alt="" src={tokenbadge} /></div>
                              </div>
 */}
                              {/* <p className="text-center mb-0">
                                <b className="boldhead text-left">Price </b>

                                <span className="cardNFTBY">
                                  {post?.Nft[0]?.price}
                                </span>
                              </p> */}

                              {/* <div className="badgeBox">
                                <p className="text-center mb-0">
                                  <b className="boldhead text-left">Profile </b>
                                  <span className="cardNFTBY">
                                    {getProfileDetails(allProfile, allMintedNfts, post?.Nft[0]?.NFTokenID).pName}

                                  </span>
                                </p> */}

                              {/* <div className="tick-badge customTickbadge">
                                  {profileBatchColor(getVScore(post?.Nft[0]?.NFTokenID))}
                              </div> */}
                              {/* </div> */}

                              {/* <p className="text-center">
                                <b className="boldhead text-left">Owner </b>
                                <span className="cardNFTBY">

                                  {token !== null ? <Link to={"/Profile/" + post?.Nft[0]?.accountNumber}>
                                    {post?.Nft[0]?.accountNumber.substring(0, 9)} *****{" "}
                                    {post?.Nft[0]?.accountNumber.substring(
                                      post?.Nft[0]?.accountNumber.length - 5
                                    )}
                                  </Link>
                                    : `${post?.Nft[0]?.accountNumber.substring(0, 9)} *****
                               ${post?.Nft[0]?.accountNumber.substring(
                                      post?.Nft[0]?.accountNumber.length - 5
                               )}`} */}

                              {/* {post?.Nft[0]?.accountNumber?.substring(0, 9)} *****{" "} */}
                              {/* {post?.Nft[0]?.accountNumber?.substring(post?.Nft[0]?.accountNumber?.length - 5)} */}
                              {/*</span>
                              </p>
                            </div> */}
                            </Card.Body>
                          </Card>
                        </Col>
                      )
                  )}
                </Row>
              )}
            </Container>

            <Container className="todayPicks">
              <Row>
                <Col md={6} xs={8}>
                  <p className="home-hading">Today’s Picks</p>
                </Col>
                <Col md={6} xs={4} className="text-right">
                  {listTodayPicks?.length === 0 ? (
                    ""
                  ) : (
                    <Link to={"/Nftlist/Today_picks"}>
                      <p className="see-all-button">SEE ALL</p>
                    </Link>
                  )}
                </Col>
              </Row>
              {!listTodayPicks ? (
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
              ) : listTodayPicks?.length === 0 ? (
                <Row>
                  <p className="text-center"> {MessageConst.NoDataFound}</p>
                  <br />
                  <br />
                </Row>
              ) : (
                <Row>
                  {listTodayPicks?.map((post) => (
                    <Col
                      lg={4}
                      md={6}
                      xs={12}
                      key={post._id}
                      className={`${post.status} padding-15 `}
                    >
                      <Card
                        className={`${post.status} customShado p-3 mb-5 bg-white rounded shadowcstm corner-ribbon`}
                      >
                        <div className="top-left-view">
                          <img
                            alt=""
                            src={
                              allProfile?.find(
                                (vl) => vl.wAddress === post?.accountNumber
                              )?.pImage
                                ? allProfile
                                    ?.find(
                                      (vl) =>
                                        vl.wAddress === post?.accountNumber
                                    )
                                    ?.pImage.startsWith("https://ipfs") ||
                                  allProfile
                                    ?.find(
                                      (vl) =>
                                        vl.wAddress === post?.accountNumber
                                    )
                                    ?.pImage.startsWith(
                                      "https://cloudflare-ipfs"
                                    )
                                  ? replaceHost(
                                      allProfile?.find(
                                        (vl) =>
                                          vl.wAddress === post?.accountNumber
                                      )?.pImage
                                    )
                                  : allProfile
                                      ?.find(
                                        (vl) =>
                                          vl.wAddress === post?.accountNumber
                                      )
                                      ?.pImage.startsWith("uploads/")
                                  ? `${
                                      configData.LOCAL_API_URL +
                                      allProfile?.find(
                                        (vl) =>
                                          vl.wAddress === post?.accountNumber
                                      )?.pImage
                                    }`
                                  : DummyProfile
                                : DummyProfile
                            }
                            className="img-circle-view"
                          />
                          <p className="top-left-text">
                            {token !== null ? (
                              <Link to={"/Profile/" + post?.accountNumber}>
                                {post?.accountNumber?.substring(0, 9)} *****{" "}
                                {post?.accountNumber?.substring(
                                  post?.accountNumber?.length - 5
                                )}
                              </Link>
                            ) : (
                              `${post?.accountNumber?.substring(0, 9)} *****
                               ${post?.accountNumber?.substring(
                                 post?.accountNumber.length - 5
                               )}`
                            )}
                          </p>
                        </div>
                        <div className="card-img-overlay-custome likeCount">
                          <div>
                            <p className="d-flex align-items-center">
                              {(() => {
                                if (
                                  decodedToken &&
                                  post?.likes_data?.find(
                                    ({ accountNumber }) =>
                                      accountNumber === decodedToken?.ac
                                  )
                                ) {
                                  return (
                                    <>
                                      <div
                                        className="like-button liked"
                                        onClick={() => likeDislike(post._id)}
                                      >
                                        <span className="like-icon">
                                          <div className="heart-animation-1"></div>
                                          <div className="heart-animation-2"></div>
                                        </span>
                                      </div>
                                    </>
                                  );
                                } else {
                                  return (
                                    <>
                                      <div
                                        className="like-button"
                                        onClick={() => likeDislike(post._id)}
                                      >
                                        <span className="like-icon">
                                          <div className="heart-animation-1"></div>
                                          <div className="heart-animation-2"></div>
                                        </span>
                                      </div>
                                    </>
                                  );
                                }
                              })()}
                              <span className="fa-fa-font-white-text">
                                {post?.likes_data?.length}
                              </span>
                            </p>
                          </div>
                        </div>
                        <Link
                          className="a-link-display-none"
                          to={
                            post.status === "bidandburn" ||
                            post.status === "bid"
                              ? "/BidDetail/" + post._id
                              : "/Nftdetail/" + post._id
                          }
                        >
                          <Filetype
                            fileType={post.contentType}
                            image={replaceHost(post.image)}
                            profileImg={
                              getProfileDetails(
                                allProfile,
                                allMintedNfts,
                                post.NFTokenID
                              )?.pImage
                                ? getProfileDetails(
                                    allProfile,
                                    allMintedNfts,
                                    post.NFTokenID
                                  ).pImage.startsWith("https://ipfs") ||
                                  getProfileDetails(
                                    allProfile,
                                    allMintedNfts,
                                    post.NFTokenID
                                  ).pImage.startsWith("https://cloudflare-ipfs")
                                  ? replaceHost(
                                      getProfileDetails(
                                        allProfile,
                                        allMintedNfts,
                                        post.NFTokenID
                                      )?.pImage
                                    )
                                  : getProfileDetails(
                                      allProfile,
                                      allMintedNfts,
                                      post.NFTokenID
                                    ).pImage.startsWith("uploads/")
                                  ? `${
                                      configData.LOCAL_API_URL +
                                      getProfileDetails(
                                        allProfile,
                                        allMintedNfts,
                                        post.NFTokenID
                                      )?.pImage
                                    }`
                                  : DummyProfile
                                : DummyProfile
                            }
                          />
                        </Link>

                        <Card.Body>
                          <div className="body-card">
                            <Card.Title className="cardNFTName">
                              {post?.name?.length > 40
                                ? post?.name?.substring(0, 40) + "..."
                                : post?.name}
                            </Card.Title>
                            <p className="body-cart-para">
                              {(() => {
                                const IssuerToken = allMintedNfts.find(
                                  (vl) => vl.NFTokenID === post.NFTokenID
                                );
                                if (IssuerToken?.Issuer !== undefined) {
                                  if (token !== null) {
                                    return (
                                      <Link
                                        to={"/Profile/" + IssuerToken?.Issuer}
                                      >
                                        {IssuerToken.Issuer?.substring(0, 9) +
                                          " ***** " +
                                          IssuerToken?.Issuer?.substring(
                                            IssuerToken?.Issuer?.length - 5
                                          )}
                                      </Link>
                                    );
                                  } else {
                                    return (
                                      IssuerToken?.Issuer?.substring(0, 9) +
                                      " ***** " +
                                      IssuerToken?.Issuer?.substring(
                                        IssuerToken?.Issuer?.length - 5
                                      )
                                    );
                                  }
                                } else {
                                  return "N/A";
                                }
                              })()}
                              <div className="token-badge customTokenbadge">
                                <img alt="" src={tokenbadge} />
                              </div>
                              <div className="tick-badge customTickbadge">
                                {profileBatchColor(post.vscore)}
                              </div>
                            </p>
                            <hr className="hr-cls" />
                            <p className="cardNFTBYACount">
                              {post.currency ? `${post.currency}` : "XRP"}
                            </p>
                            <p className="cardNFTBY">{post?.price}</p>
                          </div>
                          {/* <div className={activeCardTId.includes(post._id) ? 'cardnft-text card-h' : 'cardnft-text card-h0'} >
                                <p className="text-center mb-0 ">
                                  <b className="boldhead text-left">
                                    Issuer
                                  </b>
                                  <span className="cardNFTBYACount">
                                    {(() => {
                                      const IssuerToken = allMintedNfts.find(vl => vl.NFTokenID === post.NFTokenID);
                                      if (IssuerToken?.Issuer !== undefined) {
                                        if (token !== null) {
                                          return <Link to={"/Profile/" + IssuerToken?.Issuer}>{IssuerToken.Issuer.substring(0, 9) + " ***** " + IssuerToken.Issuer.substring(IssuerToken.Issuer.length - 5)}</Link>
                                        } else {
                                          return IssuerToken.Issuer.substring(0, 9) + " ***** " + IssuerToken.Issuer.substring(IssuerToken.Issuer.length - 5)
                                        }
                                        // return IssuerToken.Issuer.substring(0, 9) + " ***** " + IssuerToken.Issuer.substring(IssuerToken.Issuer.length - 5);
                                      } else {
                                        return "N/A"
                                      }
                                    })()}
                                  </span>
                                </p>

                                <div className="badgeBox">
                                  <p className="text-center mb-0">
                                    <b className="boldhead text-left">Token </b>
                                    <span className="cardNFTBYACount">
                                      {post.currency ? `${post.currency}` : "XRP"}{" "}
                                    </span>
                                  </p>

                                  <div className="token-badge customTokenbadge"><img alt="" src={tokenbadge} /></div>
                                </div>


                                <p className="text-center mb-0">
                                  <b className="boldhead text-left">Price </b>
                                  <span className="cardNFTBY">{post.price}</span>
                                </p>

                                <div className="badgeBox">
                                  <p className="text-center mb-0">
                                    <b className="boldhead text-left">Profile </b>
                                    <span className="cardNFTBY">
                                      {getProfileDetails(allProfile, allMintedNfts, post.NFTokenID).pName}
                                    </span>
                                  </p>

                                  <div className="tick-badge customTickbadge">
                                    {profileBatchColor(getVScore(post.NFTokenID))}

                                  </div>
                                </div>
                                <p className="text-center">
                                  <b className="boldhead text-left">Owner </b>
                                  <span className="cardNFTBY">

                                    {token !== null ? <Link to={"/Profile/" + post?.accountNumber}>
                                      {post?.accountNumber.substring(0, 9)} *****{" "}
                                      {post?.accountNumber.substring(
                                        post?.accountNumber.length - 5
                                      )}
                                    </Link>
                                      : `${post?.accountNumber.substring(0, 9)} *****
                               ${post?.accountNumber.substring(
                                        post?.accountNumber.length - 5
                                      )}`}
                                  </span>
                                </p>
                              </div> */}
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </Container>
          </>
        </div>
      )}
      <br />
      <Footer />
    </React.Fragment>
  );
}

export default Nft;
