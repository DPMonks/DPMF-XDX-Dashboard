import React, { useState } from "react";
import { Container, Row, Col, Form, Button } from "react-bootstrap";
import { Account } from "@xrplf/secret-numbers";
import AutoHideAlert from "./AutoHideAlert";
import ConfirmationModal from "./ConfirmModal";

// Map letters A-Z to digits 0-9
const charToDigit = (char) => {
  if (!char) return 0;
  if (/[0-9]/.test(char)) return parseInt(char, 10);
  const code = char.toUpperCase().charCodeAt(0);
  if (code < 65 || code > 90) return 0;
  return (code - 65) % 10;
};

const GenerateFamilySeeds = ({ setIsIssuerKey, setVanityAddress }) => {
  const [rows, setRows] = useState(Array(8).fill(""));
  const [familySeed, setFamilySeed] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertVariant, setAlertVariant] = useState("success");
  const [alertShow, setAlertShow] = useState(false);
  const [showSeed, setShowSeed] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [show, setShow] = useState(false);

  const showAlert = (message, variant = "success") => {
    setAlertMessage(message);
    setAlertVariant(variant);
    setAlertShow(true);
  };

  const handleRowChange = (i, value) => {
    const lettersOnly = value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6);
    const newRows = [...rows];
    newRows[i] = lettersOnly.toUpperCase();
    setRows(newRows);
  };

  const handleGenerate = () => {
    if (rows.some((r) => r.length !== 6)) {
      showAlert("Each row must have exactly 6 letters or digits.", "danger");
      return;
    }

    try {
      const digitsRows = rows.map((row) => row.split("").map(charToDigit));
      const secretStr = digitsRows.map((r) => r.join("")).join(" "); // 8 groups
      const acct = new Account(secretStr); // generate Family Seed
      setFamilySeed(acct.getFamilySeed());
      setWalletAddress(acct.getAddress());

      showAlert("Family Seed generated successfully!", "success");
    } catch (err) {
      showAlert("Error generating family seed.", "danger");
    }
  };

  const handleReset = () => {
    setRows(Array(8).fill(""));
    setFamilySeed("");
    setAlertShow(false);
    setIsIssuerKey(null);
    setVanityAddress(null);
  };

  return (
    <Container fluid className="p-3">
      <h5 className="text-center mb-4">XRPL Secret Numbers → Family Seed</h5>
      <div className="mt-3 mb-4 seed-notes">
        <p>
          <sup className="super-script">* </sup>
          Generating your family seed will enable offer mint for all XRPL
          accounts.
        </p>
        <h6 className="font-normal">
          <sup className="super-script">* </sup> We never store your seed phrase
          in plain text. It’s always encrypted and kept safe, so even if someone
          attempts to access it, they’d only see unreadable data. You can feel
          confident knowing your NFT journey stays private and protected.
        </h6>
        {/* {walletAddress && (
          <div className="text-center pt-2 word-break">
            <h5 className="responsive-address">{walletAddress}</h5>
          </div>
        )} */}
      </div>
      <AutoHideAlert
        message={alertMessage}
        variant={alertVariant}
        show={alertShow}
        onClose={() => setAlertShow(false)}
        delay={3000}
      />

      {/* 8 rows - 6 letters/digits each */}
      <Row className="g-2">
        {rows.map((value, i) => {
          const label = String.fromCharCode(65 + i);
          return (
            <Col xs={12} md={6} key={i}>
              <div className="d-flex align-items-center gap-2">
                <div
                  style={{
                    width: "40px",
                    fontWeight: "bold",
                    fontSize: "20px",
                    textAlign: "center"
                  }}
                >
                  {label}
                </div>
                <Form.Control
                  type="text"
                  maxLength={11} // 6 letters/digits + 5 spaces
                  value={value.split("").join(" ")}
                  onChange={(e) => {
                    const lettersOnly = e.target.value
                      .replace(/[^a-zA-Z0-9]/g, "")
                      .slice(0, 6);
                    handleRowChange(i, lettersOnly);
                  }}
                  placeholder="X X X X X X"
                  className="text-center fw-bold"
                  style={{
                    fontSize: "15px",
                    padding: "8px",
                    letterSpacing: "12px"
                  }}
                />
              </div>
            </Col>
          );
        })}
      </Row>
      {/* Buttons */}
      <div className="d-flex justify-content-center gap-2 mt-4 mb-2 flex-wrap">
        <Button variant="primary" onClick={handleGenerate} className="w-20">
          Generate
        </Button>
        <Button variant="secondary" onClick={handleReset} className="w-20">
          Reset
        </Button>
      </div>

      {/* Family Seed Output */}
      {familySeed && (
        <div className="d-flex justify-content-center mt-5 mb-3">
          <div
            className="d-flex align-items-center"
            style={{
              width: "90%",
              border: "1px solid #ced4da",
              borderRadius: "3px",
              overflow: "hidden",
              marginLeft: "13px"
            }}
          >
            <Form.Control
              type={showSeed ? "text" : "password"}
              value={familySeed}
              readOnly
              placeholder="Will appear here..."
              style={{
                flex: "7",
                border: "none",
                borderRadius: 0
              }}
            />

            <Button
              variant="light"
              onClick={() => setShowSeed(!showSeed)}
              style={{
                flex: "0.5",
                borderRadius: 0,
                height: "100%"
              }}
            >
              <i className={showSeed ? "fas fa-eye-slash" : "fas fa-eye"}></i>
            </Button>

            <Button
              variant="primary"
              onClick={() => setShow(!show)} // or submit handler
              style={{
                flex: "3",
                borderRadius: 0,
                height: "100%"
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      )}
      <ConfirmationModal
        show={show}
        setShow={setShow}
        setWalletAddress={setWalletAddress}
        walletAddress={walletAddress}
        setVanityAddress={setVanityAddress}
        setIsIssuerKey={setIsIssuerKey}
        familySeed={familySeed}
      />
    </Container>
  );
};

export default GenerateFamilySeeds;
