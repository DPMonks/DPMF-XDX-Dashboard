import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { Modal, Button, Image } from "react-bootstrap";
import { cancelTransactionPolling } from "../../helper";
import { actionTypes } from "../../store/actionTypes/wallet";
import { isMobile } from "react-device-detect";

const ShowQRModal = ({
  onCancel,
  title: titleProp,
  bodyText: bodyTextProp
}) => {
  const dispatch = useDispatch();
  const {
    visible,
    qr_url,
    next_url,
    uuid,
    title: titleFromStore,
    bodyText: bodyTextFromStore
  } = useSelector((state) => state.qrModal);

  const title = titleFromStore || titleProp || "Sign with XAMAN";
  const bodyText =
    bodyTextFromStore ||
    bodyTextProp ||
    "Please scan the QR code below with your XAMAN app to sign the transaction.";

  const handleClose = () => {
    cancelTransactionPolling(uuid); // stop polling
    dispatch({ type: actionTypes.HIDE_PAYMENT_QR }); // hide modal
    onCancel?.(); // optional per-component cleanup
  };

  return (
    <Modal show={visible} onHide={handleClose} centered backdrop="static">
      <Modal.Header closeButton className="position-relative">
        <Modal.Title className="position-absolute top-50 start-50 translate-middle w-100 text-center m-0 pe-4">
          {title}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="text-center py-4">
        <p className="text-muted mb-4">{bodyText}</p>

        {qr_url && (
          <Image
            src={qr_url}
            alt="XAMAN Payment QR Code"
            style={{ width: 220, height: 220 }}
            className="mb-4 border rounded p-2"
          />
        )}

        {isMobile && next_url && (
          <div>
            <a
              href={next_url}
              className="btn btn-primary w-100"
              target="_blank"
              rel="noreferrer"
            >
              Open in XAMAN App
            </a>
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="outline-secondary" onClick={handleClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ShowQRModal;
