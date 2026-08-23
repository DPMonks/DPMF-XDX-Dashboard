import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { Modal, Button, Image } from "react-bootstrap";
import { cancelPayment } from "../../store/actions/wallet";
import { isMobile } from "react-device-detect";

const PaymentQRModal = ({
  setIsPaymentModal,
  setIsNotification,
  setisActive,
  qrModal,
  onCancel
}) => {
  const dispatch = useDispatch();
  const { visible, qr_url, next_url } = qrModal;

  const handleClose = async () => {
    await dispatch(cancelPayment());
    setIsNotification(false);
    setIsPaymentModal(false);
    setisActive(false);
    if (onCancel) onCancel();
  };

  return (
    <Modal show={visible} onHide={handleClose} centered backdrop="static">
      <Modal.Header closeButton className="position-relative">
        <Modal.Title className="position-absolute top-50 start-50 translate-middle w-100 text-center m-0 pe-4">
          Scan to Complete Payment
        </Modal.Title>
      </Modal.Header>

      <Modal.Body className="text-center py-4">
        <p className="text-muted mb-4">
          Please scan the QR code below with your XAMAN app to complete the
          payment.
        </p>

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

export default PaymentQRModal;
