import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";

export default function Admin() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const isAdmin = isAuthenticated && user?.role === "admin";

  if (loading) {
    return (
      <div className="pageContainer">
        <div className="max-w-md rounded-lg border border-blue-500/20 bg-slate-900/60 p-6 text-sm text-slate-300">
          관리자 권한을 확인하는 중입니다.
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="pageContainer">
        <div className="pageHeader">
          <h1 className="pageTitle">관리자 센터</h1>
          <p className="pageDescription">관리자 계정으로 로그인해야 접근할 수 있습니다.</p>
        </div>
        <button type="button" className="primaryButton" onClick={() => setLocation("/")}>
          홈으로 이동
          <span>→</span>
        </button>
      </div>
    );
  }

  return (
    <div className="pageContainer">
      <div className="pageHeader">
        <h1 className="pageTitle">관리자 센터</h1>
        <p className="pageDescription">공지, 사용자, API 키, 수집 데이터를 관리합니다.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-blue-500/20 bg-slate-900/60 p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">공지 등록</h2>
              <p className="mt-1 text-sm text-slate-400">서비스 공지와 업데이트 안내를 준비합니다.</p>
            </div>
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
              준비 중
            </span>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">제목</span>
              <input
                className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
                placeholder="공지 제목"
                disabled
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-300">내용</span>
              <textarea
                className="min-h-40 w-full resize-y rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
                placeholder="공지 내용을 입력"
                disabled
              />
            </label>
            <button type="button" className="primaryButton opacity-60" disabled>
              공지 저장
              <span>→</span>
            </button>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-blue-500/20 bg-slate-900/60 p-5">
            <h2 className="text-lg font-semibold text-white">관리자 계정</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <p>{user?.email}</p>
              <p className="text-emerald-300">role: admin</p>
            </div>
          </section>

          <section className="rounded-lg border border-blue-500/20 bg-slate-900/60 p-5">
            <h2 className="text-lg font-semibold text-white">다음 연결</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-md border border-slate-700/80 bg-slate-950/40 p-3">공지 저장 DB</div>
              <div className="rounded-md border border-slate-700/80 bg-slate-950/40 p-3">사용자 목록</div>
              <div className="rounded-md border border-slate-700/80 bg-slate-950/40 p-3">YouTube API 키 상태</div>
              <div className="rounded-md border border-slate-700/80 bg-slate-950/40 p-3">뉴스/커뮤니티 수집 상태</div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
