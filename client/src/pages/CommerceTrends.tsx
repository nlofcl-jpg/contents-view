import { useState } from "react";
import { ChevronDown, RefreshCw, Search } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import VoiceSearchButton from "@/components/VoiceSearchButton";
import CoupangTrendPanel from "@/components/CoupangTrendPanel";
import { SearchGlowForm } from "@/components/SearchGlowForm";
import { TrendResetButton } from "@/components/TrendResetButton";
import { TREND_FILTER_CONTROL_CLASS, useNaverTrendComparison } from "@/components/NaverTrendComparison";
import { trpc } from "@/lib/trpc";
import { NAVER_GUEST_DAILY_LIMIT_MESSAGE, NAVER_MEMBER_DAILY_LIMIT_MESSAGE } from "@shared/naverAnalysisQuota";
import { naverShoppingCategories } from "@shared/naverShoppingCategories";
const rootCategoryFallback = Object.entries(naverShoppingCategories).map(([value, label]) => ({ value, label }));
const categoryOptionsQuery = { staleTime: 6 * 60 * 60_000, retry: false, refetchOnWindowFocus: false };

type CategoryOption = { value: string; label: string };

function withSelectedCategory(options: CategoryOption[] = [], selected?: CategoryOption) {
  return !selected || options.some(option => option.value === selected.value) ? options : [selected, ...options];
}

function CategoryFilter({ label, value, options, disabled, onChange }: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-400">
      {label}
      <span className="relative">
        <select className={`${TREND_FILTER_CONTROL_CLASS} w-full appearance-none truncate pr-9 max-sm:px-2 max-sm:pr-6`} value={value} onChange={event => onChange(event.target.value)} disabled={disabled}>
          {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 max-sm:right-1.5 max-sm:size-3" aria-hidden="true" />
      </span>
    </label>
  );
}

export default function CommerceTrends() {
  const [, navigate] = useLocation();
  const coupangActive = new URLSearchParams(useSearch()).get("tab") === "coupang";
  const { loading: authLoading } = useAuth();
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);
  const [keywordInput, setKeywordInput] = useState("");
  const [firstCategory, setFirstCategory] = useState("");
  const [secondCategory, setSecondCategory] = useState("");
  const [thirdCategory, setThirdCategory] = useState("");
  const [autoCategoryPath, setAutoCategoryPath] = useState<CategoryOption[]>([]);
  const firstOptions = trpc.naver.shoppingCategoryChildren.useQuery({ parent: "0", level: 1 }, { ...categoryOptionsQuery, enabled: !coupangActive });
  const secondOptions = trpc.naver.shoppingCategoryChildren.useQuery({ parent: firstCategory, level: 2 }, { ...categoryOptionsQuery, enabled: !coupangActive && Boolean(firstCategory) });
  const thirdOptions = trpc.naver.shoppingCategoryChildren.useQuery({ parent: secondCategory, level: 3 }, { ...categoryOptionsQuery, enabled: !coupangActive && Boolean(secondCategory) });
  const roots = withSelectedCategory(firstOptions.data ?? rootCategoryFallback, autoCategoryPath[0]);
  const secondCategories = withSelectedCategory(secondOptions.data, autoCategoryPath[1]);
  const thirdCategories = withSelectedCategory(thirdOptions.data, autoCategoryPath[2]);
  const categoryCode = thirdCategory || secondCategory || firstCategory || undefined;
  const categoryLabel = [
    roots.find(option => option.value === firstCategory)?.label,
    secondCategories.find(option => option.value === secondCategory)?.label,
    thirdCategories.find(option => option.value === thirdCategory)?.label,
  ].filter(Boolean).join(" › ");
  const failedOptions = [Boolean(firstCategory) && secondOptions, Boolean(secondCategory) && thirdOptions].find(query => query && query.isError);
  const handleAnalysisError = (error: unknown, fallback: string) => {
    const message = error instanceof Error ? error.message : "";
    if (message === NAVER_GUEST_DAILY_LIMIT_MESSAGE) {
      setGuestPromptOpen(true);
      return "";
    }
    return message === NAVER_MEMBER_DAILY_LIMIT_MESSAGE ? message : fallback;
  };
  const { renderPanel, resetComparison, submitComparisonKeyword, isTrendFilterLoading } = useNaverTrendComparison({
    authLoading,
    metric: "shopping",
    title: "쇼핑 트렌드 비교",
    onError: handleAnalysisError,
    shoppingCategory: {
      code: categoryCode,
      label: categoryLabel,
      onAutoCategory: path => {
        setAutoCategoryPath(path);
        setFirstCategory(path[0]?.value ?? "");
        setSecondCategory(path[1]?.value ?? "");
        setThirdCategory(path[2]?.value ?? "");
      },
      filters: (
        <div className="mb-3 border-b border-slate-700/60 pb-3">
          <div className="grid grid-cols-3 gap-2">
            <CategoryFilter label="1차" value={firstCategory} options={[{ value: "", label: "자동" }, ...roots]} disabled={false} onChange={value => {
              setFirstCategory(value);
              setSecondCategory("");
              setThirdCategory("");
              setAutoCategoryPath([]);
            }} />
            <CategoryFilter label="2차" value={secondCategory} options={[
              { value: "", label: !firstCategory ? "1차 선택" : secondOptions.isPending ? "로딩 중" : secondOptions.data?.length ? "전체" : "하위 없음" },
              ...secondCategories,
            ]} disabled={!firstCategory || !secondOptions.data?.length} onChange={value => {
              setSecondCategory(value);
              setThirdCategory("");
              setAutoCategoryPath(path => path.slice(0, 1));
            }} />
            <CategoryFilter label="3차" value={thirdCategory} options={[
              { value: "", label: !secondCategory ? "2차 선택" : thirdOptions.isPending ? "로딩 중" : thirdOptions.data?.length ? "전체" : "하위 없음" },
              ...thirdCategories,
            ]} disabled={!secondCategory || !thirdOptions.data?.length} onChange={value => {
              setThirdCategory(value);
              setAutoCategoryPath(path => path.slice(0, 2));
            }} />
          </div>
          {failedOptions && <button type="button" onClick={() => void failedOptions.refetch()} className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white">
            <RefreshCw size={13} aria-hidden="true" /> 하위 카테고리 다시 불러오기
          </button>}
        </div>
      ),
    },
  });

  const resetShoppingStatistics = () => {
    resetComparison();
    setKeywordInput("");
    setFirstCategory("");
    setSecondCategory("");
    setThirdCategory("");
    setAutoCategoryPath([]);
  };

  const goToAuth = (mode: "login" | "signup") => {
    const params = new URLSearchParams({ redirect: "/commerce" });
    if (mode === "signup") params.set("mode", "signup");
    setGuestPromptOpen(false);
    navigate(`/login?${params.toString()}`);
  };

  return (
    <div className="youtubePageContainer commerceTrendPage min-h-full">
      <div className="pageHeader">
        <h1 className="pageTitle">
          커머스 트렌드 <span className="ml-1 align-middle text-xs font-normal tracking-normal text-slate-400/70">Test</span>
        </h1>
      </div>
      <div className="tabMenu youtubeTabMenu" role="group" aria-label="커머스 트렌드 선택">
        <button type="button" className={`tabButton${coupangActive ? "" : " active"}`} aria-pressed={!coupangActive} onClick={() => navigate("/commerce")}>
          쇼핑 트렌드 비교
        </button>
        <button type="button" className={`tabButton${coupangActive ? " active" : ""}`} aria-pressed={coupangActive} onClick={() => navigate("/commerce?tab=coupang")}>
          쿠팡 트렌드
        </button>
      </div>
      {coupangActive ? <CoupangTrendPanel /> : (
      <>
      <SearchGlowForm
        className="heroSearch naverAnalysisComposer commerceAnalysisComposer"
        role="search"
        aria-label="쇼핑 트렌드 비교 분석"
        onSubmit={async event => {
          event.preventDefault();
          const input = keywordInput;
          if (await submitComparisonKeyword(input)) {
            setKeywordInput(current => current === input ? "" : current);
          }
        }}
      >
        <input
          type="search"
          value={keywordInput}
          onChange={event => setKeywordInput(event.target.value)}
          placeholder="검색어 입력"
          aria-label="비교할 검색어"
          autoComplete="off"
          maxLength={100}
          className="heroSearchInput"
        />
        <div className="flex items-center gap-1">
          {!isTrendFilterLoading && <VoiceSearchButton onTranscript={text => setKeywordInput(value =>
            [value.trimEnd(), text].filter(Boolean).join(" ").slice(0, 100)
          )} />}
          <button type="submit" className="heroSearchButton" aria-label="분석" title="분석" disabled={authLoading || isTrendFilterLoading || !keywordInput.trim()}>
            <Search size={18} aria-hidden="true" />
          </button>
        </div>
      </SearchGlowForm>
      {renderPanel(
        <TrendResetButton name="쇼핑 트렌드 비교" description="입력한 검색어, 선택한 필터와 그래프가 모두 초기화됩니다." onReset={resetShoppingStatistics} disabled={isTrendFilterLoading} />
      )}
      <GuestAccessPrompt
        open={guestPromptOpen}
        description={NAVER_GUEST_DAILY_LIMIT_MESSAGE}
        onBrowse={() => setGuestPromptOpen(false)}
        onLogin={() => goToAuth("login")}
        onSignup={() => goToAuth("signup")}
      />
      </>
      )}
    </div>
  );
}
