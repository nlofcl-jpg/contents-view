import { TrendingUp } from "lucide-react";
import UnifiedInsights from "./UnifiedInsights";

export default function NaverTrends() {
  return (
    <div className="youtubePageContainer">
      <div className="pageHeader">
        <h1 className="pageTitle">네이버 트렌드</h1>
        <p className="pageDescription">
          검색어 하나로 네이버 검색 수요와 쇼핑 반응을 한 페이지에서 확인하세요.
        </p>
      </div>

      <section className="mt-8">
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-foreground">
              키워드 통합 분석
            </h2>
          </div>
          <p className="pageDescription">
            검색 트렌드와 쇼핑 클릭량을 한 화면에서 비교 분석하세요.
          </p>
        </div>

        <UnifiedInsights />
      </section>
    </div>
  );
}
