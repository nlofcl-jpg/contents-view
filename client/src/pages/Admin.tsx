import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useState } from "react";
import { useLocation } from "wouter";
import NaverSearchAdKeyPanel from "@/components/NaverSearchAdKeyPanel";

type AdminTab = "notices" | "users" | "apiKeys" | "collections";

const adminTabs: Array<{ id: AdminTab; label: string }> = [
  { id: "notices", label: "공지" },
  { id: "users", label: "사용자" },
  { id: "apiKeys", label: "API 키" },
  { id: "collections", label: "수집 상태" },
];

export default function Admin() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>("notices");
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
      </div>

      <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-800">
        {adminTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "border-blue-400 text-white"
                : "border-transparent text-slate-400 hover:text-slate-100"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "notices" && <NoticePanel />}
      {activeTab === "users" && <UsersPanel adminEmail={user?.email ?? ""} />}
      {activeTab === "apiKeys" && <ApiKeysPanel />}
      {activeTab === "collections" && <CollectionsPanel />}
    </div>
  );
}

function NoticePanel() {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!supabase || !user) return;
    if (!title.trim() || !body.trim()) {
      setError("제목과 내용을 입력하세요.");
      setMessage(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    const { error: insertError } = await supabase.from("notices").insert({
      title: title.trim(),
      body: body.trim(),
      created_by: user.id,
      is_published: true,
    });

    setIsSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTitle("");
    setBody("");
    setMessage("공지 저장 완료");
  };

  return (
    <section className="rounded-lg border border-blue-500/20 bg-slate-900/60 p-5">
      <h2 className="mb-5 text-xl font-semibold text-white">공지 등록</h2>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">제목</span>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
            placeholder="공지 제목"
            value={title}
            onChange={event => setTitle(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">내용</span>
          <textarea
            className="min-h-40 w-full resize-y rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
            placeholder="공지 내용을 입력"
            value={body}
            onChange={event => setBody(event.target.value)}
          />
        </label>
        {message && <p className="text-sm text-emerald-300">{message}</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="primaryButton" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "저장 중" : "저장"}
            <span>→</span>
          </button>
          <button
            type="button"
            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
          >
            미리보기
          </button>
        </div>
      </div>
    </section>
  );
}

function UsersPanel({ adminEmail }: { adminEmail: string }) {
  return (
    <section className="rounded-lg border border-blue-500/20 bg-slate-900/60 p-5">
      <h2 className="mb-5 text-xl font-semibold text-white">사용자</h2>
      <div className="overflow-hidden rounded-md border border-slate-800">
        <div className="grid grid-cols-[1fr_120px] bg-slate-950/70 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
          <span>계정</span>
          <span>권한</span>
        </div>
        <div className="grid grid-cols-[1fr_120px] px-4 py-3 text-sm text-slate-200">
          <span>{adminEmail}</span>
          <span className="text-emerald-300">admin</span>
        </div>
      </div>
    </section>
  );
}

function ApiKeysPanel() {
  return (
    <section className="space-y-4 rounded-lg border border-blue-500/20 bg-slate-900/60 p-5">
      <h2 className="text-xl font-semibold text-white">API 키</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex min-h-[280px] flex-col rounded-md border border-slate-800 bg-slate-950/50 p-4">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-semibold text-slate-100">네이버 데이터랩</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              검색 트렌드, 쇼핑 클릭량 등 네이버 데이터랩 API 호출에 사용됩니다.
            </p>
          </div>
          <div className="flex flex-1 flex-col justify-between pt-4">
            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-center justify-between rounded-md bg-slate-900/70 px-3 py-2">
                <span>Client ID</span>
                <span className="text-emerald-300">환경변수</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-slate-900/70 px-3 py-2">
                <span>Client Secret</span>
                <span className="text-emerald-300">환경변수</span>
              </div>
            </div>
            <p className="mt-4 text-[11px] leading-5 text-slate-500">
              현재 배포 환경의 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 값으로 관리됩니다.
            </p>
          </div>
        </div>

        <div className="flex min-h-[280px] flex-col rounded-md border border-slate-800 bg-slate-950/50 p-4">
          <div className="border-b border-slate-800 pb-4">
            <h3 className="text-sm font-semibold text-slate-100">네이버 검색광고</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              월간 검색량, PC/모바일 검색량, 연관 키워드 분석에 사용할 관리자 공용 키입니다.
            </p>
          </div>
          <div className="pt-4">
            <NaverSearchAdKeyPanel isActive />
          </div>
        </div>
      </div>
    </section>
  );
}

function CollectionsPanel() {
  return (
    <section className="rounded-lg border border-blue-500/20 bg-slate-900/60 p-5">
      <h2 className="mb-5 text-xl font-semibold text-white">수집 상태</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <StatusCard title="뉴스" value="직접 조회" />
        <StatusCard title="커뮤니티" value="직접 조회" />
      </div>
    </section>
  );
}

function StatusCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-800 bg-slate-950/50 p-4">
      <div className="text-sm font-semibold text-slate-200">{title}</div>
      <div className="mt-2 text-sm text-slate-400">{value}</div>
    </div>
  );
}
