import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Save, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { cleanHeroKeyword, MAX_HERO_KEYWORD_LENGTH, MAX_HERO_KEYWORDS, parseRankedHeroKeywords, readHeroKeywords } from "@/lib/heroKeywords";

export default function HeroKeywordsPanel() {
  const utils = trpc.useUtils();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [savedKeywords, setSavedKeywords] = useState<string[]>([]);
  const [bulkInput, setBulkInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!supabase) {
      setError("검색어 저장소가 설정되지 않았습니다.");
      setIsLoading(false);
      return;
    }

    supabase.from("hero_search_settings").select("keywords").eq("id", 1).single().then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) {
        setError("인기 검색어를 불러오지 못했습니다.");
      } else {
        const loaded = readHeroKeywords(data.keywords);
        setKeywords(loaded);
        setSavedKeywords(loaded);
      }
      setIsLoading(false);
    });

    return () => { active = false; };
  }, []);

  const updateKeyword = (index: number, value: string) => {
    setKeywords(current => current.map((keyword, position) => position === index ? value : keyword));
    setError(null);
    setMessage(null);
  };

  const moveKeyword = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= keywords.length) return;
    setKeywords(current => {
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
    setMessage(null);
  };

  const applyBulkKeywords = () => {
    try {
      setKeywords(parseRankedHeroKeywords(bulkInput));
      setBulkInput("");
      setError(null);
      setMessage("편집 목록을 바꿨습니다. 저장하면 사이트에 반영됩니다.");
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : "검색어 형식을 확인해 주세요.");
      setMessage(null);
    }
  };

  const saveKeywords = async () => {
    if (!supabase) return;
    const cleaned = keywords.map(cleanHeroKeyword);
    if (cleaned.length > MAX_HERO_KEYWORDS) {
      return setError(`검색어는 최대 ${MAX_HERO_KEYWORDS}개까지 등록할 수 있습니다.`);
    }
    if (cleaned.some(keyword => !keyword || keyword.length > MAX_HERO_KEYWORD_LENGTH)) {
      return setError(`각 검색어를 1~${MAX_HERO_KEYWORD_LENGTH}자로 입력하세요.`);
    }
    if (new Set(cleaned.map(keyword => keyword.toLocaleLowerCase())).size !== cleaned.length) {
      return setError("중복된 검색어가 있습니다.");
    }

    setIsSaving(true);
    setError(null);
    setMessage(null);
    const { data, error: saveError } = await supabase.from("hero_search_settings")
      .update({ keywords: cleaned, updated_at: new Date().toISOString() })
      .eq("id", 1)
      .select("keywords")
      .single();
    setIsSaving(false);
    if (saveError) return setError("인기 검색어를 저장하지 못했습니다.");

    const saved = readHeroKeywords(data.keywords);
    setKeywords(saved);
    setSavedKeywords(saved);
    setMessage("인기 검색어를 저장했습니다.");
    void utils.googleTrends.contentsLiveRanking.invalidate();
    void utils.googleTrends.dailyRanking.invalidate({ source: "contents" });
  };

  const isDirty = JSON.stringify(keywords) !== JSON.stringify(savedKeywords);

  return (
    <section className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">인기 검색어</h2>
        <p className="mt-1 text-sm text-slate-400">한 회차에 최대 20개를 등록할 수 있습니다. 컨텐츠뷰 탭에는 오늘 누적 순위 상위 50개가 표시됩니다.</p>
      </div>

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
      {isLoading ? <p className="text-sm text-slate-400">검색어를 불러오는 중...</p> : (
        <>
          <div className="space-y-2">
            <label htmlFor="ranked-keywords-input" className="block text-sm font-medium text-slate-200">순위 일괄 입력</label>
            <textarea
              id="ranked-keywords-input"
              value={bulkInput}
              onChange={event => setBulkInput(event.target.value)}
              placeholder="1. 한국 일본 축구 | 2. 아시안게임"
              rows={2}
              className="w-full resize-y rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-blue-400"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={applyBulkKeywords} disabled={!bulkInput.trim() || isSaving} className="rounded-md border border-blue-400/50 px-3 py-2 text-sm text-blue-200 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-40">추가</button>
              <button type="button" onClick={saveKeywords} disabled={!isDirty || isSaving} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"><Save size={16} /> {isSaving ? "저장 중" : "저장"}</button>
            </div>
          </div>
          <div className="space-y-2">
            {keywords.map((keyword, index) => (
              <div key={index} className="flex items-center gap-2 border-b border-slate-800/70 py-2">
                <span className="w-5 shrink-0 text-center text-xs text-slate-500">{index + 1}</span>
                <input
                  value={keyword}
                  maxLength={MAX_HERO_KEYWORD_LENGTH + 1}
                  onChange={event => updateKeyword(index, event.target.value)}
                  aria-label={`${index + 1}번 검색어`}
                  className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
                />
                <button type="button" onClick={() => moveKeyword(index, -1)} disabled={index === 0} aria-label={`${keyword} 위로 이동`} title="위로 이동" className="p-2 text-slate-400 hover:text-white disabled:opacity-30"><ArrowUp size={16} /></button>
                <button type="button" onClick={() => moveKeyword(index, 1)} disabled={index === keywords.length - 1} aria-label={`${keyword} 아래로 이동`} title="아래로 이동" className="p-2 text-slate-400 hover:text-white disabled:opacity-30"><ArrowDown size={16} /></button>
                <button type="button" onClick={() => { setKeywords(current => current.filter((_, position) => position !== index)); setMessage(null); }} aria-label={`${keyword} 삭제`} title="삭제" className="p-2 text-slate-400 hover:text-red-300"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <span className="text-xs text-slate-400">{keywords.length} / {MAX_HERO_KEYWORDS}</span>
            {isDirty && <button type="button" onClick={() => { setKeywords(savedKeywords); setError(null); setMessage(null); }} className="rounded-md px-3 py-2 text-sm text-slate-400 hover:text-white">취소</button>}
          </div>
        </>
      )}
    </section>
  );
}
