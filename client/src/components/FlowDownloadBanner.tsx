import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
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
      <div className="flowDownloadBannerLink">
        <div className="flowDownloadBannerContent">
          <Megaphone aria-hidden="true" />
          <div className="flowDownloadBannerMarquee">
            <span>컨텐츠뷰에 가입 하고 다양한 컨텐츠 트렌드를 한 곳에서 확인하세요.</span>
            <span aria-hidden="true">컨텐츠뷰에 가입 하고 다양한 컨텐츠 트렌드를 한 곳에서 확인하세요.</span>
          </div>
        </div>
      </div>
      <button type="button" className="flowDownloadBannerClose" onClick={handleClose} title="오늘 하루 배너 닫기" aria-label="오늘 하루 배너 닫기">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
