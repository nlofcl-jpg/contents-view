import { useEffect, useRef, useState } from "react";
import { getSeoulDate } from "@shared/searchTrendDailyRanking";
import { trpc } from "@/lib/trpc";

type RankedKeyword = { rank: number; keyword: string };
const EMPTY_RANKING: never[] = [];

function readSavedRanking<T extends RankedKeyword>(key: string): { date: string; ranking: T[] } | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
    if (saved?.date === getSeoulDate() && Array.isArray(saved.ranking) && saved.ranking.length <= 50 &&
      saved.ranking.every((item: RankedKeyword) => item && typeof item.keyword === "string" && Number.isInteger(item.rank))) {
      return saved;
    }
  } catch {
    // Storage can be blocked or cleared without affecting the live list.
  }
  return null;
}

export function useRetainedRanking<T extends RankedKeyword>(
  source: "google" | "contents",
  ranking: T[] | undefined,
  timestamp?: (ranking: T[]) => number,
) {
  const key = `contents-view:live-ranking:v1:${source}`;
  const date = getSeoulDate();
  const [initial] = useState(() => readSavedRanking<T>(key));
  const saved = useRef(initial);
  const previous = saved.current?.date === date ? saved.current.ranking : EMPTY_RANKING;
  const next = ranking?.length && (!timestamp || !previous.length || timestamp(ranking) >= timestamp(previous)) ? ranking : previous;
  useEffect(() => {
    if (!next.length || saved.current?.ranking === next) return;
    saved.current = { date, ranking: next };
    try {
      localStorage.setItem(key, JSON.stringify(saved.current));
    } catch {
      // The current page can still retain the last nonempty response.
    }
  }, [date, key, next]);

  return next;
}

function rankingTimestamp(ranking: { lastSeenAt: string }[]) {
  return ranking.reduce((latest, item) => Math.max(latest, Date.parse(item.lastSeenAt) || 0), 0);
}

export function useGoogleLiveRanking() {
  const saved = trpc.googleTrends.savedGoogleRanking.useQuery(undefined, { staleTime: 60_000, retry: false });
  const live = trpc.googleTrends.realtimeTrending.useQuery({ country: "KR" }, {
    retry: 1,
    staleTime: 60_000,
    refetchInterval: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
  const refreshed = live.data?.success ? live.data.data : undefined;
  const today = getSeoulDate();
  const currentSnapshot = saved.data?.length && getSeoulDate(new Date(rankingTimestamp(saved.data))) === today ? saved.data : undefined;
  const currentLive = refreshed?.some(item => item.isCurrent) && getSeoulDate(new Date(rankingTimestamp(refreshed))) === today ? refreshed : undefined;
  const trusted = currentLive ?? currentSnapshot;
  const retained = useRetainedRanking("google", trusted, rankingTimestamp);
  return {
    ranking: retained.length ? retained : refreshed ?? EMPTY_RANKING,
    isPending: saved.isPending || live.isPending,
  };
}
