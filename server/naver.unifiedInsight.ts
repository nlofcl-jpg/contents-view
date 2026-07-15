import { publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { generateCacheKey, getFromCache, setInCache } from "./naver.cache";

const REQUEST_TIMEOUT_MS = 8000; // 8 seconds

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

function generateShoppingKeywordVariants(keyword: string) {
  const normalized = keyword.trim();
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

    // Check cache first
    const cacheKey = generateCacheKey(
      "unified",
      input.keywords,
      requestedCategory,
      input.startDate,
      input.endDate,
      input.timeUnit,
      input.device,
      input.gender,
      input.ages
    );

    const cachedData = getFromCache(cacheKey);
    if (cachedData) {
      console.log('[Naver API] Cache hit for unified insight', {
        cacheKey,
        keywords: input.keywords.length,
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
        keywords: input.keywords,
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
        keywordGroups: input.keywords.map(kw => ({
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
      const primaryShoppingKeyword = input.keywords[0] || "";
      const shoppingKeywordsToTry = input.keywords.length === 1
        ? generateShoppingKeywordVariants(primaryShoppingKeyword)
        : input.keywords;

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
            keywords: input.keywords.length,
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
            keywords: input.keywords.length,
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
          keywords: input.keywords,
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
          keywords: input.keywords,
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
            const resultKey = input.keywords.length === 1 && item.keyword === matchedShoppingKeyword
              ? input.keywords[0]
              : item.keyword;
            shoppingResult[resultKey] = item.data.map((d: any) => ({
              period: d.period,
              ratio: d.ratio,
            }));
          }
        });
      }

      console.log('[Naver API] Unified Insight success', {
        keywords: input.keywords.length,
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
      input.keywords.forEach(keyword => {
        const shoppingData = shoppingResult[keyword];
        // Check if shopping data exists and has valid data points
        if (shoppingData && Array.isArray(shoppingData) && shoppingData.length > 0) {
          shoppingStatus[keyword] = 'AVAILABLE';
        } else {
          shoppingStatus[keyword] = 'NO_DATA';
        }
      });

      console.log('[Naver API] Shopping Status', {
        keywords: input.keywords,
        shoppingStatus,
      });

      const result = {
        success: true,
        keywords: input.keywords,
        trend: trendResult,
        shopping: shoppingResult,
        meta: {
          shoppingStatus,
          matchedShoppingCategory,
          matchedShoppingKeyword,
        },
      };

      // Store in cache for 10 minutes
      setInCache(cacheKey, result);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Connection failed";
      console.error('[Naver API] Unified Insight Exception', {
        error: errorMsg,
        keywords: input.keywords.length,
        category: requestedCategory,
      });
      return {
        success: false,
        error: "통합 인사이트 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        keywords: input.keywords,
        trend: {},
        shopping: {},
      };
    }
  });
