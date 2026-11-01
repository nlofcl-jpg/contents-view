import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { ChevronDown, Loader2, RotateCcw, Search } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

interface NewsItem {
  title: string;
  link: string;
  pubDate?: string;
  publishedAt?: string;
  description: string;
  source: string;
  thumbnail: string | null;
}

function formatDate(dateString: string | undefined) {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;

    return date.toLocaleDateString("ko-KR");
  } catch {
    return "";
  }
}

export default function NewsSearchResults() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const search = useSearch();
  const keyword = new URLSearchParams(search).get("keyword")?.trim() || "";
  const [searchQuery, setSearchQuery] = useState(keyword);
  const [visibleSearchCount, setVisibleSearchCount] = useState(6);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchQuery(keyword);
    setVisibleSearchCount(6);
  }, [keyword]);

  const { data: searchResultsData, isLoading: isLoadingSearch, error: searchError } = trpc.news.searchNews.useQuery(
    { query: keyword, limit: 80 },
    {
      enabled: keyword.length > 0 && !authLoading && isAuthenticated,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  );

  const searchResults = useMemo(() => {
    return Array.isArray(searchResultsData) ? searchResultsData : [];
  }, [searchResultsData]);

  const visibleSearchResults = useMemo(() => {
    return searchResults.slice(0, visibleSearchCount);
  }, [searchResults, visibleSearchCount]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;
    setVisibleSearchCount(6);
    setLocation(`/news/search?keyword=${encodeURIComponent(trimmedQuery)}`);
  };

  const goToAuth = () => {
    const params = new URLSearchParams({ redirect: `/news/search?keyword=${encodeURIComponent(keyword)}` });
    setLocation(`/login?${params.toString()}`);
  };

  const resetSearch = () => {
    setSearchQuery("");
    setVisibleSearchCount(6);
    setLocation("/news/search", { replace: true });
    searchInputRef.current?.focus();
  };

  return (
    <div className="pageContainer">
      <div className="pageHeader">
        <h1 className="pageTitle">뉴스 & 이슈</h1>
        <p className="pageDescription">오늘 주목받는 이슈를 빠르게 확인하고 콘텐츠 아이디어로 연결해보세요.</p>
      </div>

      <section className="newsSearchSection" aria-labelledby="news-search-result-title">
        <h2 id="news-search-result-title" className="newsSearchTitle">뉴스 검색</h2>
        <form onSubmit={handleSearch} className="newsSearchForm">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="관심 키워드를 검색해보세요."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="newsSearchInput"
          />
          <button type="submit" className="newsSearchIconButton" aria-label="검색">
            <Search size={19} strokeWidth={2.1} />
          </button>
        </form>
      </section>

      <section className="newsSearchResultsSection">
        {keyword && (
          <div className="newsSearchResultsHeader">
            <h2 className="newsSearchResultTitle">뉴스 검색결과: {keyword}</h2>
            <button type="button" className="newsSearchResetButton" onClick={resetSearch} aria-label="뉴스 검색 초기화" title="검색 초기화">
              <RotateCcw size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        )}

        {authLoading ? (
          <div className="newsSearchLoading" role="status" aria-live="polite">
            <Loader2 className="newsSearchLoadingIcon" aria-hidden="true" />
            <span>로그인 상태를 확인하는 중</span>
          </div>
        ) : keyword && (!isAuthenticated || searchError?.data?.code === "UNAUTHORIZED") ? (
          <div className="py-10 text-center" role="status">
            <p className="text-base font-medium text-slate-100">로그인 후 뉴스 검색 서비스를 이용해 주세요.</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">간편 회원가입 후 컨텐츠뷰의 더욱 다양한 서비스를 이용해 보세요.</p>
            <div className="mt-5 flex justify-center">
              <button type="button" className="youtubeGuestLoginButton" onClick={goToAuth}>로그인</button>
            </div>
          </div>
        ) : isLoadingSearch ? (
          <div className="newsSearchLoading" role="status" aria-live="polite">
            <Loader2 className="newsSearchLoadingIcon" aria-hidden="true" />
            <span>데이터를 불러오는 중</span>
          </div>
        ) : !keyword ? (
          <div className="text-center text-gray-400">검색할 키워드를 입력해 주세요.</div>
        ) : searchError ? (
          <div className="text-center text-gray-400">뉴스 검색결과를 불러오지 못했습니다. 잠시 후 다시 검색해 주세요.</div>
        ) : searchResults.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {visibleSearchResults.map((news: NewsItem, index: number) => (
                <div
                  key={`${news.link}-${index}`}
                  className="bg-gray-900 rounded-lg overflow-hidden hover:bg-gray-800 transition-colors"
                >
                  {news.thumbnail && (
                    <div className="w-full h-32 bg-gray-800 overflow-hidden">
                      <img
                        src={news.thumbnail}
                        alt={news.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex min-w-0 items-center gap-2 mb-2">
                      <span className="min-w-0 flex-1 truncate text-xs text-gray-500" title={news.source}>{news.source}</span>
                      <span className="shrink-0 whitespace-nowrap text-xs text-gray-500">{formatDate(news.publishedAt || news.pubDate)}</span>
                    </div>
                    <h3 className="text-base font-semibold text-white mb-2 line-clamp-2">
                      {news.title}
                    </h3>
                    {news.description && (
                      <p className="mb-3 line-clamp-2 text-sm leading-6 text-slate-400">
                        {news.description}
                      </p>
                    )}
                    <a
                      href={news.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                    >
                      원문 보기 →
                    </a>
                  </div>
                </div>
              ))}
            </div>
            {visibleSearchCount < searchResults.length && (
              <button
                type="button"
                className="newsSearchMoreButton"
                onClick={() => setVisibleSearchCount((count) => Math.min(count + 6, searchResults.length))}
                aria-label="뉴스 검색결과 더보기"
              >
                <ChevronDown size={20} strokeWidth={1.8} />
              </button>
            )}
          </>
        ) : (
          <div className="text-center text-gray-400">제목에 '{keyword}'가 포함된 네이버 뉴스가 없습니다. 다른 키워드로 검색해보세요.</div>
        )}
      </section>
    </div>
  );
}
