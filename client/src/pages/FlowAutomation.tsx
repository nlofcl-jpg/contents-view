import { ArrowLeft, Check, Download, FolderOpen, Settings2 } from "lucide-react";
import { Link } from "wouter";

const downloadUrl = "/downloads/contents-view-flow-automation.zip";

const installSteps = [
  {
    icon: Download,
    title: "압축 파일 다운로드",
    description: "아래 버튼을 눌러 확장프로그램 ZIP 파일을 다운로드합니다.",
  },
  {
    icon: FolderOpen,
    title: "압축 해제",
    description: "다운로드한 ZIP 파일의 압축을 풀고 flow-automation 폴더를 확인합니다.",
  },
  {
    icon: Settings2,
    title: "Chrome에 설치",
    description: "Chrome에서 chrome://extensions를 연 뒤 개발자 모드를 켜고, 압축해제된 확장 프로그램을 로드합니다.",
  },
];

export default function FlowAutomation() {
  return (
    <div className="flowAutomationPage">
      <Link href="/ai-studio" className="flowAutomationBackLink">
        <ArrowLeft aria-hidden="true" />
        AI 스튜디오
      </Link>

      <section className="flowAutomationIntro">
        <div className="flowAutomationIcon" aria-hidden="true">
          <Download />
        </div>
        <span className="flowAutomationCategory">Chrome 확장프로그램</span>
        <h1>Google Flow 오토메이션</h1>
        <p>Google Flow에서 이미지 작업을 자동화하여 빠르게 작업하세요.</p>
        <a className="flowAutomationDownloadButton" href={downloadUrl} download>
          <Download aria-hidden="true" />
          확장프로그램 다운로드
        </a>
      </section>

      <section className="flowAutomationSection" aria-labelledby="flow-automation-about">
        <h2 id="flow-automation-about">프로그램 소개</h2>
        <p className="flowAutomationSectionDescription">
          반복하는 이미지 작업을 줄이고 Google Flow 작업 흐름을 더 빠르게 이어갈 수 있도록 돕는 확장프로그램입니다.
        </p>
      </section>

      <section className="flowAutomationSection" aria-labelledby="flow-automation-install">
        <h2 id="flow-automation-install">설치 방법</h2>
        <ol className="flowAutomationSteps">
          {installSteps.map(({ icon: Icon, title, description }, index) => (
            <li key={title}>
              <span className="flowAutomationStepNumber">{index + 1}</span>
              <Icon aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="flowAutomationNote">
          <Check aria-hidden="true" />
          <p>Chrome 확장프로그램 관리 화면에서 폴더를 선택하면 설치가 완료됩니다.</p>
        </div>
      </section>
    </div>
  );
}
