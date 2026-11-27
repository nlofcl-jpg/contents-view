import { useLocation } from "wouter";
import LatestNewsInfo from "@/components/LatestNewsInfo";
import { getActiveNewsPath, newsLinks } from "@/lib/newsNavigation";

export default function NewsTrendHeader() {
  const [location] = useLocation();
  const selectedPath = getActiveNewsPath(location.replace(/\/$/, ""));
  const title = newsLinks.find(link => link.href === selectedPath)?.label ?? "뉴스 트렌드";

  return (
    <header className="pageHeader newsTrendHeader">
      {selectedPath === "/news" ? (
        <div className="flex items-center gap-1">
          <h1 className="pageTitle">{title}</h1>
          <LatestNewsInfo />
        </div>
      ) : (
        <h1 className="pageTitle">{title}</h1>
      )}
      <p className="pageDescription">오늘 주목받는 이슈를 빠르게 확인하고 콘텐츠 아이디어로 연결해보세요.</p>
    </header>
  );
}
