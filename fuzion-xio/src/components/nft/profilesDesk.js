import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Container } from "react-bootstrap";
import Header from "../common/header";
import Footer from "../common/footer";
import configData from "../../config.json";
import { profileMediaUrl } from "../../helper/profileMedia";
import DummyProfile from "../../assets/defaultpimage.jpg";
import Banner from "../../assets/profilelargebanner.png";

function ProfilesDesk() {
  const [searchKey, setSearchKey] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetch(`${configData.LOCAL_API_URL}profiles`)
      .then((res) => res.json())
      .then((body) => setRows(body.data || []))
      .catch(() => setRows([]));
  }, []);

  return (
    <>
      <Header setSearchKey={setSearchKey} />
      {searchKey && (
        <div className="gradientBg py-4">
          <Container className="dpmf-market">
            <p className="dpmf-kicker">Personal profiles</p>
            <h1>Profiles</h1>
            <p className="dpmf-muted">
              First-class identity on FUZION-XIO: picture, background, bio, and
              a share link that shows the profile image on social media.
            </p>
            <div className="dpmf-grid">
              {rows.map((row) => (
                <Link
                  key={row.wAddress}
                  to={`/Profile/${row.wAddress}`}
                  className="dpmf-card dpmf-card-link dpmf-profile-card"
                >
                  <div
                    className="dpmf-profile-banner"
                    style={{
                      backgroundImage: `url(${profileMediaUrl(
                        row.dBanner || row.pBanner,
                        Banner
                      )})`
                    }}
                  />
                  <img
                    className="dpmf-profile-avatar"
                    src={profileMediaUrl(row.pImage, DummyProfile)}
                    alt={row.pName || row.wAddress}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = DummyProfile;
                    }}
                  />
                  <h3>{row.pName || "Unnamed"}</h3>
                  <p>{row.tagline || row.bio || "—"}</p>
                  <p className="dpmf-muted">
                    {row.rank} · vScore {row.vScore} · {row.badge}
                  </p>
                  {row.location && (
                    <p className="dpmf-muted">{row.location}</p>
                  )}
                </Link>
              ))}
            </div>
          </Container>
        </div>
      )}
      <Footer />
    </>
  );
}

export default ProfilesDesk;
