import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";
import { BeatLoader } from "react-spinners";
import { Table, Container, Button } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import Header from "../common/header";
import Footer from "../common/footer";
import { cancelSendNftAction } from "../../store/actions/mintNFT";
import MessageConst from "../../const/message.json";

// actions
import { checkDeclinedNFTAction } from "../../store/actions/send";

function DeclinedSendNFT() {
  const [searchKey, setSearchKey] = useState(true);
  const [notifications, setNotification] = useState(null);
  const [loaderId, setLoaderId] = useState(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = localStorage.getItem("jwtToken");

  ///////////////// REDUCER //////////////
  const [cancelSend] = useSelector((state) => [state.cancelSendNftReducer]);

  // ===========Declined receive nft record======
  useEffect(() => {
    if (!!token) {
      dispatch(checkDeclinedNFTAction({ token }))
        .then((val) => {
          setNotification(val.data.data);
        })
        .catch((e) => console.log("Error decline NFT", e));
    }
  }, [token]); // eslint-disable-line

  /* Cancel Send functionality  */

  const cancelSendNft = (val) => {
    // check user
    // if (decodedToken.ac !== nft.accountNumber) {
    //   toast.warn(MessageConst.errorConnectXummWallet, {
    //     toastId: "cancelSendCheckUser" + Date.now(),
    //   });
    //   setTimeout(() => {
    //     window.location.reload();
    //   }, 1000);
    //   return;
    // }

    // call api
    try {
      let data = {
        _id: val.nftObjId
      };
      dispatch(cancelSendNftAction({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "cancelsendToken1" + Date.now()
      });
    }
  };

  useEffect(() => {
    if (cancelSend.error === false) {
      toast.success(cancelSend.cancelSend.message, {
        toastId: "cancelsendNft" + Date.now(),
        onClose: () => {
          dispatch(checkDeclinedNFTAction({ token }))
            .then((val) => {
              if (val.data.data.length > 0) {
                setNotification(val.data.data);
              } else {
                navigate("/");
              }
            })
            .catch((e) => console.log("Error check declined NFT:", e));
        }
      });
    } else if (cancelSend.error !== null) {
      toast.error(cancelSend.error.message, {
        toastId: "cancelsendNft2" + Date.now(),
        onClose: () => {
          setLoaderId(null);
        }
      });
    }
  }, [cancelSend.error, token]); // eslint-disable-line

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4 declinedSection">
          <>
            <Container>
              <br />
              <h5 className="text-white mb-5">
                {notifications !== null && notifications[0]?.message}
              </h5>
              <div className="table-responsive">
                <Table className="table-class">
                  <thead>
                    <tr>
                      <th>Send NFT Decliner Address</th>
                      <th>NFT ID</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications !== null &&
                      notifications.map((val, key) => {
                        return (
                          <tr key={key}>
                            <td>
                              {val.data[0].destination.substring(0, 9)} *****{" "}
                              {val.data[0].destination.substring(
                                val.data[0].destination.length - 5
                              )}
                            </td>
                            <td>
                              <a
                                target="_blank"
                                rel="noreferrer"
                                href={`https://bithomp.com/explorer/${val?.nft_id}`}
                                className="text-dark"
                              >
                                {val.nft_id.substring(0, 9)} *****{" "}
                                {val.nft_id.substring(val.nft_id.length - 5)}
                              </a>
                            </td>
                            <td width="40%">
                              <Button
                                variant="danger"
                                onClick={() => {
                                  setLoaderId(key);
                                  cancelSendNft(val);
                                }}
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
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
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
export default DeclinedSendNFT;
