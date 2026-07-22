import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, approvedProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { unifiedInsightProcedure } from "./naver.unifiedInsight";
import { runDiagnostics } from "./naver.diagnostic";
import * as userApiKeys from "./_core/userApiKeys";
import * as cheerio from "cheerio";
import { ENV } from "./_core/env";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";
import { createHmac } from "crypto";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";

const require = createRequire(import.meta.url);

const NAVER_SEARCH_AD_PROVIDER = "naver-search-ad";
const BLOG_ANALYSIS_POST_LIMIT = 6;
const BLOG_RANK_SEARCH_LIMIT = 100;

const supabaseAdminForNaverKeys =
  ENV.supabaseUrl && ENV.supabaseServiceRoleKey
    ? createClient(ENV.supabaseUrl, ENV.supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

type NaverSearchAdCredentials = {
  customerId: string;
  accessLicense: string;
  secretKey: string;
};

function parseNaverSearchAdCredentials(value: string): NaverSearchAdCredentials | null {
  try {
    const parsed = JSON.parse(value) as Partial<NaverSearchAdCredentials>;
    if (!parsed.customerId || !parsed.accessLicense || !parsed.secretKey) {
      return null;
    }

    return {
      customerId: String(parsed.customerId),
      accessLicense: String(parsed.accessLicense),
      secretKey: String(parsed.secretKey),
    };
  } catch {
    return null;
  }
}

function maskNaverSearchAdCredentials(credentials: NaverSearchAdCredentials) {
  return {
    customerId: userApiKeys.maskApiKey(credentials.customerId),
    accessLicense: userApiKeys.maskApiKey(credentials.accessLicense),
    secretKey: userApiKeys.maskApiKey(credentials.secretKey),
  };
}

function getNaverSearchAdSignature(timestamp: string, method: string, uri: string, secretKey: string) {
  return createHmac("sha256", secretKey)
    .update(`${timestamp}.${method}.${uri}`)
    .digest("base64");
}

function getNaverSearchAdHeaders(credentials: NaverSearchAdCredentials, method: string, uri: string) {
  const timestamp = Date.now().toString();

  return {
    "Content-Type": "application/json; charset=UTF-8",
    "X-Timestamp": timestamp,
    "X-API-KEY": credentials.accessLicense,
    "X-Customer": credentials.customerId,
    "X-Signature": getNaverSearchAdSignature(timestamp, method, uri, credentials.secretKey),
  };
}

async function requestNaverSearchAdApi(
  credentials: NaverSearchAdCredentials,
  uri: string,
  params?: URLSearchParams,
) {
  const method = "GET";
  const query = params ? `?${params.toString()}` : "";
  const response = await fetch(`https://api.searchad.naver.com${uri}${query}`, {
    method,
    headers: getNaverSearchAdHeaders(credentials, method, uri),
  });
  const data = await response.json().catch(() => null);

  return { response, data };
}

function getNaverSearchAdErrorMessage(data: any, status: number) {
  return (
    data?.title ||
    data?.detail ||
    data?.message ||
    `네이버 검색광고 API 연결 실패 (${status})`
  );
}

function normalizeNaverSearchAdInput(input: {
  customerId: string;
  accessLicense: string;
  secretKey: string;
}) {
  return {
    customerId: input.customerId.trim(),
    accessLicense: input.accessLicense.trim(),
    secretKey: input.secretKey.trim(),
  };
}

async function getStoredNaverSearchAdCredentials() {
  if (!supabaseAdminForNaverKeys) return null;

  const { data: successData, error: successError } = await supabaseAdminForNaverKeys
    .from("user_api_keys")
    .select("encrypted_key")
    .eq("provider", NAVER_SEARCH_AD_PROVIDER)
    .eq("test_status", "success")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (successError) {
    console.error("[Naver Blog Post Analysis] Failed to load verified SearchAd credentials", {
      error: successError.message,
    });
  }

  if (successData?.encrypted_key) {
    return parseNaverSearchAdCredentials(successData.encrypted_key);
  }

  const { data, error } = await supabaseAdminForNaverKeys
    .from("user_api_keys")
    .select("encrypted_key")
    .eq("provider", NAVER_SEARCH_AD_PROVIDER)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Naver Blog Post Analysis] Failed to load SearchAd credentials", {
      error: error.message,
    });
    return null;
  }

  return data?.encrypted_key ? parseNaverSearchAdCredentials(data.encrypted_key) : null;
}

function normalizeSearchCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("<")) return 0;
  const numeric = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

async function getKeywordMonthlySearches(keyword: string, credentials: NaverSearchAdCredentials | null) {
  if (!credentials) return null;

  const result = await requestNaverSearchAdApi(credentials, "/keywordstool", new URLSearchParams({
    hintKeywords: keyword.replace(/\s+/g, ""),
    showDetail: "1",
  }));

  if (!result.response.ok || !Array.isArray(result.data?.keywordList)) return null;

  const normalizedKeyword = keyword.replace(/\s+/g, "").toLowerCase();
  const metric =
    result.data.keywordList.find((item: any) => String(item?.relKeyword || "").replace(/\s+/g, "").toLowerCase() === normalizedKeyword) ||
    result.data.keywordList[0];
  const pc = normalizeSearchCount(metric?.monthlyPcQcCnt);
  const mobile = normalizeSearchCount(metric?.monthlyMobileQcCnt);

  if (pc === null && mobile === null) return null;
  return (pc || 0) + (mobile || 0);
}

function normalizeBlogUrlInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractNaverBlogId(value: string) {
  const normalized = normalizeBlogUrlInput(value);
  try {
    const url = new URL(normalized);
    const blogIdFromQuery = url.searchParams.get("blogId");
    if (blogIdFromQuery) return blogIdFromQuery.trim();

    const host = url.hostname.replace(/^m\./, "");
    if (host === "blog.naver.com") {
      return url.pathname.split("/").filter(Boolean)[0]?.trim() || null;
    }
  } catch {
    if (/^[a-zA-Z0-9._-]+$/.test(value.trim())) return value.trim();
  }

  return null;
}

function getXmlText($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>, selector: string) {
  return element.find(selector).first().text().trim();
}

function getXmlTexts($: cheerio.CheerioAPI, element: cheerio.Cheerio<any>, selector: string) {
  return element
    .find(selector)
    .toArray()
    .map(node => $(node).text().trim())
    .filter(Boolean);
}

function stripHtmlText(value: string) {
  return cheerio.load(value).text().replace(/\s+/g, " ").trim();
}

function normalizePostTag(value: string) {
  return stripHtmlText(value)
    .replace(/^#/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueTags(values: string[]) {
  const tags: string[] = [];
  const seen = new Set<string>();

  values.forEach((value) => {
    const tag = normalizePostTag(value);
    const key = tag.replace(/\s+/g, "").toLowerCase();
    if (!tag || tag.length > 24 || seen.has(key)) return;
    seen.add(key);
    tags.push(tag);
  });

  return tags.slice(0, 8);
}

function extractNaverPostTagsFromHtml(html: string) {
  const $ = cheerio.load(html);
  const candidates: string[] = [];
  // Naver Blog reuses generic tag-like class names in editor controls, so only
  // accept links from the rendered post body or links with a tag query value.
  const selectors = [
    "meta[property='article:tag']",
    "#postView .se-hash-tag",
    ".se-main-container .se-hash-tag",
    "#postView a[href*='postTagName=']",
    ".se-main-container a[href*='postTagName=']",
    "#postView a[href*='tagName=']",
    ".se-main-container a[href*='tagName=']",
    "#postView a[href*='PostList.naver'][href*='query=']",
    ".se-main-container a[href*='PostList.naver'][href*='query=']",
  ];

  selectors.forEach((selector) => {
    $(selector).each((_, element) => {
      const node = $(element);
      const content = node.attr("content");
      const href = node.attr("href");

      if (content) {
        candidates.push(...content.split(","));
      } else if (node.is("a")) {
        candidates.push(node.text());
      }

      if (href) {
        try {
          const tagFromPostTagName = new URL(href, "https://blog.naver.com").searchParams.get("postTagName");
          const tagFromTagName = new URL(href, "https://blog.naver.com").searchParams.get("tagName");
          if (tagFromPostTagName) candidates.push(decodeURIComponent(tagFromPostTagName));
          if (tagFromTagName) candidates.push(decodeURIComponent(tagFromTagName));
        } catch {
          // Ignore malformed inline hrefs.
        }
      }
    });
  });

  const blockedLabels = new Set(["취소", "확인", "닫기", "공유", "저장", "수정", "삭제", "더보기"]);
  return uniqueTags(candidates).filter((tag) => !blockedLabels.has(tag));
}

function getNaverBlogPostIdentifier(postUrl: string) {
  try {
    const url = new URL(normalizeBlogUrlInput(postUrl));
    const blogId = url.searchParams.get("blogId")?.trim();
    const logNo = url.searchParams.get("logNo")?.trim();
    if (blogId && logNo) return { blogId, logNo };

    const host = url.hostname.replace(/^m\./, "");
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (host === "blog.naver.com" && pathParts.length >= 2) {
      return { blogId: pathParts[0], logNo: pathParts[1] };
    }
  } catch {
    // The HTML fallback below handles malformed or non-Naver post URLs.
  }

  return null;
}

function decodeNaverTagValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractNaverMobilePostTags(html: string) {
  // The mobile post page includes the saved bottom-tag list directly in this
  // variable, unlike the desktop page which fills its tag area asynchronously.
  const match = html.match(/var\s+gsTagName\s*=\s*["']([^"']*)["']/i);
  return match ? uniqueTags(match[1].split(",")) : [];
}

async function fetchNaverBlogPostTags(postUrl: string) {
  if (!postUrl) return [];

  const fetchHtml = async (url: string) => {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ContentsView/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) return "";
    return response.text();
  };

  const postIdentifier = getNaverBlogPostIdentifier(postUrl);
  if (postIdentifier) {
    const query = new URLSearchParams({
      blogId: postIdentifier.blogId,
      logNoList: postIdentifier.logNo,
      logType: "mylog",
    });

    try {
      const response = await fetch(`https://blog.naver.com/BlogTagListInfo.naver?${query.toString()}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ContentsView/1.0)",
          Accept: "application/json, text/javascript, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (response.ok) {
        const payload = await response.json() as {
          taglist?: Array<{ logno?: string | number; tagName?: string }>;
        };
        const tagName = payload.taglist?.find((item) => String(item.logno) === postIdentifier.logNo)?.tagName;
        if (tagName) {
          const tags = uniqueTags(decodeNaverTagValue(tagName).split(","));
          if (tags.length > 0) return tags;
        }
      }
    } catch (error) {
      console.warn("[Naver Blog Analysis] Tag API request failed", {
        postUrl,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    try {
      const mobileHtml = await fetchHtml(
        `https://m.blog.naver.com/${encodeURIComponent(postIdentifier.blogId)}/${encodeURIComponent(postIdentifier.logNo)}`
      );
      const mobileTags = extractNaverMobilePostTags(mobileHtml);
      if (mobileTags.length > 0) return mobileTags;
    } catch (error) {
      console.warn("[Naver Blog Analysis] Mobile tag fallback failed", {
        postUrl,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const initialHtml = await fetchHtml(normalizeBlogUrlInput(postUrl));
  if (!initialHtml) return [];

  const initialTags = extractNaverPostTagsFromHtml(initialHtml);
  if (initialTags.length > 0) return initialTags;

  const $ = cheerio.load(initialHtml);
  const iframeSrc = $("#mainFrame").attr("src");
  if (!iframeSrc) return [];

  const iframeUrl = new URL(iframeSrc, "https://blog.naver.com").href;
  const iframeHtml = await fetchHtml(iframeUrl);
  return iframeHtml ? extractNaverPostTagsFromHtml(iframeHtml) : [];
}

function normalizeBlogPostUrlForMatch(value: string) {
  try {
    const url = new URL(normalizeBlogUrlInput(value));
    const host = url.hostname.replace(/^m\./, "");
    const paths = url.pathname.split("/").filter(Boolean);
    if (host === "blog.naver.com" && paths.length >= 2) {
      return `${host}/${paths[0]}/${paths[1]}`.toLowerCase();
    }

    const blogId = url.searchParams.get("blogId");
    const logNo = url.searchParams.get("logNo");
    if (blogId && logNo) {
      return `blog.naver.com/${blogId}/${logNo}`.toLowerCase();
    }

    return `${host}${url.pathname}`.replace(/\/$/, "").toLowerCase();
  } catch {
    return value.split("?")[0].replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase();
  }
}

async function getBlogPostRankForKeyword(input: {
  keyword: string;
  postUrl: string;
  clientId: string;
  clientSecret: string;
}) {
  const params = new URLSearchParams({
    query: input.keyword,
    display: String(BLOG_RANK_SEARCH_LIMIT),
    start: "1",
    sort: "sim",
  });
  const response = await fetch(`https://openapi.naver.com/v1/search/blog.json?${params.toString()}`, {
    headers: {
      "X-Naver-Client-Id": input.clientId,
      "X-Naver-Client-Secret": input.clientSecret,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(data?.items)) {
    return {
      rank: null,
      matchedTitle: null,
      matchedLink: null,
      checkedCount: 0,
    };
  }

  const target = normalizeBlogPostUrlForMatch(input.postUrl);
  const matchedIndex = data.items.findIndex((item: any) => {
    const link = normalizeBlogPostUrlForMatch(String(item?.link || ""));
    return link === target;
  });

  if (matchedIndex < 0) {
    return {
      rank: null,
      matchedTitle: null,
      matchedLink: null,
      checkedCount: data.items.length,
    };
  }

  const matched = data.items[matchedIndex];
  return {
    rank: matchedIndex + 1,
    matchedTitle: stripHtmlText(String(matched.title || "")),
    matchedLink: matched.link || null,
    checkedCount: data.items.length,
  };
}

function extractPostKeywords(input: { title: string; description: string; category: string }) {
  const stopWords = new Set([
    "그리고",
    "하지만",
    "오늘",
    "이번",
    "있는",
    "없는",
    "하기",
    "하는",
    "위한",
    "추천",
    "정리",
    "후기",
    "리뷰",
    "방법",
    "정보",
    "블로그",
    "무려",
    "만원대",
    "입니다",
    "해요",
    "하는",
    "있는",
    "없는",
  ]);
  const cleanedTitle = input.title
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const tokens = cleanedTitle
    .split(" ")
    .map(token => token.trim())
    .filter(token => token.length >= 2 && token.length <= 18 && !stopWords.has(token));
  const candidates: string[] = [];
  const candidateKeys = new Set<string>();
  const addCandidate = (value: string) => {
    const keyword = value.trim();
    const key = keyword.replace(/\s+/g, "").toLowerCase();
    if (!keyword || keyword.length < 2 || keyword.length > 28) return;
    if (candidateKeys.has(key)) return;
    candidateKeys.add(key);
    candidates.push(keyword);
  };

  for (let index = 0; index < tokens.length; index += 1) {
    const first = tokens[index];
    const second = tokens[index + 1];
    const third = tokens[index + 2];

    if (second) {
      addCandidate(`${first} ${second}`);
    }
    if (second && third) {
      addCandidate(`${first} ${second} ${third}`);
    }
  }

  tokens.forEach(addCandidate);

  return candidates.slice(0, 5);
}

async function fetchNaverBlogRss(blogUrl: string) {
  const blogId = extractNaverBlogId(blogUrl);
  if (!blogId) {
    return {
      success: false,
      error: "네이버 블로그 메인 주소를 입력해주세요.",
    };
  }

  const rssUrl = `https://rss.blog.naver.com/${encodeURIComponent(blogId)}.xml`;
  const response = await fetch(rssUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ContentsView/1.0)",
      Accept: "application/rss+xml, application/xml, text/xml",
    },
  });

  if (!response.ok) {
    return {
      success: false,
      error: "블로그 최신글을 불러오지 못했습니다. 주소를 확인해주세요.",
    };
  }

  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const channel = $("channel").first();
  const basePosts = $("item").toArray().slice(0, BLOG_ANALYSIS_POST_LIMIT).map((item, index) => {
    const itemNode = $(item);
    const rawDescription = getXmlText($, itemNode, "description");
    const title = getXmlText($, itemNode, "title");
    const description = stripHtmlText(rawDescription).slice(0, 180);
    const rssCategories = getXmlTexts($, itemNode, "category");
    const category = rssCategories[0] || "";

    return {
      rank: index + 1,
      title,
      link: getXmlText($, itemNode, "link"),
      pubDate: getXmlText($, itemNode, "pubDate"),
      category,
      tags: uniqueTags(rssCategories.slice(1)),
      keywords: extractPostKeywords({ title, description, category }),
    };
  });
  const posts = await Promise.all(
    basePosts.map(async (post) => {
      try {
        const htmlTags = await fetchNaverBlogPostTags(post.link);
        return {
          ...post,
          tags: uniqueTags([...(post.tags || []), ...htmlTags]),
        };
      } catch (error) {
        console.error("[Naver Blog Analysis] Failed to load post tags", {
          link: post.link,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return post;
      }
    })
  );

  return {
    success: true,
    blog: {
      blogId,
      title: getXmlText($, channel, "title") || blogId,
      link: getXmlText($, channel, "link") || `https://blog.naver.com/${blogId}`,
      description: stripHtmlText(getXmlText($, channel, "description")),
      rssUrl,
    },
    posts,
    fetchedAt: new Date().toISOString(),
  };
}

// Google Trends RSS 캐시
const googleTrendsCache: Record<string, { data: Array<{ rank: number; keyword: string }>; timestamp: number }> = {};
const CACHE_TTL = 10 * 60 * 1000; // 10분

// 국가별 Google Trends RSS URL
const GOOGLE_TRENDS_RSS_URLS: Record<string, string> = {
  KR: "https://trends.google.com/trending/rss?geo=KR",
  US: "https://trends.google.com/trending/rss?geo=US",
  JP: "https://trends.google.com/trending/rss?geo=JP",
  GB: "https://trends.google.com/trending/rss?geo=GB",
  FR: "https://trends.google.com/trending/rss?geo=FR",
  DE: "https://trends.google.com/trending/rss?geo=DE",
  ES: "https://trends.google.com/trending/rss?geo=ES",
};



/**
 * Get Google Trends realtime trending searches from RSS
 */
async function getGoogleTrendingSearches(countryCode: string = "KR"): Promise<Array<{ rank: number; keyword: string; source: string; country: string }>> {
  try {
    const cacheKey = `google_trends_${countryCode}`;
    const now = Date.now();
    
    // 캐시 확인
    if (googleTrendsCache[cacheKey] && now - googleTrendsCache[cacheKey].timestamp < CACHE_TTL) {
      console.log(`[Google Trends RSS] Cache HIT for country: ${countryCode}`);
      const cachedData = googleTrendsCache[cacheKey].data;
      return cachedData.map(item => ({
        ...item,
        source: "Google Trends",
        country: countryCode,
      }));
    }
    
    const rssUrl = GOOGLE_TRENDS_RSS_URLS[countryCode];
    if (!rssUrl) {
      console.error(`[Google Trends RSS] Invalid country code: ${countryCode}`);
      return [];
    }
    
    console.log(`[Google Trends RSS] Fetching RSS for country: ${countryCode}`);
    console.log(`[Google Trends RSS] URL: ${rssUrl}`);
    
    const response = await fetch(rssUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    
    if (!response.ok) {
      console.error(`[Google Trends RSS] HTTP Error: ${response.status}`);
      return [];
    }
    
    const rssText = await response.text();
    console.log(`[Google Trends RSS] Fetched RSS text length: ${rssText.length}`);
    
    // 간단한 XML 파싱 (정규식 사용)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title>([^<]+)<\/title>/;
    const trafficRegex = /<ht:approx_traffic>([^<]+)<\/ht:approx_traffic>/;
    const newsItemRegex = /<ht:news_item>([\s\S]*?)<\/ht:news_item>/;
    const newsTitleRegex = /<ht:news_item_title>([^<]+)<\/ht:news_item_title>/;
    const newsSourceRegex = /<ht:news_item_source>([^<]+)<\/ht:news_item_source>/;
    
    const items = [];
    let match;
    let rank = 1;
    let itemCount = 0;
    
    while ((match = itemRegex.exec(rssText)) !== null && rank <= 20) {
      itemCount++;
      const itemContent = match[1];
      const titleMatch = titleRegex.exec(itemContent);
      
      if (titleMatch && titleMatch[1]) {
        const title = titleMatch[1].trim();
        // "+123%" 같은 증가율 정보 제거
        const keyword = title.replace(/\s*\+\s*\d+%\s*$/, "").trim();
        
        if (keyword && keyword !== "Explore what's trending") {
          // 검색량 추출
          const trafficMatch = trafficRegex.exec(itemContent);
          const traffic = trafficMatch ? trafficMatch[1].trim() : "";
          
          // 모든 뉴스 항목 추출 (최대 3개)
          const newsArray = [];
          const newsItemRegexGlobal = /<ht:news_item>([\s\S]*?)<\/ht:news_item>/g;
          const newsUrlRegex = /<ht:news_item_url>([^<]+)<\/ht:news_item_url>/;
          const newsPictureRegex = /<ht:news_item_picture>([^<]+)<\/ht:news_item_picture>/;
          
          let newsMatch;
          let newsCount = 0;
          while ((newsMatch = newsItemRegexGlobal.exec(itemContent)) !== null && newsCount < 3) {
            const newsContent = newsMatch[1];
            const newsTitleMatch = newsTitleRegex.exec(newsContent);
            const newsSourceMatch = newsSourceRegex.exec(newsContent);
            const newsUrlMatch = newsUrlRegex.exec(newsContent);
            const newsPictureMatch = newsPictureRegex.exec(newsContent);
            
            if (newsTitleMatch && newsTitleMatch[1]) {
              newsArray.push({
                title: newsTitleMatch[1].trim().replace(/&quot;/g, '"').replace(/&apos;/g, "'"),
                source: newsSourceMatch ? newsSourceMatch[1].trim() : "",
                url: newsUrlMatch ? newsUrlMatch[1].trim() : "",
                image: newsPictureMatch ? newsPictureMatch[1].trim() : "",
              });
              newsCount++;
            }
          }
          
          items.push({
            rank: rank,
            keyword: keyword,
            traffic: traffic,
            news: newsArray,
          });
          rank++;
        }
      }
    }
    
    console.log(`[Google Trends RSS] RSS item count: ${itemCount}`);
    console.log(`[Google Trends RSS] Parsed keywords: ${items.length}`);
    console.log(`[Google Trends RSS] Final keywords: ${items.length}`);
    
    if (items.length === 0) {
      console.warn(`[Google Trends RSS] No keywords parsed for country: ${countryCode}`);
      return [];
    }
    
    // 캐시에 저장
    googleTrendsCache[cacheKey] = {
      data: items,
      timestamp: now,
    };
    
    console.log(`[Google Trends RSS] Success - fetched ${items.length} trending searches for ${countryCode}`);
    
    return items.map(item => ({
      ...item,
      source: "Google Trends",
      country: countryCode,
    }));
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Google Trends RSS] Error fetching realtime trends for ${countryCode}:`, errorMsg);
    return [];
  }
}

/**
 * Parse ISO 8601 duration to seconds
 * Examples: PT59S -> 59, PT1M -> 60, PT1M1S -> 61, PT1H5M30S -> 3930
 */
function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Translate YouTube API error messages to Korean
 */
function translateYouTubeError(error: string): string {
  const errorMap: Record<string, string> = {
    "API key not valid. Please pass a valid API key.": "YouTube API 키 오류입니다.\nAPI 키 확인 후 다시 입력해주세요.",
    "Invalid Credentials": "YouTube API 키 오류입니다.\nAPI 키 확인 후 다시 입력해주세요.",
    "The request is missing a valid API key.": "API Key가 누락되었습니다. API 키 설정에서 YouTube API Key를 입력해주세요.",
    "YouTube Data API v3 has not been used in project": "YouTube Data API v3가 사용 설정되지 않았습니다. Google Cloud Console에서 YouTube Data API v3를 사용 설정해주세요.",
    "The caller does not have permission": "이 API Key에는 필요한 권한이 없습니다. Google Cloud Console에서 권한을 확인해주세요.",
    "Quota exceeded": "API 할당량을 초과했습니다. 나중에 다시 시도해주세요.",
    "The request cannot be completed because you have exceeded your YouTube API quota": "YouTube API 할당량을 초과했습니다. 내일 다시 시도해주세요.",
    "Invalid region code": "유효하지 않은 국가 코드입니다. 다시 선택해주세요.",
  };

  // Check for exact matches first
  if (errorMap[error]) {
    return errorMap[error];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(errorMap)) {
    if (error.includes(key)) {
      return value;
    }
  }

  // If no match, return a generic message with the original error
  return `YouTube API 오류: ${error}. API Key 설정을 확인해주세요.`;
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      (ctx.res as unknown as {
        clearCookie: (name: string, options: Record<string, unknown>) => void;
      }).clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  user: router({
    /**
     * Update user name
     */
    updateName: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(50) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.openId) {
          throw new Error("User not authenticated");
        }

        await db.updateUserName(ctx.user.openId, input.name.trim());
        return { success: true };
      }),

    /**
     * API Key management
     */
    apiKey: router({
      save: protectedProcedure
        .input(z.object({ provider: z.string().min(1), apiKey: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.user) {
            throw new Error("User not authenticated");
          }

          // Validate API key is not empty or whitespace only
          const trimmedKey = input.apiKey.trim();
          if (!trimmedKey) {
            throw new Error("API key cannot be empty or whitespace only");
          }

          await userApiKeys.saveUserApiKey(ctx.user, input.provider, trimmedKey);
          return { success: true };
        }),

      delete: protectedProcedure
        .input(z.object({ provider: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.user) {
            throw new Error("User not authenticated");
          }

          await userApiKeys.deleteUserApiKey(ctx.user, input.provider);
          return { success: true };
        }),

      /**
       * Test YouTube API connection
       */
      testConnection: protectedProcedure
        .input(z.object({ provider: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.user) {
            throw new Error("User not authenticated");
          }

          const apiKey = await userApiKeys.getUserApiKey(ctx.user, input.provider);
          if (!apiKey) {
            return {
              success: false,
              error: "API Key not found",
            };
          }

          try {
            const params = new URLSearchParams({
              part: "id",
              id: "test",
              key: apiKey.apiKey,
            });

            const response = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
              { method: "GET" }
            );

            const data = await response.json();

            if (data.error) {
              const errorMsg = data.error.message || "Unknown error";
              await userApiKeys.updateApiKeyTestStatus(ctx.user, input.provider, "failed", errorMsg);
              return {
                success: false,
                error: translateYouTubeError(errorMsg),
              };
            }

            await userApiKeys.updateApiKeyTestStatus(ctx.user, input.provider, "success");
            return { success: true };
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : "Connection failed";
            await userApiKeys.updateApiKeyTestStatus(ctx.user, input.provider, "failed", errorMsg);
            return {
              success: false,
              error: translateYouTubeError(errorMsg),
            };
          }
        }),

      /**
       * Get API key with test status
       */
      getWithStatus: protectedProcedure
        .input(z.object({ provider: z.string().min(1) }))
        .query(async ({ ctx, input }) => {
          if (!ctx.user) {
            throw new Error("User not authenticated");
          }
          const apiKey = await userApiKeys.getUserApiKey(ctx.user, input.provider);
          if (!apiKey) {
            return {
              exists: false,
              maskedKey: null,
              testStatus: null,
              testError: null,
              lastTestedAt: null,
            };
          }
          return {
            exists: true,
            maskedKey: userApiKeys.maskApiKey(apiKey.apiKey),
            testStatus: apiKey.testStatus,
            testError: apiKey.testError,
            lastTestedAt: apiKey.lastTestedAt,
            createdAt: apiKey.createdAt,
            updatedAt: apiKey.updatedAt,
          };
        }),

      saveNaverSearchAd: adminProcedure
        .input(z.object({
          customerId: z.string().min(1),
          accessLicense: z.string().min(1),
          secretKey: z.string().min(1),
        }))
        .mutation(async ({ ctx, input }) => {
          if (!ctx.user) {
            throw new Error("User not authenticated");
          }

          const existingApiKey = await userApiKeys.getUserApiKey(ctx.user, NAVER_SEARCH_AD_PROVIDER);
          const existingCredentials = existingApiKey
            ? parseNaverSearchAdCredentials(existingApiKey.apiKey)
            : null;
          const existingMaskedCredentials = existingCredentials
            ? maskNaverSearchAdCredentials(existingCredentials)
            : null;
          const nextInput = normalizeNaverSearchAdInput(input);
          const credentials = {
            customerId:
              existingCredentials && nextInput.customerId === existingMaskedCredentials?.customerId
                ? existingCredentials.customerId
                : nextInput.customerId,
            accessLicense:
              existingCredentials && nextInput.accessLicense === existingMaskedCredentials?.accessLicense
                ? existingCredentials.accessLicense
                : nextInput.accessLicense,
            secretKey:
              existingCredentials && nextInput.secretKey === existingMaskedCredentials?.secretKey
                ? existingCredentials.secretKey
                : nextInput.secretKey,
          };

          if (!credentials.customerId || !credentials.accessLicense || !credentials.secretKey) {
            throw new Error("네이버 검색광고 API 키 정보를 모두 입력해주세요.");
          }

          await userApiKeys.saveUserApiKey(
            ctx.user,
            NAVER_SEARCH_AD_PROVIDER,
            JSON.stringify(credentials),
          );

          return { success: true };
        }),

      getNaverSearchAdWithStatus: adminProcedure
        .query(async ({ ctx }) => {
          if (!ctx.user) {
            throw new Error("User not authenticated");
          }

          const apiKey = await userApiKeys.getUserApiKey(ctx.user, NAVER_SEARCH_AD_PROVIDER);
          if (!apiKey) {
            return {
              exists: false,
              maskedCredentials: null,
              testStatus: null,
              testError: null,
              lastTestedAt: null,
            };
          }

          const credentials = parseNaverSearchAdCredentials(apiKey.apiKey);
          if (!credentials) {
            return {
              exists: true,
              maskedCredentials: null,
              testStatus: "failed" as const,
              testError: "저장된 네이버 검색광고 키 형식이 올바르지 않습니다.",
              lastTestedAt: apiKey.lastTestedAt,
            };
          }

          return {
            exists: true,
            maskedCredentials: maskNaverSearchAdCredentials(credentials),
            testStatus: apiKey.testStatus,
            testError: apiKey.testError,
            lastTestedAt: apiKey.lastTestedAt,
            createdAt: apiKey.createdAt,
            updatedAt: apiKey.updatedAt,
          };
        }),

      testNaverSearchAd: adminProcedure
        .mutation(async ({ ctx }) => {
          if (!ctx.user) {
            throw new Error("User not authenticated");
          }

          const apiKey = await userApiKeys.getUserApiKey(ctx.user, NAVER_SEARCH_AD_PROVIDER);
          const credentials = apiKey ? parseNaverSearchAdCredentials(apiKey.apiKey) : null;
          if (!credentials) {
            return {
              success: false,
              error: "네이버 검색광고 API 키 정보를 먼저 저장해주세요.",
            };
          }

          try {
            const keywordCheck = await requestNaverSearchAdApi(credentials, "/keywordstool", new URLSearchParams({
              hintKeywords: "반바지",
              showDetail: "1",
            }));

            if (!keywordCheck.response.ok) {
              const rawErrorMessage = getNaverSearchAdErrorMessage(keywordCheck.data, keywordCheck.response.status);
              const errorMessage = rawErrorMessage.includes("10002") || rawErrorMessage.includes("required permission")
                ? `GET /keywordstool 호출이 10002로 실패했습니다. HTTP ${keywordCheck.response.status}. 네이버 응답: ${rawErrorMessage}`
                : `GET /keywordstool 호출 실패. HTTP ${keywordCheck.response.status}. 네이버 응답: ${rawErrorMessage}`;
              await userApiKeys.updateApiKeyTestStatus(ctx.user, NAVER_SEARCH_AD_PROVIDER, "failed", errorMessage);
              return {
                success: false,
                error: errorMessage,
              };
            }

            await userApiKeys.updateApiKeyTestStatus(ctx.user, NAVER_SEARCH_AD_PROVIDER, "success");
            return { success: true };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "네이버 검색광고 API 연결에 실패했습니다.";
            await userApiKeys.updateApiKeyTestStatus(ctx.user, NAVER_SEARCH_AD_PROVIDER, "failed", errorMessage);
            return {
              success: false,
              error: errorMessage,
            };
          }
        }),
    }),

    /**
     * Admin: List pending users for approval
     */
    listPending: adminProcedure
      .query(async () => {
        const db = await require('./db').getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        const pendingUsers = await db
          .select()
          .from(require('../drizzle/schema').users)
          .where(require('drizzle-orm').eq(require('../drizzle/schema').users.approvalStatus, 'pending'));

        return pendingUsers.map((user: any) => ({
          id: user.id,
          memberNo: user.memberNo,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          approvalStatus: user.approvalStatus,
        }));
      }),

    /**
     * Admin: Approve a pending user
     */
    approve: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await require('./db').getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        const { users } = require('../drizzle/schema');
        const { eq } = require('drizzle-orm');

        await db
          .update(users)
          .set({ approvalStatus: 'approved' })
          .where(eq(users.id, input.userId));

        return { success: true };
      }),

    /**
     * Admin: Reject a pending user
     */
    reject: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await require('./db').getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        const { users } = require('../drizzle/schema');
        const { eq } = require('drizzle-orm');

        await db
          .update(users)
          .set({ approvalStatus: 'rejected' })
          .where(eq(users.id, input.userId));

        return { success: true };
      }),
  }),

  youtube: router({
    /**
     * Get popular channels based on trending videos
     * 1. Fetch top 50 popular videos
     * 2. Extract unique channelIds
     * 3. Fetch channel details (subscribers, views, etc.)
     * 4. Calculate trending score based on frequency, views, and subscribers
     */
    getPopularChannels: protectedProcedure
      .input(z.object({
        regionCode: z.string().min(2).max(2),
        sortBy: z.enum(["trending", "subscribers", "views"]).default("trending"),
        maxResults: z.number().min(1).max(50).default(12),
        videoCategoryId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new Error("User not authenticated");
        }

        // Get user's YouTube API key
        const apiKeyRecord = await userApiKeys.getUserApiKey(ctx.user, "youtube");
        if (!apiKeyRecord) {
          return {
            success: false,
            error: "API Key not found",
            channels: [],
          };
        }

        // Check if API key test status is success
        if (apiKeyRecord.testStatus !== "success") {
          return {
            success: false,
            error: "YouTube API 키 오류입니다.\nAPI 키 확인 후 다시 입력해주세요.",
            channels: [],
          };
        }

        try {
          // Step 1: Fetch top 50 popular videos
          const videoParams = new URLSearchParams({
            part: "snippet,statistics,contentDetails",
            chart: "mostPopular",
            regionCode: input.regionCode,
            maxResults: "50",
            key: apiKeyRecord.apiKey,
          });

          if (input.videoCategoryId !== undefined) {
            videoParams.append("videoCategoryId", input.videoCategoryId.toString());
          }

          const videoResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?${videoParams.toString()}`,
            { method: "GET" }
          );

          if (!videoResponse.ok) {
            const errorData = await videoResponse.json();
            const errorMsg = errorData.error?.message || "Failed to fetch trending videos";
            return {
              success: false,
              error: translateYouTubeError(errorMsg),
              channels: [],
            };
          }

          const videoData = await videoResponse.json();

          if (videoData.error) {
            const errorMsg = videoData.error.message || "YouTube API error";
            return {
              success: false,
              error: translateYouTubeError(errorMsg),
              channels: [],
            };
          }

          // Step 2: Extract and aggregate channel information
          const channelMap = new Map<string, {
            channelId: string;
            channelTitle: string;
            videoCount: number;
            totalVideoViews: number;
            topVideoTitle: string;
          }>();

          (videoData.items || []).forEach((item: any) => {
            const channelId = item.snippet.channelId;
            const viewCount = parseInt(item.statistics.viewCount || "0");
            const videoTitle = item.snippet.title;

            if (channelMap.has(channelId)) {
              const existing = channelMap.get(channelId)!;
              existing.videoCount += 1;
              existing.totalVideoViews += viewCount;
            } else {
              channelMap.set(channelId, {
                channelId,
                channelTitle: item.snippet.channelTitle,
                videoCount: 1,
                totalVideoViews: viewCount,
                topVideoTitle: videoTitle,
              });
            }
          });

          if (channelMap.size === 0) {
            return {
              success: true,
              channels: [],
            };
          }

          // Step 3: Fetch channel details
          const channelIds = Array.from(channelMap.keys());
          const channelParams = new URLSearchParams({
            part: "snippet,statistics",
            id: channelIds.join(","),
            key: apiKeyRecord.apiKey,
          });

          const channelResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/channels?${channelParams.toString()}`,
            { method: "GET" }
          );

          if (!channelResponse.ok) {
            const errorData = await channelResponse.json();
            const errorMsg = errorData.error?.message || "Failed to fetch channel details";
            return {
              success: false,
              error: translateYouTubeError(errorMsg),
              channels: [],
            };
          }

          const channelData = await channelResponse.json();

          if (channelData.error) {
            const errorMsg = channelData.error.message || "YouTube API error";
            return {
              success: false,
              error: translateYouTubeError(errorMsg),
              channels: [],
            };
          }

          // Step 4: Combine and calculate trending score
          const channels = (channelData.items || []).map((item: any) => {
            const aggregated = channelMap.get(item.id)!;
            const subscriberCount = parseInt(item.statistics.subscriberCount || "0");
            const viewCount = parseInt(item.statistics.viewCount || "0");
            const videoCount = parseInt(item.statistics.videoCount || "0");

            // Calculate trending score:
            // - Frequency in popular videos (higher weight)
            // - Total views from popular videos
            // - Subscriber count
            // - Channel total views
            const frequencyScore = aggregated.videoCount * 100;
            const popularVideoViewsScore = aggregated.totalVideoViews / 100000; // Normalize
            const subscriberScore = subscriberCount / 10000; // Normalize
            const channelViewsScore = viewCount / 1000000; // Normalize

            const trendingScore = frequencyScore + popularVideoViewsScore + subscriberScore + channelViewsScore;

            return {
              channelId: item.id,
              channelTitle: item.snippet.title,
              channelDescription: item.snippet.description,
              thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
              subscriberCount,
              viewCount,
              videoCount,
              videoCountInTrending: aggregated.videoCount,
              topVideoTitle: aggregated.topVideoTitle,
              trendingScore,
            };
          });

          // Sort based on input
          if (input.sortBy === "subscribers") {
            channels.sort((a: any, b: any) => b.subscriberCount - a.subscriberCount);
          } else if (input.sortBy === "views") {
            channels.sort((a: any, b: any) => b.viewCount - a.viewCount);
          } else {
            // "trending" - sort by trendingScore
            channels.sort((a: any, b: any) => b.trendingScore - a.trendingScore);
          }

          return {
            success: true,
            channels: channels.slice(0, input.maxResults),
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Connection failed";
          return {
            success: false,
            error: translateYouTubeError(errorMsg),
            channels: [],
          };
        }
      }),

    /**
     * Get trending videos for a specific country
     */
    getTrendingVideos: protectedProcedure
      .input(z.object({
        regionCode: z.string().min(2).max(2),
        sortBy: z.enum(["trending", "viewCount", "publishedAt"]).default("trending"),
        maxResults: z.number().min(1).max(50).default(12),
        videoCategoryId: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new Error("User not authenticated");
        }

        // Get user's YouTube API key
        const apiKeyRecord = await userApiKeys.getUserApiKey(ctx.user, "youtube");
        if (!apiKeyRecord) {
          return {
            success: false,
            error: "API Key not found",
            videos: [],
          };
        }

        // Check if API key test status is success
        if (apiKeyRecord.testStatus !== "success") {
          return {
            success: false,
            error: "YouTube API 키 오류입니다.\nAPI 키 확인 후 다시 입력해주세요.",
            videos: [],
          };
        }

        try {
          // Call YouTube API
          const params = new URLSearchParams({
            part: "snippet,statistics,contentDetails",
            chart: "mostPopular",
            regionCode: input.regionCode,
            maxResults: input.maxResults.toString(),
            key: apiKeyRecord.apiKey,
          });

          // Add videoCategoryId if provided (not for "전체" category)
          if (input.videoCategoryId !== undefined) {
            params.append("videoCategoryId", input.videoCategoryId.toString());
          }

          const response = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
            { method: "GET" }
          );

          if (!response.ok) {
            const errorData = await response.json();
            const errorMsg = errorData.error?.message || "Failed to fetch trending videos";
            return {
              success: false,
              error: translateYouTubeError(errorMsg),
              videos: [],
            };
          }

          const data = await response.json();

          if (data.error) {
            const errorMsg = data.error.message || "YouTube API error";
            return {
              success: false,
              error: translateYouTubeError(errorMsg),
              videos: [],
            };
          }

          // Process videos
          let videos = (data.items || []).map((item: any) => ({
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            channelTitle: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
            publishedAt: item.snippet.publishedAt,
            viewCount: parseInt(item.statistics.viewCount || "0"),
            commentCount: parseInt(item.statistics.commentCount || "0"),
            categoryId: item.snippet.categoryId,
            tags: Array.isArray(item.snippet.tags) ? item.snippet.tags.slice(0, 12) : [],
            duration: item.contentDetails.duration,
          }));

          // Fetch channel profile images
          // Collect unique channel IDs
          const uniqueChannelIds = Array.from(new Set(videos.map((v: any) => v.channelId))).slice(0, 50); // YouTube API limit: 50 ids per request
          
          const channelThumbnails: Record<string, string> = {};
          if (uniqueChannelIds.length > 0) {
            try {
              const channelParams = new URLSearchParams({
                part: "snippet",
                id: uniqueChannelIds.join(","),
                key: apiKeyRecord.apiKey,
              });
              
              const channelResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?${channelParams.toString()}`,
                { method: "GET" }
              );
              
              if (channelResponse.ok) {
                const channelData = await channelResponse.json();
                (channelData.items || []).forEach((channel: any) => {
                  const thumbnailUrl = channel.snippet?.thumbnails?.high?.url || 
                                      channel.snippet?.thumbnails?.medium?.url ||
                                      channel.snippet?.thumbnails?.default?.url;
                  if (thumbnailUrl) {
                    channelThumbnails[channel.id] = thumbnailUrl;
                  }
                });
              }
            } catch (channelError) {
              // If channel fetch fails, continue without thumbnails
              console.error("Failed to fetch channel thumbnails:", channelError);
            }
          }
          
          // Add channel thumbnails to videos
          videos = videos.map((video: any) => ({
            ...video,
            channelThumbnail: channelThumbnails[video.channelId] || null,
          }));
          
          // DEBUG: Log first video data
          if (videos.length > 0) {
            const firstVideo = videos[0];
            console.log('[DEBUG] getTrendingVideos - First video:', {
              title: firstVideo.title,
              channelTitle: firstVideo.channelTitle,
              channelId: firstVideo.channelId,
              channelThumbnail: firstVideo.channelThumbnail,
            });
            console.log('[DEBUG] channelThumbnails map:', channelThumbnails);
          }

          // Sort based on input
          if (input.sortBy === "viewCount") {
            videos.sort((a: any, b: any) => b.viewCount - a.viewCount);
          } else if (input.sortBy === "publishedAt") {
            videos.sort((a: any, b: any) => 
              new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            );
          }
          // "trending" keeps the default order from YouTube API

          return {
            success: true,
            videos,
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Connection failed";
          return {
            success: false,
            error: translateYouTubeError(errorMsg),
            videos: [],
          };
        }
      }),

    /**
     * Search popular YouTube videos by keyword
     */
    searchVideos: protectedProcedure
      .input(z.object({
        query: z.string().min(1).max(120),
        regionCode: z.string().min(2).max(2).default("KR"),
        sortBy: z.enum(["relevance", "publishedAt", "viewCount"]).default("relevance"),
        durationType: z.enum(["all", "shorts", "long"]).default("all"),
        maxResults: z.number().min(1).max(50).default(50),
      }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new Error("User not authenticated");
        }

        const apiKeyRecord = await userApiKeys.getUserApiKey(ctx.user, "youtube");
        if (!apiKeyRecord) {
          return {
            success: false,
            error: "API Key not found",
            videos: [],
          };
        }

        if (apiKeyRecord.testStatus !== "success") {
          return {
            success: false,
            error: "YouTube API 키 오류입니다.\nAPI 키 확인 후 다시 입력해주세요.",
            videos: [],
          };
        }

        try {
          const searchParams = new URLSearchParams({
            part: "snippet",
            type: "video",
            q: input.query.trim(),
            regionCode: input.regionCode,
            order: input.sortBy === "publishedAt" ? "date" : input.sortBy,
            maxResults: input.maxResults.toString(),
            key: apiKeyRecord.apiKey,
          });

          if (input.durationType === "shorts") {
            searchParams.set("videoDuration", "short");
          }

          const searchResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`,
            { method: "GET" }
          );

          if (!searchResponse.ok) {
            const errorData = await searchResponse.json();
            const errorMsg = errorData.error?.message || "Failed to search videos";
            return {
              success: false,
              error: translateYouTubeError(errorMsg),
              videos: [],
            };
          }

          const searchData = await searchResponse.json();
          if (searchData.error) {
            const errorMsg = searchData.error.message || "YouTube API error";
            return {
              success: false,
              error: translateYouTubeError(errorMsg),
              videos: [],
            };
          }

          const videoIds: string[] = (searchData.items || [])
            .map((item: any) => item.id?.videoId)
            .filter(Boolean);

          if (videoIds.length === 0) {
            return {
              success: true,
              videos: [],
            };
          }

          const videosParams = new URLSearchParams({
            part: "snippet,statistics,contentDetails",
            id: videoIds.join(","),
            key: apiKeyRecord.apiKey,
          });

          const videosResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?${videosParams.toString()}`,
            { method: "GET" }
          );

          if (!videosResponse.ok) {
            const errorData = await videosResponse.json();
            const errorMsg = errorData.error?.message || "Failed to fetch video details";
            return {
              success: false,
              error: translateYouTubeError(errorMsg),
              videos: [],
            };
          }

          const videosData = await videosResponse.json();
          if (videosData.error) {
            const errorMsg = videosData.error.message || "YouTube API error";
            return {
              success: false,
              error: translateYouTubeError(errorMsg),
              videos: [],
            };
          }

          const videoOrderMap = new Map<string, number>(
            videoIds.map((videoId: string, index: number) => [videoId, index])
          );
          let videos = (videosData.items || []).map((item: any) => ({
            id: item.id,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
            channelTitle: item.snippet.channelTitle,
            channelId: item.snippet.channelId,
            publishedAt: item.snippet.publishedAt,
            viewCount: parseInt(item.statistics.viewCount || "0"),
            commentCount: parseInt(item.statistics.commentCount || "0"),
            likeCount: parseInt(item.statistics.likeCount || "0"),
            categoryId: item.snippet.categoryId,
            tags: Array.isArray(item.snippet.tags) ? item.snippet.tags.slice(0, 12) : [],
            duration: item.contentDetails.duration,
            durationSeconds: parseDurationToSeconds(item.contentDetails.duration),
          }));

          if (input.durationType === "shorts") {
            videos = videos.filter((video: any) => video.durationSeconds <= 60);
          } else if (input.durationType === "long") {
            videos = videos.filter((video: any) => video.durationSeconds > 60);
          }

          if (input.sortBy === "viewCount") {
            videos.sort((a: any, b: any) => b.viewCount - a.viewCount);
          } else if (input.sortBy === "publishedAt") {
            videos.sort((a: any, b: any) =>
              new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            );
          } else {
            videos.sort((a: any, b: any) =>
              (videoOrderMap.get(a.id) ?? 999) - (videoOrderMap.get(b.id) ?? 999)
            );
          }

          const uniqueChannelIds = Array.from(new Set(videos.map((v: any) => v.channelId))).slice(0, 50);
          const channelThumbnails: Record<string, string> = {};

          if (uniqueChannelIds.length > 0) {
            try {
              const channelParams = new URLSearchParams({
                part: "snippet",
                id: uniqueChannelIds.join(","),
                key: apiKeyRecord.apiKey,
              });

              const channelResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?${channelParams.toString()}`,
                { method: "GET" }
              );

              if (channelResponse.ok) {
                const channelData = await channelResponse.json();
                (channelData.items || []).forEach((channel: any) => {
                  const thumbnailUrl = channel.snippet?.thumbnails?.high?.url ||
                    channel.snippet?.thumbnails?.medium?.url ||
                    channel.snippet?.thumbnails?.default?.url;
                  if (thumbnailUrl) {
                    channelThumbnails[channel.id] = thumbnailUrl;
                  }
                });
              }
            } catch (channelError) {
              console.error("Failed to fetch channel thumbnails for search videos:", channelError);
            }
          }

          videos = videos.map((video: any) => ({
            ...video,
            channelThumbnail: channelThumbnails[video.channelId] || null,
          }));

          return {
            success: true,
            videos: videos.slice(0, input.maxResults),
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Connection failed";
          return {
            success: false,
            error: translateYouTubeError(errorMsg),
            videos: [],
          };
        }
      }),

    /**
     * Get trending shorts (videos <= 60 seconds)
     * Uses videos.list with duration filtering
     */
    getTrendingShorts: protectedProcedure
      .input(z.object({
        regionCode: z.string().min(2).max(2),
        sortBy: z.enum(["trending", "viewCount", "publishedAt"]).default("trending"),
        maxResults: z.number().min(1).max(50).default(24),
      }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) {
          throw new Error("User not authenticated");
        }

        // Get user's YouTube API key
        const apiKeyRecord = await userApiKeys.getUserApiKey(ctx.user, "youtube");
        if (!apiKeyRecord) {
          return {
            success: false,
            error: "API Key not found",
            videos: [],
          };
        }

        // Check if API key test status is success
        if (apiKeyRecord.testStatus !== "success") {
          return {
            success: false,
            error: "YouTube API 키 오류입니다.\nAPI 키 확인 후 다시 입력해주세요.",
            videos: [],
          };
        }

        try {
          // Language mapping by region for better localized results
          const SHORTS_LANGUAGE_BY_REGION: Record<string, string> = {
            KR: "ko",
            US: "en",
            JP: "ja",
            GB: "en",
            FR: "fr",
            ES: "es",
            DE: "de",
          };

          // Query keywords by region for better localized shorts
          const SHORTS_QUERY_BY_REGION: Record<string, string> = {
            KR: "#shorts 쇼츠",
            US: "#shorts",
            JP: "日本 ショート",
            GB: "#shorts",
            FR: "shorts français",
            ES: "shorts español",
            DE: "kurzvideo shorts",
          };

          // Step 1: Call search.list to get recent 7-day shorts
          const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const relevanceLanguage = SHORTS_LANGUAGE_BY_REGION[input.regionCode] || "en";
          const queryKeyword = SHORTS_QUERY_BY_REGION[input.regionCode] || "#shorts";
          
          const searchParams = new URLSearchParams({
            part: "snippet",
            type: "video",
            q: queryKeyword,
            regionCode: input.regionCode,
            relevanceLanguage: relevanceLanguage,
            publishedAfter: publishedAfter,
            order: "viewCount",
            videoDuration: "short",
            maxResults: "50",
            key: apiKeyRecord.apiKey,
          });

          const searchResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`,
            { method: "GET" }
          );

          if (!searchResponse.ok) {
            const errorData = await searchResponse.json();
            const errorMsg = errorData.error?.message || "Failed to search shorts";
            return {
              success: false,
              error: translateYouTubeError(errorMsg),
              videos: [],
            };
          }

          const searchData = await searchResponse.json();

          if (searchData.error) {
            const errorMsg = searchData.error.message || "YouTube API error";
            return {
              success: false,
              error: translateYouTubeError(errorMsg),
              videos: [],
            };
          }

          // Step 2: Collect videoIds from search results
          const videoIds = (searchData.items || [])
            .map((item: any) => item.id.videoId)
            .filter(Boolean);
          
          // DEBUG: Log search results
          const publishedAfterFormatted = new Date(publishedAfter).toLocaleDateString('ko-KR');
          console.log(`[getTrendingShorts] Country: ${input.regionCode}, Sort: ${input.sortBy}, Lang: ${relevanceLanguage}, PublishedAfter: ${publishedAfterFormatted}`);
          console.log(`[getTrendingShorts] search.list items: ${searchData.items?.length || 0}, videoIds extracted: ${videoIds.length}`);

          if (videoIds.length === 0) {
            return {
              success: true,
              videos: [],
            };
          }

          // Step 3: Call videos.list to get detailed information
          const videosParams = new URLSearchParams({
            part: "snippet,statistics,contentDetails",
            id: videoIds.join(","),
            key: apiKeyRecord.apiKey,
          });

          const videosResponse = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?${videosParams.toString()}`,
            { method: "GET" }
          );

          if (!videosResponse.ok) {
            const errorData = await videosResponse.json();
            const errorMsg = errorData.error?.message || "Failed to fetch video details";
            return {
              success: false,
              error: translateYouTubeError(errorMsg),
              videos: [],
            };
          }

          const videosData = await videosResponse.json();

          if (videosData.error) {
            const errorMsg = videosData.error.message || "YouTube API error";
            return {
              success: false,
              error: translateYouTubeError(errorMsg),
              videos: [],
            };
          }

          // Step 4 & 5: Process videos and filter for shorts (60 seconds or less)
          // DEBUG: Log videos.list response
          console.log(`[getTrendingShorts] Videos.list items: ${videosData.items?.length || 0}`);
          let videos = (videosData.items || [])
            .map((item: any) => ({
              id: item.id,
              title: item.snippet.title,
              description: item.snippet.description,
              thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
              channelTitle: item.snippet.channelTitle,
              channelId: item.snippet.channelId,
              publishedAt: item.snippet.publishedAt,
              viewCount: parseInt(item.statistics.viewCount || "0"),
              commentCount: parseInt(item.statistics.commentCount || "0"),
              categoryId: item.snippet.categoryId,
              tags: Array.isArray(item.snippet.tags) ? item.snippet.tags.slice(0, 12) : [],
              duration: item.contentDetails.duration,
              durationSeconds: parseDurationToSeconds(item.contentDetails.duration),
            }))
            .filter((video: any) => video.durationSeconds <= 60);
          
          // Fetch channel profile images for shorts
          const uniqueChannelIds = Array.from(new Set(videos.map((v: any) => v.channelId))).slice(0, 50);
          
          const channelThumbnails: Record<string, string> = {};
          if (uniqueChannelIds.length > 0) {
            try {
              const channelParams = new URLSearchParams({
                part: "snippet",
                id: uniqueChannelIds.join(","),
                key: apiKeyRecord.apiKey,
              });
              
              const channelResponse = await fetch(
                `https://www.googleapis.com/youtube/v3/channels?${channelParams.toString()}`,
                { method: "GET" }
              );
              
              if (channelResponse.ok) {
                const channelData = await channelResponse.json();
                (channelData.items || []).forEach((channel: any) => {
                  const thumbnailUrl = channel.snippet?.thumbnails?.high?.url || 
                                      channel.snippet?.thumbnails?.medium?.url ||
                                      channel.snippet?.thumbnails?.default?.url;
                  if (thumbnailUrl) {
                    channelThumbnails[channel.id] = thumbnailUrl;
                  }
                });
              }
            } catch (channelError) {
              console.error("Failed to fetch channel thumbnails for shorts:", channelError);
            }
          }
          
          // Add channel thumbnails to videos
          videos = videos.map((video: any) => ({
            ...video,
            channelThumbnail: channelThumbnails[video.channelId] || null,
          }));

          // DEBUG: Log duration filtering results
          console.log(`[getTrendingShorts] After 60s filter: ${videos.length} videos`);
          // Sort based on input
          if (input.sortBy === "viewCount") {
          
            videos.sort((a: any, b: any) => b.viewCount - a.viewCount);
          } else if (input.sortBy === "publishedAt") {
            videos.sort((a: any, b: any) => 
              new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
            );
          }
          // "trending" keeps the default order from search.list (viewCount)

          // Limit to maxResults (default 24)
          videos = videos.slice(0, input.maxResults);

          return {
            success: true,
            videos,
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Connection failed";
          return {
            success: false,
            error: translateYouTubeError(errorMsg),
            videos: [],
          };
        }
      }),
  }),

  googleTrends: router({
    realtimeTrending: publicProcedure
      .input(z.object({
        country: z.string().default("KR"),
      }))
      .query(async ({ input }) => {
        try {
          const data = await getGoogleTrendingSearches(input.country);
          return {
            success: true,
            data,
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Failed to fetch Google Trends data";
          console.error(`[Google Trends Router] Error:`, errorMsg);
          return {
            success: false,
            error: errorMsg,
            data: [],
          };
        }
      }),
  }),

  naver: router({
    categoryTrend: publicProcedure
      .input(z.object({
        categoryCode: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        timeUnit: z.enum(["date", "week", "month"]),
        device: z.string().optional(),
        gender: z.string().optional(),
        ages: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const clientId = process.env.NAVER_CLIENT_ID;
          const clientSecret = process.env.NAVER_CLIENT_SECRET;

          // Log environment variable status
          console.log('[Naver API] NAVER_CLIENT_ID configured:', !!clientId);
          console.log('[Naver API] NAVER_CLIENT_SECRET configured:', !!clientSecret);
          console.log('[Naver API] Input received:', JSON.stringify(input));

          if (!clientId || !clientSecret) {
            console.error('[Naver API] Missing credentials');
            return {
              success: false,
              error: "Naver API credentials not configured",
              data: [],
            };
          }

          // Category code to name mapping
          const categoryNameMap: Record<string, string> = {
            "50000000": "패션의류",
            "50000001": "패션잡화",
            "50000002": "화장품/미용",
            "50000003": "디지털/가전",
            "50000004": "식품",
            "50000005": "도서/음반/영상물",
            "50000006": "스포츠/레저",
            "50000007": "가구/인테리어",
            "50000008": "출산/육아",
            "50000009": "반려동물용품",
            "50000010": "건강/의료",
            "50000011": "생활/편의",
          };

          const categoryName = categoryNameMap[input.categoryCode] || "기타";

          const requestBody: any = {
            startDate: input.startDate,
            endDate: input.endDate,
            timeUnit: input.timeUnit,
            category: [
              {
                name: categoryName,
                param: [input.categoryCode],
              },
            ],
          };

          if (input.device && input.device !== "all") {
            requestBody.device = input.device;
          }
          if (input.gender && input.gender !== "all") {
            requestBody.gender = input.gender;
          }
          if (input.ages && input.ages.length > 0) {
            requestBody.ages = input.ages;
          }

          console.log('[Naver API] Request body:', JSON.stringify(requestBody));

          const response = await fetch(
            "https://openapi.naver.com/v1/datalab/shopping/categories",
            {
              method: "POST",
              headers: {
                "X-Naver-Client-Id": clientId,
                "X-Naver-Client-Secret": clientSecret,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(requestBody),
            }
          );

          console.log('[Naver API] HTTP Status:', response.status);

          if (!response.ok) {
            const errorData = await response.json();
            console.error('[Naver API] Error response:', JSON.stringify(errorData));
            const errorMessage = errorData.message || "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
            return {
              success: false,
              error: errorMessage,
              data: [],
            };
          }

          const data = await response.json();

          if (!data.results || !data.results[0] || !data.results[0].data) {
            return {
              success: false,
              error: "선택한 조건의 클릭 추이 데이터가 없습니다.",
              data: [],
            };
          }

          return {
            success: true,
            data: data.results[0].data,
          };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Connection failed";
          console.error('[Naver API] Exception:', errorMsg);
          return {
            success: false,
            error: "데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
            data: [],
          };
        }
      }),

    unifiedInsight: unifiedInsightProcedure,

    blogAnalysis: publicProcedure
      .input(z.object({
        blogUrl: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        try {
          return await fetchNaverBlogRss(input.blogUrl);
        } catch (error) {
          console.error("[Naver Blog Analysis] Failed", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
          return {
            success: false,
            error: "블로그 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
          };
        }
      }),

    blogPostAnalysis: publicProcedure
      .input(z.object({
        postUrl: z.string().min(1),
        title: z.string().optional(),
        keywords: z.array(z.string()).min(1).max(10),
      }))
      .mutation(async ({ input }) => {
        try {
          const clientId = process.env.NAVER_CLIENT_ID;
          const clientSecret = process.env.NAVER_CLIENT_SECRET;
          const keywords = Array.from(new Set(
            input.keywords
              .map(keyword => keyword.trim())
              .filter(Boolean)
          )).slice(0, 10);

          if (!clientId || !clientSecret) {
            return {
              success: false,
              error: "네이버 검색 API 키가 설정되어 있지 않습니다.",
            };
          }

          if (keywords.length === 0) {
            return {
              success: false,
              error: "분석할 키워드를 입력해주세요.",
            };
          }

          const credentials = await getStoredNaverSearchAdCredentials();
          const results = await Promise.all(
            keywords.map(async (keyword) => {
              try {
                const [monthlySearches, rankResult] = await Promise.all([
                  getKeywordMonthlySearches(keyword, credentials).catch((error) => {
                    console.error("[Naver Blog Post Analysis] Search volume failed", {
                      keyword,
                      error: error instanceof Error ? error.message : "Unknown error",
                    });
                    return null;
                  }),
                  getBlogPostRankForKeyword({
                    keyword,
                    postUrl: input.postUrl,
                    clientId,
                    clientSecret,
                  }),
                ]);

                return {
                  keyword,
                  monthlySearches,
                  rank: rankResult.rank,
                  matchedTitle: rankResult.matchedTitle,
                  matchedLink: rankResult.matchedLink,
                  checkedCount: rankResult.checkedCount,
                  error: null,
                };
              } catch (error) {
                console.error("[Naver Blog Post Analysis] Keyword analysis failed", {
                  keyword,
                  error: error instanceof Error ? error.message : "Unknown error",
                });

                return {
                  keyword,
                  monthlySearches: null,
                  rank: null,
                  matchedTitle: null,
                  matchedLink: null,
                  checkedCount: 0,
                  error: "키워드 분석 실패",
                };
              }
            })
          );

          return {
            success: true,
            postUrl: input.postUrl,
            title: input.title || "",
            results,
            searchedAt: new Date().toISOString(),
            searchVolumeAvailable: Boolean(credentials),
          };
        } catch (error) {
          console.error("[Naver Blog Post Analysis] Failed", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
          return {
            success: false,
            error: "게시글 분석에 실패했습니다. 잠시 후 다시 시도해주세요.",
          };
        }
      }),

    diagnostic: publicProcedure
      .input(z.object({
        keywords: z.array(z.string()).min(1).max(5),
        category: z.string(),
        startDate: z.string(),
        endDate: z.string(),
        timeUnit: z.enum(["date", "week", "month"]),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await runDiagnostics(
            input.keywords,
            input.category,
            input.startDate,
            input.endDate,
            input.timeUnit
          );
          return result;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error('[Diagnostic] Exception:', errorMsg);
          return {
            searchTrendResult: {
              api: "Search Trend API",
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
              responseTimes: 0,
              statusCode: null,
              errorCode: "DIAGNOSTIC_ERROR",
              errorMessage: errorMsg,
              resultCount: 0,
              dataPointCount: 0,
              success: false,
            },
            shoppingTrendResult: {
              api: "Shopping Trend API",
              startTime: new Date().toISOString(),
              endTime: new Date().toISOString(),
              responseTimes: 0,
              statusCode: null,
              errorCode: "DIAGNOSTIC_ERROR",
              errorMessage: errorMsg,
              resultCount: 0,
              dataPointCount: 0,
              success: false,
            },
            credentialsConfigured: false,
          };
        }
      }),
  }),

  // YouTube Bookmarks router
  youtubeBookmarks: router({
    /**
     * Get all YouTube bookmarks for the current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUserYouTubeBookmarks(ctx.user.id);
    }),

    /**
     * Check if a specific video is bookmarked
     */
    isBookmarked: protectedProcedure
      .input(
        z.object({
          videoId: z.string(),
          contentType: z.enum(["video", "shorts"]),
        })
      )
      .query(async ({ ctx, input }) => {
        return await db.isYouTubeVideoBookmarked(ctx.user.id, input.videoId, input.contentType);
      }),

    /**
     * Add a video to bookmarks
     */
    add: protectedProcedure
      .input(
        z.object({
          videoId: z.string(),
          contentType: z.enum(["video", "shorts"]),
          title: z.string(),
          thumbnailUrl: z.string().optional(),
          channelId: z.string().optional(),
          channelTitle: z.string().optional(),
          channelThumbnailUrl: z.string().optional(),
          videoUrl: z.string().optional(),
          duration: z.string().optional(),
          viewCount: z.union([z.string(), z.number()]).optional(),
          publishedAt: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const bookmarkData: any = {
          videoId: input.videoId,
          contentType: input.contentType,
          title: input.title,
        };
        if (input.thumbnailUrl) bookmarkData.thumbnailUrl = input.thumbnailUrl;
        if (input.channelId) bookmarkData.channelId = input.channelId;
        if (input.channelTitle) bookmarkData.channelTitle = input.channelTitle;
        if (input.channelThumbnailUrl) bookmarkData.channelThumbnailUrl = input.channelThumbnailUrl;
        if (input.videoUrl) bookmarkData.videoUrl = input.videoUrl;
        if (input.duration) bookmarkData.duration = input.duration;
        // Normalize viewCount to string for database storage
        if (input.viewCount !== undefined && input.viewCount !== null) {
          bookmarkData.viewCount = String(input.viewCount);
        }
        if (input.publishedAt) bookmarkData.publishedAt = input.publishedAt;
        await db.addYouTubeBookmark(ctx.user.id, bookmarkData);
        return { success: true };
      }),

    /**
     * Remove a video from bookmarks
     */
    remove: protectedProcedure
      .input(
        z.object({
          videoId: z.string(),
          contentType: z.enum(["video", "shorts"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await db.removeYouTubeBookmark(ctx.user.id, input.videoId, input.contentType);
        return { success: true };
      }),
  }),

  community: router({
    /**
     * Fetch popular posts from DC Inside Best Gallery
     * Returns normalized data for the community content list
     */
    getDcinside: publicProcedure
      .input(z.object({
        sort: z.enum(["popular", "recommend", "views", "comments"]).default("popular"),
      }).optional())
      .query(async ({ input }) => {
      console.log('[DC Inside] getDcinside called');
      const cacheKey = 'dcinside_posts_cache';
      const cacheDuration = 10 * 60 * 1000; // 10 minutes
      
      // Simple in-memory cache
      const cache = (global as any).dcinsideCache || {};
      const now = Date.now();
      
      // Check cache first
      if (cache[cacheKey] && now < cache[cacheKey].expiresAt) {
        console.log('[DC Inside] Cache HIT - returning cached data');
        console.log('[DC Inside] collectedAt:', cache[cacheKey].collectedAt);
        
        // Apply sorting to cached data
        const cachedPosts = [...cache[cacheKey].posts];
        const sortedPosts = cachedPosts.sort((a, b) => {
          const sort = input?.sort || 'popular';
          switch (sort) {
            case 'recommend':
              return b.reactionCount - a.reactionCount;
            case 'views':
              return b.viewCount - a.viewCount;
            case 'comments':
              return b.commentCount - a.commentCount;
            case 'popular':
            default:
              // Popularity score: (reactions * 2 + comments * 1.5 + views * 0.1)
              const scoreA = (a.reactionCount * 2) + (a.commentCount * 1.5) + (a.viewCount * 0.1);
              const scoreB = (b.reactionCount * 2) + (b.commentCount * 1.5) + (b.viewCount * 0.1);
              return scoreB - scoreA;
          }
        });
        
        return {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: cache[cacheKey].collectedAt,
        };
      }

      try {
        console.log('[DC Inside] Fetching data...');
        const response = await fetch('https://gall.dcinside.com/board/lists/?id=dcbest', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });
        console.log('[DC Inside] Response status:', response.status);

        if (!response.ok) {
          console.error('[DC Inside] HTTP Error:', response.status);
          return {
            success: false,
            error: '디시인사이드 인기글을 불러오지 못했습니다.',
            data: [],
          };
        }

        const html = await response.text();
        console.log('[DC Inside] HTML length:', html.length);
        const posts: any[] = [];
        
        // Parse posts - extract each row
        const rowRegex = /<tr\s+class="ub-content[^>]*us-post[^>]*data-no="(\d+)"[^>]*>([\s\S]*?)<\/tr>/g;
        console.log('[DC Inside] Regex test:', rowRegex.test(html));
        
        let rowMatch;
        let rank = 1;
        let matchCount = 0;
        
        while ((rowMatch = rowRegex.exec(html)) !== null && rank <= 30) {
          matchCount++;
          const postNo = rowMatch[1];
          const rowHtml = rowMatch[2];
          
          // Extract fields from row
          const titleMatch = rowHtml.match(/<td\s+class="gall_tit[^>]*>([\s\S]*?)<\/td>/);
          const dateMatch = rowHtml.match(/<td\s+class="gall_date"[^>]*title="([^"]*)"/);
          const viewMatch = rowHtml.match(/<td\s+class="gall_count"[^>]*>(\d+)<\/td>/);
          const reactionMatch = rowHtml.match(/<td\s+class="gall_recommend"[^>]*>(\d+)<\/td>/);
          
          if (!titleMatch) continue;
          
          const titleHtml = titleMatch[1];
          
          // Extract comment count from title
          const commentMatch = titleHtml.match(/<span\s+class="reply_num">\[(\d+)\]<\/span>/);
          const commentCount = commentMatch ? parseInt(commentMatch[1]) : 0;
          
          // Extract title text
          const titleTextMatch = titleHtml.match(/<a[^>]*>([\s\S]*?)<\/a>/);
          if (!titleTextMatch) continue;
          
          let title = titleTextMatch[1];
          // Remove HTML tags
          title = title.replace(/<[^>]*>/g, '');
          // Remove category prefix like [주갤]
          title = title.replace(/^\s*\[\w+\]\s*/, '');
          title = title.trim();
          
          if (!title) continue;
          
          posts.push({
            id: `dcinside_${postNo}`,
            rank: rank++,
            community: '디시인사이드',
            externalPostId: postNo,
            title: title,
            url: `https://gall.dcinside.com/board/view/?id=dcbest&no=${postNo}`,
            author: 'unknown',
            time: dateMatch ? dateMatch[1] : '',
            viewCount: viewMatch ? parseInt(viewMatch[1]) : 0,
            reactionCount: reactionMatch ? parseInt(reactionMatch[1]) : 0,
            commentCount: commentCount,
          });
        }
        
        console.log('[DC Inside] Total posts parsed:', posts.length);
        const collectedAt = new Date().toISOString();
        console.log('[DC Inside] New collection - collectedAt:', collectedAt);
        
        // Apply sorting based on input.sort
        const sortedPosts = [...posts].sort((a, b) => {
          const sort = input?.sort || 'popular';
          switch (sort) {
            case 'recommend':
              return b.reactionCount - a.reactionCount;
            case 'views':
              return b.viewCount - a.viewCount;
            case 'comments':
              return b.commentCount - a.commentCount;
            case 'popular':
            default:
              // Popularity score: (reactions * 2 + comments * 1.5 + views * 0.1)
              const scoreA = (a.reactionCount * 2) + (a.commentCount * 1.5) + (a.viewCount * 0.1);
              const scoreB = (b.reactionCount * 2) + (b.commentCount * 1.5) + (b.viewCount * 0.1);
              return scoreB - scoreA;
          }
        });
        
        // Update rank after sorting
        sortedPosts.forEach((post, index) => {
          post.rank = index + 1;
        });
        
        // Cache the result with collectedAt
        (global as any).dcinsideCache = {
          [cacheKey]: {
            posts: sortedPosts,
            collectedAt: collectedAt,
            expiresAt: now + cacheDuration,
          },
        };
        
        const result = {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: collectedAt,
        };
        
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[DC Inside] Exception:', errorMsg);
        return {
          success: false,
          error: '디시인사이드 인기글을 불러오지 못했습니다.',
          data: [],
        };
      }
    }),

    /**
     * Fetch popular posts from Ppomppu
     * Returns normalized data for the community content list
     * Handles EUC-KR encoding
     */
    getPpomppu: publicProcedure
      .input(z.object({ forceRefresh: z.boolean().optional() }).optional())
      .query(async ({ input }) => {
      const cacheKey = 'ppomppu_posts_cache';
      const cacheDuration = 10 * 60 * 1000; // 10 minutes
      const forceRefresh = input?.forceRefresh || false;
      
      // Simple in-memory cache
      const cache = (global as any).ppomppuCache || {};
      const now = Date.now();
      
      if (!forceRefresh && cache[cacheKey] && now - cache[cacheKey].timestamp < cacheDuration) {
        return cache[cacheKey].data;
      }

      try {
        const response = await fetch('https://www.ppomppu.co.kr/zboard/zboard.php?id=freeboard', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.ppomppu.co.kr/',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9',
          },
        });
        
        console.log('[Ppomppu] HTTP Status:', response.status);

        if (!response.ok) {
          console.error('[Ppomppu] HTTP Error:', response.status);
          return {
            success: false,
            error: '뽐뿌 인기글을 불러오지 못했습니다.',
            data: [],
          };
        }

        // Get response as ArrayBuffer and decode from EUC-KR
        const buffer = Buffer.from(await response.arrayBuffer());
        let html: string;
        
        // Force EUC-KR decoding
        try {
          const iconv = require('iconv-lite');
          html = iconv.decode(buffer, 'euc-kr');
          console.log('[Ppomppu] Decoded with EUC-KR successfully');
        } catch (decodeError) {
          console.error('[Ppomppu] EUC-KR decode failed:', decodeError);
          // Fallback to UTF-8
          html = buffer.toString('utf-8');
          console.log('[Ppomppu] Fallback to UTF-8 decode');
        }
        
        const posts: any[] = [];
        let rank = 1;
        
        console.log('[Ppomppu] HTML length:', html.length);
        
        // Find all baseList rows (게시글 행)
        const rowRegex = /<tr[^>]*class="baseList[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
        let rowMatch;
        let totalRows = 0;
        
        while ((rowMatch = rowRegex.exec(html)) !== null && rank <= 30) {
          totalRows++;
          const rowHtml = rowMatch[1];
          
          // Extract post ID
          const idMatch = rowHtml.match(/<td[^>]*class="baseList-space baseList-numb"[^>]*>(\d+)<\/td>/);
          if (!idMatch) continue;
          const postId = idMatch[1];
          
          // Extract title and URL
          const titleMatch = rowHtml.match(/<a\s+class=['"]baseList-title['"][^>]*href="([^"]*?)"[^>]*><span>([^<]+)<\/span><\/a>/);
          if (!titleMatch) continue;
          
          const relativeUrl = titleMatch[1];
          const title = titleMatch[2].trim();
          
          if (!title) continue;
          
          // Extract comment count from baseList-c span (제목 옆 숫자)
          const commentMatch = rowHtml.match(/<span class="baseList-c"[^>]*>(\d+)<\/span>/);
          const commentCount = commentMatch ? parseInt(commentMatch[1]) : 0;
          
          // Extract time
          const timeMatch = rowHtml.match(/<time[^>]*class="baseList-time"[^>]*>([^<]+)<\/time>/);
          const time = timeMatch ? timeMatch[1] : '-';
          
          // Extract reaction count from baseList-rec (추천 수, 앞 숫자만)
          const recMatch = rowHtml.match(/<td[^>]*class="baseList-space baseList-rec"[^>]*>([^<]*)<\/td>/);
          let reactionCount = 0;
          if (recMatch && recMatch[1].trim()) {
            const recStr = recMatch[1].trim();
            const recParts = recStr.split(' - ');
            reactionCount = parseInt(recParts[0]) || 0;
          }
          
          // Extract views from baseList-views (조회수)
          const viewsMatch = rowHtml.match(/<td[^>]*class="baseList-space baseList-views"[^>]*>(\d+)<\/td>/);
          const viewCount = viewsMatch ? parseInt(viewsMatch[1]) : null;
          
          // Build full URL
          const fullUrl = relativeUrl.startsWith('http') ? relativeUrl : `https://www.ppomppu.co.kr/zboard/${relativeUrl}`;
          
          posts.push({
            id: `ppomppu_${postId}`,
            rank: rank++,
            community: '뽐뿌',
            externalPostId: postId,
            title: title,
            url: fullUrl,
            author: 'unknown',
            time: time,
            viewCount: viewCount,
            reactionCount: reactionCount,
            commentCount: commentCount,
            collectedAt: new Date().toISOString(),
          });
        }
        
        console.log('[Ppomppu] Total rows found:', totalRows);
        console.log('[Ppomppu] Valid posts parsed:', posts.length);
        if (posts.length > 0) {
          console.log('[Ppomppu] First post:', posts[0].title);
        }
        
        const collectedAt = new Date().toISOString();
        const result = {
          success: true,
          error: null,
          data: posts,
          collectedAt: collectedAt,
        };
        
        // Cache the result
        (global as any).ppomppuCache = {
          [cacheKey]: {
            data: result,
            timestamp: now,
          },
        };
        
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Ppomppu] Exception:', errorMsg);
        return {
          success: false,
          error: '뽐뿌 인기글을 불러오지 못했습니다.',
          data: [],
        };
      }
    }),

    /**
     * Fetch popular posts from Nate Pann Ranking
     * Returns normalized data for the community content list
     */
    getNatePann: publicProcedure
      .input(z.object({
        sort: z.enum(["popular", "recommend", "views", "comments"]).default("popular"),
      }).optional())
      .query(async ({ input }) => {
      const cacheKey = 'natepann_posts_cache';
      const cacheDuration = 10 * 60 * 1000; // 10 minutes
      
      // Simple in-memory cache
      const cache = (global as any).natepannCache || {};
      const now = Date.now();
      
      // Check cache first
      if (cache[cacheKey] && now < cache[cacheKey].expiresAt) {
        console.log('[Nate Pann] Cache HIT - returning cached data');
        console.log('[Nate Pann] collectedAt:', cache[cacheKey].collectedAt);
        
        // Apply sorting to cached data
        const cachedPosts = [...cache[cacheKey].posts];
        const sortedPosts = cachedPosts.sort((a, b) => {
          const sort = input?.sort || 'popular';
          switch (sort) {
            case 'recommend':
              return b.reactionCount - a.reactionCount;
            case 'views':
              return b.viewCount - a.viewCount;
            case 'comments':
              return b.commentCount - a.commentCount;
            case 'popular':
            default:
              // Popularity score: (reactions * 2 + comments * 1.5 + views * 0.1)
              const scoreA = (a.reactionCount * 2) + (a.commentCount * 1.5) + (a.viewCount * 0.1);
              const scoreB = (b.reactionCount * 2) + (b.commentCount * 1.5) + (b.viewCount * 0.1);
              return scoreB - scoreA;
          }
        });
        
        return {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: cache[cacheKey].collectedAt,
        };
      }

      try {
        const response = await fetch('https://pann.nate.com/talk/ranking', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (!response.ok) {
          console.error('[Nate Pann] HTTP Error:', response.status);
          return {
            success: false,
            error: '네이트판 인기글을 불러오지 못했습니다.',
            data: [],
          };
        }

        const html = await response.text();
        const posts: any[] = [];
        
        // Parse posts - extract each li with rankNum div
        const rowRegex = /<li>\s*<div class="rankNum">[\s\S]*?<\/li>/g;
        
        let rank = 1;
        let rowMatch;
        
        while ((rowMatch = rowRegex.exec(html)) !== null && rank <= 30) {
          const rowHtml = rowMatch[0];
          
          // Extract title and URL from h2 > a tag
          const titleMatch = rowHtml.match(/<h2><a[^>]*href="([^"]*?)"[^>]*title="([^"]*?)"/);
          if (!titleMatch) continue;
          
          const relativeUrl = titleMatch[1];
          const title = titleMatch[2].trim();
          
          if (!title) continue;
          
          // Extract comment count from reple-num span
          const commentMatch = rowHtml.match(/<span\s+class="reple-num"[^>]*>.*?\((\d+)\)<\/span>/);
          const commentCount = commentMatch ? parseInt(commentMatch[1]) : 0;
          
          // Extract reaction count from rcm span (추천수)
          const reactionMatch = rowHtml.match(/<span\s+class="rcm">추천\s+(\d+)<\/span>/);
          const reactionCount = reactionMatch ? parseInt(reactionMatch[1]) : 0;
          
          // Build full URL
          const fullUrl = relativeUrl.startsWith('http') ? relativeUrl : `https://pann.nate.com${relativeUrl}`;
          
          posts.push({
            id: `natepann_${rank}`,
            rank: rank,
            community: '네이트판',
            externalPostId: `${rank}`,
            title: title,
            url: fullUrl,
            author: '-',
            time: '-',
            viewCount: null,
            reactionCount: reactionCount,
            commentCount: commentCount,
          });
          rank++;
        }
        
        const collectedAt = new Date().toISOString();
        console.log('[Nate Pann] New collection - collectedAt:', collectedAt);
        
        // Apply sorting based on input.sort
        const sortedPosts = [...posts].sort((a, b) => {
          const sort = input?.sort || 'popular';
          switch (sort) {
            case 'recommend':
              return b.reactionCount - a.reactionCount;
            case 'views':
              return b.viewCount - a.viewCount;
            case 'comments':
              return b.commentCount - a.commentCount;
            case 'popular':
            default:
              // Popularity score: (reactions * 2 + comments * 1.5 + views * 0.1)
              const scoreA = (a.reactionCount * 2) + (a.commentCount * 1.5) + (a.viewCount * 0.1);
              const scoreB = (b.reactionCount * 2) + (b.commentCount * 1.5) + (b.viewCount * 0.1);
              return scoreB - scoreA;
          }
        });
        
        // Update rank after sorting
        sortedPosts.forEach((post, index) => {
          post.rank = index + 1;
        });
        
        // Cache the result with collectedAt
        (global as any).natepannCache = {
          [cacheKey]: {
            posts: sortedPosts,
            collectedAt: collectedAt,
            expiresAt: now + cacheDuration,
          },
        };
        
        const result = {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: collectedAt,
        };
        
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Nate Pann] Exception:', errorMsg);
        return {
          success: false,
          error: '네이트판 인기글을 불러오지 못했습니다.',
          data: [],
        };
      }
    }),

    /**
     * Fetch popular posts from Ruliweb Best
     * Returns normalized data for the community content list
     */
    getRuliweb: publicProcedure
      .input(z.object({
        sort: z.enum(["popular", "recommend", "views", "comments"]).default("popular"),
      }).optional())
      .query(async ({ input }) => {
      const cacheKey = 'ruliweb_posts_cache';
      const cacheDuration = 10 * 60 * 1000; // 10 minutes
      
      // Simple in-memory cache
      const cache = (global as any).ruliwebCache || {};
      const now = Date.now();
      
      // Check cache first
      if (cache[cacheKey] && now < cache[cacheKey].expiresAt) {
        console.log('[Ruliweb] Cache HIT - returning cached data');
        console.log('[Ruliweb] collectedAt:', cache[cacheKey].collectedAt);
        
        // Apply sorting to cached data
        const cachedPosts = [...cache[cacheKey].posts];
        const sortedPosts = cachedPosts.sort((a, b) => {
          const sort = input?.sort || 'popular';
          switch (sort) {
            case 'recommend':
              return b.reactionCount - a.reactionCount;
            case 'views':
              return b.viewCount - a.viewCount;
            case 'comments':
              return b.commentCount - a.commentCount;
            case 'popular':
            default:
              // Popularity score: (reactions * 2 + comments * 1.5 + views * 0.1)
              const scoreA = (a.reactionCount * 2) + (a.commentCount * 1.5) + (a.viewCount * 0.1);
              const scoreB = (b.reactionCount * 2) + (b.commentCount * 1.5) + (b.viewCount * 0.1);
              return scoreB - scoreA;
          }
        });
        
        return {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: cache[cacheKey].collectedAt,
        };
      }

      try {
        const response = await fetch('https://bbs.ruliweb.com/best/all', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        if (!response.ok) {
          console.error('[Ruliweb] HTTP Error:', response.status);
          return {
            success: false,
            error: '루리웹 인기글을 불러오지 못했습니다.',
            data: [],
          };
        }

        const html = await response.text();
        const posts: any[] = [];
        
        // Parse posts - extract each tr with class="table_body blocktarget mode_list"
        const rowRegex = /<tr\s+class="table_body blocktarget mode_list">[\s\S]*?<\/tr>/g;
        
        let rank = 1;
        let rowMatch;
        
        while ((rowMatch = rowRegex.exec(html)) !== null && rank <= 30) {
          const rowHtml = rowMatch[0];
          
          // Extract ID
          const idMatch = rowHtml.match(/<td\s+class="id[^>]*>\s*(\d+)\s*<\/td>/);
          const postId = idMatch ? idMatch[1] : null;
          if (!postId) continue;
          
          // Extract title and URL from a tag with subject_link class
          const titleMatch = rowHtml.match(/<a\s+class="subject_link[^>]*href="([^"]*?)"[^>]*>\s*<span\s+class="text_over">\s*([^<]+?)\s*<\/span>/);
          if (!titleMatch) continue;
          
          const relativeUrl = titleMatch[1];
          const title = titleMatch[2].trim();
          
          if (!title) continue;
          
          // Extract author from td.writer
          const authorMatch = rowHtml.match(/<td\s+class="writer[^>]*>\s*([^<]+?)\s*<\/td>/);
          const author = authorMatch ? authorMatch[1].trim() : '-';
          
          // Extract recommendation count from td.recomd
          const reactionMatch = rowHtml.match(/<td\s+class="recomd">\s*(\d+)\s*<\/td>/);
          const reactionCount = reactionMatch ? parseInt(reactionMatch[1]) : 0;
          
          // Extract view count from td.hit
          const viewMatch = rowHtml.match(/<td\s+class="hit">\s*(\d+)\s*<\/td>/);
          const viewCount = viewMatch ? parseInt(viewMatch[1]) : 0;
          
          // Extract comment count from span.num_reply
          const commentMatch = rowHtml.match(/<span\s+class="num_reply[^>]*>\s*\((\d+)\)\s*<\/span>/);
          const commentCount = commentMatch ? parseInt(commentMatch[1]) : 0;
          
          // Extract time from td.time
          const timeMatch = rowHtml.match(/<td\s+class="time">[\s\S]*?(\d{2}:\d{2})\s*<\/td>/);
          const time = timeMatch ? timeMatch[1] : '-';
          
          // Extract board ID from URL
          const boardMatch = relativeUrl.match(/\/best\/board\/(\d+)/);
          const boardId = boardMatch ? boardMatch[1] : 'unknown';
          
          // Map board ID to category name
          const boardNameMap: Record<string, string> = {
            '300143': '유머',
            '300004': '게임',
            '300006': '기술',
            '300017': '게임',
            '300079': '게임',
            '300117': '게임',
            '300276': '게임',
            '300446': '게임',
          };
          const category = boardNameMap[boardId] || boardId;
          
          // Build full URL
          const fullUrl = relativeUrl.startsWith('http') ? relativeUrl : `https://bbs.ruliweb.com${relativeUrl}`;
          
          posts.push({
            id: `ruliweb_${postId}`,
            rank: rank,
            community: '루리웹',
            externalPostId: postId,
            title: title,
            url: fullUrl,
            author: author,
            time: time,
            viewCount: viewCount,
            reactionCount: reactionCount,
            commentCount: commentCount,
            category: category,
          });
          rank++;
        }
        
        const collectedAt = new Date().toISOString();
        console.log('[Ruliweb] New collection - collectedAt:', collectedAt);
        
        // Apply sorting based on input.sort
        const sortedPosts = [...posts].sort((a, b) => {
          const sort = input?.sort || 'popular';
          switch (sort) {
            case 'recommend':
              return b.reactionCount - a.reactionCount;
            case 'views':
              return b.viewCount - a.viewCount;
            case 'comments':
              return b.commentCount - a.commentCount;
            case 'popular':
            default:
              // Popularity score: (reactions * 2 + comments * 1.5 + views * 0.1)
              const scoreA = (a.reactionCount * 2) + (a.commentCount * 1.5) + (a.viewCount * 0.1);
              const scoreB = (b.reactionCount * 2) + (b.commentCount * 1.5) + (b.viewCount * 0.1);
              return scoreB - scoreA;
          }
        });
        
        // Update rank after sorting
        sortedPosts.forEach((post, index) => {
          post.rank = index + 1;
        });
        
        // Cache the result with collectedAt
        (global as any).ruliwebCache = {
          [cacheKey]: {
            posts: sortedPosts,
            collectedAt: collectedAt,
            expiresAt: now + cacheDuration,
          },
        };
        
        const result = {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: collectedAt,
        };
        
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Ruliweb] Exception:', errorMsg);
        return {
          success: false,
          error: '루리웹 인기글을 불러오지 못했습니다.',
          data: [],
        };
      }
    }),

    getInven: publicProcedure
      .input(z.object({
        sort: z.enum(["popular", "recommend", "views", "comments"]).default("popular"),
      }).optional())
      .query(async ({ input }) => {
      const cacheKey = 'inven_best';
      const cacheDuration = 10 * 60 * 1000; // 10 minutes
      
      // Simple in-memory cache
      const cache = (global as any).invenCache || {};
      const now = Date.now();
      
      // Check cache first
      if (cache[cacheKey] && now < cache[cacheKey].expiresAt) {
        console.log('[Inven] Cache HIT - returning cached data');
        console.log('[Inven] collectedAt:', cache[cacheKey].collectedAt);
        
        // Apply sorting to cached data
        const cachedPosts = [...cache[cacheKey].posts];
        const sortedPosts = cachedPosts.sort((a, b) => {
          const sort = input?.sort || 'popular';
          switch (sort) {
            case 'recommend':
              return b.reactionCount - a.reactionCount;
            case 'views':
              return b.viewCount - a.viewCount;
            case 'comments':
              return b.commentCount - a.commentCount;
            case 'popular':
            default:
              const scoreA = (a.reactionCount * 2) + (a.commentCount * 1.5) + (a.viewCount * 0.1);
              const scoreB = (b.reactionCount * 2) + (b.commentCount * 1.5) + (b.viewCount * 0.1);
              return scoreB - scoreA;
          }
        });
        
        return {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: cache[cacheKey].collectedAt,
        };
      }

      try {
        const https = require('https');
        const zlib = require('zlib');
        
        // Fetch with gzip decompression support
        const html = await new Promise<string>((resolve, reject) => {
          https.get('https://www.inven.co.kr/board/webzine/2097', {
            headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
        }, (res: any) => {
          let data = '';
          
          // Handle gzip compression
          const stream = res.headers['content-encoding'] === 'gzip' 
            ? res.pipe(zlib.createGunzip())
            : res;
          
          stream.on('data', (chunk: Buffer) => data += chunk);
          stream.on('end', () => resolve(data));
        }).on('error', reject);
      });
      
        const cheerio = require('cheerio');
      const $ = cheerio.load(html);
      
        const posts: any[] = [];
        const rows = $('tbody tr');
        let rank = 1;
      
        console.log(`[Inven] Total rows found: ${rows.length}`);
      
        rows.each((idx: number, row: any) => {
        if (rank > 50) return; // Limit to 50 posts
        
        const $row = $(row);
        
        // Skip notice posts
        if ($row.find('.notice-icon').length > 0) {
          return;
        }
        
        // Extract title from img alt (first img that's not icon)
        let title = '';
        const imgs = $row.find('img[alt]');
        imgs.each((i: number, img: any) => {
          const alt = $(img).attr('alt') || '';
          if (alt && !alt.includes('아이콘') && !alt.includes('icon')) {
            title = alt;
            return false; // break
          }
        });
        
        if (!title) {
          return;
        }
        
        // Extract URL from a.subject-link
        const subjLink = $row.find('a.subject-link');
        let url = subjLink.attr('href') || '';
        
        // Normalize URL to absolute path
        if (url && !url.startsWith('http')) {
          url = 'https://www.inven.co.kr' + url;
        }
        
        // Extract td elements
        const tds = $row.find('td');
        
        // Category from td[1]
        const category = tds.eq(1).text().trim();
        
        // Author from span.layerNickName
        const author = $row.find('span.layerNickName').text().trim();
        
        // Time from td[3]
        const time = tds.eq(3).text().trim();
        
        // Views from td[4]
        const viewsStr = tds.eq(4).text().trim();
        const viewCount = parseInt(viewsStr.replace(/,/g, '')) || 0;
        
        // Comments from td[5]
        const commentStr = tds.eq(5).text().trim();
        const commentCount = parseInt(commentStr) || 0;
        
        // Reaction count is not available in Inven
        const reactionCount = 0;
        
        // Create post object
        posts.push({
          id: `inven_${rank}`,
          rank: rank,
          community: '인벤',
          externalPostId: `inven_${idx}`,
          title: title,
          url: url,
          author: author,
          time: time,
          viewCount: viewCount,
          reactionCount: reactionCount,
          commentCount: commentCount,
          category: category,
        });
        
        rank++;
      });
      
          console.log(`[Inven] Posts parsed: ${posts.length}`);
        if (posts.length > 0) {
          console.log(`[Inven] First post: ${posts[0].title}`);
        }
        
          const collectedAt = new Date().toISOString();
          console.log('[Inven] New collection - collectedAt:', collectedAt);
          
          // Apply sorting based on input.sort
          const sortedPosts = [...posts].sort((a, b) => {
            const sort = input?.sort || 'popular';
            switch (sort) {
              case 'recommend':
                return b.reactionCount - a.reactionCount;
              case 'views':
                return b.viewCount - a.viewCount;
              case 'comments':
                return b.commentCount - a.commentCount;
              case 'popular':
              default:
                const scoreA = (a.reactionCount * 2) + (a.commentCount * 1.5) + (a.viewCount * 0.1);
                const scoreB = (b.reactionCount * 2) + (b.commentCount * 1.5) + (b.viewCount * 0.1);
                return scoreB - scoreA;
            }
          });
          
          // Update rank after sorting
          sortedPosts.forEach((post, index) => {
            post.rank = index + 1;
          });
          
          // Cache the result with collectedAt
          (global as any).invenCache = {
            [cacheKey]: {
              posts: sortedPosts,
              collectedAt: collectedAt,
              expiresAt: now + cacheDuration,
            },
          };
          
            const result = {
            success: true,
            error: null,
            data: sortedPosts,
            collectedAt: collectedAt,
        };
      
        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Inven] Exception:', errorMsg);
        return {
          success: false,
          error: '인벤 게시판을 불러오지 못했습니다.',
          data: [],
        };
      }
    }),
    getBobaedream: publicProcedure
      .input(z.object({
        sort: z.enum(["popular", "recommend", "views", "comments"]).default("popular"),
      }).optional())
      .query(async ({ input }) => {
      const cacheKey = 'bobaedream_posts_cache';
      const cacheDuration = 10 * 60 * 1000; // 10분
      const BOBAEDREAM_URL = 'https://www.bobaedream.co.kr/list?code=best';
      const now = Date.now();
      
      // Simple in-memory cache
      const cache = (global as any).bobaedreamCache || {};
      
      // Check cache first
      if (cache[cacheKey] && now < cache[cacheKey].expiresAt) {
        console.log('[Bobaedream] Cache HIT - returning cached data');
        console.log('[Bobaedream] collectedAt:', cache[cacheKey].collectedAt);
        
        // Apply sorting to cached data
        const cachedPosts = [...cache[cacheKey].posts];
        const sortedPosts = cachedPosts.sort((a, b) => {
          const sort = input?.sort || 'popular';
          switch (sort) {
            case 'recommend':
              return b.reactionCount - a.reactionCount;
            case 'views':
              return b.viewCount - a.viewCount;
            case 'comments':
              return b.commentCount - a.commentCount;
            case 'popular':
            default:
              const scoreA = (a.reactionCount * 2) + (a.commentCount * 1.5) + (a.viewCount * 0.1);
              const scoreB = (b.reactionCount * 2) + (b.commentCount * 1.5) + (b.viewCount * 0.1);
              return scoreB - scoreA;
          }
        });
        
        return {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: cache[cacheKey].collectedAt,
        };
      }

      try {
        console.log('[Bobaedream] Fetching from:', BOBAEDREAM_URL);
        const response = await fetch(BOBAEDREAM_URL);
        
        if (!response.ok) {
          console.error('[Bobaedream] HTTP Error:', response.status);
          return {
            success: false,
            error: '보배드림을 불러오지 못했습니다.',
            data: [],
          };
        }

        const html = await response.text();
        const posts: any[] = [];
        
        console.log('[Bobaedream] HTML length:', html.length);
        
        // 게시글 행 파싱 - itemscope이 있는 tr만 추출
        const rowRegex = /<tr[^>]*itemscope[^>]*>([\s\S]*?)<\/tr>/g;
        let rowMatch;
        let totalRows = 0;
        let validRows = 0;

        while ((rowMatch = rowRegex.exec(html)) !== null) {
          totalRows++;
          const rowHtml = rowMatch[1];
          
          // 공지/광고글 제외
          if (rowHtml.includes('공지') || rowHtml.includes('광고')) {
            continue;
          }

          // 제목과 URL 추출 (bsubject 클래스 사용)
          const titleMatch = rowHtml.match(/<a[^>]*class="bsubject"[^>]*href="([^"]*?)"[^>]*>([^<]*)<\/a>/);
          if (!titleMatch) {
            continue;
          }
          
          let url = titleMatch[1];
          let title = titleMatch[2].trim();
          
          // URL 정규화
          if (!url.startsWith('http')) {
            url = `https://www.bobaedream.co.kr${url}`;
          }
          
          // 게시판 메뉴 링크 제외 (list.php 제외)
          if (url.includes('list.php')) {
            continue;
          }
          
          // 제목에서 댓글 수 분리 (12) 형식
          let commentCount = 0;
          const commentMatch = rowHtml.match(/<strong[^>]*class="totreply"[^>]*>(\d+)<\/strong>/);
          if (commentMatch) {
            commentCount = parseInt(commentMatch[1], 10);
          }
          
          // 작성자 추출 (author 클래스)
          let author = '-';
          const authorMatch = rowHtml.match(/<span[^>]*class="author"[^>]*title="([^"]*?)"/);
          if (authorMatch) {
            author = authorMatch[1].trim();
          }
          
          // 시간 추출 (date 클래스)
          let time = '-';
          const timeMatch = rowHtml.match(/<td[^>]*class="date"[^>]*>([^<]*)<\/td>/);
          if (timeMatch) {
            time = timeMatch[1].trim();
          }
          
          // 추천수 추출 (recomm 클래스의 font 태그)
          let reactionCount = 0;
          const reactionMatch = rowHtml.match(/<td[^>]*class="recomm"[^>]*>\s*<font[^>]*style="color:#ff7234[^>]*>(\d+)<\/font>/);
          if (reactionMatch) {
            reactionCount = parseInt(reactionMatch[1], 10);
          }
          
          // 조회수 추출 (count 클래스) - <strong> 태그 포함 가능
          let viewCount = 0;
          const viewMatch = rowHtml.match(/<td[^>]*class="count"[^>]*>([\s\S]*?)<\/td>/);
          if (viewMatch) {
            const countText = viewMatch[1].replace(/<[^>]*>/g, '').trim();
            const numMatch = countText.match(/(\d+)/);
            if (numMatch) {
              viewCount = parseInt(numMatch[1], 10);
            }
          }
          
          validRows++;
          
          if (validRows <= 5) {
            console.log(`[Bobaedream] Row ${validRows}: title="${title}", author="${author}", time="${time}", reaction=${reactionCount}, view=${viewCount}, comment=${commentCount}`);
          }
          
          posts.push({
            id: `bobaedream-${validRows}`,
            rank: validRows,
            community: '보배드림',
            externalPostId: url.split('No=')[1]?.split('&')[0] || `${validRows}`,
            title,
            url,
            author,
            time,
            viewCount,
            reactionCount,
            commentCount,
            category: '베스트',
          });
        }

        console.log('[Bobaedream] Total rows found:', totalRows);
        console.log('[Bobaedream] Valid posts parsed:', validRows);
        if (posts.length > 0) {
          console.log('[Bobaedream] First post:', posts[0].title);
        }

        const collectedAt = new Date().toISOString();
        console.log('[Bobaedream] New collection - collectedAt:', collectedAt);
        
        // Apply sorting based on input.sort
        const sortedPosts = [...posts].sort((a, b) => {
          const sort = input?.sort || 'popular';
          switch (sort) {
            case 'recommend':
              return b.reactionCount - a.reactionCount;
            case 'views':
              return b.viewCount - a.viewCount;
            case 'comments':
              return b.commentCount - a.commentCount;
            case 'popular':
            default:
              const scoreA = (a.reactionCount * 2) + (a.commentCount * 1.5) + (a.viewCount * 0.1);
              const scoreB = (b.reactionCount * 2) + (b.commentCount * 1.5) + (b.viewCount * 0.1);
              return scoreB - scoreA;
          }
        });
        
        // Update rank after sorting
        sortedPosts.forEach((post, index) => {
          post.rank = index + 1;
        });
        
        // 캐시 저장
        (global as any).bobaedreamCache = {
          [cacheKey]: {
            posts: sortedPosts,
            collectedAt: collectedAt,
            expiresAt: now + cacheDuration,
          },
        };
        
        const result = {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: collectedAt,
        };

        return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Bobaedream] Exception:', errorMsg);
        return {
          success: false,
          error: '보배드림을 불러오지 못했습니다.',
          data: [],
        };
      }
    }),
    getHumorUniv: publicProcedure
      .input(z.object({
        sort: z.enum(["popular", "recommend", "views", "comments"]).default("popular"),
      }).optional())
      .query(async ({ input }) => {
      const cacheKey = 'humoruniv_posts_cache';
      const cacheDuration = 10 * 60 * 1000; // 10분
      const HUMORUNIV_URL = 'https://web.humoruniv.com/board/humor/list.html?table=pds';
      const now = Date.now();
      let timeout: NodeJS.Timeout | null = null;
      
      // Simple in-memory cache
      const cache = (global as any).humorunivCache || {};
      
      // Check cache first
      if (cache[cacheKey] && now < cache[cacheKey].expiresAt) {
        console.log('[HumorUniv] Cache HIT - returning cached data');
        console.log('[HumorUniv] collectedAt:', cache[cacheKey].collectedAt);
        
        // Apply sorting to cached data
        const cachedPosts = [...cache[cacheKey].posts];
        const sortedPosts = cachedPosts.sort((a, b) => {
          const sort = input?.sort || 'popular';
          switch (sort) {
            case 'recommend':
              return b.reactionCount - a.reactionCount;
            case 'views':
              return b.viewCount - a.viewCount;
            case 'comments':
              return b.commentCount - a.commentCount;
            case 'popular':
            default:
              const scoreA = (a.reactionCount * 2) + (a.commentCount * 1.5) + (a.viewCount * 0.1);
              const scoreB = (b.reactionCount * 2) + (b.commentCount * 1.5) + (b.viewCount * 0.1);
              return scoreB - scoreA;
          }
        });
        
        return {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: cache[cacheKey].collectedAt,
        };
      }

      try {
        console.log('[HumorUniv] Fetching from:', HUMORUNIV_URL);
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        const response = await fetch(HUMORUNIV_URL, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'ko-KR,ko;q=0.9',
          },
        });
        
        clearTimeout(timeout);
        if (!response.ok) {
          console.error('[HumorUniv] HTTP Error:', response.status);
          return {
            success: false,
            error: '웃긴대학을 불러오지 못했습니다.',
            data: [],
          };
        }

        // Get response as ArrayBuffer and decode from EUC-KR
        const buffer = Buffer.from(await response.arrayBuffer());
        let html: string;
        
        // Force EUC-KR decoding
        try {
          const iconv = require('iconv-lite');
          html = iconv.decode(buffer, 'euc-kr');
          console.log('[HumorUniv] Decoded with EUC-KR successfully');
        } catch (decodeError) {
          console.error('[HumorUniv] EUC-KR decode failed:', decodeError);
          // Fallback to UTF-8
          html = buffer.toString('utf-8');
          console.log('[HumorUniv] Fallback to UTF-8 decode');
        }
        const posts: any[] = [];
        
        console.log('[HumorUniv] HTML length:', html.length);
        
        // Helper: extract row with proper nested <tr> handling
        const extractRowWithNesting = (html: string, startIdx: number): string | null => {
          const trStart = html.indexOf('<tr', startIdx);
          if (trStart === -1) return null;
          
          let depth = 1;
          let idx = html.indexOf('>', trStart) + 1;
          
          while (depth > 0 && idx < html.length) {
            if (html.substr(idx, 4) === '<tr ') {
              depth++;
              idx += 4;
            } else if (html.substr(idx, 4) === '<tr>') {
              depth++;
              idx += 4;
            } else if (html.substr(idx, 5) === '</tr>') {
              depth--;
              if (depth === 0) {
                return html.substring(trStart, idx + 5);
              }
              idx += 5;
            } else {
              idx++;
            }
          }
          
          return null;
        }
        
        // Extract all rows with proper nesting
        let startIdx = 0;
        let totalRows = 0;
        let validRows = 0;

        while (validRows < 30) {
          const idIdx = html.indexOf('id="li_chk_pds-', startIdx);
          if (idIdx === -1) break;
          
          const rowHtml = extractRowWithNesting(html, idIdx - 100);
          if (!rowHtml) break;
          
          totalRows++;
          
          // Extract postId from id attribute
          const idMatch = rowHtml.match(/id="li_chk_pds-([^"]+)"/);
          if (!idMatch) {
            startIdx = idIdx + 1;
            continue;
          }
          const postId = idMatch[1];
          
          // 제목 추출 (span[id^="title_chk_pds-"])
          const titleMatch = rowHtml.match(/<span[^>]*id="title_chk_pds-[^"]*"[^>]*>([\s\S]*?)<\/span>/);
          if (!titleMatch) {
            startIdx = idIdx + 1;
            continue;
          }
          
          let title = titleMatch[1].trim().replace(/\s+/g, ' ');
          if (!title) {
            startIdx = idIdx + 1;
            continue;
          }
          
          // 댓글 수 추출 (span.list_comment_num)
          let commentCount = 0;
          const commentMatch = rowHtml.match(/<span[^>]*class="list_comment_num"[^>]*>\s*\[(\d+)\]/);
          if (commentMatch) {
            commentCount = parseInt(commentMatch[1], 10);
          }
          
          // URL 추출 (read.html?table=pds&number={number})
          let url = `https://web.humoruniv.com/board/humor/read.html?table=pds&number=${postId}`;
          
          // 작성자 추출 (span.hu_nick_txt - without quotes!)
          let author = '-';
          const authorMatch = rowHtml.match(/<span[^>]*class=hu_nick_txt[^>]*>([^<]+)<\/span>/);
          if (authorMatch) {
            author = authorMatch[1].trim();
          }
          
          // 날짜 추출 (span.w_date)
          let date = '-';
          const dateMatch = rowHtml.match(/<span[^>]*class="w_date"[^>]*>([^<]+)<\/span>/);
          if (dateMatch) {
            date = dateMatch[1].trim();
          }
          
          // 시간 추출 (span.w_time)
          let time = '-';
          const timeMatch = rowHtml.match(/<span[^>]*class="w_time"[^>]*>([^<]+)<\/span>/);
          if (timeMatch) {
            time = timeMatch[1].trim();
          }
          
          // 날짜와 시간 결합
          const fullTime = date !== '-' && time !== '-' ? `${date} ${time}` : date !== '-' ? date : time;
          
          // 조회수 추출 (첫번째 td.li_und)
          let viewCount = null;
          const tdMatches = rowHtml.match(/<td[^>]*class="li_und"[^>]*>([\s\S]*?)<\/td>/g);
          if (tdMatches && tdMatches.length >= 1) {
            const viewStr = tdMatches[0].replace(/<[^>]*>/g, '').trim();
            if (viewStr && viewStr !== '-') {
              viewCount = parseInt(viewStr.replace(/,/g, ''), 10) || null;
            }
          }
          
          // 추천수 추출 (두번째 td.li_und)
          let reactionCount = 0;
          if (tdMatches && tdMatches.length >= 2) {
            const recStr = tdMatches[1].replace(/<[^>]*>/g, '').trim();
            if (recStr && recStr !== '-') {
              reactionCount = parseInt(recStr.replace(/,/g, ''), 10) || 0;
            }
          }
          
          validRows++;
          
          if (validRows <= 5) {
            console.log(`[HumorUniv] Row ${validRows}: title="${title}", author="${author}", time="${fullTime}", view=${viewCount}, reaction=${reactionCount}, comment=${commentCount}`);
          }
          
          posts.push({
            id: `humoruniv_${postId}`,
            rank: validRows,
            community: '웃긴대학',
            externalPostId: postId,
            title,
            url,
            author,
            time: fullTime,
            viewCount,
            reactionCount,
            commentCount,
            category: '실시간',
          });
          
          startIdx = idIdx + 1;
        }

        console.log('[HumorUniv] Total rows found:', totalRows);
        console.log('[HumorUniv] Valid posts parsed:', validRows);
        if (posts.length > 0) {
          console.log('[HumorUniv] First post:', posts[0].title);
        }

        const collectedAt = new Date().toISOString();
        console.log('[HumorUniv] New collection - collectedAt:', collectedAt);
        
        // Apply sorting based on input.sort
        const sortedPosts = [...posts].sort((a, b) => {
          const sort = input?.sort || 'popular';
          switch (sort) {
            case 'recommend':
              return b.reactionCount - a.reactionCount;
            case 'views':
              return b.viewCount - a.viewCount;
            case 'comments':
              return b.commentCount - a.commentCount;
            case 'popular':
            default:
              const scoreA = (a.reactionCount * 2) + (a.commentCount * 1.5) + (a.viewCount * 0.1);
              const scoreB = (b.reactionCount * 2) + (b.commentCount * 1.5) + (b.viewCount * 0.1);
              return scoreB - scoreA;
          }
        });
        
        // Update rank after sorting
        sortedPosts.forEach((post, index) => {
          post.rank = index + 1;
        });
        
        // 캐시 저장
        (global as any).humorunivCache = {
          [cacheKey]: {
            posts: sortedPosts,
            collectedAt: collectedAt,
            expiresAt: now + cacheDuration,
          },
        };
        
        const result = {
          success: true,
          error: null,
          data: sortedPosts,
          collectedAt: collectedAt,
        };

        return result;
      } catch (error) {
        if (timeout) clearTimeout(timeout);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[HumorUniv] Exception:', errorMsg);
        if (errorMsg.includes('abort')) {
          console.error('[HumorUniv] Request timeout (10s exceeded)');
        }
        return {
          success: false,
          error: '웃긴대학을 불러오지 못했습니다.',
          data: [],
        };
      }
    }),
  }),

  news: router({
    /**
     * Get latest news from RSS
     */
      getLatestNews: publicProcedure
      .input(z.object({ limit: z.number().default(20), category: z.string().default('all') }).optional())
      .query(async ({ input }) => {
        try {
          const limit = input?.limit || 20;
          const category = input?.category || 'all';
          
          console.log(`\n[News] ===== RSS Fetch Start =====`);
          console.log(`[News] Frontend category: ${category}`);
          
          // Category key to Google News RSS URL mapping (using search-based RSS URLs)
          const categoryUrls: Record<string, string> = {
            'all': 'https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko',
            'nation': 'https://news.google.com/rss/search?q=%EC%A0%95%EC%B9%98%20OR%20%EC%82%AC%ED%9A%8C&hl=ko&gl=KR&ceid=KR:ko',
            'business': 'https://news.google.com/rss/search?q=%EA%B2%BD%EC%A0%9C&hl=ko&gl=KR&ceid=KR:ko',
            'technology': 'https://news.google.com/rss/search?q=IT%20OR%20%EA%B8%B0%EC%88%A0&hl=ko&gl=KR&ceid=KR:ko',
            'science': 'https://news.google.com/rss/search?q=%EA%B3%BC%ED%95%99&hl=ko&gl=KR&ceid=KR:ko',
            'entertainment': 'https://news.google.com/rss/search?q=%EC%97%B0%EC%98%88&hl=ko&gl=KR&ceid=KR:ko',
            'sports': 'https://news.google.com/rss/search?q=%EC%8A%A4%ED%8F%AC%EC%B8%A0&hl=ko&gl=KR&ceid=KR:ko',
            'health': 'https://news.google.com/rss/search?q=%EA%B1%B4%EA%B0%95&hl=ko&gl=KR&ceid=KR:ko',
            'world': 'https://news.google.com/rss/search?q=%EA%B5%AD%EC%A0%9C&hl=ko&gl=KR&ceid=KR:ko',
          };
          
          const rssUrl = categoryUrls[category] || categoryUrls['all'];
          
          console.log(`[News] Mapped topic URL: ${rssUrl}`);
          
          const response = await fetch(rssUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          
          console.log(`[News] Fetch status: ${response.status} ${response.statusText}`);
          console.log(`[News] Content-Type: ${response.headers.get('content-type')}`);
          
          if (!response.ok) {
            console.log(`[News] ===== RSS Fetch FAILED (HTTP ${response.status}) =====`);
            throw new Error(`RSS fetch failed: ${response.status}`);
          }
          
          let xml: string;
          try {
            xml = await response.text();
            console.log(`[News] Response body length: ${xml.length} chars`);
            console.log(`[News] First 300 chars: ${xml.substring(0, 300)}`);
          } catch (textError) {
            console.error(`[News] Error reading response text:`, textError);
            console.log(`[News] ===== RSS Fetch FAILED (Text read error) =====`);
            return [];
          }
          
          if (!xml || xml.length === 0) {
            console.log(`[News] ===== RSS Fetch FAILED (Empty response) =====`);
            return [];
          }
          
          // Helper: Decode HTML entities
          const decodeHtmlEntities = (text: string): string => {
            const entities: Record<string, string> = {
              '&amp;': '&',
              '&lt;': '<',
              '&gt;': '>',
              '&quot;': '"',
              '&#39;': "'",
              '&apos;': "'",
            };
            let decoded = text;
            for (const [entity, char] of Object.entries(entities)) {
              decoded = decoded.replace(new RegExp(entity, 'g'), char);
            }
            return decoded;
          };

          // Helper: Extract publisher from title (format: "Title - Publisher")
          const extractPublisher = (title: string): { title: string; publisher: string } => {
            const match = title.match(/^(.+?)\s*-\s*([^-]+)$/);
            if (match) {
              return {
                title: match[1].trim(),
                publisher: match[2].trim(),
              };
            }
            return { title, publisher: 'Google News' };
          };

          // Helper: Clean description - remove HTML tags and entities
          const cleanDescription = (text: string): string => {
            // Remove HTML tags
            let cleaned = text.replace(/<[^>]*>/g, '');
            // Decode HTML entities
            cleaned = decodeHtmlEntities(cleaned);
            // Remove extra whitespace
            cleaned = cleaned.replace(/\s+/g, ' ').trim();
            // Limit length
            if (cleaned.length > 150) {
              cleaned = cleaned.substring(0, 150) + '...';
            }
            return cleaned;
          };
          
          // Simple XML parsing for RSS items
          console.log(`[News] Starting XML item parsing...`);
          const itemRegex = /<item>([\s\S]*?)<\/item>/g;
          const items = [];
          let match;
          let itemCount = 0;
          
          try {
            while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
              itemCount++;
            const itemXml = match[1];
            
            const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/);
            const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
            const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
            const descriptionMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/);
            
            if (titleMatch && linkMatch) {
              const rawTitle = titleMatch[1].replace(/<[^>]*>/g, '').trim();
              const { title, publisher } = extractPublisher(rawTitle);
              const link = linkMatch[1].trim();
              const pubDate = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();
              const rawDescription = descriptionMatch ? descriptionMatch[1] : '';
              const description = cleanDescription(rawDescription);
              
              items.push({
                title,
                link,
                pubDate,
                description,
                source: publisher,
                thumbnail: null,
              });
            }
          }
          } catch (parseError) {
            console.error(`[News] XML parsing error:`, parseError);
            console.log(`[News] ===== RSS Fetch FAILED (Parsing error) =====`);
            return [];
          }
          
          console.log(`[News] Total items found in XML: ${itemCount}`);
          console.log(`[News] Items parsed successfully: ${items.length}`);
          console.log(`[News] ===== RSS Fetch SUCCESS =====`);
          
          return items;
        } catch (error) {
          console.error('[News] RSS fetch error:', error);
          console.log(`[News] ===== RSS Fetch FAILED (Exception) =====`);
          console.error('[News] Error details:', error instanceof Error ? error.message : String(error));
          return [];
        }
      }),

    /**
     * Search news from Naver News API
     */
    searchNews: publicProcedure
      .input(z.object({
        query: z.string().min(1).max(100),
        limit: z.number().default(10),
      }))
      .query(async ({ input }) => {
        try {
          const { query, limit } = input;
          const clientId = process.env.NAVER_CLIENT_ID || '';
          const clientSecret = process.env.NAVER_CLIENT_SECRET || '';
          
          if (!clientId || !clientSecret) {
            console.error('[News Search] Missing Naver API credentials');
            return [];
          }
          
          const encodedQuery = encodeURIComponent(query);
          console.log('[News Search] Input query:', query);
          
          // Fetch multiple pages: display=100, start at 1, 101, 201
          const startPositions = [1, 101, 201];
          const allItems: any[] = [];
          const statusCodes: number[] = [];
          const itemCounts: number[] = [];
          
          for (const start of startPositions) {
            const naverUrl = `https://openapi.naver.com/v1/search/news.json?query=${encodedQuery}&display=100&start=${start}&sort=date`;
            console.log(`[News Search] Fetching page start=${start}`);
            
            const response = await fetch(naverUrl, {
              headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret,
              }
            });
            
            statusCodes.push(response.status);
            console.log(`[News Search] Page start=${start} status code:`, response.status);
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`[News Search] Page start=${start} error:`, errorText);
              try {
                const errorData = JSON.parse(errorText);
                console.error(`[News Search] Page start=${start} errorCode:`, errorData.errorCode);
              } catch {}
              continue;
            }
            
            const data = await response.json() as any;
            const pageItems = data.items || [];
            itemCounts.push(pageItems.length);
            console.log(`[News Search] Page start=${start} items count:`, pageItems.length);
            allItems.push(...pageItems);
            
            // Stop if we have enough items
            if (allItems.length >= 200) break;
          }
          
          console.log('[News Search] Total start positions called:', startPositions.length);
          console.log('[News Search] Status codes:', statusCodes.join(','));
          console.log('[News Search] Items per page:', itemCounts.join(','));
          console.log('[News Search] Total collected items:', allItems.length);
          
          // Helper: Decode HTML entities
          const decodeHtmlEntities = (text: string): string => {
            const entities: Record<string, string> = {
              '&amp;': '&',
              '&lt;': '<',
              '&gt;': '>',
              '&quot;': '"',
              '&#39;': "'",
              '&apos;': "'",
            };
            let decoded = text;
            for (const [entity, char] of Object.entries(entities)) {
              decoded = decoded.replace(new RegExp(entity, 'g'), char);
            }
            return decoded;
          };

          // Helper: Normalize text for comparison
          const normalizeText = (text: string): string => {
            // Remove HTML tags
            let normalized = text.replace(/<[^>]*>/g, '');
            // Decode HTML entities
            normalized = decodeHtmlEntities(normalized);
            // Lowercase
            normalized = normalized.toLowerCase();
            // Remove extra whitespace
            normalized = normalized.replace(/\s+/g, ' ').trim();
            return normalized;
          };

          // Helper: Clean description - remove HTML tags and entities
          const cleanDescription = (text: string): string => {
            // Remove HTML tags
            let cleaned = text.replace(/<[^>]*>/g, '');
            // Decode HTML entities
            cleaned = decodeHtmlEntities(cleaned);
            // Remove extra whitespace
            cleaned = cleaned.replace(/\s+/g, ' ').trim();
            // Limit length
            if (cleaned.length > 150) {
              cleaned = cleaned.substring(0, 150) + '...';
            }
            return cleaned;
          };

          // Exclusion keywords - only exclude if user didn't search for them
          const exclusionKeywords = [
            '오늘의 운세', '운세', '띠별', '별자리', '사주',
            '로또', '당첨번호', '광고', '홍보', '이벤트',
            '쿠폰', '할인', '특가', '쇼핀', '증권가', '추천주', '종목추천'
          ];
          
          const shouldExclude = (title: string, description: string, searchQuery: string): boolean => {
            const normalizedQuery = normalizeText(searchQuery);
            const normalizedTitle = normalizeText(title);
            const normalizedDesc = normalizeText(description);
            
            // If user explicitly searched for exclusion keywords, don't exclude
            for (const keyword of exclusionKeywords) {
              if (normalizedQuery.includes(normalizeText(keyword))) {
                return false;
              }
            }
            
            // Check if title or description contains exclusion keywords
            for (const keyword of exclusionKeywords) {
              const normalizedKeyword = normalizeText(keyword);
              if (normalizedTitle.includes(normalizedKeyword) || normalizedDesc.includes(normalizedKeyword)) {
                return true;
              }
            }
            
            return false;
          };
          
          // Helper: Extract main keywords from multi-word query
          const getMainKeywords = (query: string): string[] => {
            const normalized = normalizeText(query);
            const words = normalized.split(' ').filter(w => w.length > 0);
            return words.length > 1 ? words : [normalized];
          };
          
          // Helper: Normalize domain for consistent matching
          const normalizeDomain = (hostname: string): string => {
            // Remove common subdomains: www., m., n., api., news., amp., mobile., etc.
            let normalized = hostname.replace(/^(www\.|m\.|n\.|api\.|news\.|amp\.|mobile\.)/, '');
            // Convert to lowercase
            normalized = normalized.toLowerCase();
            return normalized;
          };
          
          // Helper: Extract meta site_name from HTML with timeout
          const extractMetaSiteName = async (urlString: string): Promise<string | null> => {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
              
              const response = await fetch(urlString, {
                signal: controller.signal,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
              });
              clearTimeout(timeoutId);
              
              if (!response.ok) {
                console.log('[News Search] Meta fetch failed, status:', response.status);
                return null;
              }
              
              const html = await response.text();
              
              // Try og:site_name first
              let match = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
              if (match && match[1]) {
                console.log('[News Search] Found og:site_name:', match[1]);
                return match[1];
              }
              
              // Try application-name
              match = html.match(/<meta\s+name=["']application-name["']\s+content=["']([^"']+)["']/i);
              if (match && match[1]) {
                console.log('[News Search] Found application-name:', match[1]);
                return match[1];
              }
              
              // Try twitter:site
              match = html.match(/<meta\s+name=["']twitter:site["']\s+content=["']([^"']+)["']/i);
              if (match && match[1]) {
                console.log('[News Search] Found twitter:site:', match[1]);
                return match[1];
              }
              
              // Try to extract from title (e.g., "뉴스 - 서울경제TV")
              match = html.match(/<title>([^<]+)<\/title>/i);
              if (match && match[1]) {
                const titleText = match[1].trim();
                // Look for common news site patterns in title
                const siteMatch = titleText.match(/([가-힣\w]+(?:뉴스|TV|신문|일보|경제|매체|미디어))/);
                if (siteMatch && siteMatch[1]) {
                  console.log('[News Search] Extracted from title:', siteMatch[1]);
                  return siteMatch[1];
                }
              }
              
              return null;
            } catch (error) {
              console.log('[News Search] Meta fetch error (timeout or network):', error instanceof Error ? error.message : 'unknown');
              return null;
            }
          };
          
          // Helper: Extract source/outlet name from URL
          const extractSourceFromUrl = async (urlString: string): Promise<string> => {
            const sourceMapping: Record<string, string> = {
              'hani.co.kr': '한겨레',
              'khan.co.kr': '경향신문',
              'yna.co.kr': '연합뉴스',
              'kbs.co.kr': 'KBS',
              'imbc.com': 'MBC',
              'sbs.co.kr': 'SBS',
              'jtbc.co.kr': 'JTBC',
              'chosun.com': '조선일보',
              'joongang.co.kr': '중앙일보',
              'donga.com': '동아일보',
              'mk.co.kr': '매일경제',
              'hankyung.com': '한국경제',
              'sedaily.com': '서울경제',
              'sentv.co.kr': '서울경제TV',
              'edaily.co.kr': '이데일리',
              'newsis.com': '뉴시스',
              'news1.kr': '뉴스1',
              'zdnet.co.kr': '지디넷코리아',
              'etnews.com': '전자신문',
              'bloter.net': '블로터',
              'digitaltoday.co.kr': '디지털투데이',
              'irobotnews.com': '로봇신문',
              'greened.kr': '그린포스트코리아',
              'gamevu.co.kr': '게임뷰',
              'worktoday.co.kr': '워크투데이',
              'areyou.co.kr': '아유경제',
              'fnnews.com': '파이낸셜뉴스',
              'seoul.co.kr': '서울신문',
              'ddaily.co.kr': '디지털데일리',
              'hankooki.com': '한국일보',
              'theopiniontimes.news': '오피니언타임스',
              'businesskorea.co.kr': '비즈니스코리아',
              'ajunews.com': '아주경제',
              'dailymedi.com': '데일리메디',
              'lawissue.co.kr': '로이슈',
              'hansbiz.co.kr': '한스경제',
              'hemophilia.co.kr': '헤모필리아라이프',
              'ikbc.co.kr': 'KBC광주방송',
              'jeonmae.co.kr': '전국매일신문',
              'platum.kr': '플래텀',
              'munhwa.com': '문화일보',
              'newspim.com': '뉴스핌',
              'newscj.com': '뉴스씨제이',
              'aitimes.kr': 'AI타임스',
              'game.donga.com': '동아일보 게임',
              'itchosun.com': 'IT조선',
              'dailian.co.kr': '데일리안',
              'mt.co.kr': '머니투데이',
              'asiae.co.kr': '아시아경제',
              'kukinews.com': '쿠키뉴스',
              'nocutnews.co.kr': '노컷뉴스',
              'ohmynews.com': '오마이뉴스',
              'pressian.com': '프레시안',
            };
            
            // List of Korean TLDs that should be treated as 2-level domains
            const koreanTlds = ['.co.kr', '.or.kr', '.ne.kr', '.go.kr', '.ac.kr', '.pe.kr', '.re.kr', '.asso.kr'];
            
            try {
              const url = new URL(urlString);
              let hostname = url.hostname;
              
              // Normalize domain: remove subdomains and convert to lowercase
              const normalizedHost = normalizeDomain(hostname);
              
              console.log('[News Search] originallink:', urlString);
              console.log('[News Search] hostname:', hostname);
              console.log('[News Search] normalizedHost:', normalizedHost);
              
              // Priority 1: Check if normalized hostname matches any known source
              if (sourceMapping[normalizedHost]) {
                console.log('[News Search] sourceMapping result:', sourceMapping[normalizedHost]);
                return sourceMapping[normalizedHost];
              }
              
              // Priority 2: Try to extract meta site_name from original article
              const metaSiteName = await extractMetaSiteName(urlString);
              if (metaSiteName) {
                console.log('[News Search] meta site_name result:', metaSiteName);
                return metaSiteName;
              }
              
              // Priority 3: Improved fallback: extract domain name properly
              // For .co.kr, .or.kr, etc., extract the part before the TLD
              let domainName = normalizedHost;
              
              for (const tld of koreanTlds) {
                if (normalizedHost.endsWith(tld)) {
                  // Extract the part before the TLD
                  domainName = normalizedHost.substring(0, normalizedHost.length - tld.length);
                  console.log('[News Search] Korean TLD detected, extracted domain:', domainName);
                  break;
                }
              }
              
              // If no Korean TLD matched, try standard TLDs
              if (domainName === normalizedHost) {
                const parts = normalizedHost.split('.');
                if (parts.length >= 2) {
                  // Get the second-to-last part (domain name before TLD)
                  domainName = parts[parts.length - 2];
                  console.log('[News Search] Standard TLD, extracted domain:', domainName);
                }
              }
              
              // Validate that domainName is not a generic TLD or too short
              const invalidNames = ['co', 'or', 'ne', 'go', 'ac', 'pe', 're', 'com', 'net', 'org', 'kr', 'io', 'tv'];
              if (invalidNames.includes(domainName.toLowerCase()) || domainName.length < 2) {
                console.log('[News Search] Invalid domain name, fallback result: 출처 확인중');
                return '출처 확인중';
              }
              
              // Capitalize first letter
              const capitalizedName = domainName.charAt(0).toUpperCase() + domainName.slice(1);
              console.log('[News Search] fallback result:', capitalizedName);
              return capitalizedName;
            } catch (e) {
              console.error('[News Search] Source extraction error:', e);
              return '출처 확인중';
            }
          };
          
          // Helper: Check if query is in title (strict title-only filtering)
          const isTitleMatch = (title: string, searchQuery: string): boolean => {
            const normalizedQuery = normalizeText(searchQuery);
            const normalizedTitle = normalizeText(title);
            
            // For multi-word queries, check if any main keyword is in title
            const mainKeywords = getMainKeywords(searchQuery);
            for (const keyword of mainKeywords) {
              if (normalizedTitle.includes(keyword)) {
                return true;
              }
            }
            
            // Also check if the full query is in title
            return normalizedTitle.includes(normalizedQuery);
          };
          
          const items = await Promise.all(allItems.map(async (item: any) => {
            // Remove HTML tags from title
            const cleanTitle = item.title.replace(/<[^>]*>/g, '');
            const decodedTitle = decodeHtmlEntities(cleanTitle);
            
            // Clean description
            const description = cleanDescription(item.description);
            
            // Use originallink if available, otherwise use link
            const link = item.originallink || item.link;
            
            // Extract source from URL (now async due to meta fetching)
            const source = await extractSourceFromUrl(link);
            
            // Check if title contains the search query (strict title-only matching)
            const isTitleMatched = isTitleMatch(decodedTitle, query);
            
            // Check if should be excluded
            const isExcluded = shouldExclude(decodedTitle, description, query);
            
            return {
              title: decodedTitle,
              link,
              publishedAt: item.pubDate,
              description,
              source,
              thumbnail: null,
              isTitleMatched,
              isExcluded,
            };
          }));
          
          // Remove duplicates based on link
          const seenLinks = new Set<string>();
          const uniqueItems = items.filter((item: any) => {
            if (seenLinks.has(item.link)) {
              return false;
            }
            seenLinks.add(item.link);
            return true;
          });
          
          console.log('[News Search] Items after duplicate removal:', uniqueItems.length);
          
          // Filter items: only include items where title contains the search query
          const relevantItems = uniqueItems.filter((item: any) => !item.isExcluded && item.isTitleMatched);
          
          console.log('[News Search] Total items after all processing:', uniqueItems.length);
          console.log('[News Search] Excluded items:', uniqueItems.filter((i: any) => i.isExcluded).length);
          console.log('[News Search] Title-matched items:', relevantItems.length);
          
          // If we have relevant items, use them; otherwise return empty
          let finalItems = relevantItems;
          if (relevantItems.length === 0) {
            console.log(`[News Search] No title matches found for query: "${query}"`);
            finalItems = [];
          }
          
          const resultLimit = Math.min(Math.max(limit || 20, 1), 100);
          const limitedItems = finalItems.slice(0, resultLimit);
          
          console.log('[News Search] Final items count:', limitedItems.length);
          console.log('[News Search] ===== Search SUCCESS =====');
          
          return limitedItems.map(({ isTitleMatched, isExcluded, ...item }: any) => item);
        } catch (error) {
          console.error('[News Search] Error:', error);
          return [];
        }
      }),
  }),
});

// TODO: add feature routers here, e.g.
// todo: router({
//   list: protectedProcedure.query(({ ctx }) =>
//     db.getUserTodos(ctx.user.id)
//   ),
// }),

export type AppRouter = typeof appRouter;
