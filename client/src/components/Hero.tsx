export default function Hero() {
  return (
    <section className="hero">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="heroCopy flex max-w-[600px] flex-col items-start text-left">
          <p className="heroKicker">TRACK. ANALYZE. DISCOVER.</p>

          <h2>
            다양한 컨텐츠 트렌드를
            <br />
            <span>실시간으로</span> 확인하세요
          </h2>

          <div className="heroActions flex justify-start">
            <button type="button" className="primaryButton">
              트렌드 둘러보기
              <span>→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
