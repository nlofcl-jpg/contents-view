import { describe, expect, it } from "vitest";
import {
  consumeGuestRisingVideoView,
  GUEST_RISING_VIDEO_VIEW_KEY,
} from "../client/src/lib/guestRisingVideoViews";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe("consumeGuestRisingVideoView", () => {
  it("allows two views across callers and blocks the third", () => {
    const storage = createStorage();
    expect(consumeGuestRisingVideoView(storage)).toBe(true);
    expect(consumeGuestRisingVideoView(storage)).toBe(true);
    expect(consumeGuestRisingVideoView(storage)).toBe(false);
    expect(storage.getItem(GUEST_RISING_VIDEO_VIEW_KEY)).toBe("2");
  });

  it("blocks access when the browser cannot persist the count", () => {
    const storage = {
      getItem: () => null,
      setItem: () => { throw new Error("Storage unavailable"); },
    };
    expect(consumeGuestRisingVideoView(storage)).toBe(false);
  });
});
