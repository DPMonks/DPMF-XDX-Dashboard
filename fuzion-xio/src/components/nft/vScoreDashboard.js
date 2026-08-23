import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";
// import { BeatLoader } from "react-spinners";
import { Table, Container, Button } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import Header from "../common/header";
import Footer from "../common/footer";
// import { cancelSendNftAction } from "../../store/actions/mintNFT";
// import MessageConst from "../../const/message.json";
import { getVScoreDashboardAction } from "../../store/actions/profile";
import DummyProfile from "../../assets/defaultpimage.jpg";
import configData from "../../config.json";
import { replaceHost } from "../../helper";
import { profileBatchColor } from "../../helper/getProfileDetails";

// actions
// import { checkDeclinedNFTAction } from "../../store/actions/send";

function VscoreDashboard() {
  const [searchKey, setSearchKey] = useState(true);
  const [vScoreDashboard, setVScoreDashboard] = useState(null);
  const [loaderId, setLoaderId] = useState(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = localStorage.getItem("jwtToken");

  ///////////////// REDUCER //////////////
  const [cancelSend] = useSelector((state) => [state.cancelSendNftReducer]);

  // ===========Declined receive nft record======
  useEffect(() => {
    if (!!token) {
      dispatch(getVScoreDashboardAction({ token }))
        .then((val) => {
          const filterData = val?.data?.vscoreDashboard.filter(
            (vl) => vl.vScoreSum !== 0
          );
          setVScoreDashboard(filterData);
        })
        .catch((e) => console.log("Error decline NFT", e));
    }
  }, [token]); // eslint-disable-line

  /* Cancel Send functionality  */

  //   const cancelSendNft = (val) => {
  //     // check user
  //     // if (decodedToken.ac !== nft.accountNumber) {
  //     //   toast.warn(MessageConst.errorConnectXummWallet, {
  //     //     toastId: "cancelSendCheckUser" + Date.now(),
  //     //   });
  //     //   setTimeout(() => {
  //     //     window.location.reload();
  //     //   }, 1000);
  //     //   return;
  //     // }

  //     // call api
  //     try {
  //       let data = {
  //         _id: val.nftObjId,
  //       };
  //       dispatch(cancelSendNftAction({ data, loader: true }));
  //     } catch (error) {
  //       toast.error(MessageConst.somethingWrongError, {
  //         toastId: "cancelsendToken1" + Date.now(),
  //       });
  //     }
  //   };

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4 declinedSection">
          <>
            <Container>
              <br />
              <h3 className=" mb-5">Vscore Dashboard</h3>
              <div className="table-responsive">
                <Table className="table-class hover responsive">
                  <thead>
                    <tr>
                      <th>S.No</th>
                      <th>Name</th>
                      <th>Image</th>
                      <th>Wallet Address</th>
                      <th>Vscore</th>
                      <th>Checkmark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!!vScoreDashboard &&
                      (vScoreDashboard.length < 1 ? (
                        <tr>
                          <td colSpan={6} className="text-center">
                            No Records Found
                          </td>
                        </tr>
                      ) : (
                        vScoreDashboard
                          .sort((a, b) => b.vScoreSum - a.vScoreSum)
                          .map((val, key) => {
                            return (
                              <tr key={key}>
                                <td>{key + 1}</td>
                                <td>{!!val?.pName ? val?.pName : "N/A"}</td>
                                <td>
                                  <img
                                    width={30}
                                    height={30}
                                    alt=""
                                    src={
                                      val?.pImage
                                        ? val?.pImage?.startsWith(
                                            "https://ipfs"
                                          )
                                          ? replaceHost(val?.pImage)
                                          : val?.pImage?.startsWith("uploads")
                                          ? `${
                                              configData.LOCAL_API_URL +
                                              val?.pImage
                                            }`
                                          : DummyProfile
                                        : DummyProfile
                                    }
                                    className="img-dashboard"
                                  />
                                </td>
                                <td>
                                  {/* <a
                                target="_blank"
                                rel="noreferrer"
                                href={`https://bithomp.com/explorer/${val?.address}`}
                                className="text-dark"
                              > */}
                                  <Link to={"/Profile/" + val.address}>
                                    {val.address.substring(0, 9)} *****{" "}
                                    {val.address.substring(
                                      val.address.length - 5
                                    )}
                                  </Link>
                                  {/* </a> */}
                                </td>
                                <td width="40%">
                                  {val.vScoreSum}
                                </td>
                                <td>
                                  {profileBatchColor(val.vScoreSum)}
                                  <span className="dpmf-muted">
                                    {" "}
                                    {val.badge || ""}
                                  </span>
                                  {/* <Button
                                variant="danger"
                                onClick={() =>{setLoaderId(key); cancelSendNft(val)}}
                                className="BuyNFT"
                              >
                                {key === loaderId ? (
                                  <BeatLoader
                                    sizeUnit="px"
                                    size={10}
                                    color="#FFF"
                                    loading
                                  />
                                ) : (
                                  "Cancel Send"
                                )}
                              </Button> */}
                                </td>
                              </tr>
                            );
                          })
                      ))}
                  </tbody>
                </Table>
              </div>
            </Container>
          </>
        </div>
      )}
      <Footer />
    </>
  );
}
export default VscoreDashboard;
