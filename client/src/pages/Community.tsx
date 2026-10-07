import { useMemo, useState } from "react";
import { Bookmark, MessageCircle, RefreshCw, ThumbsUp } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { formatCommunityDateTime } from "@/lib/communityDateTime";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import { useAuth } from "@/_core/hooks/useAuth";

const COMMUNITY_OPTIONS = [
  { id: "dcinside", label: "디시인사이드", connected: true },
  { id: "ppomppu", label: "뽐뿌", connected: true },
  { id: "natepon", label: "네이트판", connected: true },
  { id: "ruliweb", label: "루리웹", connected: true },
  { id: "inven", label: "인벤", connected: true },
  { id: "bobaedream", label: "보배드림", connected: true },
  { id: "humoruniv", label: "웃긴대학", connected: true },
  { id: "theqoo", label: "더쿠", connected: false },
  { id: "instiz", label: "인스티즈", connected: false },
  { id: "clien", label: "클리앙", connected: false },
] as const;

type CommunityId = (typeof COMMUNITY_OPTIONS)[number]["id"];

type SourcePost = {
  title: string;
  time: string;
  viewCount: number | string | null;
  reactionCount: number;
  commentCount: number;
  url: string;
};

type SourceResponse = {
  success: boolean;
  data?: SourcePost[];
  collectedAt?: string;
  error?: string | null;
};

const PAGE_SIZE = 10;
const REFRESH_INTERVAL = 10 * 60 * 1000;

function formatUpdatedAt(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}.${month}.${day} ${hour}:${minute} 기준`;
}

export default function Community() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityId>("dcinside");
  const [currentPage, setCurrentPage] = useState(1);
  const [showGuestPrompt, setShowGuestPrompt] = useState(false);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());

  const queryOptions = (enabled: boolean) => ({
    enabled,
    retry: 1,
    staleTime: REFRESH_INTERVAL,
    refetchInterval: REFRESH_INTERVAL,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  const dcinside = trpc.community.getDcinside.useQuery({ sort: "source" }, queryOptions(selectedCommunity === "dcinside"));
  const ppomppu = trpc.community.getPpomppu.useQuery(undefined, queryOptions(selectedCommunity === "ppomppu"));
  const natepon = trpc.community.getNatePann.useQuery({ sort: "source" }, queryOptions(selectedCommunity === "natepon"));
  const ruliweb = trpc.community.getRuliweb.useQuery({ sort: "source" }, queryOptions(selectedCommunity === "ruliweb"));
  const inven = trpc.community.getInven.useQuery({ sort: "source" }, queryOptions(selectedCommunity === "inven"));
  const bobaedream = trpc.community.getBobaedream.useQuery({ sort: "source" }, queryOptions(selectedCommunity === "bobaedream"));
  const humoruniv = trpc.community.getHumorUniv.useQuery({ sort: "source" }, queryOptions(selectedCommunity === "humoruniv"));

  const queries = { dcinside, ppomppu, natepon, ruliweb, inven, bobaedream, humoruniv };
  const selectedQuery = selectedCommunity in queries
    ? queries[selectedCommunity as keyof typeof queries]
    : null;
  const response = selectedQuery?.data as SourceResponse | undefined;
  const selectedOption = COMMUNITY_OPTIONS.find(option => option.id === selectedCommunity)!;
  const posts = useMemo(() => response?.success ? response.data || [] : [], [response]);
  const isLoading = selectedOption.connected && selectedQuery?.isPending && !response;
  const isFetching = Boolean(selectedQuery?.isFetching);
  const totalPages = Math.ceil(posts.length / PAGE_SIZE);
  const visiblePage = isAuthenticated ? currentPage : 1;
  const visiblePosts = posts.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE);

  const selectCommunity = (community: CommunityId) => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setShowGuestPrompt(true);
      return;
    }
    setSelectedCommunity(community);
    setCurrentPage(1);
  };

  const changePage = (page: number) => {
    if (page > 1 && !isAuthenticated) {
      if (!authLoading) setShowGuestPrompt(true);
      return;
    }
    setCurrentPage(page);
    document.querySelector(".communityListWrapper")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedPosts(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="communityPage">
      <div className="pageHeader">
        <h1 className="pageTitle">커뮤니티 반응</h1>
        <p className="pageDescription">커뮤니티별 신규 글과 반응을 한 곳에서 확인하고 컨텐츠로 만들어보세요.</p>
      </div>

      <div className="tabMenu communitySourceFilters" role="group" aria-label="커뮤니티 선택">
        {COMMUNITY_OPTIONS.map(option => (
          <button
            key={option.id}
            type="button"
            className={`tabButton communitySourceFilter${selectedCommunity === option.id ? " active" : ""}`}
            aria-pressed={selectedCommunity === option.id}
            onClick={() => selectCommunity(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="communityListToolbar">
        <span className="communityUpdateText">{formatUpdatedAt(response?.collectedAt) || selectedOption.label}</span>
        {selectedOption.connected && (
          <button
            type="button"
            className="communityRefreshButton"
            onClick={() => selectedQuery?.refetch()}
            disabled={isFetching}
            aria-label={isFetching ? "게시물 새로고침 중" : "게시물 새로고침"}
            title={isFetching ? "새로고침 중" : "새로고침"}
          >
            <RefreshCw size={16} className={isFetching ? "isSpinning" : ""} />
          </button>
        )}
      </div>

      <div className="communityListWrapper communitySourceList">
        <div className="communityListHeader">
          <div className="colRank">순번</div>
          <div className="colTitle">제목</div>
          <div className="colTime">시간</div>
          <div className="colViews">조회</div>
          <div className="colBookmark">저장</div>
        </div>

        <div className="communityListContainer">
          {isLoading ? (
            <div className="communityEmptyState communityRankingLoading" role="status" aria-live="polite">
              <span className="communityLoadingSpinner" aria-hidden="true" />
              <p className="emptyStateTitle">게시물을 불러오는 중입니다.</p>
            </div>
          ) : visiblePosts.length > 0 ? (
            visiblePosts.map((post, index) => {
              const postId = `${selectedCommunity}:${post.url || (visiblePage - 1) * PAGE_SIZE + index}`;
              const isBookmarked = bookmarkedPosts.has(postId);
              return (
                <div key={postId} className="communityPostRow">
                  <div className="colRank"><span className="rankBadge">{(visiblePage - 1) * PAGE_SIZE + index + 1}</span></div>
                  <div className="colTitle">
                    <div className="titleWrapper">
                      <a href={post.url} target="_blank" rel="noopener noreferrer" className="postTitleLink">
                        <p className="postTitle">{post.title}</p>
                      </a>
                      <div className="postMeta">
                        <span className="metaItem"><ThumbsUp size={12} />{post.reactionCount.toLocaleString()}</span>
                        <span className="metaItem"><MessageCircle size={12} />{post.commentCount.toLocaleString()}</span>
                        <span className="metaItem communityMobileTime">{formatCommunityDateTime(post.time)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="colTime"><span className="timeText">{formatCommunityDateTime(post.time)}</span></div>
                  <div className="colViews">
                    <span className="viewsText">{post.viewCount == null ? "-" : typeof post.viewCount === "number" ? post.viewCount.toLocaleString() : post.viewCount}</span>
                  </div>
                  <div className="colBookmark">
                    <button
                      type="button"
                      className={`communityBookmarkButton${isBookmarked ? " active" : ""}`}
                      onClick={() => toggleBookmark(postId)}
                      aria-label={isBookmarked ? "북마크 제거" : "북마크 추가"}
                      title={isBookmarked ? "북마크 제거" : "북마크 추가"}
                    >
                      <Bookmark size={18} fill={isBookmarked ? "currentColor" : "none"} />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="communityEmptyState">
              <p className="emptyStateTitle">
                {!selectedOption.connected ? "현재 연결 준비 중인 커뮤니티입니다." : response?.success === false || selectedQuery?.error ? "게시물을 불러오지 못했습니다." : "표시할 게시물이 없습니다."}
              </p>
              {selectedOption.connected && (response?.success === false || selectedQuery?.error) && (
                <p className="emptyStateSubtitle">잠시 후 새로고침해 주세요.</p>
              )}
            </div>
          )}

        </div>
        {!isLoading && totalPages > 1 && (
          <div className="communityPagination">
            <div className="paginationContent">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (
                <button
                  key={page}
                  type="button"
                  className={`paginationButton${visiblePage === page ? " active" : ""}`}
                  onClick={() => changePage(page)}
                  aria-label={`${page}페이지로 이동`}
                  aria-current={visiblePage === page ? "page" : undefined}
                >
                  {page}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <GuestAccessPrompt
        open={showGuestPrompt && !isAuthenticated}
        onBrowse={() => setShowGuestPrompt(false)}
        onLogin={() => {
          setShowGuestPrompt(false);
          setLocation("/login?redirect=%2Fcommunity");
        }}
        onSignup={() => {
          setShowGuestPrompt(false);
          setLocation("/login?mode=signup&redirect=%2Fcommunity");
        }}
      />
    </div>
  );
}
