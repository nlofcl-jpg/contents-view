import { useAuth } from "@/_core/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { issueFocusCategories, type IssueFocusCategoryId } from "@/lib/issueFocusCategories";
import { issueBriefingLabel, issueFocusLabel } from "@/lib/newsNavigation";
import { ChevronDown, RefreshCw, X } from "lucide-react";
import NaverSearchAdKeyPanel from "@/components/NaverSearchAdKeyPanel";
import HeroKeywordsPanel from "@/components/HeroKeywordsPanel";
import SiteBannerPanel from "@/components/SiteBannerPanel";
import { getStoredIssueImagePath, removeStoredIssueImages, uploadIssueImage, validateIssueImage, validateIssueImageUrl } from "@/lib/issueImages";
import { stripIssueBodyFormatting } from "@shared/issueBody";
import { issueBodyImages } from "@shared/issueDocument";

const IssueBodyEditor = lazy(() => import("@/components/IssueBodyEditor"));

type AdminTab = "notices" | "banner" | "issues" | "newsClips" | "users" | "apiKeys" | "heroKeywords" | "partnership";

const adminTabs: Array<{ id: AdminTab; label: string }> = [
  { id: "notices", label: "공지" },
  { id: "banner", label: "배너" },
  { id: "users", label: "사용자" },
  { id: "apiKeys", label: "API 키" },
  { id: "issues", label: issueFocusLabel },
  { id: "newsClips", label: issueBriefingLabel },
  { id: "heroKeywords", label: "인기 검색어" },
  { id: "partnership", label: "제휴 문의" },
];

export default function Admin() {
  const { user, loading, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    if (typeof window === "undefined") return "notices";
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    return adminTabs.some(tab => tab.id === requestedTab) ? requestedTab as AdminTab : "notices";
  });
  const isAdmin = isAuthenticated && user?.role === "admin";
  const tabListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    setActiveTab(adminTabs.some(tab => tab.id === requestedTab) ? requestedTab as AdminTab : "notices");
  }, [location]);

  useEffect(() => {
    const list = tabListRef.current;
    if (!isAdmin || !list || !window.matchMedia("(max-width: 639px)").matches) return;
    const selected = list.querySelector<HTMLElement>('[aria-current="page"]');
    if (!selected) return;

    const listBounds = list.getBoundingClientRect();
    const selectedBounds = selected.getBoundingClientRect();
    if (selectedBounds.left < listBounds.left) {
      list.scrollBy({ left: selectedBounds.left - listBounds.left, behavior: "smooth" });
    } else if (selectedBounds.right > listBounds.right) {
      list.scrollBy({ left: selectedBounds.right - listBounds.right, behavior: "smooth" });
    }
  }, [activeTab, isAdmin]);

  const handleAdminTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    setLocation(tab === "notices" ? "/admin" : `/admin?tab=${tab}`);
  };

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

      <div ref={tabListRef} className="mb-5 flex flex-nowrap gap-2 overflow-x-auto border-b border-slate-800 sm:flex-wrap sm:overflow-visible">
        {adminTabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            aria-current={activeTab === tab.id ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab.id
                ? "border-blue-400 text-white"
                : "border-transparent text-slate-400 hover:text-slate-100"
            }`}
            onClick={() => handleAdminTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "notices" && <NoticePanel />}
      {activeTab === "banner" && <SiteBannerPanel />}
      {activeTab === "issues" && <IssuesPanel key="issues" />}
      {activeTab === "newsClips" && <IssuesPanel key="news-clips" table="news_clips" />}
      {activeTab === "users" && <UsersPanel adminEmail={user?.email ?? ""} />}
      {activeTab === "apiKeys" && <ApiKeysPanel />}
      {activeTab === "heroKeywords" && <HeroKeywordsPanel />}
      {activeTab === "partnership" && <PartnershipInquiriesPanel />}
    </div>
  );
}

function PartnershipInquiriesPanel() {
  const { data, isLoading, error, refetch, isFetching } = trpc.partnership.list.useQuery();

  return (
    <section className="space-y-5">
      <header className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-medium text-white">제휴 문의</h2>
        <button type="button" onClick={() => void refetch()} disabled={isFetching} aria-label="제휴 문의 새로고침" title="새로고침" className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-slate-400 transition-colors hover:text-white disabled:opacity-50">
          <RefreshCw size={17} className={isFetching ? "animate-spin" : ""} aria-hidden="true" />
        </button>
      </header>
      {isLoading && <p className="text-sm text-slate-400">문의 내역을 불러오는 중입니다.</p>}
      {error && <p role="alert" className="text-sm text-rose-300">문의 내역을 불러오지 못했습니다.</p>}
      {!isLoading && !error && data?.length === 0 && <p className="text-sm text-slate-400">접수된 제휴 문의가 없습니다.</p>}
      <div className="space-y-3">
        {data?.map(inquiry => (
          <article key={inquiry.id} className="rounded-md border border-slate-700 bg-slate-900/50 p-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold text-white">{inquiry.name}</h3>
              <time className="text-xs text-slate-400" dateTime={inquiry.created_at}>{new Date(inquiry.created_at).toLocaleString("ko-KR")}</time>
            </div>
            <p className="mt-2 text-slate-300">{inquiry.phone} · {inquiry.email}</p>
            <p className="mt-3 whitespace-pre-wrap break-words border-t border-slate-700 pt-3 leading-6 text-slate-100">{inquiry.message}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

type IssueRecord = {
  id: string;
  title: string;
  summary: string;
  thumbnail_url: string | null;
  thumbnail_credit: string | null;
  is_published: boolean;
  registration_status?: "connecting" | "complete" | "failed";
  category?: IssueFocusCategoryId | null;
  created_at: string;
};

type VisibilityFilter = "all" | "published" | "private";
type SortDirection = "newest" | "oldest";

function AdminSelect({ className = "", children, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative inline-flex shrink-0 items-center">
      <select {...props} className={`${className} appearance-none pr-8`}>
        {children}
      </select>
      <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-2 text-slate-400" />
    </span>
  );
}

type ManagementToolbarProps = {
  title: string;
  description: string;
  createLabel: string;
  visibility: VisibilityFilter;
  sortDirection: SortDirection;
  onCreate: () => void;
  onVisibilityChange: (value: VisibilityFilter) => void;
  onSortChange: (value: SortDirection) => void;
  onReset: () => void;
  placeCreateActionsInFilters?: boolean;
};

function ManagementToolbar({
  title,
  description,
  createLabel,
  visibility,
  sortDirection,
  onCreate,
  onVisibilityChange,
  onSortChange,
  onReset,
  placeCreateActionsInFilters = false,
}: ManagementToolbarProps) {
  const createActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="inline-flex h-9 items-center gap-1 rounded-md border border-blue-400/60 bg-blue-500/15 px-3 text-sm font-normal text-blue-100 transition hover:bg-blue-500/25"
        onClick={onCreate}
      >
        <span aria-hidden="true">+</span> {createLabel}
      </button>
    </div>
  );

  return (
    <header className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium text-white">{title}</h2>
          <p className="mt-2 text-sm font-normal text-slate-400">{description}</p>
        </div>
        {!placeCreateActionsInFilters && createActions}
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-800 bg-slate-950/45 p-5">
        <AdminSelect
          className="h-10 w-[180px] rounded-md border border-slate-700 bg-slate-950/80 px-3 text-sm font-normal text-slate-200 outline-none focus:border-blue-400"
          value={visibility}
          onChange={event => onVisibilityChange(event.target.value as VisibilityFilter)}
        >
          <option value="all">전체 상태</option>
          <option value="published">공개</option>
          <option value="private">비공개</option>
        </AdminSelect>
        <AdminSelect
          className="h-10 w-[180px] rounded-md border border-slate-700 bg-slate-950/80 px-3 text-sm font-normal text-slate-200 outline-none focus:border-blue-400"
          value={sortDirection}
          onChange={event => onSortChange(event.target.value as SortDirection)}
        >
          <option value="newest">최신 등록순</option>
          <option value="oldest">오래된 등록순</option>
        </AdminSelect>
        <button
          type="button"
          className="h-10 w-[180px] rounded-md border border-slate-700 px-3 text-sm font-normal text-slate-300 transition hover:border-slate-500 hover:text-white"
          onClick={onReset}
        >
          필터 초기화
        </button>
        {placeCreateActionsInFilters && <div className="md:ml-auto">{createActions}</div>}
      </div>
    </header>
  );
}

function IssuesPanel({ table = "issues" }: { table?: "issues" | "news_clips" }) {
  const { user } = useAuth();
  const isClip = table === "news_clips";
  const label = isClip ? issueBriefingLabel : issueFocusLabel;
  const [issues, setIssues] = useState<IssueRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<IssueFocusCategoryId | "">("");
  const bodyUploadsRef = useRef<string[]>([]);
  const draftStateRef = useRef({ mounted: true, saving: false });
  const [bodyUploading, setBodyUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailCredit, setThumbnailCredit] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [isPublished, setIsPublished] = useState(!isClip);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publicationChangingIssueId, setPublicationChangingIssueId] = useState<string | null>(null);
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    draftStateRef.current.mounted = true;
    return () => {
      draftStateRef.current.mounted = false;
      if (!draftStateRef.current.saving) {
        void removeStoredIssueImages(bodyUploadsRef.current).catch(error => console.error("[Issue image] Failed to remove draft images", error));
        bodyUploadsRef.current = [];
      }
    };
  }, []);

  useEffect(() => {
    if (!thumbnailFile) {
      setThumbnailPreviewUrl(null);
      return;
    }
    const previewUrl = URL.createObjectURL(thumbnailFile);
    setThumbnailPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [thumbnailFile]);

  useEffect(() => {
    setImagePreviewError(false);
  }, [thumbnailFile, thumbnailUrl]);

  const loadIssues = async () => {
    if (!supabase) {
      setError(`${label} 저장소가 설정되지 않았습니다.`);
      return;
    }

    const source = supabase.from(table);
    const selection = isClip
      ? source.select("id,title,summary,thumbnail_url,thumbnail_credit,is_published,created_at")
      : source.select("id,title,summary,thumbnail_url,thumbnail_credit,is_published,registration_status,category,created_at");
    const { data, error: loadError } = await selection
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(isClip ? `${label}을 불러오지 못했습니다. 저장소 설정을 확인해 주세요.` : loadError.message);
      return;
    }

    setIssues(data ?? []);
    setHasLoaded(true);
  };

  const removeArticleImages = async (urls: Array<string | null>) => {
    if (!supabase) return;
    const candidates = urls.flatMap(url => {
      const path = url && getStoredIssueImagePath(url);
      return url && path ? [{ url, path }] : [];
    });
    if (candidates.length === 0) return;

    // Published images can be reused across articles and across both lists.
    const referenced = new Set<string>();
    const pageSize = 500;
    for (const sourceTable of ["issues", "news_clips"]) {
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await supabase.from(sourceTable)
          .select("thumbnail_url,summary").order("id").range(offset, offset + pageSize - 1);
        if (error) {
          if (!isClip && sourceTable === "news_clips" && (error.code === "PGRST205" || error.code === "42P01")) break;
          throw error;
        }
        for (const article of data) {
          for (const url of [article.thumbnail_url, ...issueBodyImages(article.summary)]) {
            const path = url && getStoredIssueImagePath(url);
            if (path) referenced.add(path);
          }
        }
        if (data.length < pageSize) break;
      }
    }
    await removeStoredIssueImages(candidates.filter(({ path }) => !referenced.has(path)).map(({ url }) => url));
  };

  useEffect(() => {
    loadIssues();
  }, []);

  const resetForm = () => {
    if (bodyUploading || isSaving) return;
    const unused = bodyUploadsRef.current;
    bodyUploadsRef.current = [];
    void removeStoredIssueImages(unused).catch(error => console.error("[Issue image] Failed to remove draft images", error));
    setEditingId(null);
    setTitle("");
    setSummary("");
    setCategory("");
    setThumbnailUrl("");
    setThumbnailCredit("");
    setThumbnailFile(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    setIsPublished(!isClip);
    setIsFormOpen(false);
  };

  const handleEdit = (issue: IssueRecord) => {
    setEditingId(issue.id);
    setTitle(issue.title);
    setSummary(issue.summary);
    setCategory(issue.category ?? "");
    setThumbnailUrl(issue.thumbnail_url ?? "");
    setThumbnailCredit(issue.thumbnail_credit ?? "");
    setThumbnailFile(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
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
    if (!supabase || !user || bodyUploading || isSaving) return;
    if (!title.trim() || (!stripIssueBodyFormatting(summary) && issueBodyImages(summary).length === 0)) {
      setError("제목과 본문을 입력하세요.");
      setMessage(null);
      return;
    }
    if (!thumbnailFile) {
      const urlError = validateIssueImageUrl(thumbnailUrl);
      if (urlError) {
        setError(urlError);
        setMessage(null);
        return;
      }
    }

    setIsSaving(true);
    draftStateRef.current.saving = true;
    setError(null);
    setMessage(null);

    const previousIssue = issues.find(issue => issue.id === editingId);
    let uploadedImageUrl: string | null = null;

    try {
      if (thumbnailFile) {
        const uploaded = await uploadIssueImage(thumbnailFile);
        uploadedImageUrl = uploaded.url;
      }
    } catch (uploadError) {
      setIsSaving(false);
      draftStateRef.current.saving = false;
      if (!draftStateRef.current.mounted) {
        void removeStoredIssueImages(bodyUploadsRef.current).catch(error => console.error("[Issue image] Failed to remove draft images", error));
        bodyUploadsRef.current = [];
      }
      setError(uploadError instanceof Error ? uploadError.message : "이미지를 업로드하지 못했습니다.");
      return;
    }

    const values = {
      title: title.trim(),
      summary: summary.trim(),
      thumbnail_url: uploadedImageUrl || thumbnailUrl.trim() || null,
      thumbnail_credit: thumbnailCredit.trim() || null,
      is_published: isPublished,
      ...(!isClip ? { article_url: null, source_name: null, article_title: null, article_summary: null, registration_status: "complete", category: category || null } : {}),
    };

    let saveErrorMessage: string | null = null;
    try {
      const insertValues = { ...values, ...(!isClip ? { registration_type: "manual", created_by: user.id } : {}) };
      const { error: saveError } = editingId
        ? await supabase.from(table).update(values).eq("id", editingId).select("id").single()
        : await supabase.from(table).insert(insertValues).select("id").single();
      saveErrorMessage = saveError?.message ?? null;
    } catch (saveError) {
      saveErrorMessage = saveError instanceof Error ? saveError.message : `${label} 저장에 실패했습니다.`;
    }

    if (saveErrorMessage) {
      draftStateRef.current.saving = false;
      if (!draftStateRef.current.mounted) {
        void removeStoredIssueImages(bodyUploadsRef.current).catch(error => console.error("[Issue image] Failed to remove draft images", error));
        bodyUploadsRef.current = [];
      }
      if (uploadedImageUrl) {
        try { await removeStoredIssueImages([uploadedImageUrl]); } catch (cleanupError) { console.error("[Issue image] Failed to remove unused upload", cleanupError); }
      }
      setIsSaving(false);
      setError(saveErrorMessage);
      return;
    }

    const retained = new Set([
      values.thumbnail_url, ...issueBodyImages(values.summary),
      ...issues.filter(issue => issue.id !== editingId).flatMap(issue => [issue.thumbnail_url, ...issueBodyImages(issue.summary)]),
    ]);
    const unused = [...bodyUploadsRef.current, ...(previousIssue ? [previousIssue.thumbnail_url, ...issueBodyImages(previousIssue.summary)] : [])]
      .filter((url): url is string => Boolean(url) && !retained.has(url));
    bodyUploadsRef.current = [];
    try { await removeArticleImages(Array.from(new Set(unused))); } catch (cleanupError) { console.error("[Issue image] Failed to remove unused images", cleanupError); }

    setIsSaving(false);
    draftStateRef.current.saving = false;
    // This save is complete; resetForm's busy guard applies to user cancellation only.
    setEditingId(null);
    setTitle("");
    setSummary("");
    setCategory("");
    setThumbnailUrl("");
    setThumbnailFile(null);
    setIsPublished(!isClip);
    setThumbnailCredit("");
    setIsFormOpen(false);
    setMessage(editingId ? `${label} 수정 완료` : `${label} 등록 완료`);
    await loadIssues();
  };

  const handleDelete = async (issue: IssueRecord) => {
    if (!supabase || !window.confirm(`'${issue.title}' 글을 삭제할까요?`)) return;

    setError(null);
    setMessage(null);
    const { error: deleteError } = await supabase.from(table).delete().eq("id", issue.id).select("id").single();

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    const retainedImages = new Set(issues.filter(item => item.id !== issue.id).flatMap(item => [item.thumbnail_url, ...issueBodyImages(item.summary)]));
    try { await removeArticleImages([issue.thumbnail_url, ...issueBodyImages(issue.summary)].filter(url => !retainedImages.has(url))); } catch (cleanupError) { console.error("[Issue image] Failed to remove deleted issue image", cleanupError); }

    if (editingId === issue.id) resetForm();
    setSelectedIssueIds(current => {
      const next = new Set(current);
      next.delete(issue.id);
      return next;
    });
    setMessage(`${label} 삭제 완료`);
    await loadIssues();
  };

  const handlePublicationChange = async (issue: IssueRecord, nextPublished: boolean) => {
    if (!supabase) return;
    if (issue.is_published === nextPublished) return;

    setPublicationChangingIssueId(issue.id);
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase
      .from(table)
      .update({ is_published: nextPublished })
      .eq("id", issue.id).select("id").single();

    setPublicationChangingIssueId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage(nextPublished ? `'${issue.title}' 공개 완료` : `'${issue.title}' 비공개 전환 완료`);
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

  const isAllFilteredSelected = issues.length > 0 && issues.every(issue => selectedIssueIds.has(issue.id));

  const toggleAllIssues = () => {
    setSelectedIssueIds(current => {
      const next = new Set(current);
      if (isAllFilteredSelected) {
        issues.forEach(issue => next.delete(issue.id));
      } else {
        issues.forEach(issue => next.add(issue.id));
      }
      return next;
    });
  };

  const deleteIssues = async (ids: string[], confirmation: string) => {
    if (!supabase || ids.length === 0 || !window.confirm(confirmation)) return;

    setError(null);
    setMessage(null);
    const { data: deleted, error: deleteError } = await supabase.from(table).delete().in("id", ids).select("id");
    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    const deletedIds = new Set((deleted ?? []).map(item => item.id));
    const retainedImages = new Set(issues.filter(issue => !deletedIds.has(issue.id)).flatMap(issue => [issue.thumbnail_url, ...issueBodyImages(issue.summary)]));
    const deletedImageUrls = issues.filter(issue => deletedIds.has(issue.id)).flatMap(issue => [issue.thumbnail_url, ...issueBodyImages(issue.summary)]).filter(url => !retainedImages.has(url));
    try { await removeArticleImages(deletedImageUrls); } catch (cleanupError) { console.error("[Issue image] Failed to remove deleted issue images", cleanupError); }

    setSelectedIssueIds(current => {
      const next = new Set(current);
      deletedIds.forEach(id => next.delete(id));
      return next;
    });
    if (deletedIds.size === 0) setError("선택한 글을 삭제하지 못했습니다.");
    else setMessage(`${deletedIds.size}개 ${label} 삭제 완료`);
    await loadIssues();
  };

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-2xl font-medium text-white">{label} 관리</h2>
        {!isClip && <p className="mt-2 text-sm font-normal text-slate-400">등록된 {label} 글을 관리하세요.</p>}
      </header>

      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-red-300">{error}</p>}

      {isFormOpen && (
      <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex justify-end">
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-100"
            onClick={resetForm}
            disabled={isSaving || bodyUploading}
          >
            닫기
          </button>
        </div>
        <div>
          <label htmlFor="issue-title" className="mb-2 block text-sm font-medium text-slate-300">제목</label>
          <div className={isClip ? "flex gap-2" : "flex flex-wrap justify-end gap-2 sm:flex-nowrap"}>
            <input
              id="issue-title"
              className={`h-10 min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none focus:border-blue-400 ${isClip ? "" : "basis-full sm:basis-0"}`}
              placeholder={`${label} 제목`}
              value={title}
              onChange={event => setTitle(event.target.value)}
            />
            {!isClip && (
              <AdminSelect
                aria-label="이슈 포커스 카테고리"
                className="h-10 w-[144px] rounded-md border border-slate-700 bg-slate-950/80 pl-2 text-sm text-slate-200 outline-none focus:border-blue-400"
                value={category}
                onChange={event => setCategory(event.target.value as IssueFocusCategoryId | "")}
                disabled={isSaving}
              >
                <option value="">카테고리 미분류</option>
                {issueFocusCategories.map(({ id, label }) => id === "all" ? null : (
                  <option key={id} value={id}>{label}</option>
                ))}
              </AdminSelect>
            )}
            <AdminSelect
              aria-label="공개 상태"
              className="h-10 w-[88px] rounded-md border border-slate-700 bg-slate-950/80 pl-2 text-sm text-slate-200 outline-none focus:border-blue-400"
              value={isPublished ? "published" : "private"}
              onChange={event => setIsPublished(event.target.value === "published")}
            >
              <option value="private">비공개</option>
              <option value="published">공개</option>
            </AdminSelect>
          </div>
        </div>
        <div>
          <label htmlFor="issue-body" className="mb-2 block text-sm font-medium text-slate-300">본문</label>
          <Suspense fallback={<p className="text-sm text-slate-400" role="status">편집기 불러오는 중…</p>}>
            <IssueBodyEditor
              value={summary}
              disabled={isSaving}
              onChange={setSummary}
              onUpload={url => {
                if (draftStateRef.current.mounted) bodyUploadsRef.current.push(url);
                else void removeStoredIssueImages([url]).catch(error => console.error("[Issue image] Failed to remove draft image", error));
              }}
              onBusyChange={setBodyUploading}
            />
          </Suspense>
        </div>
        <div>
          <label htmlFor="issue-image-url" className="mb-2 block text-sm font-medium text-slate-200">대표 이미지</label>
          <input
            id="issue-image-url"
            type="url"
            className="h-11 w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-blue-400"
            placeholder="이미지 URL을 입력하세요 (예: https://example.com/image.jpg)"
            value={thumbnailUrl}
            onChange={event => {
              setThumbnailUrl(event.target.value);
              setThumbnailFile(null);
              if (imageInputRef.current) imageInputRef.current.value = "";
              setError(null);
            }}
          />
          <p className="mb-3 mt-2 text-xs text-slate-400">공개적으로 접근 가능한 이미지 URL을 입력하거나, 아래에서 직접 업로드하세요.</p>
          <input
            id="issue-image-file"
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="block h-11 w-full cursor-pointer rounded-md border border-slate-700 bg-slate-950/70 text-sm leading-[42px] text-slate-300 file:mr-3 file:h-[42px] file:cursor-pointer file:border-0 file:bg-transparent file:px-3 file:text-sm file:font-medium file:text-slate-200 focus:border-blue-400"
            aria-label="썸네일 이미지 파일"
            onChange={event => {
              const file = event.target.files?.[0];
              if (!file) return;
              const validationError = validateIssueImage(file);
              if (validationError) {
                event.target.value = "";
                setError(validationError);
                return;
              }
              setError(null);
              setThumbnailFile(file);
              setThumbnailUrl("");
            }}
          />
          <p className="mt-2 text-xs text-slate-400">JPG, PNG, WebP 이미지를 업로드할 수 있습니다.</p>
          <label htmlFor="issue-image-credit" className="mb-2 mt-4 block text-sm font-medium text-slate-300">이미지 출처 <span className="text-xs font-normal text-slate-500">(선택)</span></label>
          <input
            id="issue-image-credit"
            type="text"
            maxLength={200}
            className="h-10 w-full rounded-md border border-slate-700 bg-slate-950/70 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-blue-400"
            placeholder="예: 공식 홈페이지, 직접 촬영"
            value={thumbnailCredit}
            onChange={event => setThumbnailCredit(event.target.value)}
          />
          {(thumbnailFile || thumbnailUrl) && (
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-300"
                onClick={() => {
                  setThumbnailFile(null);
                  setThumbnailUrl("");
                  if (imageInputRef.current) imageInputRef.current.value = "";
                }}
              >
                <X size={14} aria-hidden="true" />
                이미지 제거
              </button>
            </div>
          )}
          {(thumbnailPreviewUrl || (thumbnailUrl && !validateIssueImageUrl(thumbnailUrl))) && !imagePreviewError && (
            <img
              src={thumbnailPreviewUrl || thumbnailUrl}
              alt="썸네일 미리보기"
              className="mt-3 max-h-56 max-w-full object-contain"
              onError={() => setImagePreviewError(true)}
            />
          )}
          {imagePreviewError && <p className="mt-2 text-xs text-amber-300">이미지를 불러올 수 없습니다. 주소와 공개 설정을 확인해 주세요.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="secondaryButton issueFormAction"
            onClick={resetForm}
            disabled={isSaving || bodyUploading}
          >
            취소
          </button>
          <button
            type="button"
            className="primaryButton issueFormAction"
            onClick={handleSave}
            disabled={isSaving || bodyUploading}
          >
            {isSaving ? "저장 중" : editingId ? "수정 저장" : "등록"}
          </button>
        </div>
      </div>
      )}

      {!isFormOpen && <div>
        <div className="mb-3 flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex shrink-0 items-center gap-2">
          {issues.length > 0 && (
            <>
            <button type="button" className="h-9 whitespace-nowrap rounded-md border border-slate-700 px-3 text-xs text-slate-300 hover:border-slate-500 hover:text-white" onClick={toggleAllIssues}>
              {isAllFilteredSelected ? "전체 선택 해제" : "전체 선택"}
            </button>
            <button
              type="button"
              className="h-9 whitespace-nowrap rounded-md border border-red-400/50 px-3 text-xs text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={selectedIssueIds.size === 0}
              onClick={() => deleteIssues(Array.from(selectedIssueIds), `선택한 글 ${selectedIssueIds.size}개를 삭제할까요?`)}
            >
              선택 삭제{selectedIssueIds.size > 0 ? ` (${selectedIssueIds.size})` : ""}
            </button>
            </>
          )}
          </div>
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-blue-400/60 bg-blue-500/15 px-3 text-sm font-normal text-blue-100 transition hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={handleCreate}
            disabled={isClip && !hasLoaded}
          >
            <span aria-hidden="true">+</span> 새 {label} 등록
          </button>
        </div>
        {issues.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-slate-800">
            <div className="min-w-[850px]">
            <div className="grid grid-cols-[28px_minmax(260px,1fr)_112px_120px_210px] gap-4 border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-xs text-slate-500">
              <span aria-hidden="true" />
              <span>제목</span>
              <span>등록 상태</span>
              <span>생성일</span>
              <span className="text-right">관리</span>
            </div>
            {issues.map(issue => (
              <article key={issue.id} className="grid grid-cols-[28px_minmax(260px,1fr)_112px_120px_210px] items-center gap-4 border-b border-slate-800/80 px-4 py-3 last:border-b-0">
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
                  {isClip && issue.is_published ? (
                    <Link href={`/news/clips/${issue.id}`} className="block truncate text-sm text-blue-200 hover:underline">{issue.title}</Link>
                  ) : <p className="truncate text-sm text-slate-100">{issue.title}</p>}
                  <p className="mt-1 text-xs text-slate-500">{issue.is_published ? "공개" : "비공개"}</p>
                </div>
                <span className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-400">
                  <span className={`h-2 w-2 rounded-full ${issue.registration_status === "connecting" ? "animate-pulse bg-blue-400" : issue.registration_status === "failed" ? "bg-amber-400" : "bg-emerald-400"}`} aria-hidden="true" />
                  <span>{issue.registration_status === "connecting" ? "등록 중" : issue.registration_status === "failed" ? "연결 실패" : "등록 완료"}</span>
                </span>
                <span className="whitespace-nowrap text-xs text-slate-400">{formatCreatedAt(issue.created_at)}</span>
                <div className="flex justify-end gap-2 whitespace-nowrap">
                  <AdminSelect
                    aria-label={`${issue.title} 공개 상태`}
                    className="h-8 w-20 rounded-md border border-slate-700 bg-slate-950/80 px-2 text-xs text-slate-200 outline-none transition focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={publicationChangingIssueId === issue.id}
                    value={issue.is_published ? "published" : "private"}
                    onChange={event => handlePublicationChange(issue, event.target.value === "published")}
                  >
                    <option value="private">비공개</option>
                    <option value="published">공개</option>
                  </AdminSelect>
                  <button
                    type="button"
                    className="whitespace-nowrap rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:border-blue-400 hover:text-white"
                    onClick={() => handleEdit(issue)}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="whitespace-nowrap rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-red-400 hover:text-red-300"
                    onClick={() => handleDelete(issue)}
                  >
                    삭제
                  </button>
                </div>
              </article>
            ))}
            </div>
          </div>
        ) : (
          !error && <p className="text-sm text-slate-500">{isClip && !hasLoaded ? `${label}을 불러오는 중입니다.` : `등록된 ${label} 글이 없습니다.`}</p>
        )}
      </div>}
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
      console.error("[Notices] Failed to load notices", loadError);
      setError("공지를 불러오지 못했습니다.");
      return;
    }

    setError(null);
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
      console.error("[Notices] Failed to save notice", saveError);
      setError("공지를 저장하지 못했습니다.");
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
      console.error("[Notices] Failed to delete notice", deleteError);
      setError("공지를 삭제하지 못했습니다.");
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

      {filteredNotices.length > 0 && (
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
      )}
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
