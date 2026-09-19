import React, { useState, useEffect } from "react";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Card from "react-bootstrap/Card";
import Container from "react-bootstrap/Container";
import { Link } from "react-router-dom";
import Filetype from "../common/Filetype";
import {
  getProfileDetails,
  profileBatchColor
} from "../../helper/getProfileDetails";
import {
  getProfileAction,
  getProfileVScoreAction
} from "../../store/actions/profile";
import { useDispatch } from "react-redux";
import MessageConst from "../../const/message.json";
// import tokenbadge from "../../../src/assets/token.png";
import tokenbadge from "../../../src/assets/tokenimg.png";
import DummyProfile from "../../../src/assets/defaultpimage.jpg";
import * as Spinners from "react-loader-spinner";
import Like from "./like/like";
import { replaceHost } from "../../helper";

const Searchnft = ({ data, allMintedNfts }) => {
  const token = localStorage.getItem("jwtToken");
  let dispatch = useDispatch();

  const [activeId, setActiveID] = useState([]);
  const [allProfile, setAllProfile] = useState(null);
  const [layout, setLayout] = useState(false);

  const displayCardDetails = (e, id) => {
    e.stopPropagation();
    e.preventDefault();
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

  /* Code to get vscore of issuer address */
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
      <Container className="search-body">
        <Row className="auth-wrapper ownNftSection m-0">
          <Col xs={12} md={12}>
            {!data ? (
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
            ) : data?.length === 0 ? (
              <Row>
                <p className="text-center"> {MessageConst.NoDataFound}</p>
              </Row>
            ) : (
              <Row className="ownNft m-md-0">
                {data?.map((post) => (
                  <Col
                    lg={4}
                    md={6}
                    xs={layout ? 4 : 12}
                    key={post._id}
                    className={``}
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
                              : allProfile?.find(
                                  (vl) => vl.wAddress === post?.accountNumber
                                )?.pImage
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

                      <div className="card-img-overlay-custome likeCount">
                        <div>
                          <p className="d-flex align-items-center">
                            <Like post={post?.likes_data} id={post?._id} />
                          </p>
                        </div>
                      </div>
                      <Link
                        className="onwfilea"
                        to={"../Nftdetail/" + post._id}
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
                                ).pImage
                              : DummyProfile
                          }
                        />
                      </Link>

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
                                return <span className="issuer-cls">N/A</span>;
                              }
                            })()}
                            <div className="token-badge customTokenbadge">
                              <img src={tokenbadge} alt="" />
                            </div>
                            <div className="tick-badge customTickbadge">
                              {profileBatchColor(getVScore(post.NFTokenID))}
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
          </Col>
        </Row>
      </Container>
      {/* <div className="gradientBg pt-4">
        <Container className="search-body">
          {data.length === 0 ? (
            <Row>
              <p className="text-center"> {MessageConst.NoDataFound}</p>
            </Row>
          ) : (
            <Row className="">
              {data.map((post) => (
                <Col md={6} lg={4} xl={4} xs={12} key={post._id}>
                  <Link
                    className="a-link-display-none"
                    to={
                      post.status === "bidandburn" || post.status === "bid"
                        ? "/BidDetail/" + post._id
                        : "/Nftdetail/" + post._id
                    }
                  >
                    <Card
                      className={`${post.status} customShado p-3 mb-5 bg-white rounded shadowcstm corner-ribbon`}
                    >
                      <Filetype
                        fileType={post.contentType}
                        image={post.image}
                        profileImg={getProfileDetails(!!allProfile && allProfile, allMintedNfts, post.NFTokenID)?.pImage ? getProfileDetails(!!allProfile && allProfile, allMintedNfts, post.NFTokenID).pImage : DummyProfile}
                      />
                      <Card.Body>
                        <Card.Title className="text-center cardNFTName mb-2">
                          {post?.name?.length > 40
                            ? post?.name?.substring(0, 40) + "..."
                            : post?.name}
                        </Card.Title>
                        <div className="arrowdown-img mb-2">
                          <img onClick={(e) => displayCardDetails(e, post._id)} alt=""
                            src={
                              activeId.includes(post._id) ? arrowUp : arrowdown
                            }
                          />
                        </div>
                        <div
                          className={
                            activeId.includes(post._id)
                              ? "cardnft-text card-h"
                              : "cardnft-text card-h0"
                          }
                        >
                          <p className="text-center mb-0">
                            <b className="cardNFTBY boldhead text-left slider">
                              Issuer
                            </b>
                            <span className="cardNFTBYACount">
                              {(() => {
                                const IssuerToken = allMintedNfts.find(
                                  (vl) => vl.NFTokenID === post.NFTokenID
                                );
                                if (IssuerToken?.Issuer !== undefined) {
                                  if(token !== null){
                                    return <Link to={"/Profile/" + IssuerToken?.Issuer}>{IssuerToken.Issuer.substring(0, 9) + " ***** " + IssuerToken.Issuer.substring(IssuerToken.Issuer.length - 5)}</Link>
                                  }else{
                                    return IssuerToken.Issuer.substring(0, 9) + " ***** " + IssuerToken.Issuer.substring(IssuerToken.Issuer.length - 5)
                                  }                                   
                                } else {
                                  return "N/A";
                                }
                              })()}
                            </span>
                          </p>

                          <div className="badgeBox">
                            <p className="text-center mb-0">
                              <b className="boldhead text-left slider">
                                Token{" "}
                              </b>
                              <span className="cardNFTBYACount">
                                {" "}
                                {post.currency}{" "}
                              </span>
                            </p>

                            <div className="token-badge customTokenbadge">
                              <img alt="" src={tokenbadge} />
                            </div>
                          </div>

                          <p className="text-center mb-0">
                            <b className="boldhead text-left slider">Price </b>
                            <span className="cardNFTBY">{post.price}</span>
                          </p>

                          <div className="badgeBox">
                            <p className="text-center mb-0">
                              <b className="boldhead text-left slider">
                                Profile
                              </b>
                              <span className="cardNFTBY">  
                              {getProfileDetails(allProfile, allMintedNfts, post.NFTokenID).pName}
                             </span>
                            </p>

                            <div className="tick-badge customTickbadge">
                            {profileBatchColor(getVScore(post.NFTokenID))}
                            </div>
                          </div>

                          <p className="text-center mb-0">
                            <b className="boldhead text-left slider">Owner</b>
                            <span className="cardNFTBY">

                            {token !== null ? <Link to={"/Profile/" + post?.accountNumber}>
                                {post.accountNumber.substring(0, 9)} *****{" "}
                                {post.accountNumber.substring(
                                  post.accountNumber.length - 5
                                )}
                                </Link>
                                 :  `${post.accountNumber.substring(0, 9)} *****
                               ${post.accountNumber.substring(
                                  post.accountNumber.length - 5
                                )}`}
                            </span>
                          </p>
                        </div>
                      </Card.Body>
                    </Card>
                  </Link>
                </Col>
              ))}
            </Row>
          )}
        </Container>
      </div> */}
    </React.Fragment>
  );
};

export default Searchnft;
