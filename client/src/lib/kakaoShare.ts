import { stripIssueBodyFormatting } from "@shared/issueBody";

type ShareIssue = {
  id: string;
  title: string;
  article_title: string | null;
  summary: string | null;
  article_summary: string | null;
  thumbnail_url: string | null;
};

type KakaoFeed = {
  objectType: "feed";
  content: {
    title: string;
    description: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    link: { webUrl: string; mobileWebUrl: string };
  };
  itemContent: { profileText: string; profileImageUrl: string };
  buttons: Array<{ title: string; link: { webUrl: string; mobileWebUrl: string } }>;
};

type KakaoSdk = {
  init: (key: string) => void;
  isInitialized: () => boolean;
  Share: { sendDefault: (template: KakaoFeed) => void };
};

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

const SITE_ORIGIN = "https://contents-view-chi.vercel.app";
const SDK_URL = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.2/kakao.min.js";
const SDK_INTEGRITY = "sha384-zt/G7/KfaRQ9dT/QIkS0ujMtzouJqzuSJcXVQu50x0rl/+mD1dc70AeOejVbMD9E";
let sdkPromise: Promise<KakaoSdk> | null = null;

export function buildIssueKakaoFeed(issue: ShareIssue): KakaoFeed {
  const pageUrl = `${SITE_ORIGIN}/news/issues/${encodeURIComponent(issue.id)}`;
  const iconUrl = `${SITE_ORIGIN}/contents-view-symbol.png`;
  let imageUrl = iconUrl;

  if (issue.thumbnail_url) {
    try {
      const candidate = new URL(issue.thumbnail_url, SITE_ORIGIN);
      if (candidate.protocol === "https:") imageUrl = candidate.href;
    } catch {
      // Fall back to the service icon when the source image URL is invalid.
    }
  }

  const link = { webUrl: pageUrl, mobileWebUrl: pageUrl };
  return {
    objectType: "feed",
    content: {
      title: issue.article_title || issue.title,
      description: stripIssueBodyFormatting(issue.summary || issue.article_summary || "CONTENTS VIEW 이슈 보기").slice(0, 140),
      imageUrl,
      imageWidth: 800,
      imageHeight: 400,
      link,
    },
    itemContent: {
      profileText: "CONTENTS VIEW",
      profileImageUrl: iconUrl,
    },
    buttons: [{ title: "전체 보기", link }],
  };
}

export function loadKakaoSdk(): Promise<KakaoSdk> {
  if (window.Kakao) return Promise.resolve(window.Kakao);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<KakaoSdk>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.integrity = SDK_INTEGRITY;
    script.crossOrigin = "anonymous";
    script.onload = () => window.Kakao ? resolve(window.Kakao) : reject(new Error("카카오 SDK를 초기화하지 못했습니다."));
    script.onerror = () => reject(new Error("카카오 SDK를 불러오지 못했습니다."));
    document.head.appendChild(script);
  }).catch((error) => {
    sdkPromise = null;
    throw error;
  });

  return sdkPromise;
}

export function shareIssueOnKakao(issue: ShareIssue): void {
  const key = import.meta.env.VITE_KAKAO_JAVASCRIPT_KEY?.trim();
  if (!key) throw new Error("카카오톡 공유 키가 아직 설정되지 않았습니다.");
  if (!window.Kakao) throw new Error("카카오톡 공유를 준비 중입니다. 잠시 후 다시 시도해 주세요.");
  if (!window.Kakao.isInitialized()) window.Kakao.init(key);
  window.Kakao.Share.sendDefault(buildIssueKakaoFeed(issue));
}
