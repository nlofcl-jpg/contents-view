export const GUEST_RISING_VIDEO_VIEW_LIMIT = 1;
export const GUEST_RISING_VIDEO_VIEW_KEY = "contents-view-guest-rising-video-views-v1";
const MEMBER_RISING_VIDEO_VIEW_KEY_PREFIX = "contents-view-member-rising-video-views-v1:";

type ViewStorage = Pick<Storage, "getItem" | "setItem">;

function consumeRisingVideoView(key: string, storage?: ViewStorage): boolean {
  try {
    const viewStorage = storage ?? window.localStorage;
    const storedCount = Number(viewStorage.getItem(key));
    const viewCount = Number.isFinite(storedCount) && storedCount > 0 ? Math.floor(storedCount) : 0;
    if (viewCount >= GUEST_RISING_VIDEO_VIEW_LIMIT) return false;
    viewStorage.setItem(key, String(viewCount + 1));
    return true;
  } catch {
    return false;
  }
}

export function consumeGuestRisingVideoView(storage?: ViewStorage): boolean {
  return consumeRisingVideoView(GUEST_RISING_VIDEO_VIEW_KEY, storage);
}

export function consumeMemberRisingVideoView(accountId: string, storage?: ViewStorage): boolean {
  return consumeRisingVideoView(MEMBER_RISING_VIDEO_VIEW_KEY_PREFIX + accountId, storage);
}
