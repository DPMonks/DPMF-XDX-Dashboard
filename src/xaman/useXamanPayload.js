import { useEffect, useRef, useState } from "react";
import {
  createPayload,
  extractSignedAccount,
  getPayloadResult,
} from "./xamanClient";
import { nextPayloadSession, payloadSessionOpen } from "./payloadSession";

export { nextPayloadSession, payloadSessionOpen };

export function useXamanPayload() {
  const [qr, setQr] = useState(null);
  const [mobileUrl, setMobileUrl] = useState(null);
  const [uuid, setUuid] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const timeoutRef = useRef(null);
  const pollRef = useRef(null);
  const sessionRef = useRef(0);

  const clearTimers = () => {
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

  const reset = () => {
    sessionRef.current = nextPayloadSession(sessionRef.current);
    clearTimers();
    setQr(null);
    setMobileUrl(null);
    setUuid(null);
    setStatus("idle");
  };

  useEffect(() => {
    return () => {
      sessionRef.current = nextPayloadSession(sessionRef.current);
      clearTimers();
    };
  }, []);

  async function start({ body = {}, onSigned, errorMessage } = {}) {
    if (status === "loading" || status === "waiting") return;
    const session = nextPayloadSession(sessionRef.current);
    sessionRef.current = session;

    try {
      setError(null);
      setStatus("loading");

      const payload = await createPayload(body);
      if (!payloadSessionOpen(session, sessionRef.current)) return;
      setQr(payload.qr);
      setMobileUrl(payload.mobileUrl);
      setUuid(payload.uuid);
      setStatus("waiting");

      timeoutRef.current = setTimeout(() => {
        if (payloadSessionOpen(session, sessionRef.current)) reset();
      }, 120000);

      const finish = (account, result) => {
        if (!payloadSessionOpen(session, sessionRef.current) || !account) return;
        onSigned?.(account, result);
        reset();
        setStatus("signed");
      };

      const settle = async () => {
        const result = await getPayloadResult(payload.uuid);
        finish(extractSignedAccount(result), result);
      };

      pollRef.current = setInterval(() => {
        if (!payloadSessionOpen(session, sessionRef.current)) return;
        settle().catch(() => {});
      }, 2500);

      if (payload.websocket) {
        const socket = new WebSocket(payload.websocket);
        socketRef.current = socket;

        socket.onmessage = async (event) => {
          if (!payloadSessionOpen(session, sessionRef.current)) return;
          const data = JSON.parse(event.data);
          if (!data.signed) return;
          const result = await getPayloadResult(payload.uuid);
          finish(extractSignedAccount(result) || data.account, result);
        };

        socket.onerror = () => {
          if (!payloadSessionOpen(session, sessionRef.current)) return;
          setError(errorMessage);
        };
      }
    } catch (err) {
      if (!payloadSessionOpen(session, sessionRef.current)) return;
      console.error("Xaman payload error:", err);
      setError(err.message || errorMessage);
      reset();
    }
  }

  return { qr, mobileUrl, uuid, status, error, start, reset };
}
