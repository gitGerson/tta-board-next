import { describe, expect, it, vi } from "vitest";
import { publish, subscribe, subscriberCount } from "./hub";
import { MAX_CHANNELS_PER_SOCKET, parseClientMessage } from "./protocol";

describe("hub", () => {
  it("delivers a message to every subscriber of the channel", () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribe("board:a", first);
    const unsubscribeSecond = subscribe("board:a", second);

    publish("board:a", { type: "invalidate", channel: "board:a", actorId: "u1" });

    expect(first).toHaveBeenCalledWith({
      type: "invalidate",
      channel: "board:a",
      actorId: "u1",
    });
    expect(second).toHaveBeenCalledOnce();

    unsubscribeFirst();
    unsubscribeSecond();
  });

  it("does not leak across channels", () => {
    const listener = vi.fn();
    const unsubscribe = subscribe("board:b", listener);

    publish("board:c", { type: "invalidate", channel: "board:c", actorId: "u1" });

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("forgets the channel once its last subscriber leaves", () => {
    const unsubscribe = subscribe("board:d", vi.fn());
    expect(subscriberCount("board:d")).toBe(1);

    unsubscribe();

    expect(subscriberCount("board:d")).toBe(0);
  });

  it("keeps delivering after one subscriber throws", () => {
    const broken = vi.fn(() => {
      throw new Error("socket already closed");
    });
    const healthy = vi.fn();
    const unsubscribeBroken = subscribe("board:e", broken);
    const unsubscribeHealthy = subscribe("board:e", healthy);

    expect(() =>
      publish("board:e", {
        type: "invalidate",
        channel: "board:e",
        actorId: "u1",
      }),
    ).not.toThrow();
    expect(healthy).toHaveBeenCalledOnce();

    unsubscribeBroken();
    unsubscribeHealthy();
  });
});

describe("parseClientMessage", () => {
  it("accepts a well-formed subscribe frame", () => {
    expect(
      parseClientMessage('{"type":"subscribe","channels":["board:a"]}'),
    ).toEqual({ type: "subscribe", channels: ["board:a"] });
  });

  it.each([
    ["malformed json", "{not json"],
    ["an unknown type", '{"type":"publish","channels":["board:a"]}'],
    ["a missing channel list", '{"type":"subscribe"}'],
    ["a non-array channel list", '{"type":"subscribe","channels":"board:a"}'],
    ["an empty channel list", '{"type":"subscribe","channels":[]}'],
    ["only invalid channels", '{"type":"subscribe","channels":[1,null,""]}'],
  ])("rejects %s", (_label, raw) => {
    expect(parseClientMessage(raw)).toBeNull();
  });

  it("caps how many channels one socket can claim", () => {
    const channels = Array.from({ length: 40 }, (_, index) => `board:${index}`);

    const parsed = parseClientMessage(
      JSON.stringify({ type: "subscribe", channels }),
    );

    expect(parsed?.channels).toHaveLength(MAX_CHANNELS_PER_SOCKET);
  });
});
