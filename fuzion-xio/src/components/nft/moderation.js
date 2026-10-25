import React, { useEffect, useState } from "react";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import configData from "../../config.json";

function Moderation() {
  const [searchKey, setSearchKey] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`${configData.LOCAL_API_URL}v2/moderation`)
      .then((res) => res.json())
      .then((body) => setData(body.data))
      .catch(() => setData(null));
  }, []);

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">Safety</p>
            <h1>Reports, launches, verification</h1>
            <div className="dpmf-grid">
              <div className="dpmf-card">
                <h3>Open reports</h3>
                {(data?.reports || []).map((row) => (
                  <p key={row._id}>
                    {row.targetType} {row.targetId} · {row.reason} · {row.status}
                  </p>
                ))}
                {!data?.reports?.length && <p className="dpmf-muted">Queue is clear.</p>}
              </div>
              <div className="dpmf-card">
                <h3>Launchpad review</h3>
                {(data?.launches || []).map((row) => (
                  <p key={row._id}>
                    {row.name} · {row.status}
                  </p>
                ))}
              </div>
              <div className="dpmf-card">
                <h3>Verified collections</h3>
                {(data?.verifications || []).map((row) => (
                  <p key={row.slug}>
                    {row.name} · {row.status}
                  </p>
                ))}
              </div>
            </div>
          </Container>
        </div>
      )}
      <Footer />
    </>
  );
}

export default Moderation;
