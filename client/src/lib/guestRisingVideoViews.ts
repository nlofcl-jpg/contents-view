export const GUEST_RISING_VIDEO_VIEW_LIMIT = 2;
export const GUEST_RISING_VIDEO_VIEW_KEY = "contents-view-guest-rising-video-views-v1";

export function consumeGuestRisingVideoView(storage?: Pick<Storage, "getItem" | "setItem">, limit = GUEST_RISING_VIDEO_VIEW_LIMIT): boolean {
  try {
    const viewStorage = storage ?? window.localStorage;
    const storedCount = Number(viewStorage.getItem(GUEST_RISING_VIDEO_VIEW_KEY));
    const viewCount = Number.isFinite(storedCount) && storedCount > 0 ? Math.floor(storedCount) : 0;
    if (viewCount >= limit) return false;
    viewStorage.setItem(GUEST_RISING_VIDEO_VIEW_KEY, String(viewCount + 1));
    return true;
  } catch {
    return false;
  }
}
