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
        <UnifiedInsights />
      </section>
    </div>
  );
}
