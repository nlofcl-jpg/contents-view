import { useState, useEffect, useRef, type KeyboardEvent, type UIEvent } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { ko } from "react-day-picker/locale";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import LiveTrendNavigation from "@/components/LiveTrendNavigation";
import { GoogleTrendRankChange, type RankChange } from "@/components/GoogleTrendRankChange";
import { readHeroKeywords } from "@/lib/heroKeywords";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useGoogleLiveRanking, useRetainedRanking } from "@/lib/useLiveSearchRankings";
import { getSeoulDate } from "@shared/searchTrendDailyRanking";

interface NewsItem {
  title: string;
  source: string;
  url: string;
  image: string;
}

interface TrendItem {
  rank: number;
  rankChange?: RankChange;
  keyword: string;
  lastSeenAt: string;
  traffic?: string;
  trafficCount?: number;
  news?: NewsItem[];
  source: string;
  country: string;
}

const LIVE_RANKING_PREVIEW_SIZE = 20;
const GOOGLE_LIVE_RANKING_LIMIT = 50;
const seoulDateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatSeoulDateTime(timestamp: number): string {
  const parts = new Map(seoulDateTimeFormatter.formatToParts(timestamp).map(part => [part.type, part.value]));
  return `${parts.get("year")}.${parts.get("month")}.${parts.get("day")} ${parts.get("hour")}:${parts.get("minute")}`;
}

function KeywordRanking({ entries }: { entries: { keyword: string; rankChange?: RankChange }[] }) {
  return (
    <ol className="flex flex-col gap-1.5 rounded-md border border-slate-800 bg-slate-900/25 p-1.5">
      {entries.map(({ keyword, rankChange }, index) => (
        <li key={index} className={`flex min-h-[49px] items-center gap-2 rounded-md px-4 py-2 ${index % 2 === 0 ? "bg-slate-800/35" : "bg-slate-900/45"}`}>
          <span className="w-5 shrink-0 text-center text-sm font-semibold text-blue-400">{index + 1}</span>
          <span className="min-w-0 truncate text-sm font-medium text-slate-100" title={keyword}>{keyword}</span>
          {rankChange && <GoogleTrendRankChange change={rankChange} className="ml-auto shrink-0" />}
        </li>
      ))}
    </ol>
  );
}

function RankingHeader({ id, title, date, onChange, onGuestAccess }: {
  id: string;
  title: string;
  date: string;
  onChange: (date: string) => void;
  onGuestAccess?: () => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const today = getSeoulDate();
  const activeDate = date || today;
  const [, month, day] = activeDate.split("-");
  const selectDate = (value: string) => {
    if (value <= today) onChange(value === today ? "" : value);
  };
  const moveDay = (direction: -1 | 1) => {
    if (onGuestAccess) {
      onGuestAccess();
      return;
    }
    const target = new Date(`${activeDate}T00:00:00Z`);
    target.setUTCDate(target.getUTCDate() + direction);
    selectDate(target.toISOString().slice(0, 10));
  };
  const arrowClass = "grid h-9 place-items-center text-slate-400 transition-colors hover:bg-slate-800/70 hover:text-white focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400";

  return (
    <div className="mb-5 flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <h2 id={id} className="text-base font-bold text-foreground lg:text-xl">{title}</h2>
      <div className="ml-auto grid shrink-0 grid-cols-[1.5rem_3rem_1.5rem] items-center overflow-hidden rounded-md border border-slate-700 bg-slate-900/75">
        <button type="button" className={arrowClass} onClick={() => moveDay(-1)} aria-label={`${title} 전날`} title="전날">
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <Popover open={calendarOpen} onOpenChange={open => {
          if (open && onGuestAccess) onGuestAccess();
          else setCalendarOpen(open);
        }}>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`${title} 검색어 조회 날짜 ${month}월 ${day}일`}
              className="h-9 text-center text-xs font-medium tabular-nums text-slate-100 transition-colors hover:bg-slate-800/70 focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-400">
              {month}.{day}
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-fit p-0" aria-label={`${title} 날짜 선택`}>
            <Calendar
              mode="single"
              locale={ko}
              defaultMonth={new Date(`${activeDate}T12:00:00`)}
              selected={new Date(`${activeDate}T12:00:00`)}
              today={new Date(`${today}T12:00:00`)}
              disabled={{ after: new Date(`${today}T12:00:00`) }}
              formatters={{ formatCaption: selectedMonth => `${selectedMonth.getFullYear()}년 ${selectedMonth.getMonth() + 1}월` }}
              onDayClick={selectedDay => {
                const selectedYear = String(selectedDay.getFullYear()).padStart(4, "0");
                const selectedMonth = String(selectedDay.getMonth() + 1).padStart(2, "0");
                const selectedDate = String(selectedDay.getDate()).padStart(2, "0");
                selectDate(`${selectedYear}-${selectedMonth}-${selectedDate}`);
                setCalendarOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
        <button type="button" className={arrowClass} onClick={() => moveDay(1)} disabled={activeDate >= today} aria-label={`${title} 다음날`} title="다음날">
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function DailyKeywordRanking({ source, date, isAuthenticated }: { source: "google" | "contents"; date: string; isAuthenticated: boolean }) {
  const daily = trpc.googleTrends.dailyRanking.useQuery({ source, date }, {
    enabled: isAuthenticated,
    refetchInterval: source === "contents" && date === getSeoulDate() ? 30_000 : false,
    retry: false,
  });
  if (!isAuthenticated) return null;
  if (daily.data?.rankings.length) return <KeywordRanking entries={daily.data.rankings} />;
  return (
    <div className="flex min-h-32 items-center justify-center rounded-md border border-slate-800 bg-slate-900/25 p-4 text-center text-sm text-slate-400" role="status">
      {daily.isPending ? "일간 순위를 불러오는 중..." : daily.isError ? "일간 순위를 불러오지 못했습니다." : "선택한 날짜에 저장된 검색어가 없습니다."}
    </div>
  );
}

function SearchKeywordTrends({ isAuthenticated, authLoading, onGuestAccess }: {
  isAuthenticated: boolean;
  authLoading: boolean;
  onGuestAccess: () => void;
}) {
  const [showAllLiveRanks, setShowAllLiveRanks] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [date, setDate] = useState("");
  const current = trpc.googleTrends.contentsLiveRanking.useQuery(undefined, {
    enabled: !date,
    refetchInterval: 30_000,
    retry: false,
  });
  const retained = useRetainedRanking("contents", current.data?.date === getSeoulDate() ? current.data.rankings : undefined);
  const showPublishedKeywords = !date && retained.length === 0 && Boolean(supabase) && (
    current.data?.rankings.length === 0 || (import.meta.env.DEV && current.isError)
  );
  const fallback = useQuery({
    queryKey: ["contents-view-published-keywords"],
    enabled: showPublishedKeywords,
    queryFn: async ({ signal }) => {
      if (!supabase) return [];
      const { data, error } = await supabase.from("hero_search_settings").select("keywords")
        .eq("id", 1).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return readHeroKeywords(data?.keywords);
    },
    refetchInterval: 30_000,
    retry: false,
  });
  const liveKeywords = retained.length ? retained : (showPublishedKeywords ? fallback.data?.map(keyword => ({ keyword })) ?? [] : []);
  const canShowMoreLiveRanks = liveKeywords.length > LIVE_RANKING_PREVIEW_SIZE;
  const visibleLiveRanks = showAllLiveRanks ? liveKeywords : liveKeywords.slice(0, LIVE_RANKING_PREVIEW_SIZE);
  const liveLoading = liveKeywords.length === 0 && (current.isPending || (showPublishedKeywords && fallback.isPending));
  const liveError = liveKeywords.length === 0 && (showPublishedKeywords ? fallback.isError : current.isError);
  const history = useInfiniteQuery({
    queryKey: ["contents-view-keyword-history"],
    enabled: historyOpen && isAuthenticated,
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam, signal }) => {
      if (!supabase) return { snapshot: null, nextId: undefined };
      let query = supabase.from("hero_search_keyword_history").select("id,keywords,valid_from")
        .order("id", { ascending: false }).limit(2).abortSignal(signal);
      if (pageParam !== null) query = query.lt("id", pageParam);
      const { data, error } = await query;
      if (error) throw error;
      return { snapshot: data[0] ?? null, nextId: data.length > 1 ? data[0].id : undefined };
    },
    getNextPageParam: page => page.nextId,
    retry: false,
  });
  const handleHistoryMore = () => {
    if (!historyOpen) setHistoryOpen(true);
    else if (history.isError && !history.data) void history.refetch();
    else void history.fetchNextPage();
  };

  return (
    <section aria-labelledby="search-keyword-trends-heading">
      <RankingHeader id="search-keyword-trends-heading" title="실시간" date={date} onGuestAccess={!authLoading && !isAuthenticated ? onGuestAccess : undefined} onChange={value => {
        if (value && !isAuthenticated) {
          if (!authLoading) onGuestAccess();
          return;
        }
        setDate(value);
      }} />
      {date ? <DailyKeywordRanking source="contents" date={date} isAuthenticated={isAuthenticated} /> : liveLoading || liveError ? (
        <div className="flex h-[562px] items-center justify-center rounded-md border border-slate-800 bg-slate-900/25 p-8 text-center text-sm text-slate-400">
          {liveLoading ? "불러오는 중..." : "인기 검색어를 불러오지 못했습니다."}
        </div>
      ) : (
        <>
          <div id="search-keyword-ranking">
            {visibleLiveRanks.length
              ? <KeywordRanking entries={visibleLiveRanks} />
              : <p className="rounded-md border border-slate-800 bg-slate-900/25 p-6 text-center text-sm text-slate-400">{showPublishedKeywords ? "등록된 검색어가 없습니다." : "오늘 등록된 검색어가 없습니다."}</p>}
          </div>
          {canShowMoreLiveRanks && !showAllLiveRanks && (
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={() => setShowAllLiveRanks(true)}
                aria-controls="search-keyword-ranking"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300">
                더보기
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
          <div id="search-keyword-history">
            {historyOpen && isAuthenticated && history.data?.pages.map(({ snapshot }) => snapshot && (
              <section key={snapshot.id} className="mt-4">
                <h3 className="mb-2 text-xs font-medium text-slate-400">
                  <time dateTime={snapshot.valid_from}>{formatSeoulDateTime(Date.parse(snapshot.valid_from))} 기준</time>
                </h3>
                {snapshot.keywords.length > 0
                  ? <KeywordRanking entries={readHeroKeywords(snapshot.keywords).map(keyword => ({ keyword }))} />
                  : <p className="text-sm text-slate-400">등록된 검색어가 없는 회차입니다.</p>}
              </section>
            ))}
            {historyOpen && isAuthenticated && history.isError && (
              <p role="alert" className="mt-4 text-center text-sm text-slate-400">이전 검색어 목록을 불러오지 못했습니다.</p>
            )}
            {historyOpen && isAuthenticated && !history.isError && history.data?.pages[0]?.snapshot === null && (
              <p className="mt-4 text-center text-sm text-slate-400">저장된 이전 검색어 목록이 없습니다.</p>
            )}
          </div>
          {isAuthenticated && (!canShowMoreLiveRanks || showAllLiveRanks) && (!historyOpen || history.isFetching || history.isError || history.hasNextPage) && (
            <div className="mt-4 flex justify-center">
              <button type="button" onClick={handleHistoryMore} disabled={authLoading || history.isFetching}
                aria-controls="search-keyword-history" aria-expanded={historyOpen && isAuthenticated}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300 disabled:opacity-50">
                {history.isFetching ? "불러오는 중..." : history.isError ? "다시 시도" : "이전 회차 더보기"}
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TrendNews({ news }: { news?: NewsItem[] }) {
  return (
    <div>
      <h4 className="mb-4 text-lg font-semibold text-foreground">관련 뉴스</h4>
      {news && news.length > 0 ? (
        <div className="space-y-4">
          {news.map((newsItem, idx) => (
            <a
              key={idx}
              href={newsItem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex gap-4 rounded-lg bg-slate-800/50 p-3 transition hover:bg-slate-800"
            >
              {newsItem.image && (
                <img
                  src={newsItem.image}
                  alt={newsItem.title}
                  className="h-16 w-16 flex-shrink-0 rounded object-cover transition group-hover:opacity-80 sm:h-20 sm:w-20"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium text-foreground transition group-hover:text-blue-400">
                  {newsItem.title}
                </p>
                <p className="mt-2 text-xs text-slate-400">{newsItem.source}</p>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">관련 뉴스가 없습니다.</p>
      )}
    </div>
  );
}

export default function GoogleTrends() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const getInitialParams = () => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return params.get("trend") || "";
  };

  const [selectedKeywordFromUrl, setSelectedKeywordFromUrl] = useState(getInitialParams);
  const { ranking: popularSearches, isPending: isLoading } = useGoogleLiveRanking();
  const [selectedTrend, setSelectedTrend] = useState<TrendItem | null>(null);
  const [isNewsOpen, setIsNewsOpen] = useState(false);
  const [showAllGoogleRanks, setShowAllGoogleRanks] = useState(false);
  const [googleDate, setGoogleDate] = useState("");
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [mobileTab, setMobileTab] = useState<"google" | "keywords">("google");
  const mobilePanelsRef = useRef<HTMLDivElement>(null);
  const latestTrendTimestamp = popularSearches.reduce((latest, item) => {
    const timestamp = Date.parse(item.lastSeenAt);
    return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
  }, 0);

  const selectMobileTab = (tab: "google" | "keywords") => {
    setMobileTab(tab);
    const panels = mobilePanelsRef.current;
    if (panels) {
      panels.scrollTo({ left: tab === "google" ? 0 : panels.clientWidth, behavior: "smooth" });
    }
  };

  const handleMobilePanelsScroll = (event: UIEvent<HTMLDivElement>) => {
    const panels = event.currentTarget;
    setMobileTab(panels.scrollLeft >= panels.clientWidth / 2 ? "keywords" : "google");
  };

  const handleMobileTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const nextTab = event.key === "ArrowRight" || event.key === "End"
      ? "keywords"
      : event.key === "ArrowLeft" || event.key === "Home"
        ? "google"
        : null;
    if (!nextTab) return;
    event.preventDefault();
    selectMobileTab(nextTab);
    document.getElementById(nextTab === "google" ? "google-trends-tab" : "search-keyword-trends-tab")?.focus();
  };

  useEffect(() => {
    if (!popularSearches.length) return;
    if (selectedKeywordFromUrl) {
      const match = popularSearches.find(item => item.keyword === selectedKeywordFromUrl);
      if (match) {
        setSelectedTrend(match);
        setIsNewsOpen(!window.matchMedia("(max-width: 1023px)").matches);
        setSelectedKeywordFromUrl("");
      } else if (!isLoading) setSelectedKeywordFromUrl("");
      return;
    }
    setSelectedTrend(previous => previous && (popularSearches.find(item => item.keyword === previous.keyword) ?? previous));
  }, [popularSearches, isLoading, selectedKeywordFromUrl]);

  const handleSelectTrend = (item: TrendItem) => {
    setSelectedKeywordFromUrl("");
    setSelectedTrend(item);
    setIsNewsOpen(true);
  };

  return (
    <div className="youtubePageContainer">
      {/* 페이지 상단 타이틀 */}
      <div className="pageHeader">
        <div className="flex w-full items-end justify-between gap-2">
          <h1 className="pageTitle shrink-0">
            검색 트렌드
          </h1>
          {!googleDate && latestTrendTimestamp > 0 && (
            <time
              dateTime={new Date(latestTrendTimestamp).toISOString()}
              className="shrink-0 whitespace-nowrap pb-1 text-right text-[10px] text-slate-400 sm:text-xs"
            >
              {formatSeoulDateTime(latestTrendTimestamp)} 기준
            </time>
          )}
        </div>
        <p className="pageDescription">
          현재 검색 흐름과 실시간 인기 검색어 트렌드를 확인하세요.
        </p>
        <LiveTrendNavigation active="search" />
      </div>

      <div className="searchTrendTabMenu mb-5 grid grid-cols-2 lg:hidden" role="tablist" aria-label="검색 트렌드 종류">
        <button
          id="google-trends-tab"
          type="button"
          role="tab"
          aria-selected={mobileTab === "google"}
          aria-controls="google-trends-panel"
          tabIndex={mobileTab === "google" ? 0 : -1}
          onClick={() => selectMobileTab("google")}
          onKeyDown={handleMobileTabKeyDown}
          className={`tabButton${mobileTab === "google" ? " active" : ""}`}
        >
          구글
        </button>
        <button
          id="search-keyword-trends-tab"
          type="button"
          role="tab"
          aria-selected={mobileTab === "keywords"}
          aria-controls="search-keyword-trends-panel"
          tabIndex={mobileTab === "keywords" ? 0 : -1}
          onClick={() => selectMobileTab("keywords")}
          onKeyDown={handleMobileTabKeyDown}
          className={`tabButton${mobileTab === "keywords" ? " active" : ""}`}
        >
          실시간
        </button>
      </div>

      <div
        ref={mobilePanelsRef}
        onScroll={handleMobilePanelsScroll}
        className="flex items-start overflow-x-auto overscroll-x-contain snap-x snap-mandatory lg:grid lg:grid-cols-2 lg:gap-8 lg:overflow-visible lg:snap-none"
      >
        <section
          id="google-trends-panel"
          role="tabpanel"
          aria-labelledby="google-trends-tab"
          className="w-full min-w-0 flex-none snap-start lg:w-auto"
        >
          <RankingHeader id="google-trends-heading" title="구글" date={googleDate} onGuestAccess={!authLoading && !isAuthenticated ? () => setShowGuestPrompt(true) : undefined} onChange={date => {
            if (date && !isAuthenticated) {
              if (!authLoading) setShowGuestPrompt(true);
              return;
            }
            setGoogleDate(date);
            setSelectedKeywordFromUrl("");
            setSelectedTrend(null);
            setIsNewsOpen(false);
          }} />

        {googleDate ? <DailyKeywordRanking source="google" date={googleDate} isAuthenticated={isAuthenticated} /> : isLoading && !popularSearches.length ? (
          <div className="flex h-[562px] items-center justify-center rounded-md border border-slate-800 bg-slate-900/25 p-8 text-center">
            <p className="text-slate-500">로딩 중...</p>
          </div>
        ) : popularSearches.length === 0 ? (
          <div className="flex h-[562px] items-center justify-center rounded-md border border-slate-800 bg-slate-900/25 p-8 text-center">
            <p className="text-slate-500">실시간 인기 검색어 데이터를 불러올 수 없습니다.</p>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="min-w-0">
              <div id="google-trend-ranking" className="min-h-[562px] rounded-md border border-slate-800 bg-slate-900/25">
                <div className="flex flex-col gap-1.5 p-1.5">
                  {popularSearches.slice(0, showAllGoogleRanks ? GOOGLE_LIVE_RANKING_LIMIT : LIVE_RANKING_PREVIEW_SIZE).map((item, index) => (
                    <div
                      key={item.keyword}
                      className={`grid min-h-[49px] grid-cols-[1.25rem_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md px-4 py-2 transition-colors cursor-pointer ${
                        selectedTrend?.keyword === item.keyword
                          ? "bg-blue-500/15 ring-1 ring-inset ring-blue-400/45"
                          : index % 2 === 0
                            ? "bg-slate-800/35 hover:bg-slate-800/55"
                            : "bg-slate-900/45 hover:bg-slate-800/40"
                      }`}
                      onClick={() => handleSelectTrend(item)}
                    >
                      <div className="text-center text-sm font-semibold text-blue-400">{item.rank}</div>
                      <div className="min-w-0 truncate text-sm font-medium text-foreground" title={item.keyword}>{item.keyword}</div>
                      <GoogleTrendRankChange change={item.rankChange} />
                      <div className="text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectTrend(item);
                          }}
                          className="whitespace-nowrap text-sm font-medium text-blue-500 transition hover:text-blue-400"
                        >
                          자세히
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
              {popularSearches.length > LIVE_RANKING_PREVIEW_SIZE && !showAllGoogleRanks && (
                <div className="mt-4 flex justify-center">
                  <button type="button" onClick={() => setShowAllGoogleRanks(true)}
                    aria-controls="google-trend-ranking"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300">
                    더보기
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

          </div>
        )}
        </section>
        <div
          id="search-keyword-trends-panel"
          role="tabpanel"
          aria-labelledby="search-keyword-trends-tab"
          className="w-full min-w-0 flex-none snap-start lg:w-auto"
        >
          <SearchKeywordTrends isAuthenticated={isAuthenticated} authLoading={authLoading} onGuestAccess={() => setShowGuestPrompt(true)} />
        </div>
      </div>
      <Dialog
        open={isNewsOpen && Boolean(selectedTrend)}
        onOpenChange={(open) => {
          setIsNewsOpen(open);
          if (!open) setSelectedTrend(null);
        }}
      >
        {selectedTrend && (
          <DialogContent
            className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden border-slate-700 bg-slate-950 p-0 text-foreground sm:max-w-xl"
            overlayClassName="bg-black/75"
          >
            <DialogHeader className="shrink-0 border-b border-slate-800 px-5 py-5 pr-12 text-left">
              <DialogTitle className="text-lg leading-snug">{selectedTrend.keyword}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-1 text-xs text-slate-400">
                <span>순위 {selectedTrend.rank} ·</span>
                <GoogleTrendRankChange change={selectedTrend.rankChange} />
                <span>· Google Trends</span>
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <TrendNews news={selectedTrend.news} />
            </div>
          </DialogContent>
        )}
      </Dialog>
      <GuestAccessPrompt
        open={showGuestPrompt && !isAuthenticated}
        onBrowse={() => setShowGuestPrompt(false)}
        onLogin={() => {
          setShowGuestPrompt(false);
          setLocation("/login?redirect=%2Ftrends%2Fgoogle");
        }}
      />
    </div>
  );
}
