import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Container from "react-bootstrap/Container";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import Header from "../common/header";
import Footer from "../common/footer";
import { useJwt } from "react-jwt";
import { BeatLoader } from "react-spinners";
import ReCAPTCHA from "react-google-recaptcha";
import { CountdownCircleTimer } from "react-countdown-circle-timer";

import { useDispatch, useSelector } from "react-redux";
import { bidDetailAction, antiBotAction } from "../../store/actions/biddetail";
import MessageConst from "../../const/message.json";

function BidDetail() {
  const token = localStorage.getItem("jwtToken");
  const { decodedToken } = useJwt(token);
  const [nft, setNft] = useState({}); // set value for nft detail
  const [mintinfo, setMintinfo] = useState({}); // eslint-disable-line
  // set value for nft minted detail
  const [currentBidData, setCurrentBid] = useState({}); // eslint-disable-line
  // set value for current Bid detail
  const [highestBidData, setHighestBid] = useState([]); // set value for highest Bid detail
  const [seconds, setSeconds] = useState("00:00"); // set value for timer detail
  const [captchaValue, setCaptchvalue] = useState(null);
  const [isPlaying, setIsplayingtimer] = useState(true);
  const [isTimeOut, setTimeOut] = useState(false);
  const navigate = useNavigate(); // eslint-disable-line
  let getParams = useParams();
  let dispatch = useDispatch();

  ///////////////// REDUCER //////////////
  const [nftdtl, antiBotData] = useSelector((state) => [
    state.bidDetailReducer,
    state.antiBotReducer
  ]);
  /////////////////// REDUCER ALL DATA //////////////////

  /////////////////// REDUCER ALL DATA //////////////////
  useEffect(() => {
    if (nftdtl.nftDetail !== "") {
      const { data, minData, highestBid, currentBid } = nftdtl.nftDetail;
      setNft(data);
      setMintinfo(minData);
      setHighestBid(highestBid);
      setCurrentBid(currentBid);
    }
  }, [nftdtl]);
  ////////////////////////  ALL DATA FATCH ONLOAD START///////

  ///////////////////////// HANDERLER CAPTCHA START///////////////
  const handleRecaptcha = (value) => {
    setCaptchvalue(value);
  };

  ///////////////////////// HANDERLER CAPTCHA START///////////////

  ////////////////////////  FOR ANTI BOT START ///////

  useEffect(() => {
    if (antiBotData.error === false) {
      toast.success(antiBotData.antiBot.message, {
        toastId: "salemsg1" + Date.now()
      });
      setTimeout(() => {
        window.location.reload(true);
      }, 5000);
    } else if (antiBotData.error !== null) {
      toast.error(antiBotData.error.message, {
        toastId: "salemsg2" + Date.now()
      });
    } else {
    }
  }, [antiBotData.error]); // eslint-disable-line
  ////////////////////////  FOR ANTI BOT END ///////

  ////////////////////////  FOR ANTI BOT DISPACH START ///////
  const antiBot = async () => {
    if (decodedToken === null) {
      toast.warn(MessageConst.errorConnectXummWallet, {
        toastId: "antiBot12" + Date.now()
      });
      return;
    }
    let amount = document.getElementById("amountbox_id").value;
    if (amount === "") {
      toast.warn(MessageConst.warningEnterAmount, {
        toastId: "amountantiBot12" + Date.now()
      });
      return;
    }
    if (parseInt(nft.price) > parseInt(amount)) {
      toast.warn(`Please Enter more than ${nft.price}`, {
        toastId: "amountantiBot12" + Date.now()
      });
      return;
    }
    if (isTimeOut === false) {
      toast.warn(MessageConst.warningAntiBotTimeout, {
        toastId: "isTimeOut111" + Date.now()
      });
      return;
    }
    if (captchaValue === null) {
      toast.warn(MessageConst.invalidCaptcha, {
        toastId: "captchaValue12" + Date.now()
      });
      return;
    }
    try {
      let data = {
        _id: nft._id,
        amount: amount
      };
      dispatch(antiBotAction({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "buynft1" + Date.now()
      });
    }
  };
  ////////////////////////  FOR ANTI BOT DISPACH END ///////

  ////////////////////////  ALL DATA FATCH ONLOAD START///////
  useEffect(() => {
    try {
      let itemID = getParams.id;
      dispatch(bidDetailAction({ itemID, loader: true }));
    } catch (error) {
      toast.error(error.response.data.message, {
        toastId: "Nftdetail1111" + Date.now()
      });
    }
  }, [getParams.id]); // eslint-disable-line
  // ////////////////////////  ALL DATA FATCH ONLOAD END///////

  /////////////TIMER START/////////////////

  const formatRemainingTime = (time) => {
    if (time <= 300) {
      const minutes = Math.floor((time % 3600) / 60);
      const seconds = time % 60;
      if (seconds > 0) {
        setTimeOut(true);
        let val = JSON.stringify({
          message: MessageConst.remainingTime,
          time: `${minutes}:${seconds}`
        });
        return val;
      } else if (minutes > 0) {
        setTimeOut(true);
        let val = JSON.stringify({
          message: MessageConst.remainingTime,
          time: `${minutes}:${seconds}`
        });
        return val;
      } else {
        setTimeOut(false);
        let val = JSON.stringify({
          message: MessageConst.bidTimeOut,
          time: `00:00`
        });
        return val;
      }
    } else {
      time = Number(time - 300);
      var h = Math.floor(time / 3600);
      var m = Math.floor((time % 3600) / 60);
      var s = Math.floor((time % 3600) % 60);

      var hDisplay = h > 0 ? h : 0;
      var mDisplay = m > 0 ? m : 0;
      var sDisplay = s > 0 ? s : 0;
      setTimeOut(false);

      let val = JSON.stringify({
        message: MessageConst.bidComein,
        time: `${hDisplay}:${mDisplay}:${sDisplay}`
      });
      return val;
    }
  };

  const renderTime = ({ remainingTime }) => {
    const obj = JSON.parse(formatRemainingTime(remainingTime));
    return (
      <div className="timer">
        <div className="text">{obj.message} </div>
        <div className="value">{obj.time}</div>
      </div>
    );
  };

  let secondTime = parseInt("00:00");
  useEffect(() => {
    let bidExpTimeDb = 0;
    if (nft.status === "bid") {
      bidExpTimeDb = new Date(nft.bidDateAndTime);
    } else if (nft.status === "bidandburn") {
      bidExpTimeDb = new Date(nft.updatedAt);
    }
    let crntTime = new Date();
    let bidExpTime = 0;
    if (nft.status === "bid") {
      bidExpTime = bidExpTimeDb.setMinutes(bidExpTimeDb.getMinutes() + 5);
    } else if (nft.status === "bidandburn") {
      bidExpTime = bidExpTimeDb.setMinutes(bidExpTimeDb.getMinutes() + 2);
    }
    if (bidExpTime > crntTime) {
      let diffTime = Math.abs(bidExpTime - crntTime);
      secondTime = (diffTime / 1000).toFixed(0); // eslint-disable-line
    }
    setSeconds(secondTime);
  }, [nft.updatedAt, secondTime]); // eslint-disable-line

  /////////////TIMER END///////////////////////

  return (
    <React.Fragment>
      <Header />
      <Container className="content-container">
        <Row className="auth-wrapper App align-items-center">
          <Col xs={12} md={12}>
            <Row>
              <Col xs={12} md={4}></Col>
              <Col xs={12} md={4}>
                <div className="timer">
                  {/* {" "} */}
                  <div className="timer-wrapper">
                    <CountdownCircleTimer
                      isPlaying={isPlaying}
                      duration={seconds}
                      colors={[
                        ["#004777", 0.33],
                        ["#F7B801", 0.33],
                        ["#A30000"]
                      ]}
                      onComplete={() => setIsplayingtimer(false)}
                    >
                      {renderTime}
                    </CountdownCircleTimer>
                  </div>
                </div>
              </Col>
              <Col xs={12} md={4}></Col>
            </Row>
            <Row>
              <Col
                xs={12}
                md={12}
                className="text-center NFTokenID NFTokenIDcustom"
              >
                TOKEN ID : {nft?.NFTokenID}
              </Col>
              <br />
            </Row>
            <Row>
              <Col xs={12} md={4}>
                {highestBidData.length > 0 ? (
                  <div className="token-info overflowScroller">
                    {highestBidData.map((post) => (
                      <div>
                        ACCOUNT
                        <br />
                        <span className="p-color-bid">
                          {" "}
                          {post?.bidByAccount}
                        </span>{" "}
                        <br />
                        PRICE <br />
                        <span className="p-color-bid">
                          {post?.bidAmount / 1000000}
                        </span>{" "}
                        <br />
                        NFT OWNER
                        <br />
                        <span className="p-color-bid">
                          {" "}
                          {post?.NFTOwner}
                        </span>{" "}
                        <br />
                        NFT OFFER INDEX <br />
                        <span className="p-color-bid">
                          {" "}
                          {post?.NFTOwner}
                        </span>{" "}
                        <br />
                        DATE AND TIME
                        <br />
                        <span className="p-color-bid"> {post?.createdAt}</span>
                        <hr className="hr-style" />
                      </div>
                    ))}
                  </div>
                ) : (
                  ""
                )}
                <br />
                <div className="highest-offer">Highest Offer</div>
              </Col>
              <Col xs={12} md={4}>
                <div className="advertise">
                  {" "}
                  <img src={nft.image} alt="" className="rounded width-100" />
                </div>
                <br />
                <div className="bid-xdx">BID XDX</div>
                <input
                  type="number"
                  name="price"
                  className="o-xdx"
                  placeholder="Amount"
                  id="amountbox_id"
                />
                <br></br>
                <div className="cptcha">
                  <ReCAPTCHA
                    sitekey="6LdYfV0gAAAAAHNRZLMNlkyQ5DRAqaiqo80NycfF"
                    onChange={handleRecaptcha}
                    name="recaptcha"
                  />
                </div>
                <br></br>
                <Button
                  variant="primary"
                  onClick={antiBot}
                  className="BuyNFT-button anti-bot width-100"
                >
                  {antiBotData.isSubmit ? (
                    <BeatLoader sizeUnit="px" size={10} color="#FFF" loading />
                  ) : (
                    "(Anti Bot)"
                  )}
                </Button>
              </Col>
              <Col xs={12} md={4}></Col>
            </Row>
            <Row>
              <Col xs={12} md={3}>
                <div className="address-rewards">
                  <p>
                    Address)
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                    rewords{" "}
                  </p>
                  <button className="btn-success">Collect</button> 0.01
                  <br />
                  <button className="btn-success">Collect</button> 0.10
                </div>
              </Col>
              <Col xs={12} md={9}>
                <Row>
                  <Col xs={12} md={2}></Col>
                  <Col xs={12} md={8}>
                    <Row>
                      <Col xs={12} md={6}>
                        <br />
                        <div className="transaction-history">
                          Transaction History
                        </div>
                      </Col>
                      <Col xs={12} md={6}>
                        <br />
                        <div className="nft-register">Transaction History</div>
                      </Col>
                    </Row>
                  </Col>
                  <Col xs={12} md={2}></Col>
                </Row>
              </Col>
            </Row>
          </Col>
        </Row>
      </Container>
      <Footer />
    </React.Fragment>
  );
}

export default BidDetail;
