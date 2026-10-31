import { ArrowUpRight, Download, ExternalLink, FolderDown, Images, Video } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import StudioSubnav from "@/components/StudioSubnav";

type StudioTab = "programs" | "upcoming" | "openSource";
type ProductionFormat = "video" | "cardNews" | "motionGraphic";

const productionFormats: { id: ProductionFormat; label: string; emptyMessage: string }[] = [
  { id: "video", label: "쇼츠 제작", emptyMessage: "영상제작 콘텐츠를 준비하고 있습니다." },
  { id: "cardNews", label: "카드뉴스", emptyMessage: "카드뉴스 콘텐츠를 준비하고 있습니다." },
  { id: "motionGraphic", label: "모션그래픽", emptyMessage: "모션그래픽 콘텐츠를 준비하고 있습니다." },
];

const videoStyleGroups = [
  {
    title: "쇼츠 영상",
    tone: 0,
    styles: [
      { name: "과학썰st", description: "흥미로운 과학 이야기를 풀어내는 스타일" },
      { name: "더다큐롱폼st", description: "하나의 주제를 깊이 있게 따라가는 스타일" },
      { name: "동물더쿠st", description: "동물의 매력과 일상을 담는 스타일" },
      { name: "랭킹st", description: "흥미로운 주제를 순위로 정리하는 스타일" },
      { name: "비하인드스토리st", description: "알려지지 않은 뒷이야기를 들려주는 스타일" },
      { name: "썰쇼핑st", description: "이야기와 함께 상품을 소개하는 스타일" },
      { name: "요즘PDst", description: "요즘 관심사를 가볍게 짚어보는 스타일" },
    ],
  },
  {
    title: "릴스 · 이슈",
    tone: 3,
    styles: [
      { name: "이라스토야st", description: "그림과 이야기로 장면을 전하는 스타일" },
      { name: "인스타릴스st", description: "짧고 빠르게 시선을 끄는 스타일" },
      { name: "잘난지st", description: "인물과 주제를 감각적으로 소개하는 스타일" },
      { name: "커뮤니티형st", description: "온라인 반응을 묶어 전달하는 스타일" },
    ],
  },
] as const;

type Program = {
  id: string;
  name: string;
  summary: string;
  category: string;
  detailPath?: string;
  sourceUrl?: string;
};

const programs: Program[] = [
  {
    id: "flow-automation",
    name: "Google Flow 오토메이션",
    summary: "Google Flow에서 이미지 작업을 자동화하여 빠르게 작업하세요.",
    category: "Chrome 확장프로그램",
    detailPath: "/ai-studio/flow-automation",
  },
];

export default function AIStudio() {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [guestProgramPath, setGuestProgramPath] = useState<string | null>(null);
  const [productionFormat, setProductionFormat] = useState<ProductionFormat>("video");
  const activeTab: StudioTab = location === "/ai-studio/open-source"
    ? "openSource"
    : location === "/ai-studio/video" ||
      (location === "/ai-studio" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "upcoming")
        ? "upcoming"
        : "programs";

  const handleProgramDownload = (program: Program) => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setGuestProgramPath(program.detailPath || "/ai-studio");
      return;
    }

    if (program.detailPath) {
      setLocation(program.detailPath);
    }
  };

  const handleGuestAuth = (mode: "login" | "signup") => {
    const params = new URLSearchParams();
    if (mode === "signup") params.set("mode", "signup");
    params.set("redirect", guestProgramPath || "/ai-studio");
    setGuestProgramPath(null);
    setLocation(`/login?${params.toString()}`);
  };

  return (
    <div className="aiStudioPageContainer">
      <StudioSubnav active={activeTab === "upcoming" ? "production" : activeTab} />
      <section className={`aiStudioHero ${activeTab === "upcoming" ? "aiStudioHeroVideo" : ""}`} aria-labelledby="ai-studio-title">
        <div className="aiStudioHeroContent">
          <span className="aiStudioHeroEyebrow">CONTENTS VIEW</span>
          <h1 id="ai-studio-title" className="aiStudioHeroTitle">
            <span className="aiStudioHeroEnglish">STUDIO</span>
            {activeTab === "upcoming" ? (
              <span className="aiStudioHeroKorean">아이디어를 콘텐츠로, <strong>더 빠르게</strong></span>
            ) : activeTab === "openSource" ? (
              <span className="aiStudioHeroKorean">열린 도구로, <strong>더 자유롭게</strong></span>
            ) : (
              <span className="aiStudioHeroKorean">다양한 도구로, <strong>제작을 더 효율적으로</strong></span>
            )}
          </h1>
        </div>
        <div className="aiStudioHeroMedia" aria-hidden="true">
          {activeTab === "upcoming" && (
            <img src="/ai-studio-video-hero.png" alt="" />
          )}
        </div>
      </section>

      {activeTab === "programs" ? (
        <section className="aiStudioPanel">
          {programs.length > 0 ? (
            <div className="aiStudioProgramGrid">
              {programs.map(program => (
                <article className="aiStudioProgramCard" key={program.id}>
                  <span className="aiStudioProgramCategory">{program.category}</span>
                  <h2>{program.name}</h2>
                  <p>{program.summary}</p>
                  <div className="aiStudioProgramActions">
                    {program.detailPath ? (
                      <button
                        type="button"
                        className="aiStudioPrimaryAction"
                        onClick={() => handleProgramDownload(program)}
                        disabled={authLoading}
                      >
                        <Download aria-hidden="true" />
                        다운로드
                      </button>
                    ) : (
                      <button type="button" className="aiStudioPrimaryAction" disabled>
                        <Download aria-hidden="true" />
                        다운로드
                      </button>
                    )}
                    {program.sourceUrl && (
                      <a href={program.sourceUrl} target="_blank" rel="noreferrer">
                        <ExternalLink aria-hidden="true" />
                        원문 보기
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="aiStudioEmptyState">
              <FolderDown aria-hidden="true" />
              <p>등록된 프로그램이 없습니다.</p>
            </div>
          )}
        </section>
      ) : activeTab === "openSource" ? (
        <section className="aiStudioPanel" aria-label="오픈소스 도구">
          <div className="aiStudioProgramGrid">
            <Link href="/ai-studio/open-source/hop" className="aiStudioProgramCard aiStudioOpenSourceCard">
              <span className="aiStudioProgramCategory">오픈소스 문서 앱</span>
              <h2>HOP (Open HWP)</h2>
              <p>HWP/HWPX 문서를 보고 편집할 수 있는 데스크톱 앱입니다.</p>
              <span className="aiStudioOpenSourceAction">자세히 보기 <ArrowUpRight aria-hidden="true" /></span>
            </Link>
            <Link href="/ai-studio/open-source/ace-step-studio" className="aiStudioProgramCard aiStudioOpenSourceCard">
              <span className="aiStudioProgramCategory">오픈소스 AI 음악 제작</span>
              <h2>ACE-Step Studio</h2>
              <p>Windows에서 NVIDIA GPU로 보컬 음악을 로컬 생성하는 데스크톱 앱입니다.</p>
              <span className="aiStudioOpenSourceAction">자세히 보기 <ArrowUpRight aria-hidden="true" /></span>
            </Link>
          </div>
        </section>
      ) : (
        <>
          <div className="aiStudioFormatFilters" role="group" aria-label="제작 유형 필터">
            {productionFormats.map(format => (
              <button
                key={format.id}
                type="button"
                className={`aiStudioFormatFilter ${productionFormat === format.id ? "active" : ""}`}
                aria-pressed={productionFormat === format.id}
                onClick={() => setProductionFormat(format.id)}
              >
                <span>{format.label}</span>
              </button>
            ))}
          </div>
          {productionFormat === "video" ? (
            <div className="aiStudioVideoCatalog">
              {videoStyleGroups.map((group, groupIndex) => (
                <section className="aiStudioVideoGroup" key={group.title} aria-labelledby={`video-style-group-${groupIndex}`}>
                  <h2 id={`video-style-group-${groupIndex}`}>{group.title}</h2>
                  <div className="aiStudioVideoGrid">
                    {group.styles.map(style => (
                      <article className={`aiStudioVideoStyle aiStudioVideoStyleTone${group.tone}`} key={style.name}>
                        <div className="aiStudioVideoStyleThumbnail" aria-hidden="true">
                          <Video />
                        </div>
                        <div className="aiStudioVideoStyleText">
                          <h3>{style.name}</h3>
                          <p>{style.description}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : productionFormat === "cardNews" ? (
            <section className="aiStudioCardNewsCatalog" aria-label="카드뉴스 썸네일 목록">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="aiStudioCardNewsThumbnail" role="img" aria-label={`카드뉴스 썸네일 목업 ${index + 1}`} key={index}>
                  <Images aria-hidden="true" />
                </div>
              ))}
            </section>
          ) : (
            <section className="aiStudioEmptyState aiStudioUpcomingState" aria-live="polite">
              <p>{productionFormats.find(format => format.id === productionFormat)?.emptyMessage}</p>
            </section>
          )}
        </>
      )}
      <GuestAccessPrompt
        open={guestProgramPath !== null}
        onBrowse={() => setGuestProgramPath(null)}
        onLogin={() => handleGuestAuth("login")}
        onSignup={() => handleGuestAuth("signup")}
      />
    </div>
  );
}
