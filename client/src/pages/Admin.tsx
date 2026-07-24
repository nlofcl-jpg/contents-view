import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import NaverSearchAdKeyPanel from "@/components/NaverSearchAdKeyPanel";

type AdminTab = "notices" | "issues" | "users" | "apiKeys";

const adminTabs: Array<{ id: AdminTab; label: string }> = [
  { id: "notices", label: "공지" },
  { id: "users", label: "사용자" },
  { id: "apiKeys", label: "API 키" },
  { id: "issues", label: "이슈" },
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
      {activeTab === "issues" && <IssuesPanel />}
      {activeTab === "users" && <UsersPanel adminEmail={user?.email ?? ""} />}
      {activeTab === "apiKeys" && <ApiKeysPanel />}
    </div>
  );
}

type IssueRecord = {
  id: string;
  title: string;
  summary: string;
  article_url: string | null;
  thumbnail_url: string | null;
  source_name: string | null;
  is_published: boolean;
  created_at: string;
};

function IssuesPanel() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadIssues = async () => {
    if (!supabase) return;

    const { data, error: loadError } = await supabase
      .from("issues")
      .select("id,title,summary,article_url,thumbnail_url,source_name,is_published,created_at")
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setIssues((data ?? []) as IssueRecord[]);
  };

  useEffect(() => {
    loadIssues();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setSummary("");
    setArticleUrl("");
    setThumbnailUrl("");
    setSourceName("");
    setIsPublished(false);
    setIsFormOpen(false);
  };

  const handleEdit = (issue: IssueRecord) => {
    setEditingId(issue.id);
    setTitle(issue.title);
    setSummary(issue.summary);
    setArticleUrl(issue.article_url ?? "");
    setThumbnailUrl(issue.thumbnail_url ?? "");
    setSourceName(issue.source_name ?? "");
    setIsPublished(issue.is_published);
    setIsFormOpen(true);
    setError(null);
    setMessage(null);
  };

  const handleCreate = () => {
    resetForm();
    setMessage(null);
    setError(null);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!supabase || !user) return;
    if (!title.trim() || !summary.trim()) {
      setError("제목과 핵심 요약을 입력하세요.");
      setMessage(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);

    const values = {
      title: title.trim(),
      summary: summary.trim(),
      article_url: articleUrl.trim() || null,
      thumbnail_url: thumbnailUrl.trim() || null,
      source_name: sourceName.trim() || null,
      is_published: isPublished,
    };

    const { error: saveError } = editingId
      ? await supabase.from("issues").update(values).eq("id", editingId)
      : await supabase.from("issues").insert({ ...values, created_by: user.id });

    setIsSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    resetForm();
    setMessage(editingId ? "이슈 수정 완료" : "이슈 등록 완료");
    await loadIssues();
  };

  const handleDelete = async (issue: IssueRecord) => {
    if (!supabase || !window.confirm(`'${issue.title}' 이슈를 삭제할까요?`)) return;

    setError(null);
    setMessage(null);
    const { error: deleteError } = await supabase.from("issues").delete().eq("id", issue.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingId === issue.id) resetForm();
    setMessage("이슈 삭제 완료");
    await loadIssues();
  };

  const formatCreatedAt = (value: string) => {
    try {
      return new Date(value).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  return (
    <section className="space-y-6 rounded-lg border border-blue-500/20 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-white">이슈 관리</h2>
        <button type="button" className="primaryButton" onClick={handleCreate}>
          새 이슈 등록
          <span>→</span>
        </button>
      </div>

      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {isFormOpen && (
      <div className="space-y-4 border-y border-slate-800 py-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-base font-medium text-slate-100">{editingId ? "이슈 수정" : "새 이슈 등록"}</h3>
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-100"
            onClick={resetForm}
          >
            닫기
          </button>
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">제목</span>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
            placeholder="이슈 제목"
            value={title}
            onChange={event => setTitle(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">핵심 요약</span>
          <textarea
            className="min-h-32 w-full resize-y rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
            placeholder="이슈 상세 페이지에 표시할 핵심 내용을 입력"
            value={summary}
            onChange={event => setSummary(event.target.value)}
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">기사 원문 링크</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
              placeholder="https://"
              value={articleUrl}
              onChange={event => setArticleUrl(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">언론사</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
              placeholder="언론사명"
              value={sourceName}
              onChange={event => setSourceName(event.target.value)}
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">썸네일 이미지 주소</span>
          <input
            className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
            placeholder="https://"
            value={thumbnailUrl}
            onChange={event => setThumbnailUrl(event.target.value)}
          />
        </label>
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={event => setIsPublished(event.target.checked)}
          />
          공개
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="primaryButton" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "저장 중" : editingId ? "수정 저장" : "등록"}
            <span>→</span>
          </button>
          {editingId && (
            <button
              type="button"
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
              onClick={resetForm}
            >
              취소
            </button>
          )}
        </div>
      </div>
      )}

      <div>
        {issues.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-slate-800">
            <div className="grid grid-cols-[minmax(0,1fr)_92px_128px] gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-xs text-slate-500">
              <span>제목</span>
              <span>생성일</span>
              <span className="text-right">관리</span>
            </div>
            {issues.map(issue => (
              <article key={issue.id} className="grid grid-cols-[minmax(0,1fr)_92px_128px] items-center gap-3 border-b border-slate-800/80 px-4 py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-100">{issue.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{issue.is_published ? "공개" : "비공개"}</p>
                </div>
                <span className="text-xs text-slate-400">{formatCreatedAt(issue.created_at)}</span>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-blue-400 hover:text-white"
                    onClick={() => handleEdit(issue)}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-red-400 hover:text-red-300"
                    onClick={() => handleDelete(issue)}
                  >
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">등록된 이슈가 없습니다.</p>
        )}
      </div>
    </section>
  );
}

function NoticePanel() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Array<{ id: string; title: string; body: string; created_at: string }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadNotices = async () => {
    if (!supabase) return;

    const { data, error: loadError } = await supabase
      .from("notices")
      .select("id,title,body,created_at")
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setNotices(data ?? []);
  };

  useEffect(() => {
    loadNotices();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setBody("");
    setIsFormOpen(false);
  };

  const handleCreate = () => {
    resetForm();
    setMessage(null);
    setError(null);
    setIsFormOpen(true);
  };

  const handleEdit = (notice: { id: string; title: string; body: string }) => {
    setEditingId(notice.id);
    setTitle(notice.title);
    setBody(notice.body);
    setMessage(null);
    setError(null);
    setIsFormOpen(true);
  };

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

    const values = { title: title.trim(), body: body.trim(), is_published: true };
    const { error: saveError } = editingId
      ? await supabase.from("notices").update(values).eq("id", editingId)
      : await supabase.from("notices").insert({ ...values, created_by: user.id });

    setIsSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    resetForm();
    setMessage(editingId ? "공지 수정 완료" : "공지 등록 완료");
    await loadNotices();
  };

  const handleDelete = async (notice: { id: string; title: string }) => {
    if (!supabase || !window.confirm(`'${notice.title}' 공지를 삭제할까요?`)) return;

    setError(null);
    setMessage(null);
    const { error: deleteError } = await supabase.from("notices").delete().eq("id", notice.id);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    if (editingId === notice.id) resetForm();
    setMessage("공지 삭제 완료");
    await loadNotices();
  };

  const formatCreatedAt = (value: string) => {
    try {
      return new Date(value).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      return "-";
    }
  };

  return (
    <section className="space-y-6 rounded-lg border border-blue-500/20 bg-slate-900/60 p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-white">공지 관리</h2>
        <button type="button" className="primaryButton" onClick={handleCreate}>
          새 공지 등록
          <span>→</span>
        </button>
      </div>

      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {isFormOpen && (
      <div className="space-y-4 border-y border-slate-800 py-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-base font-medium text-slate-100">{editingId ? "공지 수정" : "새 공지 등록"}</h3>
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-100"
            onClick={resetForm}
          >
            닫기
          </button>
        </div>
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
        <div className="flex flex-wrap gap-2">
          <button type="button" className="primaryButton" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "저장 중" : editingId ? "수정 저장" : "등록"}
            <span>→</span>
          </button>
          {editingId && (
            <button
              type="button"
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
              onClick={resetForm}
            >
              취소
            </button>
          )}
        </div>
      </div>
      )}

      <div>
        {notices.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-slate-800">
            <div className="grid grid-cols-[minmax(0,1fr)_92px_128px] gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-xs text-slate-500">
              <span>제목</span>
              <span>생성일</span>
              <span className="text-right">관리</span>
            </div>
            {notices.map(notice => (
              <article key={notice.id} className="grid grid-cols-[minmax(0,1fr)_92px_128px] items-center gap-3 border-b border-slate-800/80 px-4 py-3 last:border-b-0">
                <p className="truncate text-sm text-slate-100">{notice.title}</p>
                <span className="text-xs text-slate-400">{formatCreatedAt(notice.created_at)}</span>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-blue-400 hover:text-white"
                    onClick={() => handleEdit(notice)}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-red-400 hover:text-red-300"
                    onClick={() => handleDelete(notice)}
                  >
                    삭제
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">등록된 공지가 없습니다.</p>
        )}
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
