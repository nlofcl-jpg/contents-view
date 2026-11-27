import { ArrowRight, ArrowUpRight, ChevronLeft, Clapperboard, Download, ExternalLink, FolderDown, Images, Video } from "lucide-react";
import { useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import StudioSubnav from "@/components/StudioSubnav";
import StudioSectionHeader from "@/components/StudioSectionHeader";
import "./studioProductionBanners.css";

type StudioTab = "programs" | "upcoming" | "openSource";
const productionFormats = [
  { id: "video", label: "영상", icon: Video, href: "/ai-studio/video/styles" },
  { id: "cardNews", label: "카드 뉴스", icon: Images, href: "/ai-studio/video/card-news" },
  { id: "motionGraphic", label: "모션그래픽", icon: Clapperboard, href: "/ai-studio/video/motion-graphics" },
] as const;

const videoStyleGroups = [
  {
    id: "shorts",
    title: "쇼츠 영상",
    tone: 0,
    sections: [
      {
        id: "knowledge",
        title: "지식·다큐",
        styles: [
          { name: "과학 이야기", description: "흥미로운 과학 이야기를 풀어내는 스타일" },
          { name: "심층 다큐", description: "하나의 주제를 깊이 있게 따라가는 스타일" },
          { name: "동물 관찰", description: "동물의 매력과 일상을 담는 스타일" },
        ],
      },
      {
        id: "stories",
        title: "스토리·트렌드",
        styles: [
          { name: "비하인드 스토리", description: "알려지지 않은 뒷이야기를 들려주는 스타일" },
          { name: "트렌드 브리핑", description: "요즘 관심사를 가볍게 짚어보는 스타일" },
        ],
      },
      {
        id: "ranking-shopping",
        title: "랭킹·쇼핑",
        styles: [
          { name: "순위로 보는 이야기", description: "흥미로운 주제를 순위로 정리하는 스타일" },
          { name: "스토리형 쇼핑", description: "이야기와 함께 상품을 소개하는 스타일" },
        ],
      },
    ],
  },
  {
    id: "reels",
    title: "릴스 · 이슈",
    tone: 3,
    sections: [{
      id: "reels",
      title: null,
      styles: [
        { name: "이라스토야st", description: "그림과 이야기로 장면을 전하는 스타일" },
        { name: "인스타릴스st", description: "짧고 빠르게 시선을 끄는 스타일" },
        { name: "잘난지st", description: "인물과 주제를 감각적으로 소개하는 스타일" },
        { name: "커뮤니티형st", description: "온라인 반응을 묶어 전달하는 스타일" },
      ],
    }],
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
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [guestProgramPath, setGuestProgramPath] = useState<string | null>(null);
  const path = location.replace(/\/$/, "");
  const productionFormat = productionFormats.find(format => format.href === path);
  const styleGroup = videoStyleGroups.find(group => path === `/ai-studio/video/${group.id}`);
  const canOpenStylePages = !authLoading && isAuthenticated && user?.role === "admin";
  const activeTab: StudioTab = location === "/ai-studio/open-source"
    ? "openSource"
    : styleGroup || productionFormat || path === "/ai-studio/video" ||
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

  const handleGuestAuth = () => {
    const params = new URLSearchParams();
    params.set("redirect", guestProgramPath || "/ai-studio");
    setGuestProgramPath(null);
    setLocation(`/login?${params.toString()}`);
  };

  if (styleGroup && !canOpenStylePages) {
    return authLoading ? null : <Redirect to="/ai-studio/video" replace />;
  }

  return (
    <div className="aiStudioPageContainer">
      {!styleGroup && !productionFormat && (
        <StudioSectionHeader image={activeTab === "upcoming" ? "/ai-studio-video-hero.png" : undefined}>
          {activeTab === "upcoming" ? (
            <>아이디어를 콘텐츠로, <strong>더 빠르게</strong></>
          ) : activeTab === "openSource" ? (
            <>열린 도구로, <strong>더 자유롭게</strong></>
          ) : (
            <>다양한 도구로, <strong>제작을 더 효율적으로</strong></>
          )}
        </StudioSectionHeader>
      )}

      {styleGroup ? (
        <section className="aiStudioVideoCatalog" aria-labelledby="studio-style-title">
          <header className="aiStudioVideoDetailHeader">
            <Link href="/ai-studio/video/styles" className="issueBackButton"><ChevronLeft size={15} aria-hidden="true" />영상</Link>
            <h1 id="studio-style-title" className="pageTitle">{styleGroup.title}</h1>
          </header>
          <StudioSubnav />
          {styleGroup.sections.map(({ id, title, styles }) => {
            const CardTitle = title ? "h3" : "h2";
            return (
              <section key={id} aria-labelledby={title ? `studio-group-${id}` : undefined}>
                {title && <h2 id={`studio-group-${id}`} className="aiStudioVideoGroupTitle">{title}</h2>}
                <div className="aiStudioVideoGrid">
                  {styles.map(style => (
                    <article className={`aiStudioVideoStyle aiStudioVideoStyleTone${styleGroup.tone}`} key={style.name}>
                      <div className="aiStudioVideoStyleThumbnail" aria-hidden="true"><Video /></div>
                      <div className="aiStudioVideoStyleText">
                        <CardTitle>{style.name}</CardTitle>
                        <p>{style.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </section>
      ) : activeTab === "programs" ? (
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
      ) : productionFormat ? (
        <section className="aiStudioVideoCatalog" aria-labelledby="studio-format-title">
          <header className="aiStudioVideoDetailHeader">
            <Link href="/ai-studio/video" className="issueBackButton"><ChevronLeft size={15} aria-hidden="true" />콘텐츠 제작</Link>
            <h1 id="studio-format-title" className="pageTitle">{productionFormat.label}</h1>
          </header>
          <StudioSubnav />
        </section>
      ) : (
        <nav className="studioProductionBanners studioProductionThumbnails" aria-label="콘텐츠 제작 유형">
          {productionFormats.map(({ id, href, label, icon: Icon }) => (
            <Link key={id} href={href} className="studioProductionBanner">
              <Icon className="studioProductionBannerIcon" aria-hidden="true" />
              <span>{label}</span>
              <ArrowRight className="studioProductionBannerArrow" aria-hidden="true" />
            </Link>
          ))}
        </nav>
      )}
      <GuestAccessPrompt
        open={guestProgramPath !== null}
        onBrowse={() => setGuestProgramPath(null)}
        onLogin={handleGuestAuth}
      />
    </div>
  );
}
