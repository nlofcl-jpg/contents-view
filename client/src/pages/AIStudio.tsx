import { Download, ExternalLink, FolderDown, Sparkles } from "lucide-react";
import { useState } from "react";

type StudioTab = "programs" | "upcoming";

type Program = {
  id: string;
  name: string;
  summary: string;
  category: string;
  downloadUrl?: string;
  sourceUrl?: string;
};

const programs: Program[] = [
  {
    id: "flow-automation",
    name: "Google Flow 오토메이션",
    summary: "Google Flow에서 이미지 작업을 자동화하여 빠르게 작업하세요.",
    category: "Chrome 확장프로그램",
  },
];

export default function AIStudio() {
  const [activeTab, setActiveTab] = useState<StudioTab>("programs");

  return (
    <div className="aiStudioPageContainer">
      <div className="pageHeader">
        <h1 className="pageTitle">AI 스튜디오</h1>
        <p className="pageDescription">콘텐츠 제작에 활용할 프로그램과 도구를 모아봅니다.</p>
      </div>

      <div className="aiStudioTabs" role="tablist" aria-label="AI 스튜디오 메뉴">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "programs"}
          aria-controls="ai-studio-programs"
          className={`aiStudioTab ${activeTab === "programs" ? "active" : ""}`}
          onClick={() => setActiveTab("programs")}
        >
          프로그램
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "upcoming"}
          aria-controls="ai-studio-upcoming"
          className={`aiStudioTab ${activeTab === "upcoming" ? "active" : ""}`}
          onClick={() => setActiveTab("upcoming")}
        >
          준비중
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
                    {program.downloadUrl && (
                      <a className="aiStudioPrimaryAction" href={program.downloadUrl} download>
                        <Download aria-hidden="true" />
                        다운로드
                      </a>
                    )}
                    {!program.downloadUrl && (
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
    </div>
  );
}
