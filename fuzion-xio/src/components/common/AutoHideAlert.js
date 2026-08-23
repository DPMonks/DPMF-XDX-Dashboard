import React, { useState, useEffect } from "react";
import { Alert } from "react-bootstrap";

const AutoHideAlert = ({
  message,
  variant = "success",
  show,
  onClose,
  delay = 3000
}) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [show, delay, onClose]);

  if (!show) return null;

  return (
    <Alert
      variant={variant}
      onClose={onClose}
      dismissible
      className="text-center shadow"
      style={{ fontWeight: "normal", fontSize: "14px" }}
    >
      {message}
    </Alert>
  );
};

export default AutoHideAlert;
