import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, X } from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);

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

  // Fetch search results
  const { data: searchResultsData, isLoading: isLoadingSearch } = trpc.news.searchNews.useQuery(
    { query: searchQuery, limit: 20 },
    {
      enabled: hasSearched && searchQuery.length > 0,
      retry: 1,
      refetchOnWindowFocus: false,
    }
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

  const searchResults = useMemo(() => {
    return Array.isArray(searchResultsData) ? searchResultsData : [];
  }, [searchResultsData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setHasSearched(true);
    }
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

  const openArticlePreview = (news: NewsItem) => {
    setSelectedArticle(news);
  };

  const closeArticlePreview = () => {
    setSelectedArticle(null);
  };

  const renderArticlePreviewButton = (news: NewsItem) => (
    <button
      type="button"
      onClick={() => openArticlePreview(news)}
      className="text-blue-400 hover:text-blue-300 text-sm font-medium"
    >
      원문 보기 →
    </button>
  );

  return (
    <div className="pageContainer">
      {/* Page Header */}
      <div className="pageHeader">
        <h1 className="pageTitle">뉴스 & 이슈</h1>
        <p className="pageDescription">오늘 주목받는 이슈를 빠르게 확인하고 콘텐츠 아이디어로 연결해보세요.</p>
        {getLatestUpdateTime && (
          <p className="text-sm text-slate-500 mt-3">마지막 업데이트: {formatUpdateTime(getLatestUpdateTime)}</p>
        )}
      </div>

      {/* Featured News Cards - 4 Categories */}
      {isLoadingFeatured ? (
        <div className="mb-12 text-center text-gray-400">뉴스를 불러오는 중...</div>
      ) : (
        <div className="mb-12">
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
                      {renderArticlePreviewButton(news)}
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

      {/* Search Area */}
      <div className="mb-12 bg-gray-900 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-white mb-2">키워드 이슈 검색</h2>
        <p className="text-sm text-slate-400 mb-6">관심 있는 키워드의 최신 뉴스를 찾아보세요.</p>
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="text"
            placeholder="유튜브, AI, 아이돌, 경제, 브랜드, 사건 등 관심 키워드를 검색해보세요."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-gray-800 border-gray-700 text-white placeholder-gray-500"
          />
          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            검색
          </Button>
        </form>
      </div>

      {/* Search Results */}
      {hasSearched && (
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">검색 결과: {searchQuery}</h2>
          {isLoadingSearch ? (
            <div className="text-center text-gray-400">검색 결과를 불러오는 중...</div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {searchResults.map((news: NewsItem, index: number) => (
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
                    {renderArticlePreviewButton(news)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-400">제목에 '{searchQuery}'가 포함된 뉴스가 없습니다. 다른 키워드로 검색해보세요.</div>
          )}
        </div>
      )}

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
                  {renderArticlePreviewButton(news)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-400">뉴스를 불러올 수 없습니다.</div>
        )}
      </div>

      {selectedArticle && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-sm"
          onClick={closeArticlePreview}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                  <span>{selectedArticle.source}</span>
                  <span>{formatDate(selectedArticle.publishedAt || selectedArticle.pubDate)}</span>
                </div>
                <h2 className="line-clamp-2 text-base font-semibold text-white md:text-lg">
                  {selectedArticle.title}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={selectedArticle.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-700 px-3 text-sm font-medium text-slate-200 hover:bg-slate-800"
                >
                  <ExternalLink size={15} />
                  새 탭
                </a>
                <button
                  type="button"
                  onClick={closeArticlePreview}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                  aria-label="원문 팝업 닫기"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="border-b border-slate-800 bg-slate-900/70 px-5 py-2 text-xs text-slate-400">
              일부 언론사는 보안 정책으로 내부 팝업 표시를 막을 수 있습니다. 화면이 비어 있으면 새 탭으로 열어주세요.
            </div>
            <iframe
              src={selectedArticle.link}
              title={selectedArticle.title}
              className="h-full w-full flex-1 border-0 bg-white"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
        </div>
      )}
    </div>
  );
}
