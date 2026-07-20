import { publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { generateCacheKey, getFromCache, setInCache } from "./naver.cache";
import { ENV } from "./_core/env";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";

const REQUEST_TIMEOUT_MS = 8000; // 8 seconds
const NAVER_SEARCH_AD_PROVIDER = "naver-search-ad";
const NAVER_SEARCH_MAX_START = 901;

const AUTO_SHOPPING_CATEGORIES = [
  "50000000", // 패션의류
  "50000001", // 패션잡화
  "50000002", // 화장품/미용
  "50000003", // 디지털/가전
  "50000004", // 가구/인테리어
  "50000005", // 식품
  "50000006", // 스포츠/레저
  "50000007", // 생활/건강
  "50000008", // 출산/육아
  "50000009", // 도서/음반/DVD
];

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
}

function normalizeKeywordInput(keyword: string) {
  return keyword.trim().replace(/\s+/g, " ");
}

function generateShoppingKeywordVariants(keyword: string) {
  const normalized = normalizeKeywordInput(keyword);
  const noSpace = normalized.replace(/\s+/g, "");
  const spaced = normalized.replace(/\s+/g, " ");
  const variants = [normalized, noSpace, spaced];

  if (/여성|여자/.test(noSpace)) {
    variants.push(
      noSpace.replace(/여성/g, "여자"),
      noSpace.replace(/여자/g, "여성"),
      noSpace.replace(/여성|여자/g, ""),
      noSpace.replace(/^(여성|여자)/, "$1 "),
      spaced.replace(/여성/g, "여자"),
      spaced.replace(/여자/g, "여성")
    );
  }

  if (/남성|남자/.test(noSpace)) {
    variants.push(
      noSpace.replace(/남성/g, "남자"),
      noSpace.replace(/남자/g, "남성"),
      noSpace.replace(/남성|남자/g, ""),
      noSpace.replace(/^(남성|남자)/, "$1 "),
      spaced.replace(/남성/g, "남자"),
      spaced.replace(/남자/g, "남성")
    );
  }

  if (/아이폰|iphone/i.test(noSpace) && /케이스/.test(noSpace)) {
    variants.push(
      "아이폰케이스",
      "아이폰 케이스",
      "폰케이스",
      "폰 케이스",
      "휴대폰케이스",
      "휴대폰 케이스",
      "핸드폰케이스",
      "핸드폰 케이스",
      "스마트폰케이스",
      "스마트폰 케이스"
    );
  }

  return uniqueValues(variants).slice(0, 20);
}

function generateKeywordToolVariants(keyword: string) {
  const normalized = normalizeKeywordInput(keyword);
  const noSpace = normalized.replace(/\s+/g, "");
  const variants = [noSpace];

  if (/여성|여자/.test(noSpace)) {
    variants.push(
      noSpace.replace(/여성/g, "여자"),
      noSpace.replace(/여자/g, "여성")
    );
  }

  if (/남성|남자/.test(noSpace)) {
    variants.push(
      noSpace.replace(/남성/g, "남자"),
      noSpace.replace(/남자/g, "남성")
    );
  }

  return uniqueValues(variants).slice(0, 8);
}

function getShoppingDataPointCount(shoppingData: any) {
  return (shoppingData.results || []).reduce(
    (sum: number, item: any) => sum + (Array.isArray(item.data) ? item.data.length : 0),
    0
  );
}

function getMatchedShoppingKeyword(shoppingData: any, fallbackKeyword: string) {
  const matched = (shoppingData.results || []).find(
    (item: any) => Array.isArray(item.data) && item.data.length > 0
  );

  return matched?.keyword || matched?.title || fallbackKeyword;
}

type NaverSearchAdCredentials = {
  customerId: string;
  accessLicense: string;
  secretKey: string;
};

type KeywordMetric = {
  keyword: string;
  monthlyPcSearches: number | null;
  monthlyMobileSearches: number | null;
  monthlyTotalSearches: number | null;
  monthlyPcClicks: number | null;
  monthlyMobileClicks: number | null;
  monthlyTotalClicks: number | null;
  competition: string | null;
  averageAdDepth: number | null;
  similarity: number | null;
};

type ShoppingCompetition = {
  productCount: number | null;
  averagePrice: number | null;
  monthlySearches: number | null;
  competitionRatio: number | null;
  strength: "낮음" | "보통" | "높음" | "포화" | null;
  error?: string | null;
};

type ShoppingRelatedKeyword = {
  keyword: string;
  monthlySearches: number | null;
  productCount: number | null;
  averagePrice: number | null;
  competitionRatio: number | null;
  strength: "낮음" | "보통" | "높음" | "포화" | null;
};

const supabaseAdmin =
  ENV.supabaseUrl && ENV.supabaseServiceRoleKey
    ? createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

function parseNaverSearchAdCredentials(value: string): NaverSearchAdCredentials | null {
  try {
    const parsed = JSON.parse(value) as Partial<NaverSearchAdCredentials>;
    if (!parsed.customerId || !parsed.accessLicense || !parsed.secretKey) {
      return null;
    }

    return {
      customerId: String(parsed.customerId).trim(),
      accessLicense: String(parsed.accessLicense).trim(),
      secretKey: String(parsed.secretKey).trim(),
    };
  } catch {
    return null;
  }
}

async function getStoredNaverSearchAdCredentials() {
  if (!supabaseAdmin) return null;

  const { data: successData, error: successError } = await supabaseAdmin
    .from("user_api_keys")
    .select("encrypted_key")
    .eq("provider", NAVER_SEARCH_AD_PROVIDER)
    .eq("test_status", "success")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (successError) {
    console.error("[Naver SearchAd] Failed to load verified credentials", {
      error: successError.message,
    });
  }

  if (successData?.encrypted_key) {
    return parseNaverSearchAdCredentials(successData.encrypted_key);
  }

  const { data, error } = await supabaseAdmin
    .from("user_api_keys")
    .select("encrypted_key")
    .eq("provider", NAVER_SEARCH_AD_PROVIDER)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Naver SearchAd] Failed to load credentials", {
      error: error.message,
    });
    return null;
  }

  return data?.encrypted_key ? parseNaverSearchAdCredentials(data.encrypted_key) : null;
}

function getNaverSearchAdSignature(timestamp: string, method: string, uri: string, secretKey: string) {
  return createHmac("sha256", secretKey)
    .update(`${timestamp}.${method}.${uri}`)
    .digest("base64");
}

async function requestNaverSearchAdKeywordTool(credentials: NaverSearchAdCredentials, keyword: string) {
  const method = "GET";
  const uri = "/keywordstool";
  const timestamp = Date.now().toString();
  const hintKeyword = keyword.replace(/\s+/g, "").trim();
  const params = new URLSearchParams({
    hintKeywords: hintKeyword,
    showDetail: "1",
  });

  const response = await fetchWithTimeout(
    `https://api.searchad.naver.com${uri}?${params.toString()}`,
    {
      method,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Timestamp": timestamp,
        "X-API-KEY": credentials.accessLicense,
        "X-Customer": credentials.customerId,
        "X-Signature": getNaverSearchAdSignature(timestamp, method, uri, credentials.secretKey),
      },
    },
    REQUEST_TIMEOUT_MS
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.title || data?.detail || data?.message || `HTTP ${response.status}`;
    throw new Error(`Keyword Tool API failed: ${message}`);
  }

  return data;
}

function normalizeSearchCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("<")) return 0;
  const numeric = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeClickCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const numeric = Number(value.trim().replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeKeywordMetric(item: any): KeywordMetric | null {
  const keyword = String(item?.relKeyword || "").trim();
  if (!keyword) return null;

  const monthlyPcSearches = normalizeSearchCount(item.monthlyPcQcCnt);
  const monthlyMobileSearches = normalizeSearchCount(item.monthlyMobileQcCnt);
  const monthlyTotalSearches =
    monthlyPcSearches === null && monthlyMobileSearches === null
      ? null
      : (monthlyPcSearches || 0) + (monthlyMobileSearches || 0);
  const monthlyPcClicks = normalizeClickCount(item.monthlyAvePcClkCnt);
  const monthlyMobileClicks = normalizeClickCount(item.monthlyAveMobileClkCnt);
  const monthlyTotalClicks =
    monthlyPcClicks === null && monthlyMobileClicks === null
      ? null
      : (monthlyPcClicks || 0) + (monthlyMobileClicks || 0);
  const averageAdDepth = normalizeClickCount(item.plAvgDepth);

  return {
    keyword,
    monthlyPcSearches,
    monthlyMobileSearches,
    monthlyTotalSearches,
    monthlyPcClicks,
    monthlyMobileClicks,
    monthlyTotalClicks,
    competition: item.compIdx ? String(item.compIdx) : null,
    averageAdDepth,
    similarity: null,
  };
}

function mergeKeywordToolLists(keywordLists: any[][]) {
  const merged = new Map<string, any>();

  for (const keywordList of keywordLists) {
    for (const item of keywordList) {
      const keyword = String(item?.relKeyword || "").trim();
      if (!keyword) continue;

      const key = normalizeKeywordText(keyword);
      if (!merged.has(key)) {
        merged.set(key, item);
      }
    }
  }

  return Array.from(merged.values());
}

function normalizeKeywordText(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function getLevenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function getKeywordSimilarityScore(baseKeyword: string, candidateKeyword: string) {
  const base = normalizeKeywordText(baseKeyword);
  const candidate = normalizeKeywordText(candidateKeyword);
  if (!base || !candidate) return Number.MAX_SAFE_INTEGER;
  if (candidate === base) return 0;
  if (candidate.startsWith(base)) return 1 + Math.abs(candidate.length - base.length) / 100;
  if (base.startsWith(candidate)) return 2 + Math.abs(candidate.length - base.length) / 100;
  if (candidate.includes(base)) return 3 + Math.abs(candidate.length - base.length) / 100;
  if (base.includes(candidate)) return 4 + Math.abs(candidate.length - base.length) / 100;

  const distance = getLevenshteinDistance(base, candidate);
  const lengthPenalty = Math.abs(candidate.length - base.length) / Math.max(base.length, 1);
  return 5 + distance + lengthPenalty;
}

function getKeywordSimilarityPercent(baseKeyword: string, candidateKeyword: string) {
  const base = normalizeKeywordText(baseKeyword);
  const candidate = normalizeKeywordText(candidateKeyword);
  if (!base || !candidate) return null;
  if (candidate === base) return 100;
  if (candidate.startsWith(base)) return Math.max(92, 100 - Math.abs(candidate.length - base.length) * 2);
  if (candidate.includes(base)) return Math.max(82, 94 - Math.abs(candidate.length - base.length) * 2);

  const distance = getLevenshteinDistance(base, candidate);
  const maxLength = Math.max(base.length, candidate.length, 1);
  return Math.max(0, Math.round((1 - distance / maxLength) * 100));
}

function buildKeywordToolSummary(keyword: string, keywordList: any[]): {
  primary: KeywordMetric | null;
  recommended: KeywordMetric[];
  related: KeywordMetric[];
} {
  const metrics = keywordList
    .map(normalizeKeywordMetric)
    .filter((item): item is KeywordMetric => Boolean(item))
    .map(item => ({
      ...item,
      similarity: getKeywordSimilarityPercent(keyword, item.keyword),
    }));
  const normalizedKeyword = normalizeKeywordText(keyword);
  const exact = metrics.find(
    item => normalizeKeywordText(item.keyword) === normalizedKeyword
  );
  const primary = exact || metrics[0] || null;
  const bySimilarity = [...metrics].sort((a, b) => {
    const similarityDelta = getKeywordSimilarityScore(keyword, a.keyword) - getKeywordSimilarityScore(keyword, b.keyword);
    if (similarityDelta !== 0) return similarityDelta;
    return (b.monthlyTotalSearches || 0) - (a.monthlyTotalSearches || 0);
  });

  return {
    primary,
    recommended: bySimilarity.slice(0, 10),
    related: bySimilarity.slice(0, 80),
  };
}

function parseNaverDateValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  if (/^\d{8}$/.test(value)) {
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6));
    const day = Number(value.slice(6, 8));
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function fetchRecentNaverContentCount(input: {
  keyword: string;
  endpoint: string;
  dateField: "postdate" | "pubDate";
  clientId: string;
  clientSecret: string;
  since: Date;
}) {
  let count = 0;
  let checked = 0;
  let capped = false;
  let totalDocuments: number | null = null;

  for (let start = 1; start <= NAVER_SEARCH_MAX_START; start += 100) {
    const params = new URLSearchParams({
      query: input.keyword,
      display: "100",
      start: String(start),
      sort: "date",
    });
    const response = await fetchWithTimeout(
      `${input.endpoint}?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "X-Naver-Client-Id": input.clientId,
          "X-Naver-Client-Secret": input.clientSecret,
        },
      },
      REQUEST_TIMEOUT_MS
    );
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`${input.endpoint}: ${data?.errorMessage || response.status}`);
    }
    if (typeof data?.total === "number" && totalDocuments === null) {
      totalDocuments = data.total;
    }

    const items = Array.isArray(data?.items) ? data.items : [];
    if (items.length === 0) break;

    let reachedOlderItem = false;
    for (const item of items) {
      const publishedAt = parseNaverDateValue(item?.[input.dateField]);
      if (!publishedAt) continue;
      checked += 1;

      if (publishedAt >= input.since) {
        count += 1;
      } else {
        reachedOlderItem = true;
      }
    }

    if (reachedOlderItem || items.length < 100) {
      break;
    }

    if (start === NAVER_SEARCH_MAX_START) {
      capped = true;
    }
  }

  return { count, checked, capped, totalDocuments };
}

function getShoppingCompetitionStrength(ratio: number | null): ShoppingCompetition["strength"] {
  if (ratio === null || Number.isNaN(ratio)) return null;
  if (ratio < 0.5) return "낮음";
  if (ratio < 2) return "보통";
  if (ratio < 8) return "높음";
  return "포화";
}

async function fetchNaverShoppingSummary(input: {
  keyword: string;
  clientId: string;
  clientSecret: string;
}) {
  const params = new URLSearchParams({
    query: input.keyword,
    display: "100",
    start: "1",
    sort: "sim",
  });

  const response = await fetchWithTimeout(
    `https://openapi.naver.com/v1/search/shop.json?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "X-Naver-Client-Id": input.clientId,
        "X-Naver-Client-Secret": input.clientSecret,
      },
    },
    REQUEST_TIMEOUT_MS
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.errorMessage || `HTTP ${response.status}`);
  }

  const prices = Array.isArray(data?.items)
    ? data.items
        .map((item: any) => Number(String(item?.lprice || "").replace(/,/g, "")))
        .filter((price: number) => Number.isFinite(price) && price > 0)
    : [];
  const averagePrice =
    prices.length > 0
      ? prices.reduce((sum: number, price: number) => sum + price, 0) / prices.length
      : null;

  return {
    productCount: typeof data?.total === "number" ? data.total : null,
    averagePrice,
  };
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export const unifiedInsightProcedure = publicProcedure
  .input(z.object({
    keywords: z.array(z.string()).min(0).max(5),
    category: z.string().optional(),
    startDate: z.string(),
    endDate: z.string(),
    timeUnit: z.enum(["date", "week", "month"]),
    device: z.string().optional(),
    gender: z.string().optional(),
    ages: z.array(z.string()).optional(),
  }))
  .mutation(async ({ input }) => {
    const requestedCategory = input.category || "auto";
    const normalizedKeywords = uniqueValues(input.keywords.map(normalizeKeywordInput)).slice(0, 5);

    // Check cache first
    const cacheKey = generateCacheKey(
      "unified",
      normalizedKeywords,
      requestedCategory,
      input.startDate,
      input.endDate,
      input.timeUnit,
      input.device,
      input.gender,
      input.ages
    );

    const cachedData = getFromCache(cacheKey);
    if ((cachedData as any)?.meta?.keywordTool && (cachedData as any)?.meta?.shoppingCompetition) {
      console.log('[Naver API] Cache hit for unified insight', {
        cacheKey,
        keywords: normalizedKeywords.length,
        category: requestedCategory,
      });
      return cachedData;
    }

    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[Naver API] Credentials not configured');
      return {
        success: false,
        error: "통합 인사이트 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        keywords: normalizedKeywords,
        trend: {},
        shopping: {},
      };
    }

    try {
      // Logging for diagnosis
      console.log('[Server] Input dates:', {
        startDate: input.startDate,
        endDate: input.endDate,
        timeUnit: input.timeUnit,
      });

      // Build search trend request body
      const trendRequestBody: any = {
        startDate: input.startDate,
        endDate: input.endDate,
        timeUnit: input.timeUnit,
        keywordGroups: normalizedKeywords.map(kw => ({
          groupName: kw,
          keywords: [kw],
        })),
      };

      // Add optional device filter
      if (input.device && input.device !== "") {
        trendRequestBody.device = input.device === "PC" ? "pc" : input.device === "모바일" ? "mo" : "";
        if (!trendRequestBody.device) delete trendRequestBody.device;
      }

      // Add optional gender filter
      if (input.gender && input.gender !== "") {
        trendRequestBody.gender = input.gender === "남성" ? "m" : input.gender === "여성" ? "f" : "";
        if (!trendRequestBody.gender) delete trendRequestBody.gender;
      }

      // Add optional age filter
      if (input.ages && input.ages.length > 0) {
        trendRequestBody.ages = input.ages;
      }

      // Parallel API calls with allSettled to handle individual failures
      const trendStartTime = Date.now();
      const shoppingStartTime = Date.now();
      const primaryShoppingKeyword = normalizedKeywords[0] || "";
      const shoppingKeywordsToTry = normalizedKeywords.length === 1
        ? generateShoppingKeywordVariants(primaryShoppingKeyword)
        : normalizedKeywords;

      const fetchShoppingTrend = async (category: string, shoppingKeywords: string[]) => {
        const shoppingRequestBody: any = {
          startDate: input.startDate,
          endDate: input.endDate,
          timeUnit: input.timeUnit,
          category,
          keyword: shoppingKeywords.map(kw => ({
            name: kw,
            param: [kw],
          })),
        };

        if (input.device && input.device !== "") {
          shoppingRequestBody.device = input.device === "PC" ? "pc" : input.device === "모바일" ? "mo" : "";
          if (!shoppingRequestBody.device) delete shoppingRequestBody.device;
        }

        if (input.gender && input.gender !== "") {
          shoppingRequestBody.gender = input.gender === "남성" ? "m" : input.gender === "여성" ? "f" : "";
          if (!shoppingRequestBody.gender) delete shoppingRequestBody.gender;
        }

        if (input.ages && input.ages.length > 0) {
          shoppingRequestBody.ages = input.ages;
        }

        const response = await fetchWithTimeout(
          "https://openapi.naver.com/v1/datalab/shopping/category/keywords",
          {
            method: "POST",
            headers: {
              "X-Naver-Client-Id": clientId,
              "X-Naver-Client-Secret": clientSecret,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(shoppingRequestBody),
          },
          REQUEST_TIMEOUT_MS
        );

        const shoppingData = await response.json();

        if (!response.ok) {
          throw new Error(`Shopping Trend API failed: ${response.status} - ${shoppingData.errorMessage}`);
        }

        return { category, data: shoppingData };
      };

      const hasShoppingData = (shoppingData: any) => {
        return getShoppingDataPointCount(shoppingData) > 0;
      };

      const [trendSettled, shoppingSettled] = await Promise.allSettled([
        (async () => {
          console.log('[Naver API] Search Trend API - Request started', {
            timestamp: new Date().toISOString(),
            keywords: normalizedKeywords.length,
            startDate: input.startDate,
            endDate: input.endDate,
            timeUnit: input.timeUnit,
          });

          const response = await fetchWithTimeout(
            "https://openapi.naver.com/v1/datalab/search",
            {
              method: "POST",
              headers: {
                "X-Naver-Client-Id": clientId,
                "X-Naver-Client-Secret": clientSecret,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(trendRequestBody),
            },
            REQUEST_TIMEOUT_MS
          );

          const trendEndTime = Date.now();
          const trendResponseTime = trendEndTime - trendStartTime;

          const trendData = await response.json();

          if (!response.ok) {
            console.error('[Naver API] Search Trend API - Failed', {
              timestamp: new Date().toISOString(),
              statusCode: response.status,
              responseTime: trendResponseTime,
              errorCode: trendData.errorCode,
              errorMessage: trendData.errorMessage,
            });
            throw new Error(`Search Trend API failed: ${response.status} - ${trendData.errorMessage}`);
          }

          console.log('[Naver API] Search Trend API - Success', {
            timestamp: new Date().toISOString(),
            statusCode: response.status,
            responseTime: trendResponseTime,
            resultCount: trendData.results?.length || 0,
            dataPointCount: (trendData.results || []).reduce((sum: number, item: any) => sum + (item.data?.length || 0), 0),
          });

          // Detailed logging for debugging
          console.log('[Naver API] Search Trend API - Response Details', {
            topLevelKeys: Object.keys(trendData),
            resultsExists: !!trendData.results,
            resultsLength: trendData.results?.length,
            firstResult: trendData.results?.[0] ? {
              keys: Object.keys(trendData.results[0]),
              title: trendData.results[0].title,
              keyword: trendData.results[0].keyword,
              keywords: trendData.results[0].keywords,
              dataLength: trendData.results[0].data?.length,
              firstData: trendData.results[0].data?.[0],
              lastData: trendData.results[0].data?.[trendData.results[0].data.length - 1],
            } : 'N/A',
          });

          return trendData;
        })(),
        (async () => {
          console.log('[Naver API] Shopping Trend API - Request started', {
            timestamp: new Date().toISOString(),
            keywords: normalizedKeywords.length,
            category: requestedCategory,
            startDate: input.startDate,
            endDate: input.endDate,
            timeUnit: input.timeUnit,
            keywordVariants: shoppingKeywordsToTry,
          });

          const categoriesToTry = requestedCategory === "auto" ? AUTO_SHOPPING_CATEGORIES : [requestedCategory];
          let bestResult: { category: string; data: any; matchedKeyword: string; pointCount: number } | null = null;
          let lastResult: { category: string; data: any; matchedKeyword: string; pointCount: number } | null = null;

          for (const category of categoriesToTry) {
            try {
              const result = await fetchShoppingTrend(category, shoppingKeywordsToTry);
              const pointCount = getShoppingDataPointCount(result.data);
              const matchedKeyword = getMatchedShoppingKeyword(result.data, primaryShoppingKeyword);
              lastResult = { ...result, matchedKeyword, pointCount };

              if (hasShoppingData(result.data)) {
                bestResult = { ...result, matchedKeyword, pointCount };
                break;
              }
            } catch (error) {
              console.error('[Naver API] Shopping Trend API - Category failed', {
                category,
                error: error instanceof Error ? error.message : "Unknown error",
              });
            }
          }

          const resolvedResult = bestResult || lastResult;

          if (!resolvedResult) {
            throw new Error("Shopping Trend API failed for all categories");
          }

          const shoppingEndTime = Date.now();
          const shoppingResponseTime = shoppingEndTime - shoppingStartTime;

          console.log('[Naver API] Shopping Trend API - Success', {
            timestamp: new Date().toISOString(),
            category: resolvedResult.category,
            matchedKeyword: resolvedResult.matchedKeyword,
            autoMatched: requestedCategory === "auto",
            responseTime: shoppingResponseTime,
            resultCount: resolvedResult.data.results?.length || 0,
            dataPointCount: resolvedResult.pointCount,
          });

          return resolvedResult;
        })(),
      ]);

      const keywordToolSettled = await Promise.allSettled([
        (async () => {
          const primaryKeyword = normalizedKeywords[0];
          if (!primaryKeyword) {
            return null;
          }

          const credentials = await getStoredNaverSearchAdCredentials();
          if (!credentials) {
            return {
              success: false,
              error: "네이버 검색광고 API 키가 아직 연결되지 않았습니다.",
              primary: null,
              recommended: [],
              related: [],
            };
          }

          const keywordToolVariants = generateKeywordToolVariants(primaryKeyword);
          const keywordToolResults: any[][] = [];

          for (let index = 0; index < keywordToolVariants.length; index += 2) {
            const batch = keywordToolVariants.slice(index, index + 2);
            const batchResults = await Promise.allSettled(
              batch.map(keyword => requestNaverSearchAdKeywordTool(credentials, keyword))
            );

            batchResults.forEach((result, resultIndex) => {
              const variant = batch[resultIndex];
              if (result.status === "fulfilled") {
                keywordToolResults.push(result.value?.keywordList || []);
              } else {
                console.error("[Naver SearchAd] Keyword tool variant failed", {
                  keyword: variant,
                  error: result.reason instanceof Error ? result.reason.message : "Unknown error",
                });
              }
            });
          }

          const mergedKeywordList = mergeKeywordToolLists(keywordToolResults);
          const summary = buildKeywordToolSummary(primaryKeyword, mergedKeywordList);
          const hasKeywordData = Boolean(summary.primary || summary.recommended.length > 0 || summary.related.length > 0);

          return {
            success: hasKeywordData,
            error: hasKeywordData ? null : "검색광고 키워드 데이터를 찾지 못했습니다.",
            variants: keywordToolVariants,
            ...summary,
          };
        })(),
        (async () => {
          const primaryKeyword = normalizedKeywords[0];
          if (!primaryKeyword || !clientId || !clientSecret) {
            return {
              productCount: null,
              averagePrice: null,
              monthlySearches: null,
              competitionRatio: null,
              strength: null,
            } satisfies ShoppingCompetition;
          }

          try {
            const shoppingSummary = await fetchNaverShoppingSummary({
              keyword: primaryKeyword,
              clientId,
              clientSecret,
            });

            return {
              productCount: shoppingSummary.productCount,
              averagePrice: shoppingSummary.averagePrice,
              monthlySearches: null,
              competitionRatio: null,
              strength: null,
            } satisfies ShoppingCompetition;
          } catch (error) {
            const message = error instanceof Error ? error.message : "쇼핑 상품 수를 불러오지 못했습니다.";
            console.error("[Naver Shopping] Product count failed", {
              keyword: primaryKeyword,
              error: message,
            });

            return {
              productCount: null,
              averagePrice: null,
              monthlySearches: null,
              competitionRatio: null,
              strength: null,
              error: message,
            } satisfies ShoppingCompetition;
          }
        })(),
        (async () => {
          const primaryKeyword = normalizedKeywords[0];
          if (!primaryKeyword || !clientId || !clientSecret) {
            return null;
          }

          const since = new Date();
          since.setDate(since.getDate() - 30);

          const endpoints = [
            {
              key: "blog",
              label: "블로그",
              url: "https://openapi.naver.com/v1/search/blog.json",
              dateField: "postdate" as const,
            },
            {
              key: "news",
              label: "뉴스",
              url: "https://openapi.naver.com/v1/search/news.json",
              dateField: "pubDate" as const,
            },
          ];

          const settled = await Promise.allSettled(
            endpoints.map(async endpoint => {
              const recent = await fetchRecentNaverContentCount({
                keyword: primaryKeyword,
                endpoint: endpoint.url,
                dateField: endpoint.dateField,
                clientId,
                clientSecret,
                since,
              });

              return {
                key: endpoint.key,
                label: endpoint.label,
                total: recent.count,
                totalDocuments: recent.totalDocuments,
                checked: recent.checked,
                capped: recent.capped,
              };
            })
          );

          const sources = settled.map((result, index) => {
            if (result.status === "fulfilled") return result.value;
            return {
              key: endpoints[index].key,
              label: endpoints[index].label,
              total: null,
              totalDocuments: null,
              checked: 0,
              capped: false,
            };
          });
          const total = sources.reduce((sum, source) => sum + (source.total || 0), 0);

          return {
            sources,
            total,
            periodDays: 30,
            isEstimated: sources.some(source => source.capped),
          };
        })(),
      ]);

      const keywordTool =
        keywordToolSettled[0].status === "fulfilled" ? keywordToolSettled[0].value : {
          success: false,
          error: keywordToolSettled[0].reason?.message || "네이버 검색광고 키워드 데이터를 불러오지 못했습니다.",
          primary: null,
          recommended: [],
          related: [],
        };
      const contentVolume =
        keywordToolSettled[2].status === "fulfilled" ? keywordToolSettled[2].value : {
          sources: [],
          total: null,
        };
      const rawShoppingCompetition =
        keywordToolSettled[1].status === "fulfilled" ? keywordToolSettled[1].value : {
          productCount: null,
          averagePrice: null,
          monthlySearches: null,
          competitionRatio: null,
          strength: null,
          error: keywordToolSettled[1].reason?.message || "쇼핑 경쟁도 데이터를 불러오지 못했습니다.",
        };
      const shoppingMonthlySearches = keywordTool?.primary?.monthlyTotalSearches ?? null;
      const shoppingCompetitionRatio =
        rawShoppingCompetition.productCount !== null &&
        rawShoppingCompetition.productCount !== undefined &&
        shoppingMonthlySearches
          ? rawShoppingCompetition.productCount / shoppingMonthlySearches
          : null;
      const shoppingCompetition: ShoppingCompetition = {
        ...rawShoppingCompetition,
        monthlySearches: shoppingMonthlySearches,
        competitionRatio: shoppingCompetitionRatio,
        strength: getShoppingCompetitionStrength(shoppingCompetitionRatio),
      };
      const shoppingRelatedKeywords: ShoppingRelatedKeyword[] = [];
      if (clientId && clientSecret && Array.isArray(keywordTool?.related)) {
        const primaryKeywordKey = normalizeKeywordText(normalizedKeywords[0] || "");
        const candidates = keywordTool.related
          .filter((item: KeywordMetric) => normalizeKeywordText(item.keyword) !== primaryKeywordKey)
          .slice(0, 12);
        const settled = await Promise.allSettled(
          candidates.map(async (item: KeywordMetric) => {
            const summary = await fetchNaverShoppingSummary({
              keyword: item.keyword,
              clientId,
              clientSecret,
            });
            const monthlySearches = item.monthlyTotalSearches;
            const competitionRatio =
              summary.productCount !== null &&
              summary.productCount !== undefined &&
              monthlySearches
                ? summary.productCount / monthlySearches
                : null;

            return {
              keyword: item.keyword,
              monthlySearches,
              productCount: summary.productCount,
              averagePrice: summary.averagePrice,
              competitionRatio,
              strength: getShoppingCompetitionStrength(competitionRatio),
            } satisfies ShoppingRelatedKeyword;
          })
        );

        settled.forEach((result) => {
          if (result.status === "fulfilled" && result.value.productCount && result.value.productCount > 0) {
            shoppingRelatedKeywords.push(result.value);
          }
        });
        shoppingRelatedKeywords.sort((a, b) => (b.monthlySearches || 0) - (a.monthlySearches || 0));
      }

      // Check if both APIs succeeded
      const trendSuccess = trendSettled.status === "fulfilled";
      const shoppingSuccess = shoppingSettled.status === "fulfilled";

      if (!trendSuccess && !shoppingSuccess) {
        console.error('[Naver API] Both APIs failed', {
          trendError: trendSettled.status === "rejected" ? trendSettled.reason?.message : "N/A",
          shoppingError: shoppingSettled.status === "rejected" ? shoppingSettled.reason?.message : "N/A",
        });
        return {
          success: false,
          error: "통합 인사이트 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
          keywords: normalizedKeywords,
          trend: {},
          shopping: {},
        };
      }

      if (!trendSuccess) {
        console.error('[Naver API] Search Trend API failed', {
          error: trendSettled.reason?.message,
        });
        return {
          success: false,
          error: "검색 트렌드 데이터를 불러오지 못했습니다.",
          keywords: normalizedKeywords,
          trend: {},
          shopping: {},
        };
      }

      if (!shoppingSuccess) {
        console.error('[Naver API] Shopping Trend API failed', {
          error: shoppingSettled.reason?.message,
        });
      }

      // Transform trend data
      const trendData = trendSettled.value;
      const trendResult: Record<string, Array<{ period: string; ratio: number }>> = {};
      if (trendData.results && Array.isArray(trendData.results)) {
        trendData.results.forEach((item: any) => {
          // Use title as the key (groupName from request)
          const keyName = item.title || item.keyword;
          if (keyName && item.data) {
            trendResult[keyName] = item.data.map((d: any) => ({
              period: d.period,
              ratio: d.ratio,
            }));
          }
        });
      }

      console.log('[Naver API] Trend Data Transform', {
        resultsCount: trendData.results?.length,
        trendResultKeys: Object.keys(trendResult),
        trendResultSample: Object.entries(trendResult).map(([key, data]) => ({
          key,
          dataLength: data.length,
          firstPeriod: data[0]?.period,
          lastPeriod: data[data.length - 1]?.period,
          last3Periods: data.slice(-3).map(d => d.period),
        })),
      });

      // Transform shopping data
      const shoppingData = shoppingSuccess ? shoppingSettled.value.data : { results: [] };
      const matchedShoppingCategory = shoppingSuccess ? shoppingSettled.value.category : null;
      const matchedShoppingKeyword = shoppingSuccess ? shoppingSettled.value.matchedKeyword : null;
      const shoppingResult: Record<string, Array<{ period: string; ratio: number }>> = {};
      if (shoppingData.results && Array.isArray(shoppingData.results)) {
        shoppingData.results.forEach((item: any) => {
          if (item.keyword && item.data) {
            const resultKey = normalizedKeywords.length === 1 && item.keyword === matchedShoppingKeyword
              ? normalizedKeywords[0]
              : item.keyword;
            shoppingResult[resultKey] = item.data.map((d: any) => ({
              period: d.period,
              ratio: d.ratio,
            }));
          }
        });
      }

      console.log('[Naver API] Unified Insight success', {
        keywords: normalizedKeywords.length,
        category: requestedCategory,
        matchedShoppingCategory,
        matchedShoppingKeyword,
        trendKeywords: Object.keys(trendResult).length,
        shoppingKeywords: Object.keys(shoppingResult).length,
        trendDataPoints: Object.values(trendResult).reduce((sum, arr) => sum + arr.length, 0),
        shoppingDataPoints: Object.values(shoppingResult).reduce((sum, arr) => sum + arr.length, 0),
      });

      // Determine shopping data status for each keyword
      const shoppingStatus: Record<string, 'AVAILABLE' | 'NO_DATA'> = {};
      normalizedKeywords.forEach(keyword => {
        const shoppingData = shoppingResult[keyword];
        // Check if shopping data exists and has valid data points
        if (shoppingData && Array.isArray(shoppingData) && shoppingData.length > 0) {
          shoppingStatus[keyword] = 'AVAILABLE';
        } else {
          shoppingStatus[keyword] = 'NO_DATA';
        }
      });

      console.log('[Naver API] Shopping Status', {
        keywords: normalizedKeywords,
        shoppingStatus,
      });

      const result = {
        success: true,
        keywords: normalizedKeywords,
        trend: trendResult,
        shopping: shoppingResult,
        meta: {
          shoppingStatus,
          matchedShoppingCategory,
          matchedShoppingKeyword,
          keywordTool,
          contentVolume,
          shoppingCompetition,
          shoppingRelatedKeywords: shoppingRelatedKeywords.slice(0, 10),
        },
      };

      // Store in cache for 10 minutes
      setInCache(cacheKey, result);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Connection failed";
      console.error('[Naver API] Unified Insight Exception', {
        error: errorMsg,
        keywords: normalizedKeywords.length,
        category: requestedCategory,
      });
      return {
        success: false,
        error: "통합 인사이트 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        keywords: normalizedKeywords,
        trend: {},
        shopping: {},
      };
    }
  });
