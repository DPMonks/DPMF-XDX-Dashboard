import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Accordion from "react-bootstrap/Accordion";
import configData from "../../config.json";

const DEMO_BIDDER = "rFuzionXioDemoBidder1111111111111";

function NftMarketplacePanel({ nft, address }) {
  const id = nft?._id;
  const from = address || DEMO_BIDDER;
  const [quote, setQuote] = useState(null);
  const [integrity, setIntegrity] = useState(null);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [reason, setReason] = useState("spam");
  const [note, setNote] = useState("");

  const load = () => {
    if (!id) return;
    fetch(`${configData.LOCAL_API_URL}v2/quote/${id}`)
      .then((res) => res.json())
      .then((body) => {
        setQuote(body.data || null);
        setIntegrity(body.integrity || null);
      })
      .catch(() => {
        setQuote(null);
        setIntegrity(null);
      });
    fetch(`${configData.LOCAL_API_URL}v2/nft/${id}/social`)
      .then((res) => res.json())
      .then((body) => setComments(body.data?.comments || []))
      .catch(() => setComments([]));
  };

  useEffect(() => {
    load();
  }, [id]);

  const post = async (path, body) => {
    const res = await fetch(`${configData.LOCAL_API_URL}v2/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    return res.json();
  };

  if (!id) return null;

  return (
    <Accordion.Item eventKey="v2-desk">
      <Accordion.Header>Fees, royalty, and community</Accordion.Header>
      <Accordion.Body>
        <p className="dpmf-muted">
          {integrity?.badge || "File hash pending"}
          {nft?.royaltyBps
            ? ` · royalty ${((nft.royaltyBps || 0) / 100).toFixed(1)}%`
            : ""}
          {nft?.royaltyRecipient
            ? ` to ${String(nft.royaltyRecipient).slice(0, 8)}…`
            : ""}
        </p>
        {quote && (
          <p>
            List {quote.amount} {quote.currency} · marketplace {quote.marketplace?.amount}{" "}
            ({quote.marketplace?.label}) · royalty {quote.royalty?.amount} · seller
            net {quote.sellerNet}. {quote.network?.note}
          </p>
        )}
        <p>
          <Link to={`/creator/${nft.issuer || nft.Issuer || nft.accountNumber}`}>
            Creator desk
          </Link>
          {nft.collectionSlug || nft.collectionName ? (
            <>
              {" · "}
              <Link
                to={`/explore/${nft.collectionSlug || String(nft.collectionName || "").toLowerCase().replace(/\s+/g, "-")}`}
              >
                Collection
              </Link>
            </>
          ) : null}
        </p>
        <button
          type="button"
          className="lgOut11"
          onClick={async () => {
            const body = await post("follow", {
              from,
              target: nft.issuer || nft.accountNumber,
              kind: "creator"
            });
            setNote(body.following ? "Following creator" : "Unfollowed creator");
          }}
        >
          Follow creator
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Comment"
        />
        <button
          type="button"
          className="lgOut11"
          onClick={async () => {
            const body = await post("comments", { nftId: id, from, text });
            if (body.ok) setText("");
            setNote(body.ok ? "Comment posted" : body.error || "Comment failed");
            load();
          }}
        >
          Comment
        </button>
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="spam">Spam</option>
          <option value="fraud">Fraud</option>
          <option value="abuse">Abuse</option>
        </select>
        <button
          type="button"
          className="lgOut11"
          onClick={async () => {
            const body = await post("report", {
              targetType: "nft",
              targetId: id,
              reason,
              from
            });
            setNote(body.ok ? "Report sent to moderation" : body.error || "Report failed");
          }}
        >
          Report
        </button>
        {note && <p className="dpmf-muted">{note}</p>}
        {(comments || []).map((row) => (
          <p key={row._id}>
            {row.text}{" "}
            <span className="dpmf-muted">
              · {String(row.from || "").slice(0, 8)}…
            </span>
          </p>
        ))}
      </Accordion.Body>
    </Accordion.Item>
  );
}

export default NftMarketplacePanel;
