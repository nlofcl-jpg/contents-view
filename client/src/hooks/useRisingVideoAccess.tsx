import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import { YouTubeApiKeyModal } from "@/components/YouTubeApiKeyModal";
import { consumeGuestRisingVideoView, consumeMemberRisingVideoView } from "@/lib/guestRisingVideoViews";
import { trpc } from "@/lib/trpc";

export function useRisingVideoAccess(accountId: string | undefined, authLoading: boolean) {
  const [, setLocation] = useLocation();
  const [guestPromptOpen, setGuestPromptOpen] = useState(false);
  const [apiKeyPromptAccountId, setApiKeyPromptAccountId] = useState<string | null>(null);
  const { data: apiKeyData, isLoading: apiKeyLoading, isFetching, isError } = trpc.user.apiKey.getWithStatus.useQuery(
    { provider: "youtube" },
    { enabled: Boolean(accountId) && !authLoading }
  );
  const hasConnectedKey = !isError && apiKeyData?.exists === true && apiKeyData.testStatus === "success";

  const canOpenRisingVideo = useCallback(() => {
    if (authLoading) return false;
    if (accountId) {
      if (apiKeyLoading || (hasConnectedKey && isFetching)) return false;
      if (hasConnectedKey || consumeMemberRisingVideoView(accountId)) return true;
      setApiKeyPromptAccountId(accountId);
      return false;
    }
    if (consumeGuestRisingVideoView()) return true;
    setGuestPromptOpen(true);
    return false;
  }, [accountId, apiKeyLoading, authLoading, hasConnectedKey, isFetching]);

  const goToAuth = (mode: "login" | "signup") => {
    setGuestPromptOpen(false);
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    setLocation(`/login?${mode === "signup" ? "mode=signup&" : ""}redirect=${redirect}`);
  };

  return {
    apiKeyData,
    canOpenRisingVideo,
    openGuestPrompt: () => setGuestPromptOpen(true),
    accessPrompt: (
      <>
        <GuestAccessPrompt
          open={guestPromptOpen && !accountId}
          description="로그인하거나 가입하면 급상승 영상 전체 목록을 볼 수 있어요."
          onBrowse={() => setGuestPromptOpen(false)}
          onLogin={() => goToAuth("login")}
          onSignup={() => goToAuth("signup")}
        />
        <YouTubeApiKeyModal
          isOpen={Boolean(accountId) && apiKeyPromptAccountId === accountId}
          onClose={() => setApiKeyPromptAccountId(null)}
          description="급상승 영상 분석을 계속 보려면 YouTube API 키를 연결해 주세요."
        />
      </>
    ),
  };
}
