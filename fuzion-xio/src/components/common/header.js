import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "react-toastify";
import Dropdown from "react-bootstrap/Dropdown";

import "react-toastify/dist/ReactToastify.css";
import {
  Row,
  Col,
  Button,
  OverlayTrigger,
  Popover,
  Navbar,
  Nav,
  Container,
  Modal
} from "react-bootstrap";
// import SmallLogo from "../../assets/newLogo.png";
import { useJwt, decodeToken } from "react-jwt";
import { useDispatch, useSelector } from "react-redux";
import {
  connectWalletAction,
  accountDetailAction,
  getBalanceAction,
  registrationFee,
  disConnectWalletAction,
  getProfileFee
} from "../../store/actions/wallet";
import {
  numberOfMintedAction,
  totalTradeAction,
  allCancelPlacedOffersAction,
  allOfferByNftOwnerAction
} from "../../store/actions/mintNFT";
import { checkDeclinedNFTAction } from "../../store/actions/send";
import { homeNftDetail } from "../../store/actions/homedetail";
import MessageConst from "../../const/message.json";
import Form from "react-bootstrap/Form";
import SearchNft from "../nft/searchNft";
// import HashLoader from "react-spinners/HashLoader";
import Swal from "sweetalert2";
import SendModel from "./SendModel";
import * as Spinners from "react-loader-spinner";

//logo
import Xamen from "../../assets/xaman.jpg";
import MetaMask from "../../assets/metamask.jpeg";
import WalletConnect from "../../assets/walletconnect.png";
import FUSIONXIO from "../../assets/fusion-x-logo.jpg";
import FUSIONLOGO from "../../assets/fusion-logo.png";
import BACKGROUNDIMG from "../../assets/registration.jpg";

const Header = ({ setSearchKey, setIsActiveWallet, setIsPaid, isPaid }) => {
  const { pathname } = useLocation();

  const token = localStorage.getItem("jwtToken");
  const { isExpired } = useJwt(token);
  const myDecodedToken = decodeToken(token);
  const navigate = useNavigate();
  const [showModal, setShowModel] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [forMobile, setForMobile] = useState("");
  const [walletEnable, setWalletEnable] = useState(false);
  const [currencyBalance, setCurrencyBalance] = useState([]);
  const [totalMintedNft, setTotalMintedNft] = useState(0);
  const [APIData, setAPIData] = useState([]);
  const [allMintedNfts, setAllMintedNfts] = useState(null);
  const [searchInput, setSearchInput] = useState(null);
  const [filteredResults, setFilteredResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchKey, setSearchVal] = useState(true);
  const [totalTrade, setToatalTrade] = useState(0);
  const [declinedData, setDeclinedData] = useState(null);
  const [disconnect, setDisconnect] = useState(false);
  const [calcelAllPlacedOffer, setCalcelAllPlacedOffer] = useState(null);
  const [buyOfferByNftOwner, setBuyOfferByNftOwner] = useState(null);
  const [totalCount, setTotalCount] = useState(null);
  const [modalView, setModalView] = useState(false);

  const override = {
    position: "absolute",
    left: "50%",
    top: "50%"
  };
  let dispatch = useDispatch();

  const [
    walletConnectStatus,
    accountDetail,
    balance,
    registrationFeeStatus,
    disConnectStatus,
    totalNumberOfMinted,
    homedtl,
    totalTrades
  ] = useSelector((state) => [
    state.walletActionReducer,
    state.accountDetailReducer,
    state.getBalanceReducer,
    state.registrationFeeReducer,
    state.walletDisConnectReducer,
    state.numberOfMintedReducer,
    state.homeDetailReducer,
    state.totalTradeReducer
  ]);

  const isLoggedInUser = () => {
    if (pathname.split("/").length === 3) {
      if (pathname.split("/").pop() === myDecodedToken?.ac) {
        return true;
      }
    } else if (pathname.split("/").length === 2) {
      return true;
    } else {
      return false;
    }
  };

  useEffect(() => {
    const account =
      pathname.split("/").length === 3
        ? pathname.split("/").pop()
        : myDecodedToken?.ac;
    getProfileFee(account)
      .then((res) => {
        if (res.data) {
          const { exchangeFee } = res.data;
          if (typeof setIsPaid === "function") {
            setIsPaid(exchangeFee);
          }
        }
      })
      .catch((err) => {
        console.log(err, "registrationFeeStatus error");
      });
  }, []);

  const showRegistrationSwal = useCallback(() => {
    Swal.fire({
      allowOutsideClick: false,
      allowEscapeKey: false,
      title: "Registration",
      html: `<p class="swalPara">Would you like to Register your wallet to create a FREE Profile? Click ‘Connect’ and sign in your wallet.</p>`,
      imageUrl: FUSIONLOGO,
      imageWidth: 226,
      imageHeight: 60,
      showCancelButton: true,
      confirmButtonColor: "#b00fb5",
      cancelButtonColor: "#b00fb5",
      confirmButtonText: "Connect",
      customClass: {
        container: "swal-container",
        actions: "vertical-buttons",
        cancelButton: "cancel-btn",
        confirmButton: "confirm-btn"
      }
    }).then((result) => {
      if (result.isConfirmed) {
        const data = {
          account: myDecodedToken.ac,
          issuedToken: myDecodedToken.it,
          token: token
        };

        dispatch(registrationFee({ data, loader: true })).then((res) => {
          if (res?.success === true) {
            getProfileFee(myDecodedToken.ac).then((res) => {
              const { exchangeFee } = res.data;
              setIsPaid(exchangeFee);
              toast.success(MessageConst.accountActivateSuccess, {
                toastId: "accountDetailConfurm" + Date.now()
              });
            });
          } else if (res?.cancelled) {
            showRegistrationSwal();
          } else {
            toast.error(res?.message, {
              toastId: "registrationFeeStatuserror" + Date.now(),
              onClose: () => {
                setTimeout(() => {
                  window.location.reload();
                }, 3000);
              }
            });
          }
        });
      } else if (result?.dismiss === "cancel") {
        toast.error(MessageConst.accountActivateError, {
          toastId: "accountDetailNotConfurm" + Date.now(),
          onClose: () => {
            setTimeout(() => {
              window.location.reload();
            }, 3000);
          }
        });
      }
    });
  }, [
    dispatch,
    myDecodedToken?.ac,
    myDecodedToken?.it,
    setIsPaid,
    token
  ]);

  const showRegistrationSwalRef = useRef(showRegistrationSwal);
  showRegistrationSwalRef.current = showRegistrationSwal;

  useEffect(() => {
    if (!token) return;
    const isProfile = pathname.split("/")[1];
    if (isLoggedInUser() && isPaid === 0 && isProfile === "Profile") {
      showRegistrationSwalRef.current();
    }
  }, [pathname, token, isPaid]);

  useEffect(() => {
    setTotalCount(
      declinedData?.length +
        calcelAllPlacedOffer?.length +
        buyOfferByNftOwner?.length
    );
  }, [declinedData, calcelAllPlacedOffer, buyOfferByNftOwner]);

  /* All offer by nft owner */
  useEffect(() => {
    // const token = localStorage.getItem("jwtToken");
    if (!!token) {
      dispatch(allOfferByNftOwnerAction())
        .then((val) => {
          setBuyOfferByNftOwner(val.data.totalOffer);
        })
        .catch((e) => {
          console.log("Error all offer by nft owner:", e);
        });
    }
  }, [token]); // eslint-disable-line

  /* All placed offer record to be cancelled */
  useEffect(() => {
    // const token = localStorage.getItem("jwtToken");
    if (!!token) {
      dispatch(allCancelPlacedOffersAction({ token }))
        .then((val) => {
          setCalcelAllPlacedOffer(val.data.offerDataSignedUser);
        })
        .catch((e) => {
          console.log("Error all offer to be cancelled useEffect:", e);
        });
    }
  }, [token]); // eslint-disable-line

  // ===========Declined receive nft record======
  useEffect(() => {
    const pathValue = pathname.split("/").pop();
    if (
      !["Today_picks", "Recommended_collections"].includes(pathValue) &&
      pathValue.length !== 24
    ) {
      localStorage.removeItem("page");
    }

    if (!!token) {
      dispatch(checkDeclinedNFTAction({ token }))
        .then((val) => {
          setDeclinedData(val.data.data);
        })
        .catch((e) => {
          console.log("Error check declined NFT:", e);
        });
    }
  }, [token]); // eslint-disable-line

  // =============search Nft ===============
  useEffect(() => {
    try {
      dispatch(homeNftDetail({ loader: true }));
    } catch (error) {
      toast.error(error.response.data.message, {
        toastId: "searchNft" + Date.now()
      });
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    if (homedtl.nftDetail !== "") {
      const { allNft, allMintedNft } = homedtl.nftDetail;
      setAPIData(allNft);
      setAllMintedNfts(allMintedNft);
    }
  }, [homedtl]); // eslint-disable-line

  ////////////////////////  MODEL START ///////
  const handleClose = () => {
    setShowModel(false);
    setModalView(true);
  };
  ////////////////////////  MODEL END ///////

  //// REGISTRATION FEE STATUS START//////////////
  // useEffect(() => {
  //   if (registrationFeeStatus.data != null) {
  //     if (registrationFeeStatus.error === null) {
  //       // localStorage.setItem("jwtToken", registrationFeeStatus.data.token);

  //       window.location.reload();
  //     } else {
  //       toast.error(registrationFeeStatus?.data?.data?.message, {
  //         toastId: "registrationFeeStatuserror" + Date.now(),
  //         onClose: () => {
  //           localStorage.setItem("userType", "firstTime");
  //           // window.location.reload();
  //           navigate("/");
  //         },
  //       });
  //     }
  //   }
  // }, [registrationFeeStatus]);// eslint-disable-line

  //// REGISTRATION FEE STATUS END//////////////
  ////////////////////// ACCOUNT DEATIL START//////////
  useEffect(() => {
    if (accountDetail.error) {
      toast.error(accountDetail.error.message, {
        toastId: "accountDetailerror" + Date.now(),
        onClose: () => {
          window.location.reload();
        }
      });
    } else if (accountDetail?.account !== null) {
      // if (accountDetail?.account?.user_type === "secondTime" && isProfile !== "Profile") {
      localStorage.setItem("jwtToken", accountDetail.account.token);
      // localStorage.setItem("isPaid", accountDetail.account.paid);
      window.location.reload();
    }
  }, [accountDetail, walletEnable]); // eslint-disable-line

  ////////////////////// ACCOUNT DEATIL END//////////
  ////////////////////// Balance Start//////////
  useEffect(() => {
    if (balance?.currency !== null) {
      if (balance?.currency?.currency) {
        setCurrencyBalance(balance?.currency?.currency);
      } else {
        toast.error(MessageConst.alertDevnetAccountLogin, {
          toastId: "accountBalance" + Date.now(),
          onClose: () => {
            localStorage.clear();
            window.location.reload();
            navigate("/");
          }
        });
      }
    }
  }, [balance]); // eslint-disable-line

  useEffect(() => {
    // typeof setIsActiveWallet()
    setIsActiveWallet !== undefined && setIsActiveWallet(token);
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
  }, [token]); // eslint-disable-line

  ////////////////////// Balance END//////////

  ////////////// XUMM CONNECT START///////////////////////
  useEffect(() => {
    if (walletConnectStatus?.wallet && walletEnable) {
      if (walletConnectStatus?.wallet?.message) {
        setQrCode(walletConnectStatus?.wallet?.message);
        setForMobile(walletConnectStatus?.wallet?.forMobile);
        setShowModel(true);
        let data = {
          uuid: walletConnectStatus?.wallet?.uuid
        };
        dispatch(accountDetailAction({ data, loader: true }));
        setTimeout(() => {
          window.location.reload();
        }, 60000);
      } else {
        alert(MessageConst.alertTryAfterSometime);
      }
    } else if (walletConnectStatus.error !== null) {
      toast.warn(walletConnectStatus.error.data.message, {
        toastId: "walleterror" + Date.now()
      });
    }
  }, [walletConnectStatus, walletEnable]); // eslint-disable-line

  const connectWallet = async () => {
    setModalView(false);
    setWalletEnable(true);
    try {
      dispatch(connectWalletAction({ loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "connectWallet1" + Date.now()
      });
    }
  };

  // disconnect wallet
  useEffect(() => {
    if (disConnectStatus?.data && disconnect) {
      if (disConnectStatus?.data?.message) {
        localStorage.clear();
        toast.success(disConnectStatus?.data?.message, {
          toastId: "connectsisconnSS" + Date.now(),
          onClose: () => {
            setDisconnect(false);
            navigate("/");
          }
        });
      } else if (disConnectStatus?.data?.data) {
        localStorage.clear();
        toast.error(disConnectStatus?.data?.data?.message, {
          toastId: "connectsisconnSStr" + Date.now(),
          onClose: () => {
            setDisconnect(false);
            navigate("/");
          }
        });
      }
    }
  }, [disConnectStatus, disconnect]); // eslint-disable-line

  // handle vscoredashboard
  const vScoreDashboard = () => {
    navigate("/Vscoredashboard");
  };

  const disconnectWallet = async () => {
    setDisconnect(true);
    if (isExpired === true || token === null) {
      localStorage.clear();
      toast.error(MessageConst.errorConnectXummWallet, {
        toastId: "connectWallet121" + Date.now()
      });
      window.location.reload();
    }
    try {
      dispatch(disConnectWalletAction({ loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "connectWallet11111" + Date.now()
      });
    }
  };

  ////////////// XUMM CONNECT END///////////////////////

  ///////////// NUMBER OF MINTED START/////////////
  useEffect(() => {
    if (totalNumberOfMinted?.error !== null) {
      setTotalMintedNft(totalNumberOfMinted?.numberOfMinted?.totalNftMinted);
    }
  }, [totalNumberOfMinted]); // eslint-disable-line

  useEffect(() => {
    try {
      dispatch(numberOfMintedAction({ loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "numberOfMintedDispanch" + Date.now()
      });
    }
  }, []); // eslint-disable-line

  // Total trade history
  useEffect(() => {
    try {
      dispatch(totalTradeAction({ loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "numberOfMintedDispanch" + Date.now()
      });
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    try {
      if (totalTrades?.error === false) {
        setToatalTrade(totalTrades?.totalTrade?.totalTradeHistory);
      }
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "totalTrade" + Date.now()
      });
    }
  }, [totalTrades]); // eslint-disable-line

  let filterTimeout;
  ///////////// NUMBER OF MINTED END/////////////
  const searchItems = (searchValue) => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
      setLoading(true);
      if (searchValue !== "") {
        const filteredData = APIData?.filter((item) => {
          return Object.values(item)
            .join("")
            .toLowerCase()
            .includes(searchValue.toLowerCase());
        });
        setSearchVal(false);
        setSearchKey(false);
        filterTimeout = setTimeout(() => {
          setFilteredResults(filteredData);
          setLoading(false);
          setSearchInput(searchValue);
        }, 500);
      } else {
        setLoading(false);
        setSearchKey(true);
        setSearchVal(true);
      }
    }, 2000);
  };

  // handle xiodashboard
  const xioDashboard = () => {
    navigate("/Xiodashboard");
  };

  const checkXioBalance = () => {
    if (balance?.currency !== null) {
      const xioBalance = balance?.currency?.currency?.find(function (obj) {
        return obj.currency === "XIO";
      });
      if (xioBalance && xioBalance.value > 0) {
        navigate("/Createnft");
      } else {
        toast.error(MessageConst.XIOBALCHECK, {
          toastId: "xioBalCheck" + Date.now()
        });
      }
    }
  };

  return (
    <React.Fragment>
      <Navbar
        collapseOnSelect
        bg="light"
        expand="lg"
        className="nft-header-cst cstmAppNav"
      >
        <Container fluid={true}>
          <Link className="nav-link" to="/">
            <img
              src={FUSIONLOGO}
              className="width-100 logoImg"
              alt="Fuzion-XIO logo"
            />
          </Link>
          {/* <Nav.Link href="/" className="homeNav">Home</Nav.Link> */}
          {!!token ? (
            <Dropdown className="homeNav" size="sm">
              <Dropdown.Toggle
                variant="success"
                drop="start"
                id="dropdown-basic"
              >
                Menu
              </Dropdown.Toggle>

              <Dropdown.Menu>
                <Dropdown.Item href="/" className="dropdown-item">
                  Home
                </Dropdown.Item>
                <Dropdown.Item href="/Profile">Profile</Dropdown.Item>
                <Dropdown.Item href="/MyNFT">My NFT's</Dropdown.Item>
                <Dropdown.Item
                  style={{ cursor: "pointer" }}
                  onClick={checkXioBalance}
                >
                  Create NFT
                </Dropdown.Item>
                <Dropdown.Item href="/market">Market</Dropdown.Item>
                <Dropdown.Item href="/explore">Explore</Dropdown.Item>
                <Dropdown.Item href="/activity">Activity</Dropdown.Item>
                <Dropdown.Item href="/rankings">Rankings</Dropdown.Item>
                <Dropdown.Item href="/Xiodashboard">Validators</Dropdown.Item>
                <Dropdown.Item href="/Vscoredashboard">
                  Verified Profiles
                </Dropdown.Item>
                <Dropdown.Item href="/ramp">Ramp</Dropdown.Item>
                <Dropdown.Item
                  href="https://www.spatial.io/s/XION-Gallery-64b8c3ba9d0c210a1e8c4d28"
                  target="_blank"
                  className="dropdown-item"
                >
                  XION Gallery
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          ) : (
            <>
              <Link to="/" className="home-class">
                Home
              </Link>
              <Link to="/explore" className="home-class">
                Explore
              </Link>
              <Link to="/activity" className="home-class">
                Activity
              </Link>
              <Link to="/market" className="home-class">
                Market
              </Link>
              <Link to="/Xiodashboard" className="home-class">
                XIO
              </Link>
            </>
          )}

          <Navbar.Toggle aria-controls="responsive-navbar-nav" />
          <Navbar.Collapse id="responsive-navbar-nav">
            <Nav className="me-auto">
              <p className="mb-0 text-left">
                <span className="cardNFTBYACount pr-3 mt-0">
                  MINTED NFT{" "}
                  <span className="totalcount ms-2">{totalMintedNft}</span>
                </span>
                <br />
                <span className="cardNFTBYACount">
                  {" "}
                  TRADED NFT &nbsp;
                  <span className="totalcount">{totalTrade} </span>
                </span>
              </p>
            </Nav>

            <Form className="d-flex searchInput">
              <Form.Control
                type="search"
                placeholder="Search"
                className="me-2 mb-3 mb-lg-0"
                onChange={(e) => searchItems(e.target.value)}
                aria-label="Search"
              />
            </Form>
            <Nav></Nav>

            {(() => {
              if (token === null) {
                return (
                  <Nav.Link
                    onClick={() => setModalView(true)}
                    className="lgOut11 btn-outline-dark"
                  >
                    Wallet&nbsp;Connect
                  </Nav.Link>
                );
              } else {
                return (
                  <>
                    <div className="btnBOX">
                      <a
                        href="/MyNFT"
                        className="nav-link d-none d-md-block d-xl-block d-xxl-block"
                      >
                        MY NFTs
                      </a>
                      <a
                        // href="/createnft"
                        style={{ cursor: "pointer" }}
                        className="nav-link d-none d-md-block d-xl-block d-xxl-block"
                        onClick={checkXioBalance}
                      >
                        CREATE NFT
                      </a>
                      <a
                        href="/ramp"
                        className="nav-link d-none d-md-block d-xl-block d-xxl-block"
                      >
                        {" "}
                        RAMP{" "}
                      </a>
                      <a
                        href="https://www.spatial.io/s/XION-Gallery-64b8c3ba9d0c210a1e8c4d28"
                        className="nav-link d-none d-md-block d-xl-block d-xxl-block"
                        target="_blank"
                      >
                        XION Gallery
                      </a>

                      <OverlayTrigger
                        trigger="click"
                        key="bottom"
                        placement="bottom"
                        overlay={
                          <Popover id={"popover-positioned-bottom"}>
                            <Popover.Header as="h3">
                              All Notifications
                            </Popover.Header>
                            <Popover.Body>
                              <Row>
                                <Col xs={12} md={12}>
                                  {!!declinedData &&
                                    declinedData.length > 0 && (
                                      <Nav.Link
                                        href="/DeclinedSendNFT"
                                        className="notification-nav"
                                      >
                                        <span className="notify-text">
                                          Sent NFT Declined&nbsp;:&nbsp;
                                          <span className="notifybutton">
                                            {declinedData.length}
                                          </span>
                                        </span>
                                      </Nav.Link>
                                    )}
                                </Col>
                              </Row>
                              <Row>
                                <Col xs={12} md={12}>
                                  {!!calcelAllPlacedOffer &&
                                    calcelAllPlacedOffer.length > 0 && (
                                      <Nav.Link
                                        href="/Cancelplacedoffer"
                                        className="notification-nav"
                                      >
                                        <span className="notify-text">
                                          Cancel placed offer&nbsp;:&nbsp;
                                          <span className="notifybutton">
                                            {calcelAllPlacedOffer.length}
                                          </span>
                                        </span>
                                      </Nav.Link>
                                    )}
                                </Col>
                              </Row>
                              <Row>
                                <Col xs={12} md={12}>
                                  {!!buyOfferByNftOwner &&
                                    buyOfferByNftOwner.length > 0 && (
                                      <Nav.Link
                                        href="/BuyOfferReceived"
                                        className="notification-nav"
                                      >
                                        <span className="notify-text">
                                          Buy Offer Received&nbsp;:&nbsp;
                                          <span className="notifybutton">
                                            {buyOfferByNftOwner.length}
                                          </span>
                                        </span>
                                      </Nav.Link>
                                    )}
                                </Col>
                              </Row>
                            </Popover.Body>
                          </Popover>
                        }
                      >
                        <Button className="pe-0" variant="">
                          <i
                            className="fa fa-bell"
                            style={{ fontSize: "24px" }}
                          ></i>
                          <span className="badge rounded-pill badge-notification">
                            {!!totalCount && totalCount}
                          </span>
                        </Button>
                      </OverlayTrigger>
                      {/* <Nav.Link className="pe-4 cstmporight" href="/Profile" > <i className="fa fa-user-circle" style={{ fontSize: "24px" }}></i> </Nav.Link> */}
                      <Link
                        className="pe-4 cstmporight nav-link  d-none d-md-block d-xl-block d-xxl-block"
                        to="/Profile"
                      >
                        {" "}
                        <i
                          className="fa fa-user-circle"
                          style={{ fontSize: "24px" }}
                        ></i>{" "}
                      </Link>
                    </div>

                    <OverlayTrigger
                      trigger="click"
                      key="bottom"
                      placement="bottom"
                      overlay={
                        <Popover id={"popover-positioned-bottom"}>
                          <Popover.Header align="center" as="h3">
                            Wallet
                          </Popover.Header>
                          <Popover.Body id="pop-body">
                            <Row>
                              <Col xs={12} md={12}>
                                <strong className="text-center">
                                  {myDecodedToken?.ac?.substring(0, 9)}
                                  ****************
                                  {myDecodedToken?.ac?.substring(
                                    myDecodedToken?.ac?.length - 5
                                  )}
                                </strong>
                              </Col>
                            </Row>
                            <br />
                            {currencyBalance?.map((currencyType) => (
                              <Row key={currencyType?.currency}>
                                <Col xs={6} md={6}>
                                  <strong className="text-left">
                                    {currencyType?.currency}
                                  </strong>
                                </Col>
                                <Col xs={6} md={6}>
                                  <strong className="text-right">
                                    {currencyType?.value}
                                  </strong>
                                </Col>
                              </Row>
                            ))}
                          </Popover.Body>
                          <Popover.Body>
                            <Row>
                              <Col xs={12} md={12}>
                                <Button
                                  variant="danger"
                                  className="col-md-12 col-xs-12"
                                  onClick={disconnectWallet}
                                >
                                  Disconnect
                                </Button>
                              </Col>
                              <Col>
                                <Button
                                  variant="primary"
                                  className="col-md-12 col-xs-12 vscore-class"
                                  onClick={vScoreDashboard}
                                >
                                  Vscoreboard
                                </Button>
                              </Col>
                              <Col>
                                <Button
                                  variant="primary"
                                  className="col-md-12 col-xs-12"
                                  onClick={xioDashboard}
                                >
                                  Xiodashboard
                                </Button>
                              </Col>
                            </Row>
                          </Popover.Body>
                        </Popover>
                      }
                    >
                      <Button variant="btn btn-dark connected">
                        Wallet&nbsp;Connected
                      </Button>
                    </OverlayTrigger>
                  </>
                );
              }
            })()}
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Modal
        show={showModal}
        onHide={handleClose}
        backdrop="static"
        className="qrModal"
      >
        <Modal.Header closeButton>
          {/* <Modal.Title>{""}</Modal.Title> */}
        </Modal.Header>
        <Modal.Body>
          <div className="padding-modal-image">
            <div className="imgBox">
              <img src={qrCode} alt="" className="qr-img" />
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer className="text-center d-md-none d-lg-none d-sm-block">
          <h6 className="only-for-mobile">
            Open in
            <a
              href={`https://xumm.app/sign/${forMobile}`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="see-all-button">XAMAN</span>
            </a>
          </h6>
        </Modal.Footer>
      </Modal>
      {/* // Send Model start // */}
      <SendModel />
      {/* {// Send Model end //} */}

      {!!searchInput && !searchKey ? (
        <SearchNft data={filteredResults} allMintedNfts={allMintedNfts} />
      ) : (
        <div className={loading ? "parentDisable" : ""}>
          <Spinners.MutatingDots
            visible={loading}
            height="100"
            width="100"
            color="#f531e9"
            secondaryColor="#f531e9"
            radius="12.5"
            wrapperStyle={{
              justifyContent: "center"
            }}
            wrapperClass="search-wrapper"
          />
          {/* <HashLoader
            sizeUnit="px"
            size={100}
            color="#329be3"
            loading={loading}
            cssOverride={override}
          /> */}
        </div>
      )}

      {/* inital wallet show modal */}
      <Modal
        show={modalView}
        onHide={() => setModalView(false)}
        backdrop="static"
        dialogClassName="custom-modal"
        aria-labelledby="example-custom-modal-styling-title"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title className="ms-auto">
            {/* <strong>FUSION-XIO</strong> */}
            <img src={FUSIONXIO} height={50} />
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-md-5 px-lg-5 px-xl-5">
          <h5 className="text-center">
            <strong>To get Started, Connect your Wallet</strong>
          </h5>
          <div className="md-body">
            <div className="wallet-body">
              <img src={Xamen} height={40} width={75} /> Xaman{" "}
              <span>
                <Button
                  variant="success"
                  className="wallet-button"
                  // className="BuyNFT-button width-22 sendNFT"
                  onClick={connectWallet}
                >
                  Connect
                </Button>
              </span>
            </div>
            <div className="wallet-body">
              <img src={MetaMask} height={40} width={70} />
              &nbsp;&nbsp;Metamask{" "}
              <span>
                <Button variant="success" className="wallet-button" disabled>
                  Connect
                </Button>
              </span>
            </div>
            <div className="wallet-body">
              <img src={WalletConnect} height={40} width={70} /> Wallet Connect{" "}
              <span>
                <Button variant="success" className="wallet-button" disabled>
                  Connect
                </Button>
              </span>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </React.Fragment>
  );
};

export default Header;
