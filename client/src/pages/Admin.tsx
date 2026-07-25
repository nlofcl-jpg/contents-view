import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useState } from "react";
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
  registration_status: "connecting" | "complete" | "failed";
  created_at: string;
};

type VisibilityFilter = "all" | "published" | "private";
type SortDirection = "newest" | "oldest";
type IssueRegistrationMode = "manual" | "clipping";

type ClippingEntry = {
  title: string;
  summary: string;
};

function parseClippingEntries(value: string): ClippingEntry[] {
  const numberedEntryPattern = /^\s*\d{1,2}[.)]\s*(.+)$/;
  const entries: Array<{ title: string; lines: string[] }> = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(numberedEntryPattern);

    if (match) {
      if (current) entries.push(current);
      current = { title: match[1].trim(), lines: [] };
      continue;
    }

    if (current && line) current.lines.push(line);
  }

  if (current) entries.push(current);

  return entries
    .map(entry => ({
      title: entry.title.replace(/\s+/g, " ").trim(),
      summary: entry.lines.join(" ").replace(/\s+/g, " ").trim(),
    }))
    .filter(entry => entry.title.length > 1)
    .filter((entry, index, all) => all.findIndex(item => item.title === entry.title) === index)
    .slice(0, 20)
    .map(entry => ({ ...entry, summary: entry.summary || entry.title }));
}

type ManagementToolbarProps = {
  title: string;
  description: string;
  createLabel: string;
  secondaryCreateLabel?: string;
  visibility: VisibilityFilter;
  sortDirection: SortDirection;
  onCreate: () => void;
  onSecondaryCreate?: () => void;
  onVisibilityChange: (value: VisibilityFilter) => void;
  onSortChange: (value: SortDirection) => void;
  onReset: () => void;
};

function ManagementToolbar({
  title,
  description,
  createLabel,
  secondaryCreateLabel,
  visibility,
  sortDirection,
  onCreate,
  onSecondaryCreate,
  onVisibilityChange,
  onSortChange,
  onReset,
}: ManagementToolbarProps) {
  return (
    <header className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium text-white">{title}</h2>
          <p className="mt-2 text-sm font-normal text-slate-400">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {secondaryCreateLabel && onSecondaryCreate && (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded-md border border-slate-600 bg-slate-900/70 px-3 text-sm font-normal text-slate-200 transition hover:border-slate-400 hover:text-white"
              onClick={onSecondaryCreate}
            >
              <span aria-hidden="true">+</span> {secondaryCreateLabel}
            </button>
          )}
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 rounded-md border border-blue-400/60 bg-blue-500/15 px-3 text-sm font-normal text-blue-100 transition hover:bg-blue-500/25"
            onClick={onCreate}
          >
            <span aria-hidden="true">+</span> {createLabel}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-800 bg-slate-950/45 p-5">
        <select
          className="h-10 w-[180px] rounded-md border border-slate-700 bg-slate-950/80 px-3 text-sm font-normal text-slate-200 outline-none focus:border-blue-400"
          value={visibility}
          onChange={event => onVisibilityChange(event.target.value as VisibilityFilter)}
        >
          <option value="all">전체 상태</option>
          <option value="published">공개</option>
          <option value="private">비공개</option>
        </select>
        <select
          className="h-10 w-[180px] rounded-md border border-slate-700 bg-slate-950/80 px-3 text-sm font-normal text-slate-200 outline-none focus:border-blue-400"
          value={sortDirection}
          onChange={event => onSortChange(event.target.value as SortDirection)}
        >
          <option value="newest">최신 등록순</option>
          <option value="oldest">오래된 등록순</option>
        </select>
        <button
          type="button"
          className="h-10 w-[180px] rounded-md border border-slate-700 px-3 text-sm font-normal text-slate-300 transition hover:border-slate-500 hover:text-white md:ml-auto"
          onClick={onReset}
        >
          필터 초기화
        </button>
      </div>
    </header>
  );
}

function IssuesPanel() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [registrationMode, setRegistrationMode] = useState<IssueRegistrationMode>("manual");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [sortDirection, setSortDirection] = useState<SortDirection>("newest");
  const [clippingContent, setClippingContent] = useState("");
  const [isClippingSaving, setIsClippingSaving] = useState(false);
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(() => new Set());
  const matchClippingNewsMutation = trpc.news.matchClippingNews.useMutation();

  const loadIssues = async () => {
    if (!supabase) return;

    const { data, error: loadError } = await supabase
      .from("issues")
      .select("id,title,summary,article_url,thumbnail_url,source_name,is_published,registration_status,created_at")
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
    setRegistrationMode("manual");
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
    setRegistrationMode("manual");
    setError(null);
    setMessage(null);
  };

  const handleCreate = () => {
    resetForm();
    setMessage(null);
    setError(null);
    setIsFormOpen(true);
  };

  const handleClippingCreate = () => {
    resetForm();
    setMessage(null);
    setError(null);
    setRegistrationMode("clipping");
    setClippingContent("");
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
      registration_status: "complete" as const,
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
    setSelectedIssueIds(current => {
      const next = new Set(current);
      next.delete(issue.id);
      return next;
    });
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

  const filteredIssues = useMemo(() => {
    return [...issues]
      .filter(issue => visibility === "all" || (visibility === "published" ? issue.is_published : !issue.is_published))
      .sort((left, right) => {
        const difference = new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
        return sortDirection === "newest" ? difference : -difference;
      });
  }, [issues, sortDirection, visibility]);

  const isAllFilteredSelected = filteredIssues.length > 0 && filteredIssues.every(issue => selectedIssueIds.has(issue.id));

  const toggleAllIssues = () => {
    setSelectedIssueIds(current => {
      const next = new Set(current);
      if (isAllFilteredSelected) {
        filteredIssues.forEach(issue => next.delete(issue.id));
      } else {
        filteredIssues.forEach(issue => next.add(issue.id));
      }
      return next;
    });
  };

  const deleteIssues = async (ids: string[], confirmation: string) => {
    if (!supabase || ids.length === 0 || !window.confirm(confirmation)) return;

    setError(null);
    setMessage(null);
    const { error: deleteError } = await supabase.from("issues").delete().in("id", ids);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setSelectedIssueIds(current => {
      const next = new Set(current);
      ids.forEach(id => next.delete(id));
      return next;
    });
    setMessage(`${ids.length}개 이슈 삭제 완료`);
    await loadIssues();
  };

  const clippingEntries = useMemo(() => parseClippingEntries(clippingContent), [clippingContent]);

  const handleClippingSave = async () => {
    if (!supabase || !user) return;
    if (clippingEntries.length === 0) {
      setError("번호별 이슈 제목을 붙여넣어 주세요.");
      setMessage(null);
      return;
    }

    setIsClippingSaving(true);
    setError(null);
    const { data: draftData, error: draftError } = await supabase
      .from("issues")
      .insert(clippingEntries.map(entry => ({
        title: entry.title,
        summary: entry.summary,
        article_url: null,
        source_name: null,
        is_published: false,
        registration_status: "connecting",
        created_by: user.id,
      })))
      .select("id,title");

    if (draftError || !draftData) {
      setIsClippingSaving(false);
      setError(draftError?.message ?? "이슈 초안을 저장하지 못했습니다.");
      return;
    }

    await loadIssues();
    setMessage(`${draftData.length}개 이슈 초안 등록 중`);

    try {
      const matches = await matchClippingNewsMutation.mutateAsync({
        titles: clippingEntries.map(entry => entry.title),
      });
      const matchByTitle = new Map(matches.map(match => [match.title, match]));
      const updates = await Promise.all(draftData.map(async draft => {
        const match = matchByTitle.get(draft.title);
        return supabase!.from("issues").update(
          match
            ? {
                article_url: match.articleUrl,
                source_name: match.sourceName,
                registration_status: "complete",
              }
            : { registration_status: "failed" },
        ).eq("id", draft.id);
      }));

      const updateError = updates.find(result => result.error)?.error;
      if (updateError) throw updateError;

      const matchedCount = draftData.filter(draft => matchByTitle.has(draft.title)).length;
      const unmatchedCount = draftData.length - matchedCount;
      setMessage(
        unmatchedCount > 0
          ? `${matchedCount}개 등록 완료 · ${unmatchedCount}개 뉴스 미연결`
          : `${matchedCount}개 이슈 등록 완료`,
      );
    } catch (matchError) {
      await supabase.from("issues").update({ registration_status: "failed" }).in("id", draftData.map(draft => draft.id));
      setError(matchError instanceof Error ? matchError.message : "네이버 뉴스 연결 중 오류가 발생했습니다.");
    }

    setClippingContent("");
    setIsFormOpen(false);
    setRegistrationMode("manual");
    setIsClippingSaving(false);
    await loadIssues();
  };

  return (
    <section className="space-y-6">
      <ManagementToolbar
        title="이슈 관리"
        description="등록된 이슈를 관리하세요."
        createLabel="새 이슈 등록"
        secondaryCreateLabel="새 클리핑 등록"
        visibility={visibility}
        sortDirection={sortDirection}
        onCreate={handleCreate}
        onSecondaryCreate={handleClippingCreate}
        onVisibilityChange={setVisibility}
        onSortChange={setSortDirection}
        onReset={() => {
          setVisibility("all");
          setSortDirection("newest");
        }}
      />

      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {isFormOpen && registrationMode === "manual" && (
      <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
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

      {isFormOpen && registrationMode === "clipping" && (
        <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-medium text-slate-100">뉴스 클리핑 등록</h3>
              <p className="mt-1 text-xs font-normal text-slate-400">번호별 이슈 제목으로 네이버 뉴스 원문을 연결한 뒤, 검색 성공 항목만 비공개 이슈 초안으로 등록합니다.</p>
            </div>
            <button type="button" className="text-xs text-slate-400 hover:text-slate-100" onClick={resetForm}>
              닫기
            </button>
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">번호별 뉴스 요약</span>
            <textarea
              className="min-h-52 w-full resize-y rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm leading-6 text-slate-100 outline-none focus:border-blue-400"
              placeholder={"1. 첫 번째 이슈 제목\n핵심 요약 내용\n\n2. 두 번째 이슈 제목\n핵심 요약 내용"}
              value={clippingContent}
              onChange={event => setClippingContent(event.target.value)}
            />
          </label>
          {clippingContent.trim() && (
            <div className="rounded-md border border-slate-800 bg-slate-950/45 p-4">
              <p className="text-xs text-slate-400">등록 예정 이슈 {clippingEntries.length}개</p>
              {clippingEntries.length > 0 && (
                <ol className="mt-3 space-y-2 text-sm text-slate-200">
                  {clippingEntries.map((entry, index) => (
                    <li key={`${entry.title}-${index}`} className="truncate">{index + 1}. {entry.title}</li>
                  ))}
                </ol>
              )}
            </div>
          )}
          <button
            type="button"
            className="primaryButton"
            onClick={handleClippingSave}
            disabled={isClippingSaving || clippingEntries.length === 0}
          >
            {isClippingSaving ? "뉴스 검색 및 초안 등록 중" : `${clippingEntries.length}개 이슈 초안 등록`}
            <span>→</span>
          </button>
        </div>
      )}

      <div>
        {filteredIssues.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <button type="button" className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500 hover:text-white" onClick={toggleAllIssues}>
              {isAllFilteredSelected ? "전체 선택 해제" : "전체 선택"}
            </button>
            <button
              type="button"
              className="rounded-md border border-red-400/50 px-3 py-1.5 text-xs text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={selectedIssueIds.size === 0}
              onClick={() => deleteIssues(Array.from(selectedIssueIds), `선택한 ${selectedIssueIds.size}개 이슈를 삭제할까요?`)}
            >
              선택 삭제{selectedIssueIds.size > 0 ? ` (${selectedIssueIds.size})` : ""}
            </button>
            <button
              type="button"
              className="rounded-md border border-red-500/70 px-3 py-1.5 text-xs text-red-200 transition hover:bg-red-500/10"
              onClick={() => deleteIssues(filteredIssues.map(issue => issue.id), `현재 목록의 ${filteredIssues.length}개 이슈를 모두 삭제할까요?`)}
            >
              전체 삭제
            </button>
          </div>
        )}
        {filteredIssues.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-slate-800">
            <div className="grid grid-cols-[28px_minmax(0,1fr)_148px_128px] gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-xs text-slate-500">
              <span aria-hidden="true" />
              <span>제목</span>
              <span>등록 상태 · 생성일</span>
              <span className="text-right">관리</span>
            </div>
            {filteredIssues.map(issue => (
              <article key={issue.id} className="grid grid-cols-[28px_minmax(0,1fr)_148px_128px] items-center gap-3 border-b border-slate-800/80 px-4 py-3 last:border-b-0">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-500"
                  checked={selectedIssueIds.has(issue.id)}
                  onChange={() => setSelectedIssueIds(current => {
                    const next = new Set(current);
                    next.has(issue.id) ? next.delete(issue.id) : next.add(issue.id);
                    return next;
                  })}
                  aria-label={`${issue.title} 선택`}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-100">{issue.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{issue.is_published ? "공개" : "비공개"}</p>
                </div>
                <span className="flex items-center gap-2 text-xs text-slate-400">
                  <span className={`h-2 w-2 rounded-full ${issue.registration_status === "connecting" ? "animate-pulse bg-blue-400" : issue.registration_status === "failed" ? "bg-amber-400" : "bg-emerald-400"}`} aria-hidden="true" />
                  <span>{issue.registration_status === "connecting" ? "등록 중" : issue.registration_status === "failed" ? "연결 실패" : "등록 완료"}</span>
                  <span className="text-slate-600">·</span>
                  <span>{formatCreatedAt(issue.created_at)}</span>
                </span>
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
          <p className="text-sm text-slate-500">조건에 맞는 이슈가 없습니다.</p>
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
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [sortDirection, setSortDirection] = useState<SortDirection>("newest");

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

  const filteredNotices = useMemo(() => {
    return [...notices]
      // Current notices are all published, but keeping this filter prepares private notices.
      .filter(() => visibility !== "private")
      .sort((left, right) => {
        const difference = new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
        return sortDirection === "newest" ? difference : -difference;
      });
  }, [notices, sortDirection, visibility]);

  return (
    <section className="space-y-6">
      <ManagementToolbar
        title="공지 관리"
        description="등록된 공지를 관리하세요."
        createLabel="새 공지 등록"
        visibility={visibility}
        sortDirection={sortDirection}
        onCreate={handleCreate}
        onVisibilityChange={setVisibility}
        onSortChange={setSortDirection}
        onReset={() => {
          setVisibility("all");
          setSortDirection("newest");
        }}
      />

      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {isFormOpen && (
      <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
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
        {filteredNotices.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-slate-800">
            <div className="grid grid-cols-[minmax(0,1fr)_92px_128px] gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-xs text-slate-500">
              <span>제목</span>
              <span>생성일</span>
              <span className="text-right">관리</span>
            </div>
            {filteredNotices.map(notice => (
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
          <p className="text-sm text-slate-500">조건에 맞는 공지가 없습니다.</p>
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
