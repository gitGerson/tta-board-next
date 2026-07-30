import type { ServerMessage } from "./protocol";

type Subscriber = (message: ServerMessage) => void;

type Hub = { channels: Map<string, Set<Subscriber>> };

/**
 * `server.ts` runs outside the Next.js compiler, so this module is evaluated
 * twice: once inside the Next bundle that server actions run in, and once in
 * the plain Node process that owns the sockets. Two module instances means two
 * empty registries and events that silently reach nobody, so the registry is
 * pinned to `globalThis` the same way `app/lib/db/client.ts` pins Prisma.
 */
const globalForHub = globalThis as unknown as { ttaRealtimeHub?: Hub };

const hub: Hub = (globalForHub.ttaRealtimeHub ??= { channels: new Map() });

export function subscribe(channel: string, subscriber: Subscriber): () => void {
  let subscribers = hub.channels.get(channel);

  if (!subscribers) {
    subscribers = new Set();
    hub.channels.set(channel, subscribers);
  }

  subscribers.add(subscriber);

  return () => {
    const current = hub.channels.get(channel);
    if (!current) return;
    current.delete(subscriber);
    if (current.size === 0) hub.channels.delete(channel);
  };
}

export function publish(channel: string, message: ServerMessage): void {
  const subscribers = hub.channels.get(channel);
  if (!subscribers) return;

  for (const subscriber of subscribers) {
    try {
      subscriber(message);
    } catch {
      // One broken socket must not stop the rest of the channel.
    }
  }
}

export function subscriberCount(channel: string): number {
  return hub.channels.get(channel)?.size ?? 0;
}
