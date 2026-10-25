import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Link } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Header from "../common/header";
import Footer from "../common/footer";
import Pagination from "react-bootstrap/Pagination";
import axios from "axios";
import configData from "../../config.json";
import { Category } from "../../const/category.js";
import MessageConst from "../../const/message.json";
import Filetype from "../common/Filetype";
import ToggleButton from "react-bootstrap/ToggleButton";
import ToggleButtonGroup from "react-bootstrap/ToggleButtonGroup";
import Like from "./like/like";
import { getProfileDetails } from "../../helper/getProfileDetails";
import { profileBatchColor } from "../../helper/getProfileDetails";
import { useDispatch, useSelector } from "react-redux";
import {
  getProfileAction,
  getProfileVScoreAction
} from "../../store/actions/profile";
// import arrowdown from "../../../src/assets/down-arrow.png";
// import arrowUp from '../../../src/assets/up-arrow.png';
import tokenbadge from "../../../src/assets/tokenimg.png";
import * as Spinners from "react-loader-spinner";

// import tickbadge from '../../../src/assets/tick.png';

// Dummy Image
import DummyProfile from "../../assets/defaultpimage.jpg";
import { replaceHost } from "../../helper/index.js";

function Nftlist() {
  const token = localStorage.getItem("jwtToken");
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [allMintedNfts, setAllMintedNFts] = useState(null);
  const [page, setPage] = useState(1);
  const [defaultPage, setDefaultPage] = useState(null); // eslint-disable-line
  const [catType, setCatType] = useState(null);
  const [searchKey, setSearchKey] = useState(true);
  const [layout, setLayout] = useState(false);
  let { type } = useParams();
  const [likeReducer] = useSelector((state) => [state.nftLikeReducer]);
  const changePage = localStorage.getItem("page");
  const [activeId, setActiveID] = useState([]);
  const [allProfile, setAllProfile] = useState(null);
  let dispatch = useDispatch();

  const handleChange = (e) => {
    setCatType(e.target.value);
    if (!!changePage) {
      localStorage.removeItem("page");
    }
    setPage(1);
  };

  const handlePageChange = (status, Id) => {
    if (!changePage && catType === null) {
      localStorage.setItem("page", page);
    }
    if (status === "bidandburn" || status === "bid") {
      return navigate("/BidDetail/" + Id);
    } else {
      return navigate("/Nftdetail/" + Id);
    }
  };
  const handlePagination = (e) => {
    if (!!changePage) {
      localStorage.removeItem("page");
    }
    setPage(e);
  };

  useEffect(() => {
    (async () => {
      try {
        let data = {
          type: type,
          category: catType === "all" ? null : catType,
          page:
            changePage === null
              ? page === null
                ? 1
                : page
              : Number(changePage)
        };

        let res = await axios.post(
          `${configData.LOCAL_API_URL}nft/getAllNftList/`,
          data
        );
        if (res.data.success) {
          setAllMintedNFts(res.data.allMintedNft);
          setTimeout(() => {
            setList(res.data.data);
          }, 1000);
        }
      } catch (error) {
        toast.error(error.response.data.message, {
          toastId: "updateProfile3" + Date.now()
        });
      }
    })();
  }, [catType, page, likeReducer, defaultPage]); // eslint-disable-line

  const createPaginationItem = (i) => {
    return (
      <Pagination.Item
        boundaryLinks="true"
        className={
          changePage === null
            ? i === page
              ? "active"
              : ""
            : i === Number(changePage)
            ? "active"
            : ""
        }
        onClick={() => handlePagination(i)}
      >
        {i}
      </Pagination.Item>
    );
  };

  const paginationItems = [];
  // Add the first item (page 1)
  list?.totalPages > 5 && paginationItems.push(createPaginationItem(1));
  // Add the first ellipsis
  list?.totalPages > 5 && paginationItems.push(<Pagination.Ellipsis />);
  // Create page numbers in the middle (10-14)

  const midpoint = Math.ceil(list?.totalPages / 2);

  for (
    let i = list?.totalPages > 5 ? midpoint : 1;
    i <= (list?.totalPages > 5 ? midpoint + 4 : list?.totalPages);
    i++
  ) {
    paginationItems.push(createPaginationItem(i));
  }
  // Add the second ellipsis
  list?.totalPages > 5 && paginationItems.push(<Pagination.Ellipsis />);
  // Add the last item (page 20)
  list?.totalPages > 5 &&
    paginationItems.push(createPaginationItem(list?.totalPages));

  const displayCardDetails = (e, id) => {
    e.stopPropagation();
    const idList = activeId;
    if (idList.includes(id)) {
      const filterData = idList.filter((item) => item !== id);
      setActiveID(filterData);
    } else {
      setActiveID([...activeId, id]);
    }
  };

  /*for profile image in card and profile name */
  useEffect(() => {
    dispatch(getProfileAction({ wAddress: "" }))
      .then((pDetail) => {
        setAllProfile(pDetail.data.allProfile);
      })
      .catch((err) => console.log(err, "pdetails error"));
  }, []); // eslint-disable-line

  const getVScore = (NFTokenID) => {
    const IssuerToken = allMintedNfts.find((vl) => vl.NFTokenID === NFTokenID);
    dispatch(getProfileVScoreAction({ wAddress: IssuerToken?.Issuer }))
      .then((vScorePoint) => {
        const { vPointDetails } = vScorePoint.data;
        return vPointDetails[0].totalVPoint;
      })
      .catch((err) => console.log(err, "vpoint error"));
  };

  return (
    <React.Fragment>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className={`gradientBg ${layout ? "myNFT" : ""} footerSection`}>
          <>
            <Container>
              <div className="auth-wrapper">
                <Row className="padding-top-bottom-25 ">
                  <Col xs={12} md={4}></Col>
                  <Col xs={12} md={4}>
                    <h3>NFTs List</h3>
                  </Col>
                  <Col xs={12} md={4} className="text-center mt-4 mt-md-0">
                    <Row>
                      <Col
                        xs={6}
                        md={5}
                        className="order-1 order-md-0 order-lg-0 text-right"
                      >
                        <div className="d-block d-md-none d-lg-none d-xl-none">
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
                        </div>
                      </Col>
                      <Col xs={6} md={7}>
                        <Form.Select
                          onChange={handleChange}
                          name="category"
                          aria-label="Default select example"
                        >
                          <option value="all">All Category</option>
                          {Category.map((cat, index) => (
                            <option key={index} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </Form.Select>
                      </Col>
                    </Row>
                  </Col>
                </Row>
              </div>
            </Container>
            <Container className="listImgSection">
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
                <Row>
                  {list?.docs?.map((post) => (
                    <Col
                      md={6}
                      lg={4}
                      xl={4}
                      xs={layout ? 4 : 12}
                      key={post._id}
                    >
                      <Card
                        className={`${post.status} ${
                          layout ? "p-md-3 " : "p-3"
                        } customShado mb-3 mb-lg-5 mb-md-5 bg-white rounded shadowcstm corner-ribbon`}
                      >
                        <div className="top-left-view">
                          <img
                            alt=""
                            src={
                              allProfile?.find(
                                (vl) => vl.wAddress === post?.accountNumber
                              )?.pImage === null
                                ? DummyProfile
                                : allProfile
                                    ?.find(
                                      (vl) =>
                                        vl.wAddress === post?.accountNumber
                                    )
                                    ?.pImage?.startsWith("https://ipfs")
                                ? replaceHost(
                                    allProfile?.find(
                                      (vl) =>
                                        vl.wAddress === post?.accountNumber
                                    )?.pImage
                                  )
                                : `${
                                    configData.LOCAL_API_URL +
                                    allProfile?.find(
                                      (vl) =>
                                        vl.wAddress === post?.accountNumber
                                    )?.pImage
                                  }`
                            }
                            className="img-circle-view"
                          />
                          <p className="top-left-text">
                            {token !== null ? (
                              <Link to={"/Profile/" + post?.accountNumber}>
                                {post?.accountNumber.substring(0, 9)} *****{" "}
                                {post?.accountNumber.substring(
                                  post?.accountNumber.length - 5
                                )}
                              </Link>
                            ) : (
                              `${post?.accountNumber.substring(0, 9)} *****
                               ${post?.accountNumber.substring(
                                 post?.accountNumber.length - 5
                               )}`
                            )}
                          </p>
                        </div>
                        {/* <div className="card-img-overlay-custome likeCount">
                          <div>
                         
                            <p className="d-flex align-items-center">
                            <Like post={post?.likes_data} id={post?._id} />
                            </p>
                          </div>
                        </div> */}
                        {/* <div> */}
                        {/* <Like post={post?.likes_data} id={post?._id} /> */}
                        {/* </div> */}

                        <div className="a-link-display-none">
                          <div
                            onClick={() =>
                              handlePageChange(post.status, post._id)
                            }
                            className="card-img"
                          >
                            <Filetype
                              fileType={post.contentType}
                              image={replaceHost(post.image)}
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
                          </div>

                          <Card.Body>
                            <div className="body-card">
                              <Card.Title className="cardNFTName">
                                {post?.name?.length > 40
                                  ? post?.name?.substring(0, 40) + "..."
                                  : post?.name !== undefined
                                  ? post?.name
                                  : "N/A"}
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
                                          {IssuerToken.Issuer.substring(0, 9) +
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
                                    return "N/A";
                                  }
                                })()}
                                <div className="token-badge customTokenbadge">
                                  <img alt="" src={tokenbadge} />
                                </div>
                                <div className="tick-badge customTickbadge">
                                  {profileBatchColor(getVScore(post.NFTokenID))}
                                </div>
                              </p>
                              <hr className="hr-cls" />
                              <p className="cardNFTBYACount">
                                {post.currency ? `${post.currency}` : "XRP"}
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
                              </p>
                              <p className="cardNFTBY">{post?.price}</p>
                            </div>

                            <div
                              className={
                                activeId.includes(post._id)
                                  ? "cardnft-text card-h"
                                  : "cardnft-text card-h0"
                              }
                            >
                              {/* <div className="badgeBox">
                                <p className="text-center mb-0">
                                  <b className="boldhead text-left">
                                    Token
                                  </b>
                                  <span className="cardNFTBYACount">
                                    {" "}
                                    {post.currency}{" "}
                                  </span>
                                </p>
                              </div>
 */}

                              <p className="text-center mb-0">
                                <b className="boldhead text-left">Price</b>
                                <span className="cardNFTBY">{post.price}</span>
                              </p>

                              <div className="badgeBox">
                                <p className="text-center mb-0">
                                  <b className="boldhead text-left">Profile</b>
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

                              {/* <p className="text-center">
                                <b className="boldhead text-left">
                                  Owner
                                </b>
                                <span className="cardNFTBY">

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
                              </p> */}
                            </div>
                          </Card.Body>
                        </div>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}

              <Row>
                <Col md={12} xs={11} className="text-right mx-auto">
                  {!!list && list.totalPages > 1 && (
                    <Pagination>
                      {list?.hasPrevPage ? (
                        <Pagination.First onClick={() => handlePagination(1)} />
                      ) : (
                        <Pagination.First disabled />
                      )}
                      {list?.prevPage !== null ? (
                        <Pagination.Prev
                          onClick={() => handlePagination(page - 1)}
                        />
                      ) : (
                        <Pagination.Prev disabled />
                      )}
                      {paginationItems}
                      {list?.nextPage !== null ? (
                        <Pagination.Next
                          onClick={() => handlePagination(page + 1)}
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
              </Row>
            </Container>
          </>
        </div>
      )}
      <Footer />
    </React.Fragment>
  );
}

export default Nftlist;
