import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

import NotFound from "@/pages/NotFound";
import Home from "@/pages/Home";
import YouTubeTrends from "@/pages/YouTubeTrends";
import NaverTrends from "@/pages/NaverTrends";
import GoogleTrends from "@/pages/GoogleTrends";
import Community from "@/pages/Community";
import SavedContents from "@/pages/SavedContents";
import News from "@/pages/News";
import NewsSearchResults from "@/pages/NewsSearchResults";
import IssueDetail from "@/pages/IssueDetail";
import AIStudio from "@/pages/AIStudio";
import FlowAutomation from "@/pages/FlowAutomation";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import MyPageModal from "@/components/MyPageModal";
import { MobileMenuDrawer } from "@/components/MobileMenuDrawer";
import GuestAccessPrompt from "@/components/GuestAccessPrompt";
import { Route, Switch, Router as WouterRouter } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BookmarkProvider } from "./contexts/BookmarkContext";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/trends/youtube"} component={YouTubeTrends} />
      <Route path={"/trends/naver"} component={NaverTrends} />
      <Route path={"/trends/google"} component={GoogleTrends} />
      <Route path={"/community"} component={Community} />
      <Route path={"/saved-contents"} component={SavedContents} />
      <Route path={"/news/search"} component={NewsSearchResults} />
      <Route path={"/news/issues"} component={News} />
      <Route path={"/news/issues/:id"} component={IssueDetail} />
      <Route path={"/news"} component={News} />
      <Route path={"/ai-studio/flow-automation"} component={FlowAutomation} />
      <Route path={"/ai-studio"} component={AIStudio} />
      <Route path={"/login"} component={Login} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [isMyPageModalOpen, setIsMyPageModalOpen] = useState(false);

  const [mobilePanelType, setMobilePanelType] = useState<"account" | "menu" | null>(null);
  const [guestMenuTarget, setGuestMenuTarget] = useState<string | null | undefined>(undefined);
  const guestMenuPromptSeen = useRef(false);
  const guestBrowseAction = useRef<(() => void) | null>(null);

  const requestGuestMenuAccess = (path?: string, onBrowse?: () => void) => {
    if (authLoading || isAuthenticated || guestMenuPromptSeen.current) return false;

    try {
      if (window.sessionStorage.getItem("contents-view-guest-menu-prompt-seen")) return false;
      window.sessionStorage.setItem("contents-view-guest-menu-prompt-seen", "1");
    } catch {
      // Keep the prompt one-time in this app instance when storage is unavailable.
    }

    guestMenuPromptSeen.current = true;
    guestBrowseAction.current = onBrowse ?? null;
    setGuestMenuTarget(path ?? null);
    return true;
  };

  const continueAsGuest = () => {
    const target = guestMenuTarget;
    const action = guestBrowseAction.current;
    guestBrowseAction.current = null;
    setGuestMenuTarget(undefined);
    if (action) action();
    else if (target === null) setMobilePanelType("menu");
    else if (target) setLocation(target);
  };

  const goToGuestAuth = (mode: "login" | "signup") => {
    const params = new URLSearchParams();
    if (mode === "signup") params.set("mode", "signup");
    if (guestMenuTarget) params.set("redirect", guestMenuTarget);
    guestBrowseAction.current = null;
    setGuestMenuTarget(undefined);
    setLocation(`/login${params.size ? `?${params.toString()}` : ""}`);
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    const redirectPath = window.localStorage.getItem("contents-view-auth-redirect");
    if (!redirectPath) return;

    window.localStorage.removeItem("contents-view-auth-redirect");
    if (redirectPath.startsWith("/") && !redirectPath.startsWith("//")) {
      setLocation(redirectPath);
    }
  }, [authLoading, isAuthenticated, setLocation]);

  return (
    <ErrorBoundary>
      <BookmarkProvider>
        <ThemeProvider
          defaultTheme="dark"
        >
          <TooltipProvider>
            <Toaster />
            <div className="app">
            <Header
              onOpenMyPageModal={() => setIsMyPageModalOpen(true)}
              onGuestMenuAccess={requestGuestMenuAccess}
              onToggleMobileMenu={(panelType) => {
                setMobilePanelType(panelType || null);
              }}
            />
            <MobileMenuDrawer
              panelType={mobilePanelType}
              onClose={() => setMobilePanelType(null)}
              onOpenMyPageModal={() => setIsMyPageModalOpen(true)}
              onNavigate={() => setMobilePanelType(null)}
            />

            <main className="mainContent">
              <WouterRouter>
                <Router />
                <Footer onGuestMenuAccess={requestGuestMenuAccess} />
              </WouterRouter>
            </main>

            <MyPageModal isOpen={isMyPageModalOpen} onClose={() => setIsMyPageModalOpen(false)} />
            <GuestAccessPrompt
              open={guestMenuTarget !== undefined}
              onBrowse={continueAsGuest}
              onLogin={() => goToGuestAuth("login")}
              onSignup={() => goToGuestAuth("signup")}
            />
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </BookmarkProvider>
    </ErrorBoundary>
  );
}

export default App;
