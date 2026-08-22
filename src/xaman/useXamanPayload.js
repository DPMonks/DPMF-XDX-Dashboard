import { useEffect, useRef, useState } from "react";
import {
  createPayload,
  extractSignedAccount,
  getPayloadResult,
} from "./xamanClient";

export function useXamanPayload() {
  const [qr, setQr] = useState(null);
  const [mobileUrl, setMobileUrl] = useState(null);
  const [uuid, setUuid] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const timeoutRef = useRef(null);
  const pollRef = useRef(null);

  const reset = () => {
    setQr(null);
    setMobileUrl(null);
    setUuid(null);
    setStatus("idle");
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function start({ body = {}, onSigned, errorMessage } = {}) {
    if (status === "loading" || status === "waiting") return;

    try {
      setError(null);
      setStatus("loading");

      const payload = await createPayload(body);
      setQr(payload.qr);
      setMobileUrl(payload.mobileUrl);
      setUuid(payload.uuid);
      setStatus("waiting");

      timeoutRef.current = setTimeout(() => {
        reset();
      }, 120000);

      const finish = (account, result) => {
        if (!account) return;
        onSigned?.(account, result);
        reset();
        setStatus("signed");
      };

      const settle = async () => {
        const result = await getPayloadResult(payload.uuid);
        finish(extractSignedAccount(result), result);
      };

      pollRef.current = setInterval(() => {
        settle().catch(() => {});
      }, 2500);

      if (payload.websocket) {
        const socket = new WebSocket(payload.websocket);
        socketRef.current = socket;

        socket.onmessage = async (event) => {
          const data = JSON.parse(event.data);
          if (!data.signed) return;
          const result = await getPayloadResult(payload.uuid);
          finish(extractSignedAccount(result) || data.account, result);
        };

        socket.onerror = () => {
          setError(errorMessage);
        };
      }
    } catch (err) {
      console.error("Xaman payload error:", err);
      setError(err.message || errorMessage);
      reset();
    }
  }

  return { qr, mobileUrl, uuid, status, error, start, reset };
}
