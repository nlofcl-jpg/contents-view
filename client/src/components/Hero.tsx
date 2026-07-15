import { ChevronDown, Search } from "lucide-react";

export default function Hero() {
  return (
    <section className="hero">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="heroCopy">
          <p className="heroKicker">TRACK. ANALYZE. DISCOVER.</p>

          <h2>
            다양한 컨텐츠 트렌드를
            <br />
            <span>실시간으로</span> 확인하세요
          </h2>

          <div className="heroSearch" role="search" aria-label="트렌드 키워드 검색">
            <label className="heroSearchFilter" aria-label="검색 플랫폼 선택">
              <select className="heroSearchSelect" defaultValue="naver">
                <option value="naver">NAVER</option>
                <option value="youtube">YOUTUBE</option>
              </select>
              <ChevronDown className="heroSearchFilterIcon" aria-hidden="true" />
            </label>
            <div className="heroSearchDivider" aria-hidden="true" />
            <input
              type="text"
              className="heroSearchInput"
              placeholder="분석할 키워드를 입력하세요"
              aria-label="분석할 키워드"
            />
            <button type="button" className="heroSearchButton" aria-label="검색">
              <Search className="heroSearchIcon" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
