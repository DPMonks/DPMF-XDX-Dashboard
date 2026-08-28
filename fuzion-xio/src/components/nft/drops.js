import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import configData from "../../config.json";

function countdown(iso) {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Live";
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

function Drops() {
  const { slug } = useParams();
  const [searchKey, setSearchKey] = useState(true);
  const [drops, setDrops] = useState([]);
  const [drop, setDrop] = useState(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    fetch(`${configData.LOCAL_API_URL}v2/drops`)
      .then((res) => res.json())
      .then((body) => setDrops(body.data || []))
      .catch(() => setDrops([]));
  }, []);

  useEffect(() => {
    if (!slug) return setDrop(null);
    fetch(`${configData.LOCAL_API_URL}v2/drops/${slug}`)
      .then((res) => res.json())
      .then((body) => setDrop(body.data || null))
      .catch(() => setDrop(null));
  }, [slug]);

  const submitLaunch = async () => {
    const res = await fetch(`${configData.LOCAL_API_URL}v2/launchpad`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, description: desc })
    });
    const body = await res.json();
    setNote(body.ok ? "Launch submitted for review" : body.error || "Failed");
  };

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">Drops + launchpad</p>
            <h1>{drop?.name || "Scheduled mints"}</h1>
            {drop ? (
              <div className="dpmf-card">
                <p>{drop.description}</p>
                <p>
                  Starts {countdown(drop.startsAt)} · {drop.price} {drop.currency}
                </p>
                <p className="dpmf-muted">
                  Allowlist {drop.allowlist?.length || 0} · pre-mint then public
                </p>
                <Link to={`/explore/${drop.slug?.replace(/-horizon$/, "") || "fuzion-3d"}`}>
                  Collection
                </Link>
              </div>
            ) : (
              <div className="dpmf-grid">
                {drops.map((row) => (
                  <Link key={row._id} to={`/drops/${row.slug}`} className="dpmf-card dpmf-card-link">
                    <h3>{row.name}</h3>
                    <p>{countdown(row.startsAt)}</p>
                  </Link>
                ))}
              </div>
            )}
            <h3>Launchpad</h3>
            <div className="dpmf-card">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Collection name" />
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Review notes, assets, schedule" />
              <button type="button" className="lgOut11" onClick={submitLaunch}>
                Submit for review
              </button>
              {note && <p className="dpmf-muted">{note}</p>}
            </div>
          </Container>
        </div>
      )}
      <Footer />
    </>
  );
}

export default Drops;
