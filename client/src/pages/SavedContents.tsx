import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBookmark } from "@/contexts/BookmarkContext";
import { YouTubeVideoDetailModal } from "@/components/YouTubeVideoDetailModal";
import { ChevronDown, Trash2, ExternalLink } from "lucide-react";

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

const VIDEO_PLATFORMS = [
  { id: "youtube", label: "YouTube", icon: "▶" },
  { id: "tiktok", label: "TikTok", icon: "♪" },
  { id: "instagram", label: "Instagram", icon: "◎" },
];

export default function SavedContents() {
  const { isAuthenticated } = useAuth();
  const { bookmarkedYouTubeVideos, removeYouTubeBookmark } = useBookmark();
  const [activeSectionId, setActiveSectionId] = useState(SECTIONS[0].id);
  const [selectedVideoPlatformId, setSelectedVideoPlatformId] = useState(VIDEO_PLATFORMS[0].id);
  const [isVideoPlatformMenuOpen, setIsVideoPlatformMenuOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const activeSection = SECTIONS.find((section) => section.id === activeSectionId) || SECTIONS[0];
  const selectedVideoPlatform =
    VIDEO_PLATFORMS.find((platform) => platform.id === selectedVideoPlatformId) || VIDEO_PLATFORMS[0];

  const renderSectionContent = () => {
    if (
      activeSection.id === "youtube" &&
      selectedVideoPlatform.id === "youtube" &&
      bookmarkedYouTubeVideos.length > 0
    ) {
      return (
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
      );
    }

    return (
      <div className="emptyStateContainer">
        <p className="emptyStateText">아직 저장된 콘텐츠가 없습니다.</p>
      </div>
    );
  };

  const handleSectionChange = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setIsVideoPlatformMenuOpen(false);
  };

  return (
    <div className="savedContentsPageContainer">
      {/* Page Header */}
      <div className="pageHeader">
        <h1 className="pageTitle">내 보관함</h1>
        <p className="pageDescription">저장한 콘텐츠를 플랫폼별로 확인하고 관리하세요.</p>
      </div>

      <div className="savedContentsTabs" role="tablist" aria-label="보관함 콘텐츠 분류">
        {SECTIONS.map((section) => {
          if (section.id === "youtube") {
            return (
              <div
                key={section.id}
                className="savedContentsTabDropdown"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsVideoPlatformMenuOpen(false);
                  }
                }}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeSection.id === section.id}
                  aria-haspopup="listbox"
                  aria-expanded={isVideoPlatformMenuOpen}
                  className={`savedContentsTab savedContentsTabWithChevron ${activeSection.id === section.id ? "active" : ""}`}
                  onClick={() => {
                    setActiveSectionId(section.id);
                    setIsVideoPlatformMenuOpen((isOpen) => !isOpen);
                  }}
                >
                  <span className="savedContentsTabIcon">{section.icon}</span>
                  <span>{section.label}</span>
                  <ChevronDown
                    className={`savedContentsTabChevron ${isVideoPlatformMenuOpen ? "open" : ""}`}
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </button>
                {isVideoPlatformMenuOpen && (
                  <div className="savedContentsTabMenu" role="listbox" aria-label="영상 플랫폼 선택">
                    {VIDEO_PLATFORMS.map((platform) => (
                      <button
                        key={platform.id}
                        type="button"
                        role="option"
                        aria-selected={selectedVideoPlatform.id === platform.id}
                        className={`savedContentsTabMenuItem ${selectedVideoPlatform.id === platform.id ? "active" : ""}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setSelectedVideoPlatformId(platform.id);
                          setActiveSectionId("youtube");
                          setIsVideoPlatformMenuOpen(false);
                        }}
                      >
                        <span>{platform.icon}</span>
                        <span>{platform.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={activeSection.id === section.id}
              className={`savedContentsTab ${activeSection.id === section.id ? "active" : ""}`}
              onClick={() => handleSectionChange(section.id)}
            >
              <span className="savedContentsTabIcon">{section.icon}</span>
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>

      <section className="savedContentsSection" aria-labelledby="saved-contents-section-title">
        <div className="sectionHeader">
          <span className="sectionIcon">
            {activeSection.id === "youtube" ? selectedVideoPlatform.icon : activeSection.icon}
          </span>
          <h2 id="saved-contents-section-title" className="sectionTitle">
            {activeSection.id === "youtube" ? selectedVideoPlatform.label : activeSection.label}
          </h2>
        </div>

        <div className="contentListArea">
          {renderSectionContent()}
        </div>
      </section>

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
