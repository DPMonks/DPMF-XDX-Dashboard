import React, { useEffect, useState } from "react";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import configData from "../../config.json";

const DEMO_OWNER = "rFuzionXioDemoOwner11111111111111";

function Governance() {
  const [searchKey, setSearchKey] = useState(true);
  const [data, setData] = useState(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  const load = () => {
    fetch(`${configData.LOCAL_API_URL}v2/governance`)
      .then((res) => res.json())
      .then((body) => setData(body.data))
      .catch(() => setData(null));
  };

  useEffect(() => {
    load();
  }, []);

  const vote = async (id, support) => {
    const res = await fetch(`${configData.LOCAL_API_URL}v2/governance/${id}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: DEMO_OWNER, support, weight: 12.4 })
    });
    const body = await res.json();
    setNote(body.ok ? "Vote recorded (XIO-weighted)" : body.error || "Vote failed");
    load();
  };

  const propose = async () => {
    const res = await fetch(`${configData.LOCAL_API_URL}v2/governance`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, kind: "feature", body: title })
    });
    const body = await res.json();
    setNote(body.ok ? "Proposal opened" : body.error || "Failed");
    setTitle("");
    load();
  };

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">Governance</p>
            <h1>XIO-weighted proposals</h1>
            <div className="dpmf-card">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New proposal" />
              <button type="button" className="lgOut11" onClick={propose}>
                Open proposal
              </button>
            </div>
            {(data?.proposals || []).map((row) => (
              <div className="dpmf-card" key={row._id}>
                <h3>{row.title}</h3>
                <p className="dpmf-muted">
                  {row.kind} · {row.status} · yes {row.yes} / no {row.no}
                </p>
                <p>{row.body}</p>
                {row.status === "open" && (
                  <>
                    <button type="button" className="lgOut11" onClick={() => vote(row._id, true)}>
                      Vote yes
                    </button>
                    <button type="button" className="lgOut11" onClick={() => vote(row._id, false)}>
                      Vote no
                    </button>
                  </>
                )}
              </div>
            ))}
            {note && <p className="dpmf-muted">{note}</p>}
          </Container>
        </div>
      )}
      <Footer />
    </>
  );
}

export default Governance;
