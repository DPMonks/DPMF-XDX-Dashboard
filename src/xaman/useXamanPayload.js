import { useEffect, useRef, useState } from "react";
import { detectTradeExecution, isTradeTxjson } from "./detectExecution";
import { notifyTradeExecuted } from "./tradeTx";
import {
  createPayload,
  extractSignedAccount,
  getLedgerTx,
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
  const busyRef = useRef(false);

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
    busyRef.current = false;
    clearTimers();
    setQr(null);
    setMobileUrl(null);
    setUuid(null);
    setStatus("idle");
  };

  useEffect(() => {
    return () => {
      sessionRef.current = nextPayloadSession(sessionRef.current);
      busyRef.current = false;
      clearTimers();
    };
  }, []);

  async function start({ body = {}, onSigned, onExecuted, errorMessage } = {}) {
    if (busyRef.current) return;
    busyRef.current = true;
    const session = nextPayloadSession(sessionRef.current);
    sessionRef.current = session;
    const watchTrade = isTradeTxjson(body?.txjson) || body?.txjson?.TransactionType === "AMMVote";
    let announced = false;
    let finishing = false;
    let latestPayload = null;
    let latestSocket = null;
    let latestLedger = null;

    const announce = (detection) => {
      if (announced || !detection?.executed) return false;
      announced = true;
      onExecuted?.(detection);
      if (watchTrade) notifyTradeExecuted({ ...detection, txjson: body?.txjson });
      return true;
    };

    const inspect = async () => {
      if (latestPayload?.response?.txid || latestPayload?.meta?.signed) {
        const hash = detectTradeExecution({ payload: latestPayload, socket: latestSocket }).txid;
        if (hash) latestLedger = (await getLedgerTx(hash).catch(() => null)) || latestLedger;
      }
      return detectTradeExecution({
        payload: latestPayload,
        socket: latestSocket,
        ledger: latestLedger,
      });
    };

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

      const finish = async (account, result) => {
        if (finishing || !payloadSessionOpen(session, sessionRef.current)) return;
        finishing = true;
        if (result) latestPayload = result;
        const detection = await inspect();
        if (account || detection.signed || detection.executed) {
          onSigned?.(account || extractSignedAccount(result), result);
        }
        if (watchTrade) {
          if (announce(detection)) {
            reset();
            setStatus("signed");
            return;
          }
          const started = Date.now();
          while (payloadSessionOpen(session, sessionRef.current) && Date.now() - started < 20000) {
            const next = await getPayloadResult(payload.uuid).catch(() => null);
            if (next) latestPayload = next;
            const again = await inspect();
            if (announce(again)) {
              reset();
              setStatus("signed");
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, 1500));
          }
        }
        reset();
        setStatus("signed");
      };

      const settle = async () => {
        const result = await getPayloadResult(payload.uuid);
        if (result) latestPayload = result;
        const detection = await inspect();
        if (detection.rejected) {
          reset();
          return;
        }
        if (detection.signed || detection.executed || extractSignedAccount(result)) {
          await finish(extractSignedAccount(result), result);
        }
      };

      pollRef.current = setInterval(() => {
        if (!payloadSessionOpen(session, sessionRef.current)) return;
        settle().catch(() => {});
      }, 2000);

      if (payload.websocket) {
        const socket = new WebSocket(payload.websocket);
        socketRef.current = socket;

        socket.onmessage = async (event) => {
          if (!payloadSessionOpen(session, sessionRef.current)) return;
          const data = JSON.parse(event.data);
          latestSocket = data;
          if (data.expired && !data.signed) {
            reset();
            return;
          }
          if (!data.signed) return;
          const result = await getPayloadResult(payload.uuid);
          if (result) latestPayload = result;
          await finish(extractSignedAccount(result) || data.account, result);
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
