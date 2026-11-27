import { format, subDays } from "date-fns";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import type { KeywordMetric } from "@/lib/naverKeywordMetrics";

export const heroAnalysisLabels = {
  youtube: "유튜브 분석",
  naver: "네이버 분석",
  news: "뉴스 검색",
  shopping: "쇼핑 인사이트 분석",
} as const;

export type HeroAnalysisPlatform = keyof typeof heroAnalysisLabels;

export function getHeroAnalysisRange(today = new Date()) {
  return {
    startDate: format(subDays(today, 30), "yyyy-MM-dd"),
    endDate: format(today, "yyyy-MM-dd"),
    timeUnit: "date" as const,
  };
}

type Outputs = inferRouterOutputs<AppRouter>;

// The unified insight procedure currently exposes an untyped cached response.
export type NaverKeywordResult = {
  success: boolean;
  error?: string;
  keywords: string[];
  trend: Record<string, { period: string; ratio: number }[]>;
  meta?: {
    keywordTool?: { primary?: KeywordMetric | null; related: KeywordMetric[]; recommended: KeywordMetric[]; error?: string | null };
    contentVolume?: { sources: { key: string; totalDocuments?: number | null }[] };
  };
};

export type HeroAnalysisResult =
  | { kind: "youtube"; data: Outputs["youtube"]["searchVideos"] }
  | { kind: "news"; data: Outputs["news"]["searchNews"] }
  | { kind: "naver"; data: NaverKeywordResult; range: ReturnType<typeof getHeroAnalysisRange> }
  | { kind: "shopping"; data: Outputs["naver"]["shoppingStatistics"]; range: ReturnType<typeof getHeroAnalysisRange> }
  | { kind: "error"; message: string; loginRequired?: boolean };
