import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import { consumeGuestRisingVideoView } from "@/lib/guestRisingVideoViews";

export function useGuestRisingVideoAccess(isAuthenticated: boolean, authLoading: boolean, guestViewLimit?: number) {
  const [, setLocation] = useLocation();
  const [promptOpen, setPromptOpen] = useState(false);

  const canOpenRisingVideo = useCallback(() => {
    if (authLoading) return false;
    if (isAuthenticated) return true;
    if (consumeGuestRisingVideoView(undefined, guestViewLimit)) return true;
    setPromptOpen(true);
    return false;
  }, [authLoading, guestViewLimit, isAuthenticated]);

  const goToAuth = (mode: "login" | "signup") => {
    setPromptOpen(false);
    const redirect = encodeURIComponent(window.location.pathname + window.location.search);
    setLocation(`/login?${mode === "signup" ? "mode=signup&" : ""}redirect=${redirect}`);
  };

  return {
    canOpenRisingVideo,
    guestPrompt: (
      <GuestAccessPrompt
        open={promptOpen && !isAuthenticated}
        onBrowse={() => setPromptOpen(false)}
        onLogin={() => goToAuth("login")}
        onSignup={() => goToAuth("signup")}
      />
    ),
  };
}
