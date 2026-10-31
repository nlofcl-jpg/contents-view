export const BANNER_HIDDEN_UNTIL_KEY = "contents-view-banner-hidden-until";

export function nextKoreanMidnight(now: number): number {
  const day = 24 * 60 * 60 * 1000;
  const offset = 9 * 60 * 60 * 1000;
  return (Math.floor((now + offset) / day) + 1) * day - offset;
}

export function readBannerHiddenUntil(value: string | null, now: number): number {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > now ? timestamp : 0;
}
