import { X } from "lucide-react";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

interface Video {
  id: string;
  title: string;
  channelTitle: string;
  channelThumbnail?: string;
  viewCount: number;
  commentCount?: number;
  categoryId?: string;
  tags?: string[];
  publishedAt: string;
  duration: string;
  velocityPerHour?: number | null;
  averageHourlyViews?: number | null;
  outlierScore?: number | null;
  discoveryScore?: number | null;
  subscriberCount?: number | null;
  hiddenSubscribers?: boolean;
}

interface YouTubeVideoDetailModalProps {
  video: Video | null;
  isOpen: boolean;
  onClose: () => void;
}

// Format view count (e.g., 1000000 -> 100만)
function formatViewCount(count: number): string {
  if (!count || Number.isNaN(count)) return "0";
  if (count >= 100000000) {
    return `${Math.round(count / 10000000) / 10}억`;
  }
  if (count >= 10000) {
    return `${Math.round(count / 1000) / 10}만`;
  }
  if (count >= 1000) {
    return count.toLocaleString("ko-KR");
  }
  return count.toLocaleString("ko-KR");
}

// Format date (e.g., 2024-06-10T12:00:00Z -> 6월 10일)
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}월 ${day}일`;
}

// ISO 8601 duration to readable format (e.g., PT10M30S -> 10:30)
function formatDuration(duration: string): string {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  if (!match) return "0:00";

  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const YOUTUBE_CATEGORY_NAMES: Record<string, string> = {
  "1": "영화/애니메이션",
  "2": "자동차",
  "10": "음악",
  "15": "동물",
  "17": "스포츠",
  "19": "여행",
  "20": "게임",
  "22": "인물/블로그",
  "23": "코미디",
  "24": "엔터테인먼트",
  "25": "뉴스/정치",
  "26": "노하우/스타일",
  "27": "교육",
  "28": "과학기술",
};

function getCategoryName(categoryId?: string) {
  if (!categoryId) return "분류 없음";
  return YOUTUBE_CATEGORY_NAMES[categoryId] || `카테고리 ${categoryId}`;
}

export function YouTubeVideoDetailModal({
  video,
  isOpen,
  onClose,
}: YouTubeVideoDetailModalProps) {
  const { isAuthenticated } = useAuth();
  const { data: analysisData, isFetching: isAnalysisFetching } = trpc.youtube.getVideoAnalysis.useQuery(
    { videoId: video?.id || "" },
    {
      enabled: isAuthenticated && isOpen && Boolean(video?.id),
      retry: false,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  );

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !video) return null;

  const freshVideo = analysisData?.success ? analysisData.video : null;
  const modalVideo: Video = freshVideo
    ? {
        ...video,
        ...freshVideo,
        velocityPerHour: video.velocityPerHour ?? freshVideo.velocityPerHour,
        averageHourlyViews: video.averageHourlyViews ?? freshVideo.averageHourlyViews,
        outlierScore: video.outlierScore ?? freshVideo.outlierScore,
        discoveryScore: video.discoveryScore ?? freshVideo.discoveryScore,
      }
    : video;

  const visibleTags = Array.from(new Set((modalVideo.tags || []).map(tag => tag.trim()).filter(Boolean))).slice(0, 10);
  const insightItems = [
    { label: "조회수", value: `${formatViewCount(modalVideo.viewCount)}회` },
    { label: "댓글 수", value: `${formatViewCount(modalVideo.commentCount || 0)}개` },
    { label: "카테고리", value: getCategoryName(modalVideo.categoryId) },
  ];
  const risingVelocity = modalVideo.velocityPerHour ?? modalVideo.averageHourlyViews;
  const risingInsightItems = modalVideo.discoveryScore === undefined
    ? []
    : [
        {
          label: "시간당 증가량",
          value: risingVelocity === null || risingVelocity === undefined
            ? "-"
            : `${formatViewCount(risingVelocity)}회`,
        },
        {
          label: "채널 대비",
          value: modalVideo.outlierScore === null || modalVideo.outlierScore === undefined
            ? "-"
            : `${modalVideo.outlierScore}배`,
        },
        {
          label: "상승 지수",
          value: modalVideo.discoveryScore === null ? "-" : String(modalVideo.discoveryScore),
        },
      ];

  return (
    <div className="youtubeVideoModalOverlay" onClick={onClose}>
      <div
        className="youtubeVideoModalContent"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          className="youtubeVideoModalCloseBtn"
          onClick={onClose}
          aria-label="Close modal"
        >
          <X size={24} />
        </button>

        {/* YouTube iframe */}
        <div className="youtubeVideoModalIframeContainer">
          <iframe
            src={`https://www.youtube.com/embed/${modalVideo.id}`}
            title={modalVideo.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="youtubeVideoModalIframe"
          />
        </div>

        {/* Video Info */}
        <div className="youtubeVideoModalInfo">
          <h2 className="youtubeVideoModalTitle">{modalVideo.title}</h2>
          <div className="youtubeVideoModalChannelRow">
            <p className="youtubeVideoModalChannel">{modalVideo.channelTitle}</p>
            {(modalVideo.hiddenSubscribers || modalVideo.subscriberCount !== undefined) && (
              <span className="youtubeVideoModalSubscribers">
                {modalVideo.hiddenSubscribers
                  ? "구독자 비공개"
                  : `구독자 ${formatViewCount(modalVideo.subscriberCount || 0)}`}
              </span>
            )}
          </div>

          {/* Meta Info */}
          <div className="youtubeVideoModalMeta">
            <span>{formatDate(modalVideo.publishedAt)}</span>
            <span>{formatDuration(modalVideo.duration)}</span>
            {isAnalysisFetching ? <span>최신 분석 중...</span> : null}
          </div>

          <div className="youtubeVideoInsightGrid">
            {insightItems.map((item) => (
              <div key={item.label} className="youtubeVideoInsightItem">
                <span className="youtubeVideoInsightLabel">{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          {risingInsightItems.length > 0 && (
            <div className="youtubeVideoInsightGrid youtubeVideoRisingInsightGrid">
              {risingInsightItems.map((item) => (
                <div key={item.label} className="youtubeVideoInsightItem youtubeVideoRisingInsightItem">
                  <span className="youtubeVideoInsightLabel">{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          )}

          {visibleTags.length > 0 && (
            <div className="youtubeVideoTags">
              {visibleTags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          )}

          {/* YouTube Button */}
          <a
            href={`https://www.youtube.com/watch?v=${modalVideo.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="youtubeVideoModalButton"
          >
            YouTube에서 보기
          </a>
        </div>
      </div>
    </div>
  );
}
