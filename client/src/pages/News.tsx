import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Search } from "lucide-react";
import { useLocation } from "wouter";

interface NewsItem {
  title: string;
  link: string;
  pubDate?: string;
  publishedAt?: string;
  description: string;
  source: string;
  thumbnail: string | null;
}

interface FeaturedNewsGroup {
  categoryId: string;
  categoryLabel: string;
  items: NewsItem[];
}

export default function News() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [activeContentTab, setActiveContentTab] = useState<"news" | "issues">("news");

  // Category definitions
  const categories = [
    { id: 'all', label: '전체' },
    { id: 'nation', label: '정치/사회' },
    { id: 'business', label: '경제' },
    { id: 'technology', label: 'IT·과학' },
    { id: 'entertainment', label: '연예' },
    { id: 'sports', label: '스포츠' },
    { id: 'health', label: '건강' },
    { id: 'world', label: '국제' },
  ];

  // Featured categories for top cards
  const featuredCategories = [
    { id: 'nation', label: '정치/사회' },
    { id: 'business', label: '경제' },
    { id: 'technology', label: 'IT·과학' },
    { id: 'entertainment', label: '연예' },
  ];

  // Fetch latest news for selected category
  const { data: latestNewsData, isLoading: isLoadingLatest } = trpc.news.getLatestNews.useQuery(
    { limit: 30, category: selectedCategory },
    {
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );

  // Fetch featured news for 4 categories
  const { data: nationNewsData } = trpc.news.getLatestNews.useQuery(
    { limit: 2, category: 'nation' },
    { retry: 1, refetchOnWindowFocus: false }
  );

  const { data: businessNewsData } = trpc.news.getLatestNews.useQuery(
    { limit: 2, category: 'business' },
    { retry: 1, refetchOnWindowFocus: false }
  );

  const { data: technologyNewsData } = trpc.news.getLatestNews.useQuery(
    { limit: 2, category: 'technology' },
    { retry: 1, refetchOnWindowFocus: false }
  );

  const { data: entertainmentNewsData } = trpc.news.getLatestNews.useQuery(
    { limit: 2, category: 'entertainment' },
    { retry: 1, refetchOnWindowFocus: false }
  );

  // Combine featured news into category columns.
  const featuredNewsGroups = useMemo<FeaturedNewsGroup[]>(() => {
    const dataByCategory: Record<string, unknown> = {
      nation: nationNewsData,
      business: businessNewsData,
      technology: technologyNewsData,
      entertainment: entertainmentNewsData,
    };

    return featuredCategories.map(category => ({
      categoryId: category.id,
      categoryLabel: category.label,
      items: Array.isArray(dataByCategory[category.id])
        ? (dataByCategory[category.id] as NewsItem[]).slice(0, 2)
        : [],
    }));
  }, [nationNewsData, businessNewsData, technologyNewsData, entertainmentNewsData]);

  // Extract remaining news (excluding featured)
  const remainingNews = useMemo(() => {
    const items = Array.isArray(latestNewsData) ? latestNewsData : [];
    return items.slice(0);
  }, [latestNewsData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;
    setLocation(`/news/search?keyword=${encodeURIComponent(trimmedQuery)}`);
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '';
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
      return '';
    }
  };

  const isLoadingFeatured = !nationNewsData || !businessNewsData || !technologyNewsData || !entertainmentNewsData;

  // Get the most recent update time from all news data
  const getLatestUpdateTime = useMemo(() => {
    const allNews = [
      ...(Array.isArray(nationNewsData) ? nationNewsData : []),
      ...(Array.isArray(businessNewsData) ? businessNewsData : []),
      ...(Array.isArray(technologyNewsData) ? technologyNewsData : []),
      ...(Array.isArray(entertainmentNewsData) ? entertainmentNewsData : []),
      ...(Array.isArray(latestNewsData) ? latestNewsData : []),
    ];

    if (allNews.length === 0) return null;

    const latestDate = allNews.reduce((latest, news) => {
      const newsDate = new Date((news.pubDate || (news as any).publishedAt) || 0);
      return newsDate > latest ? newsDate : latest;
    }, new Date(0));

    if (latestDate.getTime() === 0) return null;

    return latestDate;
  }, [nationNewsData, businessNewsData, technologyNewsData, entertainmentNewsData, latestNewsData]);

  const formatUpdateTime = (date: Date | null) => {
    if (!date) return '';
    try {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const period = hours >= 12 ? '오후' : '오전';
      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes.toString().padStart(2, '0');
      return `${period} ${displayHours}:${displayMinutes}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="pageContainer">
      {/* Page Header */}
      <div className="pageHeader">
        <h1 className="pageTitle">뉴스 & 이슈</h1>
        <p className="pageDescription">오늘 주목받는 이슈를 빠르게 확인하고 콘텐츠 아이디어로 연결해보세요.</p>
        <div className="newsContentTabs" role="tablist" aria-label="뉴스 및 이슈 분류">
          <button
            type="button"
            role="tab"
            aria-selected={activeContentTab === "news"}
            className={`newsContentTab ${activeContentTab === "news" ? "active" : ""}`}
            onClick={() => setActiveContentTab("news")}
          >
            뉴스
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeContentTab === "issues"}
            className={`newsContentTab ${activeContentTab === "issues" ? "active" : ""}`}
            onClick={() => setActiveContentTab("issues")}
          >
            이슈
          </button>
        </div>
      </div>

      {activeContentTab === "news" ? (
        <>
      {/* Featured News Cards - 4 Categories */}
      {isLoadingFeatured ? (
        <div className="mb-12 text-center text-gray-400">뉴스를 불러오는 중...</div>
      ) : (
        <div className="mb-12">
          {getLatestUpdateTime && (
            <p className="newsCardsUpdateTime">마지막 업데이트: {formatUpdateTime(getLatestUpdateTime)}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {featuredNewsGroups.map(group => (
              <div key={group.categoryId} className="flex flex-col gap-4">
                {group.items.map((news: NewsItem, index: number) => (
                  <div
                    key={`${group.categoryId}-${index}-${news.link}`}
                    className="bg-gray-900 rounded-lg overflow-hidden hover:bg-gray-800 transition-colors"
                  >
                    {news.thumbnail && (
                      <div className="w-full h-36 bg-gray-800 overflow-hidden">
                        <img
                          src={news.thumbnail}
                          alt={news.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <div className="mb-2">
                        <span className="text-[11px] font-medium text-slate-400">
                          {group.categoryLabel}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                          {news.source}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(news.pubDate || news.publishedAt)}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-white mb-2 line-clamp-2">
                        {news.title}
                      </h3>
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
                {group.items.length === 0 && (
                  <div className="bg-gray-900 rounded-lg p-4 text-sm text-slate-500">
                    <span className="text-[11px] font-medium text-slate-400">
                      {group.categoryLabel}
                    </span>
                    <p className="mt-3">뉴스를 불러오지 못했습니다.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* News Search */}
      <section className="newsSearchSection" aria-labelledby="news-search-title">
        <h2 id="news-search-title" className="newsSearchTitle">뉴스 검색</h2>
        <form onSubmit={handleSearch} className="newsSearchForm">
          <input
            type="text"
            placeholder="관심 키워드를 검색해보세요."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="newsSearchInput"
          />
          <button type="submit" className="newsSearchIconButton" aria-label="검색">
            <Search size={19} strokeWidth={2.1} />
          </button>
        </form>
      </section>

      {/* Latest News List */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-6">최신 뉴스</h2>

        {/* Category Tabs */}
        <div className="mb-8 flex flex-wrap gap-2 border-b border-gray-700 pb-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {isLoadingLatest ? (
          <div className="text-center text-gray-400">뉴스를 불러오는 중...</div>
        ) : remainingNews.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {remainingNews.map((news: NewsItem, index: number) => (
              <div
                key={index}
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
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-gray-500">{news.source}</span>
                    <span className="text-xs text-gray-500">{formatDate(news.publishedAt || news.pubDate)}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2 line-clamp-2">
                    {news.title}
                  </h3>
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
        ) : (
          <div className="text-center text-gray-400">뉴스를 불러올 수 없습니다.</div>
        )}
      </div>
        </>
      ) : (
        <section className="newsIssuesPlaceholder" role="tabpanel">
          <p>이슈를 준비하고 있습니다.</p>
        </section>
      )}
    </div>
  );
}
