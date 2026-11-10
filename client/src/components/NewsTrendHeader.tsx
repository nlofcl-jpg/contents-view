import SectionSubnav from "@/components/SectionSubnav";

export default function NewsTrendHeader() {
  return (
    <header className="pageHeader newsTrendHeader">
      <h1 className="pageTitle">뉴스 트렌드</h1>
      <p className="pageDescription">오늘 주목받는 이슈를 빠르게 확인하고 콘텐츠 아이디어로 연결해보세요.</p>
      <SectionSubnav placement="pageHeader" />
    </header>
  );
}
