import { X } from "lucide-react";
import { useEffect } from "react";

interface Video {
  id: string;
  title: string;
  channelTitle: string;
  channelThumbnail?: string;
  viewCount: number;
  publishedAt: string;
  duration: string;
}

interface YouTubeVideoDetailModalProps {
  video: Video | null;
  isOpen: boolean;
  onClose: () => void;
}

// Format view count (e.g., 1000000 -> 100만)
function formatViewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}백만`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(0)}천`;
  }
  return count.toString();
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

export function YouTubeVideoDetailModal({
  video,
  isOpen,
  onClose,
}: YouTubeVideoDetailModalProps) {
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
            src={`https://www.youtube.com/embed/${video.id}`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="youtubeVideoModalIframe"
          />
        </div>

        {/* Video Info */}
        <div className="youtubeVideoModalInfo">
          <h2 className="youtubeVideoModalTitle">{video.title}</h2>
          <p className="youtubeVideoModalChannel">{video.channelTitle}</p>

          {/* Meta Info */}
          <div className="youtubeVideoModalMeta">
            <span>{formatViewCount(video.viewCount)} 조회</span>
            <span>{formatDate(video.publishedAt)}</span>
            <span>{formatDuration(video.duration)}</span>
          </div>

          {/* YouTube Button */}
          <a
            href={`https://www.youtube.com/watch?v=${video.id}`}
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
