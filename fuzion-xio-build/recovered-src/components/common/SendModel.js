import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useDispatch } from "react-redux";
import { Modal, Table, Button } from "react-bootstrap";
import {
  sendStatusAction,
  checkAcceptAction,
  declinedNFTRequestAction
} from "../../store/actions/send";
import ShowQRModal from "./ShowQRModel";

function SendModel() {
  let dispatch = useDispatch();
  const [sendModel, setSendModel] = useState(false);
  const [sendData, setSendData] = useState([]);
  const [loadingRow, setLoadingRow] = useState(null); // nft_id of row being processed
  const [declineLoading, setDeclineLoading] = useState(null);

  const token = localStorage.getItem("jwtToken");

  useEffect(() => {
    if (token !== null) {
      dispatch(sendStatusAction({ token, loader: true }))
        .then(async (res) => {
          if (res.data.sendDataLength.length > 0) {
            setSendModel(true);
            setSendData(res.data.sendDataLength);
          } else {
            setSendModel(false);
          }
        })
        .catch((error) => {
          setSendModel(false);
        });
    }
  }, []); // eslint-disable-line

  const checkAcceptNft = async (val) => {
    setLoadingRow(val.nft_id);
    try {
      const result = await dispatch(checkAcceptAction(val));
      const { error, success, message, balance, cancelled } = result?.data || {};
      if (cancelled) return;
      if (balance === false) {
        toast.error(message, { toastId: "error111" + Date.now() });
        return;
      }
      if (success || error) {
        const rs = await dispatch(sendStatusAction({ token, loader: true }));
        setSendData(rs?.data?.sendDataLength || []);
        if (!rs?.data?.sendDataLength?.length) setSendModel(false);
        if (error) toast.error(message, { toastId: "error" + Date.now() });
        if (success) toast.success(message, { toastId: "receivenft" + Date.now() });
      }
    } finally {
      setLoadingRow(null);
    }
  };

  const handleSendModel = () => setSendModel(false);
  const acceptOffer = async (val) => {
    await checkAcceptNft(val);
  };
  const declineOffer = async (val) => {
    setDeclineLoading(val.nft_id);
    try {
      const data = await dispatch(declinedNFTRequestAction(val));
      if (data?.data?.success) {
        const rs = await dispatch(sendStatusAction({ token, loader: true }));
        setSendData(rs?.data?.sendDataLength || []);
        if (!rs?.data?.sendDataLength?.length) setSendModel(false);
        toast.success(data?.data?.message || "Declined", {
          toastId: "declined" + Date.now()
        });
      } else {
        toast.error(data?.data?.message || "Failed to decline", {
          toastId: "declinedErr" + Date.now()
        });
      }
    } catch (e) {
      toast.error("Failed to decline", { toastId: "declinedErr" + Date.now() });
    } finally {
      setDeclineLoading(null);
    }
  };

  return (
    <>
      <Modal
        show={sendModel}
        className="sendModal modal"
        onHide={handleSendModel}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <strong className="text-info"> Accept Free NFT</strong>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <br />
          <h5>
            You have been sent a NFT from the below details, please ‘Accept’ or
            ‘Decline’ the transaction.
          </h5>
          <Table className="freenft-table">
            <thead>
              <tr>
                <th>NFT ID</th>
              </tr>
            </thead>
            <tbody>
              {sendData.map((val, i) => {
                return (
                  <tr key={i}>
                    <td>
                      {val.nft_id ? (
                        <a
                          target="_blank"
                          rel="noreferrer"
                          href={`https://bithomp.com/explorer/${val.nft_id}`}
                          className=""
                        >
                          {val.nft_id.substring(0, 9)} *****{" "}
                          {val.nft_id.substring(val.nft_id.length - 5)}
                        </a>
                      ) : (
                        ""
                      )}
                    </td>
                    <td align="center">
                      <Button
                        variant="success"
                        onClick={() => acceptOffer(val)}
                        className="BuyNFT buttonMobile_None"
                        disabled={loadingRow || declineLoading}
                      >
                        {loadingRow === val.nft_id ? "..." : "Accept"}
                      </Button>

                      <Button
                        variant="success"
                        onClick={() => acceptOffer(val)}
                        className="BuyNFT buttonDesktop_None"
                        disabled={loadingRow || declineLoading}
                      >
                        <i className="fa fa-check" aria-hidden="true"></i>
                      </Button>
                    </td>
                    <td align="center">
                      <Button
                        variant="danger"
                        onClick={() => declineOffer(val)}
                        className="BuyNFT buttonMobile_None"
                        disabled={loadingRow || declineLoading}
                      >
                        {declineLoading === val.nft_id ? "..." : "Decline"}
                      </Button>

                      <Button
                        className="BuyNFT buttonDesktop_None"
                        onClick={() => declineOffer(val)}
                        variant="danger"
                        disabled={loadingRow || declineLoading}
                      >
                        <i className="fa fa-times" aria-hidden="true"></i>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <br />
        </Modal.Body>
      </Modal>
      <ShowQRModal
        title="Accept NFT"
        onCancel={() => setLoadingRow(null)}
      />
    </>
  );
}
export default SendModel;
