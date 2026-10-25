import React, { useState } from "react";
import { Link } from "react-router-dom";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Card from "react-bootstrap/Card";
import MessageConst from "../../const/message.json";
import Filetype from "../common/Filetype";
// import arrowdown from "../../../src/assets/down-arrow.png";
// import arrowUp from "../../../src/assets/up-arrow.png";
import tokenbadge from "../../../src/assets/tokenimg.png";
import tickbadge from "../../../src/assets/tick.png";

// Dummy Image
import DummyProfile from "../../assets/defaultpimage.jpg";
// import { getProfileDetails } from "../../helper/getProfileDetails";
import configData from "../../config.json";
import { sortByTitleASCOrder } from "../../helper";

function RestNft(props) {
  const [searchKey, setSearchKey] = useState(true); // eslint-disable-line
  // const [activeId, setActiveID] = useState([]);

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
  return (
    <React.Fragment>
      {searchKey && (
        <>
          <Container className="px-3">
            <Row className="">
              <Col xs={12} md={12}>
                {props?.data?.length === 0 ? (
                  <Row>
                    <p className="text-center" key={1}>
                      {" "}
                      {MessageConst.NoDataFound}
                    </p>
                  </Row>
                ) : (
                  <Row className="ownNft">
                    {props?.data?.map((post) => (
                      <Col
                        lg={4}
                        md={6}
                        xs={props.layout ? 4 : 12}
                        key={post._id}
                      >
                        <Card
                          className={`${post.status} customShado ${
                            props.layout ? "p-md-3 " : "p-3"
                          } mb-3 mb-lg-5 mb-md-5 bg-white rounded shadowcstm corner-ribbon`}
                        >
                          <div className="top-left-view">
                            <img
                              alt=""
                              src={
                                props?.allProfile?.find(
                                  (vl) => vl.wAddress === post?.Issuer
                                )?.pImage
                                  ? props?.allProfile
                                      ?.find(
                                        (vl) =>
                                          vl.wAddress === post?.accountNumber
                                      )
                                      ?.pImage?.startsWith("https://ipfs")
                                    ? props?.allProfile?.find(
                                        (vl) =>
                                          vl.wAddress === post?.accountNumber
                                      )?.pImage
                                    : props?.allProfile
                                        ?.find(
                                          (vl) =>
                                            vl.wAddress === post?.accountNumber
                                        )
                                        ?.pImage?.startsWith("uploads/")
                                    ? `${
                                        configData.LOCAL_API_URL +
                                        props?.allProfile?.find(
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
                              {post?.owner?.substring(0, 9)} *****{" "}
                              {post?.owner?.substring(post?.owner?.length - 5)}
                            </p>
                          </div>
                          {/* <div className="card-img-overlay-custome likeCount">
                            <div>
                              <p className="d-flex align-items-center">
                                <div className="like-button liked">
                                  <span className="like-icon">
                                    <div className="heart-animation-1"></div>
                                    <div className="heart-animation-2"></div>
                                  </span>
                                </div>
                                <span className="fa-fa-font-white-text">
                                  0
                                </span>
                              </p>
                            </div>
                          </div> */}
                          <Link
                            className="onwfilea"
                            to={"../InteroperabilityDetail/" + post.NFTokenID}
                          >
                            <Filetype
                              fileType={post.contentType}
                              image={post.url}
                              profileImg={
                                props?.profileImg
                                  ? props?.profileImg?.startsWith(
                                      "https://ipfs"
                                    )
                                    ? props?.profileImg.pImage
                                    : props?.profileImg.startsWith("uploads/")
                                    ? `${
                                        configData.LOCAL_API_URL +
                                        props?.profileImg
                                      }`
                                    : DummyProfile
                                  : DummyProfile
                              }
                            />
                          </Link>
                          <Card.Body>
                            <div className="body-card">
                              <Card.Title className="cardNFTName">
                                {post?.name
                                  ? post?.name?.length > 40
                                    ? post?.name?.substring(0, 40) + "..."
                                    : post?.name
                                  : "N/A"}
                              </Card.Title>
                              <p className="body-cart-para">
                                {post?.Issuer?.substring(0, 9)} *****{" "}
                                {post?.Issuer?.substring(
                                  post?.Issuer?.length - 5
                                )}
                                <div className="token-badge customTokenbadge">
                                  <img src={tokenbadge} alt="" />
                                </div>
                                <div className="tick-badge customTickbadge">
                                  <img src={tickbadge} alt="" />
                                </div>
                              </p>

                              <hr className="hr-cls" />
                              <p className="cardNFTBYACount text-left ml-3">
                                {post.currency}
                              </p>
                              <p className="cardNFTBYACount text-left ml-3">
                                {post.amount}
                              </p>
                            </div>

                            {/* <div className="arrowdown-img mb-2">
                                <img alt="" onClick={(e) => displayCardDetails(e, post.nft_serial)}
                                  src={activeId.includes(post.nft_serial) ? arrowUp : arrowdown}
                                />


                                
                              </div> */}
                            {/* <div
                              className={
                                activeId.includes(post.nft_serial)
                                  ? "cardnft-text card-h"
                                  : "cardnft-text card-h0"
                              }
                            > */}
                            {/* <div className="badgeBox">
                                <Card.Text className="text-center d-flex w-100 mb-0">
                                  <b className="boldhead text-left">Token</b>

                                </Card.Text>


                              </div> */}

                            {/* <Card.Text className="text-center d-flex w-100 mb-0">
                                <b className="boldhead text-left">Price</b>

                              </Card.Text> */}
                            {/* <div className="badgeBox"> */}
                            {/* <Card.Text className="text-center d-flex w-100 mb-0">
                                  <b className="boldhead text-left">
                                    Profile
                                  </b>
                                  <span className="cardNFTBYACount text-left ml-3">
                                    N/A
                                  </span>
                              </Card.Text> */}

                            {/* </div> */}

                            {/* <Card.Text className="text-center d-flex w-100">
                                <b className="boldhead text-left">Owner</b>
                                <span className="cardNFTBYACount text-left ml-3">
                                  {post?.owner?.substring(0, 9)} *****{" "}
                                  {post?.owner?.substring(
                                    post?.owner?.length - 5
                                  )}
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
          </Container>
        </>
      )}
    </React.Fragment>
  );
}

export default RestNft;
