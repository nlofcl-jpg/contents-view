import { describe, expect, it } from "vitest";
import {
  consumeGuestRisingVideoView,
  consumeMemberRisingVideoView,
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
  it("shares one view between the home page and the rising tab", () => {
    const storage = createStorage();
    const openFromHome = () => consumeGuestRisingVideoView(storage);
    const openFromRisingTab = () => consumeGuestRisingVideoView(storage);
    expect(openFromHome()).toBe(true);
    expect(openFromRisingTab()).toBe(false);
    expect(storage.getItem(GUEST_RISING_VIDEO_VIEW_KEY)).toBe("1");
  });

  it("blocks every later click, including another click on the same video", () => {
    const storage = createStorage();
    const openVideo = () => consumeGuestRisingVideoView(storage);
    expect(openVideo()).toBe(true);
    expect(openVideo()).toBe(false);
    expect(openVideo()).toBe(false);
    expect(storage.getItem(GUEST_RISING_VIDEO_VIEW_KEY)).toBe("1");
  });

  it("blocks access when the browser cannot persist the count", () => {
    const storage = {
      getItem: () => null,
      setItem: () => { throw new Error("Storage unavailable"); },
    };
    expect(consumeGuestRisingVideoView(storage)).toBe(false);
  });
});

describe("consumeMemberRisingVideoView", () => {
  it("shares the member's single view across surfaces and blocks the same video again", () => {
    const storage = createStorage();
    const openFromHome = () => consumeMemberRisingVideoView("member-a", storage);
    const openFromRisingTab = () => consumeMemberRisingVideoView("member-a", storage);
    expect(openFromHome()).toBe(true);
    expect(openFromHome()).toBe(false);
    expect(openFromRisingTab()).toBe(false);
  });

  it("keeps guest views and member accounts independent", () => {
    const storage = createStorage();
    expect(consumeGuestRisingVideoView(storage)).toBe(true);
    expect(consumeMemberRisingVideoView("member-a", storage)).toBe(true);
    expect(consumeMemberRisingVideoView("member-a", storage)).toBe(false);
    expect(consumeMemberRisingVideoView("member-b", storage)).toBe(true);
    expect(consumeGuestRisingVideoView(storage)).toBe(false);
  });
});
