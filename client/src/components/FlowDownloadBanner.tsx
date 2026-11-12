import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BANNER_HIDDEN_UNTIL_KEY, nextKoreanMidnight, readBannerHiddenUntil } from "@/lib/bannerVisibility";
import { siteBannerQuery } from "@/lib/siteBanner";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SITE_BANNER, getBannerLink } from "@shared/siteBanner";

function getSavedExpiry(): number {
  try {
    return readBannerHiddenUntil(window.localStorage.getItem(BANNER_HIDDEN_UNTIL_KEY), Date.now());
  } catch {
    return 0;
  }
}

export default function FlowDownloadBanner() {
  const [hiddenUntil, setHiddenUntil] = useState(getSavedExpiry);
  const { data, error } = useQuery({ ...siteBannerQuery, enabled: Boolean(supabase) });

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

  const missingTable = error && "code" in error && (error.code === "PGRST205" || error.code === "42P01");
  const banner = data ?? (!supabase || missingTable ? DEFAULT_SITE_BANNER : null);
  if (!banner?.is_visible || hiddenUntil > 0) return null;

  const href = getBannerLink(banner.link_url);
  const content = (
    <div className="flowDownloadBannerContent">
      <Megaphone aria-hidden="true" />
      <div className="flowDownloadBannerMarquee">
        <span>{banner.message}</span>
        <span aria-hidden="true">{banner.message}</span>
      </div>
    </div>
  );

  return (
    <div className="flowDownloadBanner">
      {href?.startsWith("/") ? (
        <Link href={href} className="flowDownloadBannerLink">{content}</Link>
      ) : href ? (
        <a href={href} className="flowDownloadBannerLink">{content}</a>
      ) : (
        <div className="flowDownloadBannerLink">{content}</div>
      )}
      <button type="button" className="flowDownloadBannerClose" onClick={handleClose} title="오늘 하루 배너 닫기" aria-label="오늘 하루 배너 닫기">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
