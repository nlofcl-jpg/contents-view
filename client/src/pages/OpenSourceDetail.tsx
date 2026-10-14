import { useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Link, useParams } from "wouter";
import NotFound from "@/pages/NotFound";
import { loadKakaoSdk, shareOpenSourceOnKakao } from "@/lib/kakaoShare";

const projects = {
  hop: {
    category: "오픈소스 문서 앱",
    name: "HOP (Open HWP)",
    summary: "한글 문서를 열고 편집하는 데스크톱 앱",
    description: "HWP와 HWPX 형식의 문서를 확인하고 편집할 수 있습니다. 운영체제에 맞는 설치 파일은 공식 사이트에서 받을 수 있습니다.",
    features: ["HWP/HWPX 문서 보기", "문서 편집", "macOS, Windows, Linux 지원"],
    environment: "macOS · Windows · Linux",
    note: "운영체제별 설치 방식과 최신 버전은 공식 사이트에서 확인하세요.",
    url: "https://golbin.github.io/hop/",
  },
  "ace-step-studio": {
    category: "오픈소스 AI 음악 제작",
    name: "ACE-Step Studio",
    summary: "내 컴퓨터에서 음악과 보컬을 생성하는 AI 스튜디오",
    description: "아이디어나 가사를 입력해 음악을 만들고, 커버와 리믹스, 스템 분리, 뮤직비디오 제작 등을 한 앱에서 진행할 수 있습니다.",
    features: ["가사와 설명으로 보컬 음악 생성", "커버·리믹스 및 스템 작업", "뮤직비디오 제작"],
    environment: "Windows · NVIDIA GPU (VRAM 4GB 이상)",
    note: "현재 2.0 배포판은 Windows용입니다. 사용하는 모델과 부가 기능의 라이선스는 프로젝트에서 각각 확인하세요.",
    url: "https://github.com/timoncool/ACE-Step-Studio",
  },
} as const;

export default function OpenSourceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const project = projects[slug as keyof typeof projects];
  const [kakaoSdkStatus, setKakaoSdkStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!project || !import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY) return;
    let cancelled = false;
    setKakaoSdkStatus("loading");
    loadKakaoSdk()
      .then(() => { if (!cancelled) setKakaoSdkStatus("ready"); })
      .catch(() => { if (!cancelled) setKakaoSdkStatus("error"); });
    return () => { cancelled = true; };
  }, [project]);

  if (!project) return <NotFound />;

  const handleKakaoShare = () => {
    if (kakaoSdkStatus === "error") {
      toast.error("카카오톡 공유를 불러오지 못했습니다. 페이지를 새로고침해 주세요.");
      return;
    }
    try {
      shareOpenSourceOnKakao({ slug, title: project.name, description: project.summary });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "카카오톡 공유를 시작하지 못했습니다.");
    }
  };

  return (
    <main className="openSourceDetailPage">
      <Link href="/ai-studio/open-source" className="openSourceDetailBack">
        <ArrowLeft aria-hidden="true" />
        오픈소스
      </Link>

      <header className="openSourceDetailHeader">
        <div>
          <span className="openSourceDetailCategory">{project.category}</span>
          <h1>{project.name}</h1>
          <div className="openSourceDetailSummaryRow">
            <p className="openSourceDetailSummary">{project.summary}</p>
            <button
              type="button"
              className="openSourceKakaoShareButton"
              onClick={handleKakaoShare}
              disabled={kakaoSdkStatus === "loading"}
              title="카카오톡으로 공유"
              aria-label={`${project.name} 카카오톡으로 공유`}
            >
              {kakaoSdkStatus === "loading" ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="currentColor" d="M12 3.5c-5.1 0-9.2 3.18-9.2 7.1 0 2.5 1.67 4.7 4.19 5.96l-.7 2.78c-.06.23.2.42.39.28l3.32-2.22c.65.1 1.32.15 2 .15 5.1 0 9.2-3.18 9.2-7.1s-4.1-6.95-9.2-6.95Z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="openSourceDetailContent">
        <section aria-labelledby="open-source-about">
          <h2 id="open-source-about">소개</h2>
          <p>{project.description}</p>
        </section>
        <section aria-labelledby="open-source-features">
          <h2 id="open-source-features">주요 기능</h2>
          <ul>
            {project.features.map(feature => <li key={feature}>{feature}</li>)}
          </ul>
        </section>
        <section aria-labelledby="open-source-environment">
          <h2 id="open-source-environment">이용 환경</h2>
          <p>{project.environment}</p>
          <p className="openSourceDetailNote">{project.note}</p>
        </section>
        <a className="openSourceDetailAction" href={project.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden="true" />
          바로가기
        </a>
      </div>
    </main>
  );
}
