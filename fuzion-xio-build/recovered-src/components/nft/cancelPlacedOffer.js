import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";
import { BeatLoader } from "react-spinners";
import { Table, Container, Button } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import Header from "../common/header";
import Footer from "../common/footer";
import ShowQRModal from "../common/ShowQRModel";
import {
  allCancelPlacedOffersAction,
  cancelPlacedOffersAction
} from "../../store/actions/mintNFT";
import MessageConst from "../../const/message.json";

function AllCancelPlacedOffer() {
  const [searchKey, setSearchKey] = useState(true);
  const [notifications, setNotification] = useState(null);
  const [loaderId, setLoaderId] = useState(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = localStorage.getItem("jwtToken");

  ///////////////// REDUCER //////////////
  const [cancelPlacedOffer] = useSelector((state) => [
    state.cancelPlacedOffersReducer
  ]);

  // ===========Declined receive nft record======
  useEffect(() => {
    if (!!token) {
      dispatch(allCancelPlacedOffersAction({ token }))
        .then((val) => {
          setNotification(val.data.offerDataSignedUser);
        })
        .catch((e) => console.log("Error all offer to be cancelled:", e));
    }
  }, [token]); // eslint-disable-line

  /* Cancel Placed Offer functionality  */
  const cancelplacedOffer = (val) => {
    // check user
    // if (decodedToken.ac !== nft.accountNumber) {
    //   toast.warn(MessageConst.errorConnectXummWallet, {
    //     toastId: "cancelSendCheckUser" + Date.now(),
    //     onClose: () => window.location.reload()
    //   });
    //   return;
    // }
    try {
      let data = {
        _id: val.nftObjId,
        nftOfferIndex: val.nftOfferIndex
      };
      dispatch(cancelPlacedOffersAction({ data, loader: true }));
    } catch (error) {
      toast.error(MessageConst.somethingWrongError, {
        toastId: "cancelsendToken1" + Date.now()
      });
    }
  };

  useEffect(() => {
    if (cancelPlacedOffer.error === false) {
      toast.success(cancelPlacedOffer.cancelPlacedoffer.message, {
        toastId: "cancelbuyoffer1" + Date.now(),
        onClose: () => {
          setLoaderId(null);
          navigate("/");
        }
      });
    } else if (cancelPlacedOffer.error !== null) {
      toast.error(cancelPlacedOffer.cancelPlacedoffer.data.message, {
        toastId: "cancelbuyoffer1" + Date.now(),
        onClose: () => {
          setLoaderId(null);
        }
      });
    }
  }, [cancelPlacedOffer.error]); // eslint-disable-line

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4 declinedSection">
          <>
            <Container>
              <br />
              <h5 className="text-white mb-5">
                Cancel your buy Offers, NFT is sold and Owner has changed.
                {/* {notifications !== null && notifications[0]?.message} */}
              </h5>
              <div className="table-responsive">
                <Table className="table-class">
                  <thead>
                    <tr>
                      <th className="t-header">NFT OWNER</th>
                      <th className="t-header">NFT ID</th>
                      <th className="t-header">Created On</th>
                      <th className="offer-action-th t-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications !== null &&
                      notifications !== undefined &&
                      notifications.map((val, key) => {
                        return (
                          <tr key={key}>
                            <td className="t-header text-wrap">
                              {val.nft_owner.substring(0, 9)} *****{" "}
                              {val.nft_owner.substring(
                                val.nft_owner.length - 5
                              )}
                            </td>
                            <td className="t-header text-wrap">
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
                            <td className="t-header">{val.createdAt}</td>
                            <td className="offer-cancel-btn">
                              <Button
                                variant="danger"
                                onClick={() => {
                                  setLoaderId(key);
                                  cancelplacedOffer(val);
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
                                  "Cancel"
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
      <ShowQRModal />
      <Footer />
    </>
  );
}
export default AllCancelPlacedOffer;
