import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import { useNaverTrendComparison } from "@/components/NaverTrendComparison";
import { NAVER_GUEST_DAILY_LIMIT_MESSAGE, NAVER_MEMBER_DAILY_LIMIT_MESSAGE } from "@shared/naverAnalysisQuota";

export default function CommerceTrends() {
  const [, navigate] = useLocation();
  const { loading: authLoading } = useAuth();
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);
  const { renderPanel } = useNaverTrendComparison({
    authLoading,
    metric: "shopping",
    onError: (error, fallback) => {
      const message = error instanceof Error ? error.message : "";
      if (message === NAVER_GUEST_DAILY_LIMIT_MESSAGE) {
        setGuestPromptOpen(true);
        return "";
      }
      return message === NAVER_MEMBER_DAILY_LIMIT_MESSAGE ? message : fallback;
    },
  });

  const goToAuth = (mode: "login" | "signup") => {
    const params = new URLSearchParams({ redirect: "/commerce" });
    if (mode === "signup") params.set("mode", "signup");
    setGuestPromptOpen(false);
    navigate(`/login?${params.toString()}`);
  };

  return (
    <div className="youtubePageContainer min-h-full">
      <div className="pageHeader">
        <h1 className="pageTitle">커머스 트렌드</h1>
      </div>
      <div className="tabMenu youtubeTabMenu" role="group" aria-label="커머스 트렌드 선택">
        <button type="button" className="tabButton active" aria-pressed="true">
          쇼핑 트렌드 비교
        </button>
      </div>
      {renderPanel()}
      <GuestAccessPrompt
        open={guestPromptOpen}
        description={NAVER_GUEST_DAILY_LIMIT_MESSAGE}
        onBrowse={() => setGuestPromptOpen(false)}
        onLogin={() => goToAuth("login")}
        onSignup={() => goToAuth("signup")}
      />
    </div>
  );
}
