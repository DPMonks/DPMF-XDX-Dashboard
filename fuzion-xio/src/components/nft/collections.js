import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Container, Row, Col, Card, Dropdown } from "react-bootstrap";
import DummyProfile from "../../assets/defaultpimage.jpg";
import { Link } from "react-router-dom";
import Filetype from "../common/Filetype";
import { getProfileDetails } from "../../helper/getProfileDetails";
import tokenbadge from "../../../src/assets/tokenimg.png";
import * as Spinners from "react-loader-spinner";
import { useDispatch, useSelector } from "react-redux";
import configData from "../../config.json";
import { decodeToken } from "react-jwt";
// import Pagination from "react-bootstrap/Pagination";
import Header from "../common/header";

import Like from "./like/like";
import MessageConst from "../../const/message.json";
import { profileBatchColor } from "../../helper/getProfileDetails";

import {
  getProfileAction,
  getProfileVScoreAction
} from "../../store/actions/profile";

import { getNftsByCollection } from "../../store/actions/nftdetail";
import Footer from "../common/footer";
import { replaceHost } from "../../helper";
import { decodeBase64ToUnicode } from "../../helper";
import PaginationComponent from "../common/Pagination";

const COLLECTION_FILTERS = [
  { key: "all", label: "All NFTs", accentClass: "all" },
  {
    key: "created",
    label: "Available to Mint",
    accentClass: "mint"
  },
  {
    key: "minted",
    label: "Available for Offers",
    accentClass: "offers"
  },
  { key: "sale", label: "On Sale", accentClass: "sale" }
];

const MODEL_DRAG_THRESHOLD = 8;

const isInteractive3DType = (contentType) =>
  ["fbx", "gltf", "glb", "model"].includes(contentType);

const Collections = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = localStorage.getItem("jwtToken");
  const myDecodedToken = decodeToken(token);

  const [searchKey, setSearchKey] = useState(true);
  const [collections, setCollections] = useState(null);
  const [layout, setLayout] = useState(false);
  const [allProfile, setAllProfile] = useState(null);
  const [allMintedNfts, setAllMintedNfts] = useState(null);
  const [page, setPage] = useState(1);
  const [loadPage, setLoadPage] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const modelInteractionRef = useRef({});

  // get param from url bar
  const [searchParams] = useSearchParams();

  const [homedtl, likeStatus] = useSelector((state) => [
    state.homeDetailReducer,
    state.nftLikeReducer
  ]);

  // const handlePagination = (e) => {
  //   setPage(e);
  // };

  const getVScore = (NFTokenID) => {
    const IssuerToken = allMintedNfts?.find((vl) => vl.NFTokenID === NFTokenID);
    return dispatch(getProfileVScoreAction({ wAddress: IssuerToken?.Issuer }))
      .then((vScorePoint) => {
        if (vScorePoint) {
          const { vPointDetails } = vScorePoint?.data;
          return vPointDetails[0]?.totalVPoint;
        }
      })
      .catch((err) => console.log(err, "vpoint error"));
  };

  const bindVscoreData = async (data) => {
    return await Promise.all(
      data.docs.map(async (vl) => ({
        ...vl,
        vscore: vl?.NFTokenID ? await getVScore(vl.NFTokenID) : 0
      }))
    );
  };

  const handleModelPointerStart = useCallback((nftId, event) => {
    modelInteractionRef.current[nftId] = {
      x: event.clientX ?? event.touches?.[0]?.clientX ?? 0,
      y: event.clientY ?? event.touches?.[0]?.clientY ?? 0,
      moved: false
    };
  }, []);

  const handleModelPointerMove = useCallback((nftId, event) => {
    const interaction = modelInteractionRef.current[nftId];
    if (!interaction) return;

    const currentX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
    const currentY = event.clientY ?? event.touches?.[0]?.clientY ?? 0;

    if (
      Math.abs(currentX - interaction.x) > MODEL_DRAG_THRESHOLD ||
      Math.abs(currentY - interaction.y) > MODEL_DRAG_THRESHOLD
    ) {
      interaction.moved = true;
    }
  }, []);

  const handleModelPointerEnd = useCallback(
    (nftId, detailTarget) => {
      const interaction = modelInteractionRef.current[nftId];
      if (!interaction) return;

      if (!interaction.moved) {
        navigate(detailTarget.pathname, { state: detailTarget.state });
      }

      delete modelInteractionRef.current[nftId];
    },
    [navigate]
  );

  useEffect(() => {
    dispatch(getProfileAction({ wAddress: "" }))
      .then((pDetail) => {
        setAllProfile(pDetail.data.allProfile);
      })
      .catch((err) => console.log(err, "pdetails error"));
  }, []); // eslint-disable-line

  useEffect(() => {
    if (homedtl.nftDetail !== "") {
      const { allMintedNft } = homedtl.nftDetail;
      setAllMintedNfts(allMintedNft);
    }
  }, [homedtl]); // eslint-disable-line

  useEffect(() => {
    try {
      setLoadPage(true);
      dispatch(
        getNftsByCollection({
          page,
          collectionName: decodeBase64ToUnicode(searchParams.get("name")),
          wltAddress: searchParams.get("address"),
          activeFilter
        })
      ).then(async (resp) => {
        console.log(resp, "check the response data");
        const { success, data } = resp.data;
        if (success) {
          const finalData = await bindVscoreData(data);
          data.docs = finalData;
          setCollections(data);
        }
      });
    } catch (e) {
      console.log(e, "get my collections error");
    } finally {
      setLoadPage(false);
    }
  }, [page, likeStatus, activeFilter]);

  const isAvailableToMint = (post) =>
    normalizeStatus(post?.status) === "created";

  function normalizeStatus(status) {
    return String(status || "")
      .trim()
      .toLowerCase();
  }

  useEffect(() => {
    setPage(1);
  }, [activeFilter]);

  const activeFilterOption =
    COLLECTION_FILTERS.find((filter) => filter.key === activeFilter) ||
    COLLECTION_FILTERS[0];

  return (
    <React.Fragment>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className={`gradientBg ${layout ? "myNFT" : ""}`}>
          <br />
          <br />
          <Container className="container">
            <Row className="auth-wrapper ownNftSection m-0">
              <Col xs={12} md={12}>
                {!collections ? (
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
                ) : collections?.docs?.length === 0 ? (
                  <Row>
                    <p className="text-center"> {MessageConst.NoDataFound}</p>
                  </Row>
                ) : (
                  <>
                    <div className="collections-filter-bar">
                      <div className="collections-filter-dropdown">
                        <Dropdown
                          onSelect={(eventKey) =>
                            setActiveFilter(eventKey || "all")
                          }
                        >
                          <Dropdown.Toggle
                            id="collections-filter-dropdown"
                            className="collections-filter-toggle"
                          >
                            <span>{activeFilterOption.label}</span>
                          </Dropdown.Toggle>

                          <Dropdown.Menu className="collections-filter-menu">
                            {COLLECTION_FILTERS.map(
                              ({ key, label, accentClass }) => (
                                <Dropdown.Item
                                  key={key}
                                  eventKey={key}
                                  active={activeFilter === key}
                                  as="button"
                                  className="collections-filter-item"
                                >
                                  <span
                                    className={`collections-filter-dot ${accentClass}`}
                                  />
                                  <span>{label}</span>
                                </Dropdown.Item>
                              )
                            )}
                          </Dropdown.Menu>
                        </Dropdown>
                      </div>
                    </div>

                    {collections?.docs?.length === 0 ? (
                      <Row>
                        <p className="text-center">
                          No NFTs found for the selected filter.
                        </p>
                      </Row>
                    ) : (
                      <Row className="ownNft m-md-0">
                        {collections?.docs?.map((post) => (
                          <Col
                            lg={4}
                            md={6}
                            xs={layout ? 4 : 12}
                            key={post._id}
                            className={``}
                          >
                            <Card
                              className={`${
                                isAvailableToMint(post)
                                  ? "created"
                                  : post.status
                              } ${
                                layout ? "p-md-3 " : "p-3"
                              } customShado mb-3 mb-lg-5 mb-md-5 bg-white rounded shadowcstm corner-ribbon profile-ribbon`}
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
                                  {myDecodedToken !== null ? (
                                    <Link
                                      to={"/Profile/" + post?.accountNumber}
                                    >
                                      {post?.accountNumber?.substring(0, 9)}{" "}
                                      *****{" "}
                                      {post?.accountNumber?.substring(
                                        post?.accountNumber?.length - 5
                                      )}
                                    </Link>
                                  ) : (
                                    `${post?.accountNumber?.substring(
                                      0,
                                      9
                                    )} ***** ${post?.accountNumber?.substring(
                                      post?.accountNumber?.length - 5
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
                              {(() => {
                                const detailTarget = {
                                  pathname: `../Nftdetail/${post._id}`,
                                  state: {
                                    isValid:
                                      post?.accountNumber ===
                                      searchParams.get("address")
                                  }
                                };
                                const isInteractiveModel = isInteractive3DType(
                                  post.contentType
                                );
                                const profileImage = getProfileDetails(
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
                                  : DummyProfile;

                                if (isInteractiveModel) {
                                  return (
                                    <div
                                      className="onwfilea profile-nft"
                                      onMouseDown={(event) =>
                                        handleModelPointerStart(post._id, event)
                                      }
                                      onMouseMove={(event) =>
                                        handleModelPointerMove(post._id, event)
                                      }
                                      onMouseUp={() =>
                                        handleModelPointerEnd(
                                          post._id,
                                          detailTarget
                                        )
                                      }
                                      onMouseLeave={() => {
                                        delete modelInteractionRef.current[
                                          post._id
                                        ];
                                      }}
                                      onTouchStart={(event) =>
                                        handleModelPointerStart(post._id, event)
                                      }
                                      onTouchMove={(event) =>
                                        handleModelPointerMove(post._id, event)
                                      }
                                      onTouchEnd={() =>
                                        handleModelPointerEnd(
                                          post._id,
                                          detailTarget
                                        )
                                      }
                                    >
                                      <div className="onwfilea profile-nft">
                                        <Filetype
                                          fileType={post.contentType}
                                          image={replaceHost(post.image)}
                                          layout={layout}
                                          profileImg={profileImage}
                                        />
                                      </div>
                                    </div>
                                  );
                                }

                                return (
                                  <Link
                                    className="onwfilea profile-nft"
                                    to={detailTarget.pathname}
                                    state={detailTarget.state}
                                  >
                                    <div className="onwfilea profile-nft">
                                      <Filetype
                                        fileType={post.contentType}
                                        image={replaceHost(post.image)}
                                        layout={layout}
                                        profileImg={profileImage}
                                      />
                                    </div>
                                  </Link>
                                );
                              })()}

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
                                        if (myDecodedToken !== null) {
                                          return (
                                            <Link
                                              to={
                                                "/Profile/" +
                                                IssuerToken?.Issuer
                                              }
                                            >
                                              {IssuerToken?.Issuer?.substring(
                                                0,
                                                9
                                              ) +
                                                " ***** " +
                                                IssuerToken?.Issuer?.substring(
                                                  IssuerToken?.Issuer?.length -
                                                    5
                                                )}
                                            </Link>
                                          );
                                        } else {
                                          return (
                                            IssuerToken?.Issuer?.substring(
                                              0,
                                              9
                                            ) +
                                            " ***** " +
                                            IssuerToken?.Issuer?.substring(
                                              IssuerToken?.Issuer?.length - 5
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
                                    <div className="profile-collection token-badge customTokenbadge">
                                      <img src={tokenbadge} alt="" />
                                    </div>
                                    <div className="profile-cls tick-badge customTickbadge">
                                      {profileBatchColor(post?.vscore)}
                                    </div>
                                  </p>
                                  <hr className="hr-cls" />
                                  <p className="cardNFTBYACount">
                                    {post.currency ? `${post.currency}` : "XRP"}
                                  </p>
                                  <p className="cardNFTBY">{post?.price}</p>
                                </div>
                              </Card.Body>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    )}
                  </>
                )}
                <br />
                <Row className="mx-auto">
                  <Col md={12} xs={12} className="text-right">
                    {!!collections && collections.totalPages > 1 && (
                      <>
                        <PaginationComponent
                          currentPage={page}
                          totalPages={collections.totalPages}
                          loading={loadPage}
                          onPageChange={(pageNum) => setPage(pageNum)}
                        />
                        <br />
                      </>
                      // <Pagination>
                      //   {collections?.hasPrevPage ? (
                      //     <Pagination.First
                      //       onClick={() => handlePagination(1)}
                      //     />
                      //   ) : (
                      //     <Pagination.First disabled />
                      //   )}
                      //   {collections?.prevPage !== null ? (
                      //     <Pagination.Prev
                      //       onClick={() =>
                      //         handlePagination(collections?.prevPage)
                      //       }
                      //     />
                      //   ) : (
                      //     <Pagination.Prev disabled />
                      //   )}

                      //   {Array.from(Array(collections?.totalPages).keys()).map(
                      //     (i, index) => {
                      //       return (
                      //         <Pagination.Item
                      //           key={index}
                      //           className={page === i + 1 ? "active" : ""}
                      //           onClick={() => handlePagination(i + 1)}
                      //         >
                      //           {i + 1}
                      //         </Pagination.Item>
                      //       );
                      //     }
                      //   )}
                      //   {collections?.nextPage !== null ? (
                      //     <Pagination.Next
                      //       onClick={() =>
                      //         handlePagination(collections?.nextPage)
                      //       }
                      //     />
                      //   ) : (
                      //     <Pagination.Next disabled />
                      //   )}
                      //   {collections?.totalPages === page ? (
                      //     <Pagination.Last disabled />
                      //   ) : (
                      //     <Pagination.Last
                      //       onClick={() =>
                      //         handlePagination(collections?.totalPages)
                      //       }
                      //     />
                      //   )}
                      // </Pagination>
                    )}
                  </Col>
                </Row>
              </Col>
            </Row>
          </Container>
        </div>
      )}
      <Footer />
    </React.Fragment>
  );
};

export default Collections;
