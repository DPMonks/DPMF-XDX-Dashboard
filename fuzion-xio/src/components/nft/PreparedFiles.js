import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Button, Form } from "react-bootstrap";
import { BeatLoader } from "react-spinners";
import configData from "../../config.json";
import { PREPARED_ACCEPT, PREPARED_LABEL } from "../../const/filetypes";

function hostUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  const base = String(configData.LOCAL_API_URL || "/api/").replace(/\/?$/, "/");
  return url.startsWith("/") ? url : `${base}${url.replace(/^\/+/, "")}`;
}

function toFormItems(items) {
  return (items || []).map((item, index) => ({
    url: hostUrl(item.url),
    _id: index + 1,
    ftype: item.ext || item.kind,
    ctype: item.kind || item.ext,
    name: item.name,
    description: item.description || "",
    preparedId: item._id
  }));
}

export default function PreparedFiles({
  account,
  token,
  formData,
  validate,
  onApply,
  onCreated
}) {
  const [packs, setPacks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState("");

  const headers = token
    ? { Authorization: `Basic ${token}` }
    : {};

  const loadPacks = useCallback(async () => {
    try {
      const q = account ? `?address=${encodeURIComponent(account)}` : "";
      const res = await axios.get(`${configData.LOCAL_API_URL}mint/prepared${q}`);
      setPacks(res.data?.data?.docs || []);
    } catch {
      setPacks([]);
    }
  }, [account]);

  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  const uploadPack = async (event) => {
    const chosen = Array.from(event.target.files || []);
    event.target.value = "";
    if (!chosen.length) return;
    setBusy(true);
    try {
      const body = new FormData();
      chosen.forEach((file) => body.append("files", file));
      if (formData?.collectionName) body.append("name", formData.collectionName);
      if (account) body.append("wAddress", account);
      const res = await axios.post(`${configData.LOCAL_API_URL}mint/prepared`, body, {
        headers: { ...headers, "Content-Type": "multipart/form-data" }
      });
      toast.success(res.data?.message || "Files disseminated and ready to create", {
        toastId: "prepared-ok"
      });
      await loadPacks();
      const pack = res.data?.data;
      if (pack?.items?.length && onApply) {
        onApply(toFormItems(pack.items), pack);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not disseminate prepared files", {
        toastId: "prepared-err"
      });
    } finally {
      setBusy(false);
    }
  };

  const usePack = (pack) => {
    const ready = (pack.items || []).filter((item) => item.status !== "created");
    if (!ready.length) {
      toast.warn("Every file in this pack has already been created", {
        toastId: "prepared-empty"
      });
      return;
    }
    onApply?.(toFormItems(ready), pack);
    toast.success(`${ready.length} prepared file${ready.length === 1 ? "" : "s"} ready on this form`, {
      toastId: "prepared-use"
    });
  };

  const createPack = async (pack) => {
    if (validate && !validate(true)) return;
    setCreating(pack._id);
    try {
      const res = await axios.post(
        `${configData.LOCAL_API_URL}mint/prepared/${encodeURIComponent(pack._id)}/create`,
        {
          name: formData?.name || pack.name,
          collectionName: formData?.collectionName || pack.collectionName,
          category: formData?.category || "Digital Art",
          description: formData?.description || pack.description,
          externalurl: formData?.externalurl || "",
          metaverse: formData?.metaverse,
          price: formData?.price,
          accountNumber: account,
          issuer: account
        },
        { headers }
      );
      toast.success(res.data?.message || "Created NFTs from prepared files", {
        toastId: "prepared-create"
      });
      await loadPacks();
      onCreated?.(res.data?.Ids || []);
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not create prepared NFTs", {
        toastId: "prepared-create-err"
      });
    } finally {
      setCreating("");
    }
  };

  const removePack = async (pack) => {
    try {
      await axios.delete(
        `${configData.LOCAL_API_URL}mint/prepared/${encodeURIComponent(pack._id)}`,
        { headers }
      );
      await loadPacks();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not remove pack", {
        toastId: "prepared-del"
      });
    }
  };

  return (
    <div className="dpmf-prepared">
      <h4 className="dpmf-prepared-title">Pre-prepared files</h4>
      <p className="dpmf-prepared-copy">
        Add a .zip pack or a set of NFT files. They are disseminated and sit
        ready to create — no ledger reserve until you mint.
      </p>
      <Form.Group className="mb-3">
        <Form.Control
          type="file"
          accept={PREPARED_ACCEPT}
          multiple
          disabled={busy}
          onChange={uploadPack}
        />
        <Form.Label className="dpmf-prepared-label">
          {busy ? "Disseminating…" : `Select ${PREPARED_LABEL}`}
        </Form.Label>
      </Form.Group>
      {busy && (
        <div className="dpmf-prepared-busy">
          <BeatLoader size={8} color="#c770ff" />
        </div>
      )}
      {packs.map((pack) => {
        const ready = (pack.items || []).filter((item) => item.status !== "created").length;
        return (
          <div className="dpmf-prepared-pack" key={pack._id}>
            <div className="dpmf-prepared-pack-head">
              <strong>{pack.name || "Prepared pack"}</strong>
              <span>
                {ready} ready · {pack.items?.length || 0} files
              </span>
            </div>
            <ul className="dpmf-prepared-list">
              {(pack.items || []).slice(0, 8).map((item) => (
                <li key={item._id}>
                  <span>{item.name}</span>
                  <small>
                    {(item.kind || item.ext || "file").toUpperCase()} · {item.status}
                  </small>
                </li>
              ))}
              {(pack.items || []).length > 8 && (
                <li>
                  <small>+{pack.items.length - 8} more</small>
                </li>
              )}
            </ul>
            <div className="dpmf-prepared-actions">
              <Button
                variant="primary"
                size="sm"
                disabled={!ready}
                onClick={() => usePack(pack)}
              >
                Use on this form
              </Button>
              <Button
                variant="success"
                size="sm"
                disabled={!ready || creating === pack._id}
                onClick={() => createPack(pack)}
              >
                {creating === pack._id ? (
                  <BeatLoader size={8} color="#fff" />
                ) : (
                  "Create prepared NFTs"
                )}
              </Button>
              <Button variant="outline-light" size="sm" onClick={() => removePack(pack)}>
                Remove
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
