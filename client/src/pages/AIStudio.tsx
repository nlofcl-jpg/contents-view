import { Download, ExternalLink, FolderDown, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";

type StudioTab = "programs" | "upcoming";

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
  const [activeTab, setActiveTab] = useState<StudioTab>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "upcoming"
      ? "upcoming"
      : "programs",
  );

  useEffect(() => {
    setActiveTab(new URLSearchParams(window.location.search).get("tab") === "upcoming" ? "upcoming" : "programs");
  }, [location]);

  const handleTabChange = (tab: StudioTab) => {
    setActiveTab(tab);
    setLocation(tab === "programs" ? "/ai-studio" : "/ai-studio?tab=upcoming");
  };

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
      <section className="aiStudioHero" aria-labelledby="ai-studio-title">
        <div className="aiStudioHeroContent">
          <span className="aiStudioHeroEyebrow">CONTENTS VIEW</span>
          <h1 id="ai-studio-title" className="aiStudioHeroTitle">
            <span className="aiStudioHeroEnglish">AI STUDIO</span>
            {activeTab === "upcoming" ? (
              <span className="aiStudioHeroKorean">아이디어를 콘텐츠로, <strong>더 빠르게</strong></span>
            ) : (
              <span className="aiStudioHeroKorean">반복 작업을 자동화로, <strong>더 간편하게</strong></span>
            )}
          </h1>
        </div>
        <div className="aiStudioHeroMedia" aria-hidden="true">
          {activeTab === "upcoming" && (
            <img src="/ai-studio-video-hero.png" alt="" />
          )}
        </div>
      </section>

      <div className="aiStudioTabs" role="tablist" aria-label="AI 스튜디오 메뉴">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "upcoming"}
          aria-controls="ai-studio-upcoming"
          className={`aiStudioTab ${activeTab === "upcoming" ? "active" : ""}`}
          onClick={() => handleTabChange("upcoming")}
        >
          영상 제작
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "programs"}
          aria-controls="ai-studio-programs"
          className={`aiStudioTab ${activeTab === "programs" ? "active" : ""}`}
          onClick={() => handleTabChange("programs")}
        >
          프로그램
        </button>
      </div>

      {activeTab === "programs" ? (
        <section id="ai-studio-programs" role="tabpanel" className="aiStudioPanel">
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
      ) : (
        <section id="ai-studio-upcoming" role="tabpanel" className="aiStudioEmptyState aiStudioUpcomingState">
          <Sparkles aria-hidden="true" />
          <p>새로운 AI 도구를 준비하고 있습니다.</p>
        </section>
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
