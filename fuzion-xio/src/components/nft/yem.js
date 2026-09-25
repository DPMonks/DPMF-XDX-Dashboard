import React, { useState } from "react";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";

function Yem() {
  const [searchKey, setSearchKey] = useState(true);

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-yem">
            <p className="dpmf-kicker">Y.E.M.2</p>
            <h1>Yield Earning Mechanism</h1>
          </Container>
        </div>
      )}
      <Footer />
    </>
  );
}

export default Yem;
