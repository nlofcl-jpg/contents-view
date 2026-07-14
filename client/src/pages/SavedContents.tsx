import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBookmark } from "@/contexts/BookmarkContext";
import { YouTubeVideoDetailModal } from "@/components/YouTubeVideoDetailModal";
import { Trash2, ExternalLink } from "lucide-react";

// Format view count (e.g., 74540 → 7.4만)
const formatViewCount = (count: string): string => {
  const num = parseInt(count, 10);
  if (isNaN(num)) return count;
  
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}백만`;
  } else if (num >= 10000) {
    return `${(num / 10000).toFixed(1)}만`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}천`;
  }
  return num.toString();
};

// Format saved date (today → "오늘", yesterday → "어제", else → "M월 D일")
const formatSavedDate = (): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const now = new Date();
  const currentDate = new Date(now);
  currentDate.setHours(0, 0, 0, 0);
  
  if (currentDate.getTime() === today.getTime()) {
    return "오늘";
  } else if (currentDate.getTime() === yesterday.getTime()) {
    return "어제";
  } else {
    const month = currentDate.getMonth() + 1;
    const date = currentDate.getDate();
    return `${month}월 ${date}일`;
  }
};

const SECTIONS = [
  { id: "youtube", label: "YouTube", icon: "▶" },
  { id: "naver", label: "네이버", icon: "N" },
  { id: "google-trends", label: "Google Trends", icon: "G" },
  { id: "news-issues", label: "뉴스 & 이슈", icon: "▤" },
  { id: "community", label: "커미니티 반응", icon: "∷" },
];

export default function SavedContents() {
  const { isAuthenticated } = useAuth();
  const { bookmarkedYouTubeVideos, removeYouTubeBookmark } = useBookmark();
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="savedContentsPageContainer">
      {/* Page Header */}
      <div className="pageHeader">
        <h1 className="pageTitle">내 보관함</h1>
        <p className="pageDescription">저장한 콘텐츠를 플랫폼별로 확인하고 관리하세요.</p>
      </div>

      {/* Vertical Sections */}
      <div className="savedContentsSections">
        {SECTIONS.map((section) => {
          return (
            <section key={section.id} className="savedContentsSection">
              {/* Section Header */}
              <div className="sectionHeader">
                <span className="sectionIcon">{section.icon}</span>
                <h2 className="sectionTitle">{section.label}</h2>
              </div>

              {/* Content List Area */}
              <div className="contentListArea">
                {section.id === "youtube" && bookmarkedYouTubeVideos.length > 0 ? (
                  <div className="youtubeCardsGrid">
                    {bookmarkedYouTubeVideos.map((video) => (
                      <div
                        key={video.id}
                        className="youtubeContentCard"
                        onClick={() => {
                          setSelectedVideo(video);
                          setIsModalOpen(true);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="cardThumbnail">
                          <img src={video.thumbnail} alt={video.title} />
                        </div>
                        <div className="cardContent">
                          <h3 className="cardTitle">{video.title}</h3>
                          <p className="cardChannel">{video.channelTitle}</p>
                          <div className="cardMeta">
                            <span>{formatViewCount(video.viewCount)} 조회</span>
                            <span className="cardSavedDate">저장일: {formatSavedDate()}</span>
                          </div>
                          <div className="cardActions">
                            <a
                              href={`https://www.youtube.com/watch?v=${video.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="viewButton"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={16} />
                              원본 보기
                            </a>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeYouTubeBookmark(video.id);
                              }}
                              className="removeButtonOutline"
                              title="보관 해제"
                            >
                              <Trash2 size={16} />
                              보관 해제
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="emptyStateContainer">
                    <p className="emptyStateText">아직 저장된 콘텐츠가 없습니다.</p>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* YouTube Video Detail Modal */}
      {selectedVideo && (
        <YouTubeVideoDetailModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedVideo(null);
          }}
          video={selectedVideo}
        />
      )}
    </div>
  );
}
