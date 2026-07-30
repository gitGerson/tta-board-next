"use client";

import { useEffect, useRef } from "react";
import { REALTIME_PATH, type ServerMessage } from "./protocol";

const FIRST_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

function socketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${REALTIME_PATH}`;
}

/**
 * Subscribes to realtime invalidations for `channels` and calls `onInvalidate`
 * when another user changes something. The board still refreshes itself after
 * its own mutations, so a dropped socket degrades to the previous behaviour
 * rather than breaking the page.
 */
export function useRealtime(
  channels: string[],
  currentUserId: string,
  onInvalidate: () => void,
): void {
  const handlerRef = useRef(onInvalidate);
  // Effects below depend on the channel list by value, not by array identity,
  // so a caller does not have to memoise it.
  const key = channels.join(",");

  useEffect(() => {
    handlerRef.current = onInvalidate;
  });

  useEffect(() => {
    if (!key) return;

    const subscribeTo = key.split(",");
    let socket: WebSocket | null = null;
    let retryMs = FIRST_RETRY_MS;
    let retryTimer: number | undefined;
    let closed = false;

    function connect(): void {
      if (closed) return;

      const ws = new WebSocket(socketUrl());
      socket = ws;

      ws.addEventListener("open", () => {
        retryMs = FIRST_RETRY_MS;
        ws.send(JSON.stringify({ type: "subscribe", channels: subscribeTo }));
      });

      ws.addEventListener("message", (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }
        if (message.type !== "invalidate") return;
        if (!subscribeTo.includes(message.channel)) return;
        // The actor already refreshed itself when its action resolved.
        if (message.actorId === currentUserId) return;
        handlerRef.current();
      });

      ws.addEventListener("close", () => {
        if (closed || socket !== ws) return;
        socket = null;
        retryTimer = window.setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
      });

      // "close" always follows "error", so reconnection is handled there.
      ws.addEventListener("error", () => ws.close());
    }

    connect();

    return () => {
      closed = true;
      window.clearTimeout(retryTimer);
      socket?.close();
      socket = null;
    };
  }, [key, currentUserId]);
}
