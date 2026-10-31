import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Link } from "wouter";
import { BANNER_HIDDEN_UNTIL_KEY, nextKoreanMidnight, readBannerHiddenUntil } from "@/lib/bannerVisibility";

function getSavedExpiry(): number {
  try {
    return readBannerHiddenUntil(window.localStorage.getItem(BANNER_HIDDEN_UNTIL_KEY), Date.now());
  } catch {
    return 0;
  }
}

export default function FlowDownloadBanner() {
  const [hiddenUntil, setHiddenUntil] = useState(getSavedExpiry);

  useEffect(() => {
    const refresh = () => {
      setHiddenUntil(previous => {
        try {
          return readBannerHiddenUntil(window.localStorage.getItem(BANNER_HIDDEN_UNTIL_KEY), Date.now());
        } catch {
          return previous > Date.now() ? previous : 0;
        }
      });
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === BANNER_HIDDEN_UNTIL_KEY || event.key === null) refresh();
    };
    const timer = hiddenUntil > 0
      ? window.setTimeout(() => setHiddenUntil(0), Math.max(0, hiddenUntil - Date.now()))
      : undefined;
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [hiddenUntil]);

  const handleClose = () => {
    const expiry = nextKoreanMidnight(Date.now());
    setHiddenUntil(expiry);
    try {
      window.localStorage.setItem(BANNER_HIDDEN_UNTIL_KEY, String(expiry));
    } catch {
      // Keep this tab dismissed even when browser storage is unavailable.
    }
  };

  if (hiddenUntil > 0) return null;

  return (
    <div className="flowDownloadBanner">
      <Link href="/ai-studio" className="flowDownloadBannerLink" aria-label="Google Flow 오토메이션 크롬 확장 프로그램 다운로드 페이지로 이동">
        <div className="flowDownloadBannerContent">
          <Download aria-hidden="true" />
          <div className="flowDownloadBannerMarquee">
            <span>구글 FLOW 오토메이션 크롬 확장 프로그램 다운로드 받기</span>
            <span aria-hidden="true">구글 FLOW 오토메이션 크롬 확장 프로그램 다운로드 받기</span>
          </div>
        </div>
      </Link>
      <button type="button" className="flowDownloadBannerClose" onClick={handleClose} title="오늘 하루 배너 닫기" aria-label="오늘 하루 배너 닫기">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
