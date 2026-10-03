import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cleanHeroKeyword, MAX_HERO_KEYWORD_LENGTH, MAX_HERO_KEYWORDS, readHeroKeywords } from "@/lib/heroKeywords";

export default function HeroKeywordsPanel() {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [savedKeywords, setSavedKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
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

  const addKeyword = () => {
    const keyword = cleanHeroKeyword(newKeyword);
    if (!keyword) return setError("검색어를 입력하세요.");
    if (keyword.length > MAX_HERO_KEYWORD_LENGTH) return setError(`검색어는 ${MAX_HERO_KEYWORD_LENGTH}자 이하로 입력하세요.`);
    if (keywords.length >= MAX_HERO_KEYWORDS) return setError(`검색어는 최대 ${MAX_HERO_KEYWORDS}개까지 등록할 수 있습니다.`);
    if (keywords.some(item => cleanHeroKeyword(item).toLocaleLowerCase() === keyword.toLocaleLowerCase())) {
      return setError("이미 등록된 검색어입니다.");
    }
    setKeywords(current => [...current, keyword]);
    setNewKeyword("");
    setError(null);
    setMessage(null);
  };

  const saveKeywords = async () => {
    if (!supabase) return;
    const cleaned = keywords.map(cleanHeroKeyword);
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
  };

  const isDirty = JSON.stringify(keywords) !== JSON.stringify(savedKeywords);

  return (
    <section className="max-w-2xl space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">인기 검색어</h2>
        <p className="mt-1 text-sm text-slate-400">검색어 트렌드에 최대 10개를 표시합니다. 메인 검색창 아래에는 앞의 7개만 표시됩니다.</p>
      </div>

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-300">{message}</p>}
      {isLoading ? <p className="text-sm text-slate-400">검색어를 불러오는 중...</p> : (
        <>
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

          {keywords.length < MAX_HERO_KEYWORDS && (
            <form onSubmit={event => { event.preventDefault(); addKeyword(); }} className="flex items-center gap-2">
              <input
                value={newKeyword}
                onChange={event => { setNewKeyword(event.target.value); setError(null); }}
                maxLength={MAX_HERO_KEYWORD_LENGTH + 1}
                placeholder="검색어 추가"
                aria-label="새 검색어"
                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-400"
              />
              <button type="submit" title="검색어 추가" className="inline-flex h-10 items-center gap-1 rounded-md border border-blue-400/50 px-3 text-sm text-blue-200 hover:bg-blue-500/10"><Plus size={16} /> 추가</button>
            </form>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <span className="text-xs text-slate-400">{keywords.length} / {MAX_HERO_KEYWORDS}</span>
            <div className="flex gap-2">
              {isDirty && <button type="button" onClick={() => { setKeywords(savedKeywords); setError(null); }} className="rounded-md px-3 py-2 text-sm text-slate-400 hover:text-white">취소</button>}
              <button type="button" onClick={saveKeywords} disabled={!isDirty || isSaving} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"><Save size={16} /> {isSaving ? "저장 중" : "저장"}</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
