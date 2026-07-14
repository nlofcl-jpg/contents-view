"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Bookmark, MessageCircle, ThumbsUp } from "lucide-react";
import { trpc } from "@/lib/trpc";

type CommunityFilterType = "all" | "dcinside" | "ppomppu" | "theqoo" | "instiz" | "natepon" | "ruliweb" | "inven" | "bobaedream" | "humoruniv" | "clien";
type PeriodFilterType = "realtime" | "today" | "week";
type SortFilterType = "popular" | "reaction" | "view" | "comment";

const COMMUNITY_OPTIONS = [
  { id: "all", label: "전체" },
  { id: "dcinside", label: "디시인사이드" },
  { id: "ppomppu", label: "뽐뿌" },
  { id: "natepon", label: "네이트판" },
  { id: "ruliweb", label: "루리웹" },
  { id: "inven", label: "인벤" },
  { id: "bobaedream", label: "보배드림" },
  { id: "humoruniv", label: "웃긴대학" },
  { id: "theqoo", label: "더쿠" },
  { id: "instiz", label: "인스티즈" },
  { id: "clien", label: "클리앙" },
] as const;

const PERIOD_OPTIONS = [
  { id: "realtime", label: "실시간" },
  { id: "today", label: "오늘" },
  { id: "week", label: "최근 7일" },
] as const;

const SORT_OPTIONS = [
  { id: "popular", label: "인기순" },
  { id: "reaction", label: "추천순" },
  { id: "view", label: "조회순" },
  { id: "comment", label: "댓글순" },
] as const;

// Community sources configuration for scalable data merging
const communitySources = [
  { key: "dcinside", label: "디시인사이드", query: null as any },
  { key: "ppomppu", label: "뽐뿌", query: null as any },
  { key: "natepon", label: "네이트판", query: null as any },
  { key: "ruliweb", label: "루리웹", query: null as any },
  { key: "inven", label: "인벤", query: null as any },
  { key: "bobaedream", label: "보배드림", query: null as any },
  { key: "humoruniv", label: "웃긴대학", query: null as any },
] as const;

// 샘플 데이터 (30개) - 폴백용
const SAMPLE_POSTS = [
  {
    rank: 1,
    title: "이번 주 가장 화제가 된 게시물 제목입니다",
    time: "32분 전",
    viewCount: "12.4만",
    reactionCount: 1240,
    commentCount: 386,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 2,
    community: "디시인사이드",
    title: "커뮤니티에서 가장 많이 공유된 콘텐츠",
    time: "1시간 전",
    viewCount: "8.9만",
    reactionCount: 892,
    commentCount: 245,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 3,
    community: "더쿠",
    title: "최근 핫한 주제에 대한 토론 게시물",
    time: "2시간 전",
    viewCount: "7.2만",
    reactionCount: 756,
    commentCount: 198,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 4,
    community: "인스티즈",
    title: "팬들이 주목하는 연예인 소식",
    time: "3시간 전",
    viewCount: "6.5만",
    reactionCount: 634,
    commentCount: 167,
    url: "#",
    isBookmarked: true,
  },
  {
    rank: 5,
    community: "네이트판",
    title: "사회 이슈에 대한 다양한 의견",
    time: "4시간 전",
    viewCount: "5.8만",
    reactionCount: 512,
    commentCount: 145,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 6,
    community: "루리웹",
    title: "게임 커뮤니티의 핫이슈",
    time: "5시간 전",
    viewCount: "5.1만",
    reactionCount: 456,
    commentCount: 123,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 7,
    community: "클리앙",
    title: "기술 뉴스 및 리뷰",
    time: "6시간 전",
    viewCount: "4.7만",
    reactionCount: 398,
    commentCount: 102,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 8,
    title: "감정 나눔 및 공감 글",
    time: "7시간 전",
    viewCount: "4.3만",
    reactionCount: 345,
    commentCount: 87,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 9,
    community: "디시인사이드",
    title: "일상 정보 및 팁 공유",
    time: "8시간 전",
    viewCount: "3.9만",
    reactionCount: 289,
    commentCount: 76,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 10,
    community: "더쿠",
    title: "드라마 및 영화 리뷰",
    time: "9시간 전",
    viewCount: "3.5만",
    reactionCount: 234,
    commentCount: 65,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 11,
    community: "인스티즈",
    title: "K-pop 아이돌 소식",
    time: "10시간 전",
    viewCount: "3.2만",
    reactionCount: 198,
    commentCount: 54,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 12,
    community: "네이트판",
    title: "정치 뉴스 및 분석",
    time: "11시간 전",
    viewCount: "2.9만",
    reactionCount: 167,
    commentCount: 45,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 13,
    community: "루리웹",
    title: "게임 공략 및 팁",
    time: "12시간 전",
    viewCount: "2.6만",
    reactionCount: 145,
    commentCount: 38,
    url: "#",
    isBookmarked: true,
  },
  {
    rank: 14,
    community: "클리앙",
    title: "IT 기기 리뷰",
    time: "13시간 전",
    viewCount: "2.4만",
    reactionCount: 123,
    commentCount: 32,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 15,
    title: "일상 이야기 및 경험담",
    time: "14시간 전",
    viewCount: "2.2만",
    reactionCount: 112,
    commentCount: 29,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 16,
    community: "더쿠",
    title: "드라마 및 영화 리뷰",
    time: "15시간 전",
    viewCount: "1.9만",
    reactionCount: 145,
    commentCount: 33,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 17,
    community: "인스티즈",
    title: "팬 활동 및 응원 게시물",
    time: "16시간 전",
    viewCount: "1.8만",
    reactionCount: 134,
    commentCount: 30,
    url: "#",
    isBookmarked: true,
  },
  {
    rank: 18,
    community: "네이트판",
    title: "정치 및 사회 이슈 토론",
    time: "17시간 전",
    viewCount: "1.6만",
    reactionCount: 123,
    commentCount: 28,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 19,
    community: "루리웹",
    title: "게임 커뮤니티 소식",
    time: "18시간 전",
    viewCount: "1.5만",
    reactionCount: 112,
    commentCount: 25,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 20,
    community: "클리앙",
    title: "기술 뉴스 및 리뷰",
    time: "19시간 전",
    viewCount: "1.4만",
    reactionCount: 101,
    commentCount: 23,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 21,
    community: "디시인사이드",
    title: "일상 정보 및 팁 공유",
    time: "20시간 전",
    viewCount: "1.3만",
    reactionCount: 98,
    commentCount: 21,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 22,
    title: "감정 표현 및 공감 글",
    time: "21시간 전",
    viewCount: "1.2만",
    reactionCount: 87,
    commentCount: 19,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 23,
    community: "더쿠",
    title: "연예 뉴스 정리",
    time: "22시간 전",
    viewCount: "1.1만",
    reactionCount: 76,
    commentCount: 17,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 24,
    community: "인스티즈",
    title: "팬덤 문화 이야기",
    time: "23시간 전",
    viewCount: "9,800",
    reactionCount: 65,
    commentCount: 15,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 25,
    community: "네이트판",
    title: "시사 토론 게시물",
    time: "1일 전",
    viewCount: "8,900",
    reactionCount: 54,
    commentCount: 12,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 26,
    community: "루리웹",
    title: "게임 정보 및 소식",
    time: "1일 전",
    viewCount: "8,500",
    reactionCount: 43,
    commentCount: 10,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 27,
    community: "클리앙",
    title: "기술 정보 및 가이드",
    time: "1일 전",
    viewCount: "8,100",
    reactionCount: 32,
    commentCount: 9,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 28,
    community: "디시인사이드",
    title: "일상 이야기 및 경험담",
    time: "1일 전",
    viewCount: "7,500",
    reactionCount: 28,
    commentCount: 8,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 29,
    title: "감정 나눔 및 조언 글",
    time: "1일 전",
    viewCount: "7,200",
    reactionCount: 25,
    commentCount: 7,
    url: "#",
    isBookmarked: false,
  },
  {
    rank: 30,
    community: "더쿠",
    title: "최신 연예 뉴스 정리",
    time: "1일 전",
    viewCount: "6,800",
    reactionCount: 22,
    commentCount: 6,
    url: "#",
    isBookmarked: false,
  },
];

type OpenMenuType = "community" | "sort" | "period" | null;

interface Post {
  id?: string; // Unique identifier: ${community}-${originalId}
  rank: number;
  community?: string;
  title: string;
  time: string;
  viewCount: number | string;
  reactionCount: number;
  commentCount: number;
  url: string;
  isBookmarked: boolean;
}

interface DropdownPosition {
  top: number;
  left: number;
}

// Dropdown Portal Component
function DropdownPortal({
  isOpen,
  position,
  options,
  selectedValue,
  onSelect,
  onMouseEnter,
  onMouseLeave,
}: {
  isOpen: boolean;
  position: DropdownPosition | null;
  options: readonly { id: string; label: string }[];
  selectedValue: string;
  onSelect: (id: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  if (!isOpen || !position) return null;

  return createPortal(
    <div
      className="unifiedMenuDropdown"
      style={{
        position: "fixed",
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 9999,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`unifiedMenuOption ${selectedValue === option.id ? "selected" : ""}`}
          onClick={() => onSelect(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>,
    document.body
  );
}

export default function Community() {
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityFilterType>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilterType>("today");
  const [selectedSort, setSelectedSort] = useState<SortFilterType>("popular");
  const [openMenu, setOpenMenu] = useState<OpenMenuType>(null);
  const [posts, setPosts] = useState<Post[]>(SAMPLE_POSTS);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<number>>(
    new Set(SAMPLE_POSTS.filter((p) => p.isBookmarked).map((p) => p.rank))
  );
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const menuTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const communityButtonRef = useRef<HTMLButtonElement | null>(null);
  const sortButtonRef = useRef<HTMLButtonElement | null>(null);
  const periodButtonRef = useRef<HTMLButtonElement | null>(null);

  // Map frontend sort values to server enum values - memoized to prevent infinite queries
  const sortParam = useMemo(() => {
    const sortMap: Record<string, string> = {
      "popular": "popular",
      "reaction": "recommend",
      "view": "views",
      "comment": "comments",
    };
    return sortMap[selectedSort] || "popular";
  }, [selectedSort]);

  // Fetch DC Inside posts
  const dcinsideQuery = trpc.community.getDcinside.useQuery({ sort: sortParam as any }, { retry: 1, refetchOnWindowFocus: false });
  
  // Fetch Ppomppu posts
  const ppomppuQuery = trpc.community.getPpomppu.useQuery();
  
  // Fetch Nate Pann posts
  const natepannQuery = trpc.community.getNatePann.useQuery({ sort: sortParam as any }, { retry: 1, refetchOnWindowFocus: false });
  
  // Fetch Ruliweb posts
  const ruliwebQuery = trpc.community.getRuliweb.useQuery({ sort: sortParam as any }, { retry: 1, refetchOnWindowFocus: false });
  
  // Fetch Inven posts
  const invenQuery = trpc.community.getInven.useQuery({ sort: sortParam as any }, { retry: 1, refetchOnWindowFocus: false });
  
  // Fetch Bobaedream posts
  const bobaedreamQuery = trpc.community.getBobaedream.useQuery({ sort: sortParam as any }, { retry: 1, refetchOnWindowFocus: false });
  
  // Fetch HumorUniv posts
  const humorunivQuery = trpc.community.getHumorUniv.useQuery({ sort: sortParam as any }, { retry: 1, refetchOnWindowFocus: false });

  // Update posts when data is loaded
  useEffect(() => {
    const allPosts: Post[] = [];
    let hasError = false;
    let errorMsg = '';
    
    // Add DC Inside posts
    if (dcinsideQuery.data?.success && dcinsideQuery.data?.data) {
      const dcinsidePosts: Post[] = dcinsideQuery.data.data.map((post: any, index: number) => ({
        id: `${post.community || 'dcinside'}-${post.rank || index}`,
        rank: post.rank,
        community: post.community,
        title: post.title,
        time: post.time,
        viewCount: post.viewCount,
        reactionCount: post.reactionCount,
        commentCount: post.commentCount,
        url: post.url,
        isBookmarked: false,
      }));
      allPosts.push(...dcinsidePosts);
    } else if (dcinsideQuery.data?.success === false) {
      hasError = true;
      errorMsg = dcinsideQuery.data?.error || '디시인사이드 인기글을 불러오지 못했습니다.';
    }
    
    // Add Ppomppu posts
    if (ppomppuQuery.data?.success && ppomppuQuery.data?.data) {
      const ppomppuPosts: Post[] = ppomppuQuery.data.data.map((post: any, index: number) => ({
        id: `${post.community || 'ppomppu'}-${post.rank || index}`,
        rank: post.rank,
        community: post.community,
        title: post.title,
        time: post.time,
        viewCount: post.viewCount,
        reactionCount: post.reactionCount,
        commentCount: post.commentCount,
        url: post.url,
        isBookmarked: false,
      }));
      allPosts.push(...ppomppuPosts);
    } else if (ppomppuQuery.data?.success === false) {
      // Only show error if DC Inside also failed
      if (hasError) {
        errorMsg = '데이터를 불러오지 못했습니다.';
      }
    }
    
    // Add Nate Pann posts
    if (natepannQuery.data?.success && natepannQuery.data?.data) {
      const natepannPosts: Post[] = natepannQuery.data.data.map((post: any, index: number) => ({
        id: `${post.community || 'natepann'}-${post.rank || index}`,
        rank: post.rank,
        community: post.community,
        title: post.title,
        time: post.time,
        viewCount: post.viewCount,
        reactionCount: post.reactionCount,
        commentCount: post.commentCount,
        url: post.url,
        isBookmarked: false,
      }));
      allPosts.push(...natepannPosts);
    } else if (natepannQuery.data?.success === false) {
      // Only show error if DC Inside also failed
      if (hasError) {
        errorMsg = '데이터를 불러오지 못했습니다.';
      }
    }
    
    // Add Ruliweb posts
    if (ruliwebQuery.data?.success && ruliwebQuery.data?.data) {
      const ruliwebPosts: Post[] = ruliwebQuery.data.data.map((post: any, index: number) => ({
        id: `${post.community || 'ruliweb'}-${post.rank || index}`,
        rank: post.rank,
        community: post.community,
        title: post.title,
        time: post.time,
        viewCount: post.viewCount,
        reactionCount: post.reactionCount,
        commentCount: post.commentCount,
        url: post.url,
        isBookmarked: false,
      }));
      allPosts.push(...ruliwebPosts);
    } else if (ruliwebQuery.data?.success === false) {
      // Only show error if DC Inside also failed
      if (hasError) {
        errorMsg = '데이터를 불러오지 못했습니다.';
      }
    }
    
    // Add Inven posts
    if (invenQuery.data?.success && invenQuery.data?.data) {
      const invenPosts: Post[] = invenQuery.data.data.map((post: any, index: number) => ({
        id: `${post.community || 'inven'}-${post.rank || index}`,
        rank: post.rank,
        community: post.community,
        title: post.title,
        time: post.time,
        viewCount: post.viewCount,
        reactionCount: post.reactionCount,
        commentCount: post.commentCount,
        url: post.url,
        isBookmarked: false,
      }));
      allPosts.push(...invenPosts);
    } else if (invenQuery.data?.success === false) {
      // Only show error if DC Inside also failed
      if (hasError) {
        errorMsg = '데이터를 불러오지 못했습니다.';
      }
    }
    
    // Add Bobaedream posts
    if (bobaedreamQuery.data?.success && bobaedreamQuery.data?.data) {
      const bobaedreamPosts: Post[] = bobaedreamQuery.data.data.map((post: any, index: number) => ({
        id: `${post.community || 'bobaedream'}-${post.rank || index}`,
        rank: post.rank,
        community: post.community,
        title: post.title,
        time: post.time,
        viewCount: post.viewCount,
        reactionCount: post.reactionCount,
        commentCount: post.commentCount,
        url: post.url,
        isBookmarked: false,
      }));
      allPosts.push(...bobaedreamPosts);
    } else if (bobaedreamQuery.data?.success === false) {
      // Only show error if DC Inside also failed
      if (hasError) {
        errorMsg = '데이터를 불러오지 못했습니다.';
      }
    }
    
    // Add HumorUniv posts
    if (humorunivQuery.data?.success && humorunivQuery.data?.data) {
      const humorunivPosts: Post[] = humorunivQuery.data.data.map((post: any, index: number) => ({
        id: `${post.community || 'humoruniv'}-${post.rank || index}`,
        rank: post.rank,
        community: post.community,
        title: post.title,
        time: post.time,
        viewCount: post.viewCount,
        reactionCount: post.reactionCount,
        commentCount: post.commentCount,
        url: post.url,
        isBookmarked: false,
      }));
      allPosts.push(...humorunivPosts);
    } else if (humorunivQuery.data?.success === false) {
      // Only show error if DC Inside also failed
      if (hasError) {
        errorMsg = '데이터를 불러오지 못했습니다.';
      }
    }
    
    if (allPosts.length > 0) {
      setPosts(allPosts);
      setError(null);
      // Update lastFetchedAt with the most recent collectedAt
      const dcAt = (dcinsideQuery.data as any)?.success ? (dcinsideQuery.data as any)?.collectedAt : undefined;
      const ppAt = (ppomppuQuery.data as any)?.success ? (ppomppuQuery.data as any)?.collectedAt : undefined;
      const npAt = (natepannQuery.data as any)?.success ? (natepannQuery.data as any)?.collectedAt : undefined;
      const rwAt = (ruliwebQuery.data as any)?.success ? (ruliwebQuery.data as any)?.collectedAt : undefined;
      const ivAt = (invenQuery.data as any)?.success ? (invenQuery.data as any)?.collectedAt : undefined;
      const bbAt = (bobaedreamQuery.data as any)?.success ? (bobaedreamQuery.data as any)?.collectedAt : undefined;
      const huAt = (humorunivQuery.data as any)?.success ? (humorunivQuery.data as any)?.collectedAt : undefined;
      let latestAt = dcAt;
      if (ppAt && (!latestAt || new Date(ppAt) > new Date(latestAt))) {
        latestAt = ppAt;
      }
      if (npAt && (!latestAt || new Date(npAt) > new Date(latestAt))) {
        latestAt = npAt;
      }
      if (rwAt && (!latestAt || new Date(rwAt) > new Date(latestAt))) {
        latestAt = rwAt;
      }
      if (ivAt && (!latestAt || new Date(ivAt) > new Date(latestAt))) {
        latestAt = ivAt;
      }
      if (bbAt && (!latestAt || new Date(bbAt) > new Date(latestAt))) {
        latestAt = bbAt;
      }
      if (huAt && (!latestAt || new Date(huAt) > new Date(latestAt))) {
        latestAt = huAt;
      }
      if (latestAt) {
        setLastFetchedAt(latestAt);
      }
    } else if (hasError) {
      setError(errorMsg);
    }
  }, [dcinsideQuery.data, ppomppuQuery.data, natepannQuery.data, ruliwebQuery.data, invenQuery.data, bobaedreamQuery.data, humorunivQuery.data, selectedSort]);

    // 페이지네이션 설정
  const PAGE_SIZE = 10;
  
  // Filter posts based on selected community
  // Map community keys to Korean names for filtering
  const communityNameMap: Record<string, string> = {
    "dcinside": "디시인사이드",
    "ppomppu": "뽐뿌",
    "natepon": "네이트판",
    "ruliweb": "루리웹",
    "inven": "인벤",
    "bobaedream": "보배드림",
    "humoruniv": "웃긴대학",
  };
  
  const filteredPosts = selectedCommunity === "all"
    ? posts
    : communityNameMap[selectedCommunity]
    ? posts.filter(p => p.community === communityNameMap[selectedCommunity])
    : [];
  
  // Check if selected community is not yet connected
  const isUnconnectedCommunity = !communitySources.some((s: any) => s.key === selectedCommunity) && selectedCommunity !== "all";
  
  // Apply sorting
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    switch (selectedSort) {
      case "popular": {
        // Calculate popularity score: (reactions * 2 + comments * 1.5 + views * 0.1)
        const viewA = typeof a.viewCount === 'number' ? a.viewCount : 0;
        const viewB = typeof b.viewCount === 'number' ? b.viewCount : 0;
        const scoreA = (a.reactionCount * 2) + (a.commentCount * 1.5) + (viewA * 0.1);
        const scoreB = (b.reactionCount * 2) + (b.commentCount * 1.5) + (viewB * 0.1);
        return scoreB - scoreA;
      }
      case "reaction":
        return b.reactionCount - a.reactionCount;
      case "view": {
        const viewA = typeof a.viewCount === 'number' ? a.viewCount : 0;
        const viewB = typeof b.viewCount === 'number' ? b.viewCount : 0;
        return viewB - viewA;
      }
      case "comment":
        return b.commentCount - a.commentCount;
      default:
        return 0;
    }
  });
  
  const totalPages = Math.ceil(sortedPosts.length / PAGE_SIZE);
  const paginatedPosts = sortedPosts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const getCommunityLabel = () => {
    if (selectedCommunity === "inven") return "인벤";
    return COMMUNITY_OPTIONS.find((o) => o.id === selectedCommunity)?.label || "전체";
  };
  const getPeriodLabel = () => PERIOD_OPTIONS.find((o) => o.id === selectedPeriod)?.label || "오늘";
  const getSortLabel = () => SORT_OPTIONS.find((o) => o.id === selectedSort)?.label || "인기순";

  const getCommunityKoreanName = (key: string): string => {
    return communityNameMap[key] || key;
  };
  
  const getButtonRef = (menu: OpenMenuType): React.RefObject<HTMLButtonElement | null> | null => {
    switch (menu) {
      case "community":
        return communityButtonRef;
      case "sort":
        return sortButtonRef;
      case "period":
        return periodButtonRef;
      default:
        return null;
    }
  };

  const calculateDropdownPosition = (buttonRef: React.RefObject<HTMLButtonElement | null> | null) => {
    if (!buttonRef?.current) return null;
    const rect = buttonRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + 8,
      left: rect.left - 16,
    };
  };

  const handleMenuOpen = (menu: OpenMenuType) => {
    if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    if (openMenu === menu) {
      setOpenMenu(null);
      setDropdownPosition(null);
    } else {
      setOpenMenu(menu);
      const buttonRef = getButtonRef(menu);
      const position = calculateDropdownPosition(buttonRef);
      setDropdownPosition(position);
    }
  };

  const handleMenuClose = () => {
    menuTimeoutRef.current = setTimeout(() => {
      setOpenMenu(null);
      setDropdownPosition(null);
    }, 200);
  };

  const handleMenuSelect = (menu: OpenMenuType, value: string) => {
    if (menu === "community") {
      setSelectedCommunity(value as CommunityFilterType);
    } else if (menu === "sort") {
      setSelectedSort(value as SortFilterType);
    } else if (menu === "period") {
      setSelectedPeriod(value as PeriodFilterType);
    }
    setOpenMenu(null);
    setDropdownPosition(null);
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 이동
  };

  const handlePostClick = (rank: number) => {
    console.log(`Post clicked: ${rank}`);
  };

  const handleBookmarkToggle = (e: React.MouseEvent, rank: number) => {
    e.stopPropagation();
    setBookmarkedPosts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(rank)) {
        newSet.delete(rank);
      } else {
        newSet.add(rank);
      }
      return newSet;
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // 페이지 변경 시 리스트 상단으로 스크롤
    const listContainer = document.querySelector(".communityListContainer");
    if (listContainer) {
      listContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="communityPage">
      {/* Page Header */}
      <div className="pageHeader">
        <h1 className="pageTitle">커뮤니티 반응</h1>
        <p className="pageDescription">다양한 커뮤니티의 실시간 인기 글과 반응을 한눈에 확인해보세요.</p>
      </div>

      {/* Filter Bar */}
      <div className="unifiedFilterBar">
        <div className="unifiedMenuBar">
          {/* Community Filter */}
          <div className="communityMenuWrapper">
            <button
              ref={communityButtonRef}
              type="button"
              className={`unifiedMenuButton ${openMenu === "community" ? "active" : ""}`}
              onClick={() => handleMenuOpen("community")}
              onMouseEnter={() => handleMenuOpen("community")}
              onMouseLeave={handleMenuClose}
            >
              {getCommunityLabel()}
              <ChevronDown size={16} />
            </button>
            <DropdownPortal
              isOpen={openMenu === "community"}
              position={dropdownPosition}
              options={[
                { id: "all", label: "전체" },
                ...communitySources.map(source => ({
                  id: source.key,
                  label: source.label
                }))
              ]}
              selectedValue={selectedCommunity}
              onSelect={(value) => handleMenuSelect("community", value)}
              onMouseEnter={() => {
                if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
              }}
              onMouseLeave={handleMenuClose}
            />
          </div>

          {/* Sort Filter */}
          <div className="sortMenuWrapper">
            <button
              ref={sortButtonRef}
              type="button"
              className={`unifiedMenuButton ${openMenu === "sort" ? "active" : ""}`}
              onClick={() => handleMenuOpen("sort")}
              onMouseEnter={() => handleMenuOpen("sort")}
              onMouseLeave={handleMenuClose}
            >
              {getSortLabel()}
              <ChevronDown size={16} />
            </button>
            <DropdownPortal
              isOpen={openMenu === "sort"}
              position={dropdownPosition}
              options={SORT_OPTIONS}
              selectedValue={selectedSort}
              onSelect={(value) => handleMenuSelect("sort", value)}
              onMouseEnter={() => {
                if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
              }}
              onMouseLeave={handleMenuClose}
            />
          </div>

          {/* Period Filter */}
          <div className="periodMenuWrapper">
            <button
              ref={periodButtonRef}
              type="button"
              className={`unifiedMenuButton ${openMenu === "period" ? "active" : ""}`}
              onClick={() => handleMenuOpen("period")}
              onMouseEnter={() => handleMenuOpen("period")}
              onMouseLeave={handleMenuClose}
            >
              {getPeriodLabel()}
              <ChevronDown size={16} />
            </button>
            <DropdownPortal
              isOpen={openMenu === "period"}
              position={dropdownPosition}
              options={PERIOD_OPTIONS}
              selectedValue={selectedPeriod}
              onSelect={(value) => handleMenuSelect("period", value)}
              onMouseEnter={() => {
                if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
              }}
              onMouseLeave={handleMenuClose}
            />
          </div>
        </div>
      </div>

      {/* Last Updated Info */}
      {lastFetchedAt && (
        <div className="communityUpdateInfo" style={{ padding: '8px 0' }}>
          <span className="updateText" style={{ fontSize: '12px', fontWeight: '300', color: '#888', letterSpacing: '-0.3px' }}>
            마지막 업데이트: {new Date(lastFetchedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}

      {/* Content List */}
      <div className="communityListWrapper">
        {/* Header */}
        <div className="communityListHeader">
          <div className="colRank">순위</div>
          <div className="colCommunity">커뮤니티</div>
          <div className="colTitle">제목</div>
          <div className="colTime">시간</div>
          <div className="colViews">조회</div>
          <div className="colBookmark">저장</div>
        </div>

        {/* List Container */}
        <div className="communityListContainer">
          {paginatedPosts.length > 0 ? (
            paginatedPosts.map((post, index) => (
              <div
                key={post.id || `${post.community}-${post.rank}`}
                className="communityPostRow"
                onClick={() => handlePostClick(post.rank)}
              >
                {/* Rank */}
                <div className="colRank">
                  <span className="rankBadge">
                    {selectedCommunity === "all" 
                      ? (currentPage - 1) * PAGE_SIZE + index + 1
                      : post.rank
                    }
                  </span>
                </div>

                {/* Community */}
                <div className="colCommunity">
                  <span className="communityName">{post.community}</span>
                </div>

                {/* Title + Meta */}
                <div className="colTitle">
                  <div className="titleWrapper">
                    <a 
                      href={post.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="postTitleLink"
                    >
                      <p className="postTitle">{post.title}</p>
                    </a>
                    <div className="postMeta">
                      <span className="metaItem">
                        <ThumbsUp size={12} />
                        {post.reactionCount.toLocaleString()}
                      </span>
                      <span className="metaItem">
                        <MessageCircle size={12} />
                        {post.commentCount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Time */}
                <div className="colTime">
                  <span className="timeText">{post.time}</span>
                </div>

                {/* Views */}
                <div className="colViews">
                  <span className="viewsText">{post.viewCount === null || post.viewCount === undefined ? '-' : typeof post.viewCount === 'number' ? post.viewCount.toLocaleString() : post.viewCount}</span>
                </div>

                {/* Bookmark Button */}
                <div className="colBookmark">
                  <button
                    type="button"
                    className={`communityBookmarkButton ${bookmarkedPosts.has(post.rank) ? "active" : ""}`}
                    onClick={(e) => handleBookmarkToggle(e, post.rank)}
                    aria-label={bookmarkedPosts.has(post.rank) ? "북마크 제거" : "북마크 추가"}
                    title={bookmarkedPosts.has(post.rank) ? "북마크 제거" : "북마크 추가"}
                  >
                    <Bookmark
                      size={18}
                      fill={bookmarkedPosts.has(post.rank) ? "currentColor" : "none"}
                    />
                  </button>
                </div>
              </div>
            ))
          ) : error ? (
            <div className="communityEmptyState">
              <p className="emptyStateTitle">디시인사이드 인기글을 불러오지 못했습니다.</p>
              <p className="emptyStateSubtitle">잠시 후 다시 시도해주세요.</p>
            </div>
          ) : selectedCommunity === "theqoo" ? (
            <div className="communityEmptyState">
              <p className="emptyStateTitle">현재 연결 준비 중인 커뮤니티입니다.</p>
              <p className="emptyStateSubtitle">공식 접근 방식 또는 공개 데이터 확인 후 순차적으로 연결할 예정입니다.</p>
            </div>
          ) : isUnconnectedCommunity ? (
            <div className="communityEmptyState">
              <p className="emptyStateTitle">아직 연결되지 않은 커뮤니티입니다.</p>
              <p className="emptyStateSubtitle">커뮤니티별 인기 게시물 데이터를 순차적으로 연결할 예정입니다.</p>
            </div>
          ) : (
            <div className="communityEmptyState">
              <p className="emptyStateTitle">커뮤니티 인기 콘텐츠를 준비하고 있습니다.</p>
              <p className="emptyStateSubtitle">커뮤니티별 인기 게시물과 반응 데이터를 순차적으로 연결할 예정입니다.</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (() => {
            const PAGES_PER_GROUP = 10;
            const currentGroup = Math.floor((currentPage - 1) / PAGES_PER_GROUP);
            const startPage = currentGroup * PAGES_PER_GROUP + 1;
            const endPage = Math.min(startPage + PAGES_PER_GROUP - 1, totalPages);
            const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
            const hasPrevGroup = currentGroup > 0;
            const hasNextGroup = endPage < totalPages;

            return (
              <div className="communityPagination">
                <div className="paginationContent">
                  {/* Previous group button */}
                  {hasPrevGroup && (
                    <button
                      type="button"
                      className="paginationButton prevGroup"
                      onClick={() => handlePageChange(Math.max(1, startPage - 1))}
                      aria-label="이전 페이지 묶음"
                    >
                      &lt;
                    </button>
                  )}

                  {/* Page numbers */}
                  {pageNumbers.map((page) => (
                    <button
                      key={page}
                      type="button"
                      className={`paginationButton ${currentPage === page ? "active" : ""}`}
                      onClick={() => handlePageChange(page)}
                      aria-label={`${page}페이지로 이동`}
                      aria-current={currentPage === page ? "page" : undefined}
                    >
                      {page}
                    </button>
                  ))}

                  {/* Next group button */}
                  {hasNextGroup && (
                    <button
                      type="button"
                      className="paginationButton nextGroup"
                      onClick={() => handlePageChange(Math.min(totalPages, endPage + 1))}
                      aria-label="다음 페이지 묶음"
                    >
                      &gt;
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
