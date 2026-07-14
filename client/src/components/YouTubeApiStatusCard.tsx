import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { KeyRound, CheckCircle, AlertCircle } from "lucide-react";
import { YouTubeApiKeyModal } from "./YouTubeApiKeyModal";

interface YouTubeApiStatusCardProps {
  activeTab: "trending" | "category" | "channels" | "shorts";
  apiKeyMessage: string;
}

export function YouTubeApiStatusCard({
  activeTab,
  apiKeyMessage,
}: YouTubeApiStatusCardProps) {
  const { isAuthenticated } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const utils = trpc.useUtils();

  // Query to get existing API key with test status
  const { data: apiKeyData, isLoading } = trpc.user.apiKey.getWithStatus.useQuery(
    { provider: "youtube" },
    { enabled: isAuthenticated, staleTime: 0 }
  );

  const hasApiKey = apiKeyData?.exists ?? false;
  const maskedKey = apiKeyData?.maskedKey ?? null;
  const testStatus = apiKeyData?.testStatus ?? null;
  const testError = apiKeyData?.testError ?? null;

  const handleModalSave = () => {
    setIsModalOpen(false);
    // Invalidate the query to refetch API key status
    utils.user.apiKey.getWithStatus.invalidate({ provider: "youtube" });
  };

  if (isLoading) {
    return (
      <div className="apiSetupCard">
        <div className="apiIconWrap">
          <KeyRound className="apiIcon" />
        </div>
        <h2 className="apiSetupCardTitle">로딩 중...</h2>
      </div>
    );
  }

  if (hasApiKey && maskedKey) {
    // API Key exists - show status based on test result
    if (testStatus === "success") {
      // Connection successful
      return (
        <>
          <div className="apiSetupCard apiSetupCardSuccess">
            <div className="apiIconWrap">
              <CheckCircle className="apiIcon" style={{ color: "#10b981" }} />
            </div>
            <h2 className="apiSetupCardTitle">YouTube API 연결이 완료되었습니다</h2>
            <p className="apiSetupCardMessage">
              저장된 API 키: <span className="apiKeyDisplay">{maskedKey}</span>
            </p>
            <p className="apiSetupCardSubtext">
              국가별 인기 급상승 영상 데이터를 불러올 수 있습니다.
            </p>
            <div className="apiSetupButtonGroup">
              <button
                onClick={() => setIsModalOpen(true)}
                className="apiSetupButton"
              >
                API 키 수정
              </button>
            </div>
          </div>

          <YouTubeApiKeyModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={handleModalSave}
          />
        </>
      );
    } else if (testStatus === "failed") {
      // Connection failed
      return (
        <>
          <div className="apiSetupCard apiSetupCardError">
            <div className="apiIconWrap">
              <AlertCircle className="apiIcon apiErrorIcon" style={{ color: "#22d3ee" }} />
            </div>
            <h2 className="apiSetupCardTitle">YouTube API 키 오류입니다</h2>
            <p className="apiSetupCardMessage">API 키 확인 후 다시 입력해주세요.</p>
            <div className="apiSetupButtonGroup">
              <button
                onClick={() => setIsModalOpen(true)}
                className="apiSetupButton"
              >
                API 키 수정
              </button>
            </div>
          </div>

          <YouTubeApiKeyModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={handleModalSave}
          />
        </>
      );
    }
    // If testStatus is null or "untested", don't render anything
    // The key should always have a test status after auto-test on save
    return null;
  }

  // No API Key - show setup state
  return (
    <>
      <div className="apiEmptyState">
        <KeyRound className="apiEmptyIcon" style={{ color: "#3b82f6" }} />
        <h3 className="apiEmptyTitle">
          YouTube API 키 설정이 필요합니다
        </h3>
        <p className="apiEmptyDescription">
          YouTube 트렌드 데이터를 불러오려면 API 키를 설정해주세요.
        </p>
        <button
          onClick={() => setIsModalOpen(true)}
          className="apiEmptyButton"
        >
          API 키 설정
        </button>
      </div>

      <YouTubeApiKeyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleModalSave}
      />
    </>
  );
}
