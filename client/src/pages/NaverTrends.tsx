import UnifiedInsights from "./UnifiedInsights";

export default function NaverTrends() {
  return (
    <div className="youtubePageContainer">
      <div className="pageHeader">
        <h1 className="pageTitle">네이버 트렌드</h1>
        <p className="pageDescription">
          키워드, 블로그, 쇼핑 데이터를 한곳에서 분석하세요.
        </p>
      </div>

      <section className="mt-8">
        <UnifiedInsights />
      </section>
    </div>
  );
}
