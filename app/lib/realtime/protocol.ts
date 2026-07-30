/**
 * Shared between the browser and the Node server, so this module must stay
 * free of `server-only` and of any Node or React imports.
 */

export const REALTIME_PATH = "/realtime";

/** Board creation and deletion, which changes the board list rather than one board. */
export const BOARDS_CHANNEL = "boards";

/** A socket subscribing to every board at once is a bug, not a use case. */
export const MAX_CHANNELS_PER_SOCKET = 8;

export function boardChannel(boardId: string): string {
  return `board:${boardId}`;
}

export type ServerMessage =
  | { type: "ready" }
  /**
   * Deliberately carries no payload beyond its origin: the client re-renders
   * from the server rather than trying to replay the mutation locally, so the
   * board can never drift from the database.
   */
  | { type: "invalidate"; channel: string; actorId: string };

export type ClientMessage = { type: "subscribe"; channels: string[] };

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value !== "object" ||
      value === null ||
      (value as { type?: unknown }).type !== "subscribe"
    ) {
      return null;
    }
    const channels = (value as { channels?: unknown }).channels;
    if (!Array.isArray(channels)) return null;
    const valid = channels.filter(
      (channel): channel is string =>
        typeof channel === "string" && channel.length > 0 && channel.length <= 80,
    );
    return valid.length > 0
      ? { type: "subscribe", channels: valid.slice(0, MAX_CHANNELS_PER_SOCKET) }
      : null;
  } catch {
    return null;
  }
}
