import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { naverShoppingCategories } from "@shared/naverShoppingCategories";
import { publicProcedure } from "./_core/trpc";
import { naverAnalysisProcedure } from "./naverAnalysisQuota";
import { generateCacheKey, getFromCache, setInCache } from "./naver.cache";

export const categoryFilterInput = z.object({
  startDate: z.string(),
  endDate: z.string(),
  timeUnit: z.enum(["date", "week", "month"]),
  device: z.string().optional(),
  gender: z.string().optional(),
  ages: z.array(z.string()).optional(),
});
const categoryTrendInput = categoryFilterInput.extend({ categoryCode: z.string() });
const trendPoints = z.array(z.object({ period: z.string(), ratio: z.number() }));
type CategoryTrendResult = { success: boolean; error?: string; data: z.infer<typeof trendPoints> };

export async function fetchNaverCategoryTrend(input: z.infer<typeof categoryTrendInput>): Promise<CategoryTrendResult> {
  const { NAVER_CLIENT_ID: clientId, NAVER_CLIENT_SECRET: clientSecret } = process.env;
  if (!clientId || !clientSecret) return { success: false, error: "Naver API credentials not configured", data: [] };

  const { categoryCode, startDate, endDate, timeUnit, device, gender, ages } = input;
  const name = Object.hasOwn(naverShoppingCategories, categoryCode)
    ? naverShoppingCategories[categoryCode as keyof typeof naverShoppingCategories] : categoryCode;
  const cacheKey = generateCacheKey("category-click-index", [], categoryCode, startDate, endDate, timeUnit, device, gender, ages);
  const cached = getFromCache<CategoryTrendResult>(cacheKey);
  if (cached) return cached;
  try {
    const response = await fetch("https://openapi.naver.com/v1/datalab/shopping/categories", {
      method: "POST",
      headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDate, endDate, timeUnit, category: [{ name, param: [categoryCode] }],
        device: device && device !== "all" ? device : undefined,
        gender: gender && gender !== "all" ? gender : undefined,
        ages: ages?.length ? ages : undefined,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await response.json();
    if (!response.ok) return { success: false, error: payload.message || "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", data: [] };
    const points = trendPoints.safeParse(payload.results?.[0]?.data);
    if (!points.success || !points.data.length) return { success: false, error: "선택한 조건의 클릭 추이 데이터가 없습니다.", data: [] };
    const result = { success: true, data: points.data };
    setInCache(cacheKey, result);
    return result;
  } catch {
    return { success: false, error: "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", data: [] };
  }
}

export const categoryTrendProcedure = naverAnalysisProcedure.input(categoryTrendInput)
  .mutation(({ input }) => fetchNaverCategoryTrend(input));

const catalogResponse = z.object({
  childList: z.array(z.object({
    cid: z.number().int(), pid: z.number().int(), level: z.number().int(), name: z.string().min(1),
    deleted: z.boolean(), svcUse: z.boolean(),
  })),
});
export type CategoryOption = { value: string; label: string };
const categoryCache = new Map<string, { list: CategoryOption[]; expires: number }>();

async function fetchCategoryChildren(input: { parent: string; level: 1 | 2 | 3 }) {
    const key = `${input.parent}:${input.level}`;
    const cached = categoryCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.list;
    const url = new URL("https://datalab.naver.com/shoppingInsight/getCategory.naver");
    url.searchParams.set("cid", input.parent);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Referer: "https://datalab.naver.com/shoppingInsight/sCategory.naver",
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(6_000),
      });
      if (!response.ok) throw new Error("Category request failed");
      const { childList } = catalogResponse.parse(await response.json());
      const list = childList.filter(item => String(item.pid) === input.parent && item.level === input.level && !item.deleted && item.svcUse)
        .map(({ cid, name }) => ({ value: String(cid), label: name }));
      if (categoryCache.size >= 512) categoryCache.clear();
      categoryCache.set(key, { list, expires: Date.now() + 6 * 60 * 60 * 1000 });
      return list;
    } catch {
      if (cached) return cached.list;
      throw new TRPCError({ code: "BAD_GATEWAY", message: "하위 카테고리를 불러오지 못했습니다." });
    }
}

export const shoppingCategoryChildrenProcedure = publicProcedure
  .input(z.object({ parent: z.string().regex(/^(0|\d{8})$/), level: z.union([z.literal(1), z.literal(2), z.literal(3)]) }))
  .query(({ input }) => fetchCategoryChildren(input));

const categoryNameSeparators = new RegExp("[^\\p{L}\\p{N}]", "gu");

function matchingCategory<T extends CategoryOption>(options: T[], keyword: string): T | undefined {
  const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(categoryNameSeparators, "");
  const term = normalize(keyword);
  const scored = options.map(option => ({ option, score: Math.max(0, ...option.label.split("/").map(label => {
    const key = normalize(label);
    return key.length >= 2 && term.includes(key) ? key.length + (key === term ? 100 : 0) : 0;
  })) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  return scored[0]?.score !== scored[1]?.score ? scored[0]?.option : undefined;
}

export async function resolveShoppingCategoryPath(root: string, keyword: string): Promise<CategoryOption[]> {
  const first = { value: root, label: naverShoppingCategories[root as keyof typeof naverShoppingCategories] ?? root };
  const children = await fetchCategoryChildren({ parent: root, level: 2 }).catch(() => []);
  const second = matchingCategory(children, keyword);
  if (second) {
    const leaves = await fetchCategoryChildren({ parent: second.value, level: 3 }).catch(() => []);
    const third = matchingCategory(leaves, keyword);
    return third ? [first, second, third] : [first, second];
  }

  // Avoid fanning out across large categories when the keyword gives no useful parent match.
  if (!children.length || children.length > 8) return [first];
  const groups = await Promise.all(children.map(async parent => {
    const leaves = await fetchCategoryChildren({ parent: parent.value, level: 3 }).catch(() => []);
    return leaves.map(item => ({ ...item, parent }));
  }));
  const third = matchingCategory(groups.flat(), keyword);
  return third ? [first, third.parent, { value: third.value, label: third.label }] : [first];
}
