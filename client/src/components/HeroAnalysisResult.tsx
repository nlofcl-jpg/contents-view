import { useState, type ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { UnifiedChart } from "@/components/UnifiedChart";
import { getLoginUrl } from "@/const";
import type { HeroAnalysisResult as AnalysisResult } from "@/lib/heroAnalysis";
import { formatDecimal, formatDelta, formatNumber, formatPercent, formatRatio, getBlogCompetitionStrength, getBlogSearchRatio, getCompetitionLabel, getSeriesSummary } from "@/lib/naverKeywordMetrics";
import { naverShoppingCategories } from "@shared/naverShoppingCategories";

const PAGE_SIZE = 6;
const dateFormat = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "numeric", day: "numeric", timeZone: "Asia/Seoul" });
const clickIndexFormat = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });
const errorClass = "text-sm leading-6 text-slate-400";

function dateLabel(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

function durationLabel(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return "";
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor(value / 60) % 60;
  const seconds = String(value % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

function ResultList({ items }: { items: { title: string; href: string; image?: string | null; meta: string; description?: string }[] }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  return (
    <>
      <ul className="m-0 divide-y divide-white/10 p-0">
        {items.slice(0, limit).map(({ title, href, image, meta, description }, index) => (
          <li key={`${href}-${index}`} className="flex gap-3 py-3">
            {image && <img src={image} alt="" loading="lazy" className="aspect-video w-20 shrink-0 self-start rounded object-cover sm:w-28" />}
            <div className="min-w-0 flex-1">
              {/^(https?):\/\//i.test(href) ? (
                <a href={href} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-start gap-1.5 text-sm font-medium text-slate-100 hover:text-sky-300">
                  <span className="min-w-0 break-words">{title}</span>
                  <ExternalLink size={13} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                </a>
              ) : <span className="break-words text-sm text-slate-100">{title}</span>}
              <p className="mt-1 break-words text-xs leading-5 text-slate-400">{meta}</p>
              {description && <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-300">{description}</p>}
            </div>
          </li>
        ))}
      </ul>
      {limit < items.length && (
        <button type="button" className="py-2 text-xs font-medium text-sky-300 hover:underline" onClick={() => setLimit(value => value + PAGE_SIZE)}>결과 더보기</button>
      )}
    </>
  );
}

function ResultMetrics({ title, values }: { title: string; values: [string, string][] }) {
  return (
    <section>
      <h4 className="mb-2 text-xs font-medium text-slate-400">{title}</h4>
      <dl className="flex flex-wrap gap-x-5 gap-y-2">
        {values.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-slate-400">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums text-slate-100">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ResultChart({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-3 text-sm font-semibold text-slate-100">{title}</h4>
      <div className="h-60 min-w-0 sm:h-72">{children}</div>
    </section>
  );
}

const searchLayer = { trend: true, shopping: false };
const shoppingLayer = { trend: false, shopping: true };

export default function HeroAnalysisResult({ result }: { result: AnalysisResult }) {
  switch (result.kind) {
    case "error":
      return (
        <div className={errorClass}>
          <p>{result.message}</p>
          {result.loginRequired && <a href={getLoginUrl()} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium text-sky-300 hover:underline">로그인 / 가입</a>}
        </div>
      );
    case "youtube": {
      if (!result.data.success) {
        const message = result.data.error === "API Key not found" ? "내 정보에서 YouTube API 키를 연결해 주세요." : result.data.error;
        return <p className={errorClass}>{message || "YouTube 결과를 불러오지 못했습니다."}</p>;
      }
      if (!result.data.videos.length) return <p className={errorClass}>관련 영상을 찾지 못했습니다.</p>;
      return <ResultList items={result.data.videos.map((video: { id: string; title: string; thumbnail?: string; channelTitle: string; viewCount: number; publishedAt: string; durationSeconds?: number }) => ({
        title: video.title,
        href: `https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}`,
        image: video.thumbnail,
        meta: [video.channelTitle, `조회수 ${formatNumber(video.viewCount)}회`, dateLabel(video.publishedAt), durationLabel(video.durationSeconds)].filter(Boolean).join(" · "),
      }))} />;
    }
    case "news": {
      if (!result.data.length) return <p className={errorClass}>검색어에 해당하는 뉴스가 없습니다.</p>;
      return <ResultList items={result.data.map(item => ({
        title: item.title,
        href: item.link,
        image: item.thumbnail,
        description: item.description,
        meta: [item.source, dateLabel(item.publishedAt || item.pubDate)].filter(Boolean).join(" · "),
      }))} />;
    }
    case "naver": {
      const { data, range } = result;
      if (!data.success) return <p className={errorClass}>{data.error || "네이버 결과를 불러오지 못했습니다."}</p>;
      const tool = data.meta?.keywordTool;
      const metric = tool?.primary;
      const blogCount = data.meta?.contentVolume?.sources.find(source => source.key === "blog")?.totalDocuments ?? null;
      const ratio = getBlogSearchRatio(blogCount, metric?.monthlyTotalSearches);
      const trend = data.trend?.[data.keywords[0] ?? ""];
      const summary = getSeriesSummary(trend);
      const related = [...(tool?.related ?? [])].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0) || (b.monthlyTotalSearches ?? 0) - (a.monthlyTotalSearches ?? 0))[0];

      return (
        <div className="space-y-4">
          <ResultMetrics title="월간 검색량" values={[
            ["PC", formatNumber(metric?.monthlyPcSearches)], ["모바일", formatNumber(metric?.monthlyMobileSearches)], ["전체", formatNumber(metric?.monthlyTotalSearches)],
          ]} />
          <ResultMetrics title="블로그 경쟁도" values={[
            ["블로그 발행수", formatNumber(blogCount)], ["경쟁강도", getBlogCompetitionStrength(ratio)], ["검색 비율", formatDecimal(ratio)],
          ]} />
          <ResultMetrics title="검색 관심도" values={[["현재", formatRatio(summary.latest)], ["직전 구간 대비", formatDelta(summary.delta)]]} />
          <ResultMetrics title="월간 클릭량" values={[
            ["전체", formatDecimal(metric?.monthlyTotalClicks)], ["PC", formatDecimal(metric?.monthlyPcClicks)], ["모바일", formatDecimal(metric?.monthlyMobileClicks)],
          ]} />
          <ResultMetrics title="키워드 등급" values={[
            ["등급", getCompetitionLabel(metric?.competition)], ["광고 노출 깊이", formatDecimal(metric?.averageAdDepth)],
          ]} />
          {tool?.error && <p className={errorClass}>{tool.error}</p>}
          {tool && tool.recommended.length > 0 && (
            <section>
              <h4 className="mb-2 text-xs font-medium text-slate-400">추천 키워드</h4>
              <p className="break-words text-sm leading-6 text-slate-100">{tool.recommended.map(item => item.keyword).join(" · ")}</p>
            </section>
          )}
          {related && <ResultMetrics title="연관 키워드" values={[
            ["키워드", related.keyword], ["등급", getCompetitionLabel(related.competition)], ["검색량", formatNumber(related.monthlyTotalSearches)],
            ["클릭량", formatDecimal(related.monthlyTotalClicks)], ["유사도", formatPercent(related.similarity)],
          ]} />}
          {Boolean(trend?.length) && (
            <ResultChart title="검색 트렌드 비교">
              <UnifiedChart data={{ keywords: data.keywords, trend: data.trend, shopping: {} }} visibleLayers={searchLayer} {...range} />
            </ResultChart>
          )}
        </div>
      );
    }
    case "shopping": {
      const { data, range } = result;
      const comparison = data.comparisons[0];
      const shopping = comparison?.shopping ?? {};
      const keywords = Object.keys(shopping).filter(keyword => shopping[keyword].length > 0);
      const category = data.category;
      const name = category && (data.categoryPath.at(-1)?.label || naverShoppingCategories[category.categoryCode as keyof typeof naverShoppingCategories] || category.categoryCode);
      const categorySeries = category && name && category.data.length ? { name, points: category.data } : undefined;
      const latest = categorySeries?.points.at(-1);
      if (!keywords.length && !categorySeries) return <p className={errorClass}>{comparison?.error || category?.error || "쇼핑 클릭량 데이터를 찾지 못했습니다."}</p>;
      return (
        <div className="space-y-3">
          {latest && <p className="text-xs text-slate-400">{name} · 최신 클릭 지수 <strong className="text-sky-200">{clickIndexFormat.format(latest.ratio)}</strong> · {latest.period} 기준</p>}
          <ResultChart title="쇼핑 트렌드 비교">
            <UnifiedChart data={{ keywords, trend: {}, shopping, categorySeries }} visibleLayers={shoppingLayer} {...range} />
          </ResultChart>
        </div>
      );
    }
  }
}
