import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import { Container, Row, Col, Card, Dropdown, Form } from "react-bootstrap";
// import Pagination from "react-bootstrap/Pagination";
import { useDispatch, useSelector } from "react-redux";
import {
  getProfileAction,
  getProfileVScoreAction
} from "../../store/actions/profile";
// import HashLoader from "react-spinners/HashLoader";
import {
  getProfileDetails,
  profileBatchColor
} from "../../helper/getProfileDetails";
import Header from "../common/header";
import Footer from "../common/footer";
import configData from "../../config.json";
import MessageConst from "../../const/message.json";
import Filetype from "../common/Filetype";
import Interoperability from "./interoperability";
import { NftsByAdressDetail } from "../../store/actions/nftsbyaddress";
import ToggleButton from "react-bootstrap/ToggleButton";
import ToggleButtonGroup from "react-bootstrap/ToggleButtonGroup";
import Like from "./like/like";
import "bootstrap/dist/css/bootstrap.min.css";
//import arrowdown from "../../../src/assets/down-arrow.png";
//import arrowUp from "../../../src/assets/up-arrow.png";
import tokenbadge from "../../../src/assets/tokenimg.png";
// import tickbadge from "../../../src/assets/tick.png";

// Dummy Image
import DummyProfile from "../../assets/defaultpimage.jpg";

import * as Spinners from "react-loader-spinner";
import {
  checkImageExists,
  extractCIDFromURL,
  replaceHost,
  sortByTitleASCOrder
} from "../../helper";
import PaginationComponent from "../common/Pagination";

// import { useSelector } from "react-redux";
function Ownnft() {
  const token = localStorage.getItem("jwtToken");
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);
  const [searchKey, setSearchKey] = useState(true);
  const [remainingNFt, setRemainingNft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadPage, setLoadPage] = useState(false);
  const [layout, setLayout] = useState(false);
  // const [activeId, setActiveID] = useState([]);
  const [allMintedNfts, setAllMintedNfts] = useState(null);
  const [allProfile, setAllProfile] = useState(null);
  const [interopAllMarkers, setInteropAllMarkers] = useState([]);
  const [interopStepIndex, setInteropStepIndex] = useState(0);
  const [interopLoading, setInteropLoading] = useState(false);

  // manage states
  const [likeReducer, homedtl] = useSelector((state) => [
    state.nftLikeReducer,
    state.homeDetailReducer
  ]);
  // const override = {
  //   position: "absolute",
  //   left: "50%",
  //   top: "50%",
  // };

  let dispatch = useDispatch();
  const [allNftDetails] = useSelector((state) => [
    state.allNftsDetailByAddrReducer.allNftDetails
  ]);

  const getVScore = (NFTokenID) => {
    const IssuerToken =
      !!allMintedNfts && allMintedNfts.find((vl) => vl.NFTokenID === NFTokenID);
    return dispatch(getProfileVScoreAction({ wAddress: IssuerToken?.Issuer }))
      .then((vScorePoint) => {
        const { vPointDetails } = vScorePoint?.data;
        return vPointDetails[0]?.totalVPoint;
      })
      .catch((err) => console.log(err, "vpoint error"));
  };

  /**
   * Return the full image URL for a given NFTokenID.
   * If the URL is an IPFS URL, it will be converted to an HTTP URL.
   * If the URL is already an HTTP URL, it will be returned as is.
   * @param {string} url The URL to process
   * @returns {string} The full image URL
   */
  const getImageURL = async (url) => {
    const CID = extractCIDFromURL(url);
    return (await checkImageExists(CID)) ? replaceHost(url) : url;
  };

  // const bindVscoreData = async (data) => {
  //   const abs = data.map(async (vl) => ({ ...vl, vscore: !!vl.NFTokenID ? await getVScore(vl.NFTokenID) : 0 }));
  //   return await Promise.all(abs);
  // }

  // const handlePagination = (e) => {
  //   setPage(e);
  // };

  // const handleInitialCall = async (page) => {
  //   try {
  //     let config = {
  //       headers: {
  //         Authorization: `Basic ${token}`
  //       }
  //     };
  //     let data = {
  //       page: page === null ? 1 : page
  //     };
  //     let res = await axios.post(
  //       `${configData.LOCAL_API_URL}nft/getSingleUserNfts`,
  //       data,
  //       config
  //     );
  //     if (res.data.success) {
  //       const mergevScrore = await Promise.all(
  //         res.data.data.docs.map(async (vl) => ({
  //           ...vl,
  //           image: await getImageURL(vl.image),
  //           vscore: !!vl.NFTokenID ? await getVScore(vl.NFTokenID) : 0
  //         }))
  //       );
  //       res.data.data.docs = mergevScrore;
  //       setList(res.data.data);
  //     }
  //   } catch (error) {
  //     toast.error(error?.response?.data?.message, {
  //       toastId: "updateProfile3" + Date.now()
  //     });
  //   }
  // };

  const handleInitialCall = useCallback(
    async (page) => {
      try {
        setLoadPage(true);

        const config = { headers: { Authorization: `Basic ${token}` } };
        const { data } = await axios.post(
          `${configData.LOCAL_API_URL}nft/getSingleUserNfts`,
          { page },
          config
        );

        if (data.success) {
          const mergevScrore = await Promise.all(
            data.data.docs.map(async (vl) => {
              const imagePromise = getImageURL(vl.image);

              // optional: batch vscore calls for better performance
              const vscorePromise = vl.NFTokenID
                ? getVScore(vl.NFTokenID)
                : Promise.resolve(0);

              const [image, vscore] = await Promise.all([
                imagePromise,
                vscorePromise
              ]);

              return { ...vl, image, vscore };
            })
          );

          setList({ ...data.data, docs: mergevScrore });
        }
      } catch (error) {
        console.log(error, "get my nfts error");
        // toast.error(error?.response?.data?.message || "Error loading NFTs", {
        //   toastId: "updateProfile3" + Date.now()
        // });
      } finally {
        setLoadPage(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (homedtl.nftDetail !== "") {
      const { allMintedNft } = homedtl.nftDetail;
      setAllMintedNfts(allMintedNft);
    }
  }, [homedtl]);

  const getIntropabilityData = useCallback(async (resp) => {
    const { userNFTs } = resp;
    // console.log("userFinalNfts", userNFTs)
    // const userFinalNfts = await userNFTs.map(async vl => ({...vl, url: await getImageURL(vl.url)}));

    const arr = await userNFTs.map(async (val) => {
      if (val.url === null) {
        val.url = `${configData.BGIMAGE_URL}bgimg.jpg`;
        val.contentType = "image";
      } else {
        // const last = val.url.substring(val.url.lastIndexOf("/") + 1, val.url.length);
        // last.indexOf('.') === -1 ? val?.url?.split("/ipfs/")?.[1]?.startsWith("ba") ?  val.url : replaceHost(val.url) : val.url
        const uri = val.url?.replace("https://ipfs.io/ipfs/", "");
        const finalPath = `${
          configData.LOCAL_API_URL
        }proxy/${encodeURIComponent(uri)}`;

        if (finalPath.split("/").pop() !== "") {
          // console.log(finalPath, "check the uri")
          const response = await fetch(finalPath);
          const data = await response.json();
          if (data.contentType) {
            if (data.contentType === "model/gltf-binary") {
              val.url = replaceHost(val.url);
              val.contentType = "glb";
            } else {
              val.contentType = data.contentType.split("/")[0];
            }
          }
        }
      }
      return val;
    });
    return arr;
  }, []);

  useEffect(() => {
    dispatch(NftsByAdressDetail())
      .then(async (resp) => {
        if (resp) {
          const { allMarkers, totalNfts, mkrId } = resp;
          const data = await getIntropabilityData(resp);

          if (allMarkers?.length) {
            setInteropAllMarkers(allMarkers);
          }
          setInteropStepIndex(0);

          setRemainingNft({
            allNfts: await Promise.all(data),
            allMarkers,
            totalNfts,
            mkrId
          });
        } else {
          setInteropAllMarkers([]);
          setRemainingNft({
            allNfts: [],
            allMarkers: [],
            totalNfts: 0,
            mkrId: undefined
          });
        }
      })
      .catch(() => {
        setInteropAllMarkers([]);
        setRemainingNft({
          allNfts: [],
          allMarkers: [],
          totalNfts: 0,
          mkrId: undefined
        });
      });
  }, []);

  useEffect(() => {
    (async () => {
      await handleInitialCall(page);
    })();
  }, [page, likeReducer, allMintedNfts]); // eslint-disable-line

  useEffect(() => {
    if (remainingNFt === null) {
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [remainingNFt]);

  const interopStepCount = useMemo(
    () => Math.max(1, 1 + interopAllMarkers.length),
    [interopAllMarkers]
  );

  const loadInteropStep = useCallback(
    async (stepIndex) => {
      const marker =
        stepIndex === 0 ? undefined : interopAllMarkers[stepIndex - 1];
      if (stepIndex !== 0 && marker === undefined) {
        return;
      }
      setInteropStepIndex(stepIndex);
      setInteropLoading(true);
      try {
        const resp = await dispatch(NftsByAdressDetail(marker));
        if (resp) {
          if (resp.allMarkers?.length) {
            setInteropAllMarkers(resp.allMarkers);
          }
          const data = await getIntropabilityData(resp);
          const processed = await Promise.all(data);
          setRemainingNft((prev) => ({
            allNfts: processed,
            allMarkers: resp.allMarkers?.length
              ? resp.allMarkers
              : prev?.allMarkers ?? [],
            totalNfts: resp.totalNfts,
            mkrId: resp.mkrId
          }));
        }
      } finally {
        setInteropLoading(false);
      }
    },
    [dispatch, getIntropabilityData, interopAllMarkers]
  );

  // useMemo(async () => {
  //   if (allNftDetails !== null) {

  // }, [allNftDetails]); // eslint-disable-line

  // const displayCardDetails = (e, id) => {
  //   e.stopPropagation();
  //   e.preventDefault();
  //   const idList = activeId;
  //   if (idList.includes(id)) {
  //     const filterData = idList.filter((item) => item !== id);
  //     setActiveID(filterData);
  //   } else {
  //     setActiveID([...activeId, id]);
  //   }
  // };

  /*for profile image in card and profile name */
  useEffect(() => {
    dispatch(getProfileAction({ wAddress: "" }))
      .then((pDetail) => {
        setAllProfile(pDetail.data.allProfile);
      })
      .catch((err) => console.log(err, "pdetails error"));
  }, []); // eslint-disable-line

  return (
    <React.Fragment>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className={`gradientBg ${layout ? "myNFT" : ""}`}>
          <>
            <Container className="content-container">
              <Row className="auth-wrapper ownNftSection m-0">
                <Col xs={12} md={12} className="padding-top-bottom-25 pb-0">
                  <Row>
                    <Col xs={6} md={12} className="text-left text-md-center">
                      <span className="mynftText justify-content-end">
                        <h3 className="">Own NFTs</h3>
                      </span>
                    </Col>
                    <Col
                      xs={6}
                      md={6}
                      className="d-flex justify-content-end align-items-center d-md-none d-lg-none d-xl-none"
                    >
                      <ToggleButtonGroup
                        type="radio"
                        name="options"
                        defaultValue={1}
                        className="toggleBtn"
                      >
                        <ToggleButton
                          id="tbg-radio-1"
                          value={1}
                          onClick={() => {
                            setLayout(false);
                          }}
                        >
                          <i className="fa fa-list" aria-hidden="true"></i>
                        </ToggleButton>
                        <ToggleButton
                          id="tbg-radio-2"
                          value={2}
                          onClick={() => {
                            setLayout(true);
                          }}
                        >
                          <i className="fa fa-th" aria-hidden="true"></i>
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </Col>
                  </Row>
                </Col>
                <br />
                <Col xs={12} md={12}>
                  {!list ? (
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
                  ) : list?.docs?.length === 0 ? (
                    <Row>
                      <p className="text-center"> {MessageConst.NoDataFound}</p>
                    </Row>
                  ) : (
                    <Row className="ownNft m-md-0">
                      {/* ?.sort((a, b) =>
                          (
                            a.name.indexOf("#") != -1 &&
                            b.name.indexOf("#") != -1
                              ? parseInt(a.name.split("#")[1]) >
                                parseInt(b.name.split("#")[1])
                              : a.name > b.name
                          )
                            ? 1
                            : -1
                        )
                        ?. */}
                      {sortByTitleASCOrder(list?.docs)
                        // ?.filter((vl) => vl.name)
                        // ?.sort((a, b) => (a.name > b.name ? 1 : -1))
                        // ?
                        .map((post) => (
                          <Col
                            lg={4}
                            md={6}
                            xs={layout ? 4 : 12}
                            key={post._id}
                            className={``}
                          >
                            <Card
                              className={`${
                                post.isMintOffer ? "offermint" : post.status
                              } ${
                                layout ? "p-md-3 " : "p-3"
                              } customShado mb-3 mb-lg-5 mb-md-5 bg-white rounded shadowcstm corner-ribbon`}
                            >
                              <div className="top-left-view">
                                <img
                                  alt=""
                                  src={
                                    allProfile?.find(
                                      (vl) =>
                                        vl.wAddress === post?.accountNumber
                                    )?.pImage === null
                                      ? DummyProfile
                                      : allProfile
                                          ?.find(
                                            (vl) =>
                                              vl.wAddress ===
                                              post?.accountNumber
                                          )
                                          ?.pImage?.startsWith("https://ipfs")
                                      ? replaceHost(
                                          allProfile?.find(
                                            (vl) =>
                                              vl.wAddress ===
                                              post?.accountNumber
                                          )?.pImage
                                        )
                                      : `${
                                          configData.LOCAL_API_URL +
                                          allProfile?.find(
                                            (vl) =>
                                              vl.wAddress ===
                                              post?.accountNumber
                                          )?.pImage
                                        }`
                                  }
                                  className="img-circle-view"
                                />
                                <p className="top-left-text">
                                  {token !== null ? (
                                    <Link
                                      to={"/Profile/" + post?.accountNumber}
                                    >
                                      {post?.accountNumber.substring(0, 9)}{" "}
                                      *****{" "}
                                      {post?.accountNumber.substring(
                                        post?.accountNumber.length - 5
                                      )}
                                    </Link>
                                  ) : (
                                    `${post?.accountNumber.substring(
                                      0,
                                      9
                                    )} *****
                               ${post?.accountNumber.substring(
                                 post?.accountNumber.length - 5
                               )}`
                                  )}
                                </p>
                              </div>

                              <div className="card-img-overlay-custome likeCount">
                                <div>
                                  <p className="d-flex align-items-center">
                                    <Like
                                      post={post?.likes_data}
                                      id={post?._id}
                                    />
                                  </p>
                                </div>
                              </div>
                              {/* <Dropdown.Item
                                className="onwfilea"
                                href={"../Nftdetail/" + post._id}
                              > */}
                              <div
                                onClick={() => {
                                  navigate("/Nftdetail/" + post._id);
                                }}
                              >
                                <Filetype
                                  fileType={post.contentType}
                                  image={post.image}
                                  layout={layout}
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
                                        ).pImage.startsWith("https://ipfs")
                                        ? replaceHost(
                                            getProfileDetails(
                                              allProfile,
                                              allMintedNfts,
                                              post.NFTokenID
                                            ).pImage
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
                                            ).pImage
                                          }`
                                        : DummyProfile
                                      : DummyProfile
                                  }
                                />
                              </div>
                              {/* </Dropdown.Item> */}
                              <Card.Body>
                                <div className="body-card">
                                  <Card.Title className="cardNFTName">
                                    {post.name
                                      ? post?.name?.length > 40
                                        ? post?.name?.substring(0, 40) + "..."
                                        : post?.name
                                      : "NA"}
                                  </Card.Title>
                                  <p className="body-cart-para">
                                    {(() => {
                                      const IssuerToken = allMintedNfts?.find(
                                        (vl) => vl.NFTokenID === post.NFTokenID
                                      );
                                      if (IssuerToken?.Issuer !== undefined) {
                                        if (token !== null) {
                                          return (
                                            <Link
                                              to={
                                                "/Profile/" +
                                                IssuerToken?.Issuer
                                              }
                                            >
                                              {IssuerToken.Issuer.substring(
                                                0,
                                                9
                                              ) +
                                                " ***** " +
                                                IssuerToken.Issuer.substring(
                                                  IssuerToken.Issuer.length - 5
                                                )}
                                            </Link>
                                          );
                                        } else {
                                          return (
                                            IssuerToken.Issuer.substring(0, 9) +
                                            " ***** " +
                                            IssuerToken.Issuer.substring(
                                              IssuerToken.Issuer.length - 5
                                            )
                                          );
                                        }
                                      } else {
                                        return (
                                          <span className="issuer-cls">
                                            N/A
                                          </span>
                                        );
                                      }
                                    })()}
                                    <div className="token-badge customTokenbadge">
                                      <img src={tokenbadge} alt="" />
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

                                {/* <div
                                className={
                                  activeId.includes(post._id)
                                    ? "cardnft-text card-h"
                                    : "cardnft-text card-h0"
                                }
                              > */}
                                {/* <div className="badgeBox">
                                  <Card.Text className="text-center d-flex w-100 mb-0">
                                    <b className="boldhead text-left">
                                      Token
                                    </b>
                                    <span className="cardNFTBYACount text-left ml-3">
                                      {" "}
                                      {post.currency}
                                    </span>
                                  </Card.Text>

                                </div> */}

                                {/* <Card.Text className="text-center d-flex w-100 mb-0">
                                  <b className="boldhead text-left">Price</b>
                                  <span className="cardNFTBYACount text-left ml-3">
                                    {" "}
                                    {post.price}
                                  </span>
                                </Card.Text> */}

                                {/* <Card.Text className="text-center d-flex w-100 mb-0">
                                  <b className="boldhead text-left">Issuer</b>
                                  <span className="cardNFTBYACount text-left ml-3">
                                  </span>
                                </Card.Text> */}

                                {/* <div className="badgeBox">
                                  <Card.Text className="text-center d-flex w-100 mb-0">
                                    <b className="boldhead text-left">
                                      Profile
                                    </b>
                                    <span className="cardNFTBYACount text-left ml-3">
                                      {getProfileDetails(allProfile, allMintedNfts, post.NFTokenID).pName}
                                    </span>
                                  </Card.Text>
                                </div> */}

                                {/* <Card.Text className="text-center d-flex w-100">
                                  <b className="boldhead text-left">Owner</b>
                                  <span className="cardNFTBYACount text-left ml-3">

                                    {token !== null ? <Link to={"/Profile/" + post?.accountNumber}>
                                      {post.accountNumber.substring(0, 9)} *****{" "}
                                      {post.accountNumber.substring(
                                        post.accountNumber.length - 5
                                      )}
                                    </Link>
                                      : `${post.accountNumber.substring(0, 9)} *****
                               ${post.accountNumber.substring(
                                        post.accountNumber.length - 5
                                      )}`}

                                  </span>
                                </Card.Text> */}
                                {/* </div> */}
                              </Card.Body>
                            </Card>
                          </Col>
                        ))}
                    </Row>
                  )}
                </Col>
              </Row>
              <Row className="mx-auto">
                <Col md={12} xs={12} className="text-right">
                  {!!list && list.totalPages > 1 && (
                    <PaginationComponent
                      currentPage={page}
                      totalPages={list.totalPages}
                      loading={loadPage}
                      onPageChange={(pageNum) => setPage(pageNum)}
                    />
                  )}
                  {/* {!!list && list.totalPages > 1 && (
                    <Pagination>
                      {list?.hasPrevPage ? (
                        <Pagination.First onClick={() => handlePagination(1)} />
                      ) : (
                        <Pagination.First disabled />
                      )}
                      {list?.prevPage !== null ? (
                        <Pagination.Prev
                          onClick={() => handlePagination(list?.prevPage)}
                        />
                      ) : (
                        <Pagination.Prev disabled />
                      )}

                      {Array.from(Array(list?.totalPages).keys()).map(
                        (i, index) => {
                          return (
                            <Pagination.Item
                              key={index}
                              className={page === i + 1 ? "active" : ""}
                              onClick={() => handlePagination(i + 1)}
                            >
                              {i + 1}
                            </Pagination.Item>
                          );
                        }
                      )}

                      {list?.nextPage !== null ? (
                        <Pagination.Next
                          onClick={() => handlePagination(list?.nextPage)}
                        />
                      ) : (
                        <Pagination.Next disabled />
                      )}
                      {list?.totalPages === page ? (
                        <Pagination.Last disabled />
                      ) : (
                        <Pagination.Last
                          onClick={() => handlePagination(list?.totalPages)}
                        />
                      )}
                    </Pagination>
                  )} */}
                </Col>
              </Row>

              {/* Other Nft Details */}
              <Row className="auth-wrapper ownNftSection m-0" id="mg-top">
                {!!remainingNFt && (
                  <Col xs={12} md={12} className="padding-top-bottom-25">
                    <hr
                      style={{
                        color: "black",
                        backgroundColor: "black",
                        height: 5
                      }}
                    />
                    {/* <span className="mynftText">
                    <h3 className="nft-details">Externally minted NFTs</h3>
                  </span> */}
                  </Col>
                )}
                {/* <br /> */}

                {!!remainingNFt ? (
                  <>
                    {interopStepCount > 1 && (
                      <Col xs={12} md={6} lg={3} className="mb-4">
                        <Form.Group controlId="interop-marker-step">
                          <Form.Label className="text-black">
                            Select the page to load more NFTs
                          </Form.Label>
                          <Form.Select
                            value={interopStepIndex}
                            onChange={(e) =>
                              loadInteropStep(Number(e.target.value))
                            }
                            disabled={interopLoading}
                          >
                            {Array.from(
                              { length: interopStepCount },
                              (_, idx) => (
                                <option key={idx} value={idx}>
                                  Page {idx + 1}
                                </option>
                              )
                            )}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    )}
                    <Col xs={12}>
                      {interopLoading ? (
                        <h4 style={{ textAlign: "center", color: "black" }}>
                          Loading...
                        </h4>
                      ) : (
                        <Interoperability
                          data={remainingNFt?.allNfts ?? []}
                          layout={layout}
                          allProfile={allProfile}
                        />
                      )}
                    </Col>
                  </>
                ) : loading ? (
                  <div className={loading ? "" : ""}>
                    <h4 style={{ textAlign: "center", color: "black" }}>
                      Loading NFTs...
                    </h4>
                    {/* <HashLoader
                      sizeUnit="px"
                      size={100}
                      color="#329be3"
                      loading={loading}
                      cssOverride={override}
                    /> */}
                  </div>
                ) : null}
              </Row>
              {/* <Row>
              <Col md={12} xs={12} className="text-right">
                {list.totalPages > 1 && (
                  <Pagination>
                    {list?.hasPrevPage ? (
                      <Pagination.First onClick={() => handlePagination(1)} />
                    ) : (
                      <Pagination.First disabled />
                    )}
                    {list?.prevPage !== null ? (
                      <Pagination.Prev
                        onClick={() => handlePagination(list?.prevPage)}
                      />
                    ) : (
                      <Pagination.Prev disabled />
                    )}

                    {Array.from(Array(list?.totalPages).keys()).map((i) => {
                      return (
                        <Pagination.Item
                          className={page === i + 1 ? "active" : ""}
                          onClick={() => handlePagination(i + 1)}
                        >
                          {i + 1}
                        </Pagination.Item>
                      );
                    })}

                    {list?.nextPage !== null ? (
                      <Pagination.Next
                        onClick={() => handlePagination(list?.nextPage)}
                      />
                    ) : (
                      <Pagination.Next disabled />
                    )}
                    {list?.totalPages === page ? (
                      <Pagination.Last disabled />
                    ) : (
                      <Pagination.Last
                        onClick={() => handlePagination(list?.totalPages)}
                      />
                    )}
                  </Pagination>
                )}
              </Col>
            </Row> */}
            </Container>
          </>
        </div>
      )}
      <Footer />
    </React.Fragment>
  );
}

export default Ownnft;
