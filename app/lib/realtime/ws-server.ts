import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, type WebSocket } from "ws";
import { SESSION_COOKIE, verifySessionToken } from "../auth/session-token";
import { subscribe } from "./hub";
import {
  MAX_CHANNELS_PER_SOCKET,
  REALTIME_PATH,
  parseClientMessage,
  type ServerMessage,
} from "./protocol";

const HEARTBEAT_MS = 30_000;

type LiveSocket = WebSocket & { isAlive?: boolean };

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }

  return null;
}

function reject(socket: Duplex, status: number, reason: string): void {
  socket.write(`HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

/**
 * Authenticates on the HTTP upgrade rather than on the first frame, so an
 * unauthenticated client never gets an open socket to send anything through.
 */
export function attachRealtimeServer(server: Server): void {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET is not configured.");
  }

  const wss = new WebSocketServer({ noServer: true, clientTracking: true });

  server.on("upgrade", (request: IncomingMessage, socket: Duplex, head) => {
    // Next.js owns its own upgrades (HMR in development); only claim ours.
    const { pathname } = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`,
    );

    if (pathname !== REALTIME_PATH) return;

    socket.on("error", () => socket.destroy());

    const token = readCookie(request.headers.cookie, SESSION_COOKIE);

    if (!token) {
      reject(socket, 401, "Unauthorized");
      return;
    }

    verifySessionToken(token, secret)
      .then((session) => {
        if (!session) {
          reject(socket, 401, "Unauthorized");
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit("connection", ws, request, session.user.id);
        });
      })
      .catch(() => reject(socket, 500, "Internal Server Error"));
  });

  wss.on("connection", (ws: LiveSocket) => {
    const unsubscribes = new Map<string, () => void>();

    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    function send(message: ServerMessage): void {
      if (ws.readyState !== ws.OPEN) return;
      ws.send(JSON.stringify(message));
    }

    ws.on("message", (raw) => {
      const message = parseClientMessage(raw.toString());
      if (!message) return;

      for (const [channel, unsubscribe] of unsubscribes) {
        if (!message.channels.includes(channel)) {
          unsubscribe();
          unsubscribes.delete(channel);
        }
      }

      for (const channel of message.channels) {
        if (unsubscribes.has(channel)) continue;
        if (unsubscribes.size >= MAX_CHANNELS_PER_SOCKET) break;
        unsubscribes.set(channel, subscribe(channel, send));
      }
    });

    ws.on("close", () => {
      for (const unsubscribe of unsubscribes.values()) unsubscribe();
      unsubscribes.clear();
    });

    ws.on("error", () => ws.terminate());

    send({ type: "ready" });
  });

  // Half-open connections (laptop lid closed, VPN dropped) never fire "close",
  // so they are reaped instead of accumulating subscriptions forever.
  const heartbeat = setInterval(() => {
    for (const client of wss.clients as Set<LiveSocket>) {
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, HEARTBEAT_MS);

  heartbeat.unref();
  wss.on("close", () => clearInterval(heartbeat));
}
