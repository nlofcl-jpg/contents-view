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
import AIStudio from "@/pages/AIStudio";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import MyPageModal from "@/components/MyPageModal";
import { MobileMenuDrawer } from "@/components/MobileMenuDrawer";
import { Route, Switch, Router as WouterRouter } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { BookmarkProvider } from "./contexts/BookmarkContext";
import { useState } from "react";
import { useLocation } from "wouter";

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
      <Route path={"/news"} component={News} />
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
  const [isMyPageModalOpen, setIsMyPageModalOpen] = useState(false);

  const [mobilePanelType, setMobilePanelType] = useState<"account" | "menu" | null>(null);

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
                <Footer />
              </WouterRouter>
            </main>

            <MyPageModal isOpen={isMyPageModalOpen} onClose={() => setIsMyPageModalOpen(false)} />
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </BookmarkProvider>
    </ErrorBoundary>
  );
}

export default App;
