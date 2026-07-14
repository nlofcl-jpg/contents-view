import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, ChevronDown, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface YouTubeApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

interface YouTubeApiKeySettingsPanelProps {
  isActive: boolean;
  onClose?: () => void;
  onSave?: () => void;
  compact?: boolean;
}

export function YouTubeApiKeyModal({
  isOpen,
  onClose,
  onSave,
}: YouTubeApiKeyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[1000] pt-20 pb-8 overflow-y-auto">
      <div className="bg-slate-900 rounded-lg p-8 max-w-md w-full mx-4 border border-slate-700 max-h-[calc(100vh-160px)] overflow-y-auto relative z-[1001]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-white">
            YouTube API 키 설정
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <YouTubeApiKeySettingsPanel isActive={isOpen} onClose={onClose} onSave={onSave} />
      </div>
    </div>
  );
}

export function YouTubeApiKeySettingsPanel({
  isActive,
  onClose,
  onSave,
  compact = false,
}: YouTubeApiKeySettingsPanelProps) {
  const { user, isAuthenticated } = useAuth();
  const [inputValue, setInputValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelpBox, setShowHelpBox] = useState(false);
  const [testStatus, setTestStatus] = useState<"untested" | "success" | "failed" | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // Query to get existing API key with test status
  const { data: apiKeyData, isLoading: isQueryLoading, refetch } = trpc.user.apiKey.getWithStatus.useQuery(
    { provider: "youtube" },
    { enabled: isAuthenticated && isActive }
  );

  // Mutations
  const saveApiKeyMutation = trpc.user.apiKey.save.useMutation();
  const deleteApiKeyMutation = trpc.user.apiKey.delete.useMutation();
  const testConnectionMutation = trpc.user.apiKey.testConnection.useMutation();

  // Initialize modal state
  useEffect(() => {
    if (isActive && apiKeyData) {
      if (apiKeyData.exists && apiKeyData.maskedKey) {
        setMaskedKey(apiKeyData.maskedKey);
        setTestStatus(apiKeyData.testStatus as "untested" | "success" | "failed" | null);
        setTestError(apiKeyData.testError);
        setIsEditing(false);
        setInputValue("");
      } else {
        setMaskedKey(null);
        setTestStatus(null);
        setTestError(null);
        setIsEditing(true);
        setInputValue("");
      }
      setError(null);
      setShowHelpBox(false);
    }
  }, [isActive, apiKeyData]);

  const handleSave = async () => {
    if (!inputValue.trim()) {
      setError("API Key를 입력해주세요");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await saveApiKeyMutation.mutateAsync({
        provider: "youtube",
        apiKey: inputValue.trim(),
      });

      // Refetch to get the masked key and status
      await refetch();
      setInputValue("");
      setIsEditing(false);
      setTestError(null);
      
      // Automatically run connection test after saving
      setIsTesting(true);
      try {
        const result = await testConnectionMutation.mutateAsync({
          provider: "youtube",
        });

        if (result.success) {
          setTestStatus("success");
          setTestError(null);
        } else {
          setTestStatus("failed");
          setTestError(result.error || null);
        }
        
        // Refetch to get updated status
        await refetch();
      } catch (err) {
        setTestStatus("failed");
        setTestError(
          err instanceof Error ? err.message : "연결 테스트에 실패했습니다"
        );
      } finally {
        setIsTesting(false);
      }
      
      onSave?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "API Key 저장에 실패했습니다"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("저장된 YouTube API Key를 삭제하시겠습니까?")) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await deleteApiKeyMutation.mutateAsync({ provider: "youtube" });
      setMaskedKey(null);
      setTestStatus(null);
      setTestError(null);
      setIsEditing(true);
      setInputValue("");
      onSave?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "API Key 삭제에 실패했습니다"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setError(null);

    try {
      const result = await testConnectionMutation.mutateAsync({
        provider: "youtube",
      });

      if (result.success) {
        setTestStatus("success");
        setTestError(null);
      } else {
        setTestStatus("failed");
        setTestError(result.error || null);
      }
      
      // Refetch to get updated status
      await refetch();
    } catch (err) {
      setTestStatus("failed");
      setTestError(
        err instanceof Error ? err.message : "연결 테스트에 실패했습니다"
      );
    } finally {
      setIsTesting(false);
    }
  };

  const handleCancel = () => {
    setInputValue("");
    setError(null);
    if (!maskedKey) {
      if (onClose) {
        onClose();
      } else {
        setIsEditing(false);
      }
    } else {
      // If key exists, exit edit mode
      setIsEditing(false);
    }
  };

  const handleEdit = () => {
    setError(null);
    setInputValue(maskedKey ?? "");
    setIsEditing(true);
  };

  const isMaskedValue = Boolean(maskedKey && inputValue === maskedKey);
  const canSaveInputValue = inputValue.trim().length > 0 && !isMaskedValue;

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="rounded-md border border-slate-700 bg-slate-950/40 p-4">
        <p className="text-slate-300 mb-4">
          API 키를 저장하려면 로그인이 필요합니다.
        </p>
        {onClose && (
          <Button onClick={onClose} variant="outline" className="w-full">
            닫기
          </Button>
        )}
      </div>
    );
  }

  if (compact) {
    const apiKeyInputValue = isEditing ? inputValue : maskedKey || "";
    const canCancelApiKeyEdit = isEditing && !isLoading && !isTesting;
    const hasApiKeyChanged = !maskedKey || canSaveInputValue;
    const statusClass =
      testStatus === "success"
        ? "mypageApiStatus success"
        : testStatus === "failed"
          ? "mypageApiStatus failed"
          : "mypageApiStatus neutral";
    const statusText = isQueryLoading
      ? "YouTube API key 상태 확인 중"
      : isEditing
        ? "저장하면 YouTube API 연결 확인이 진행됩니다."
        : testStatus === "success"
          ? "YouTube API 연결이 확인되었습니다."
          : testStatus === "failed"
            ? testError || "YouTube API key가 올바르지 않습니다."
            : maskedKey
              ? "YouTube API 연결 확인이 필요합니다."
              : "YouTube API key를 입력하세요.";

    return (
      <div className="mypageApiKeyPanel">
        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        {isQueryLoading ? (
          <input
            className="mypageModalNameInput"
            value="로딩 중..."
            disabled
            readOnly
          />
        ) : (
          <input
            type={isEditing && !isMaskedValue ? "password" : "text"}
            className="mypageModalNameInput"
            value={apiKeyInputValue}
            onChange={(event) => setInputValue(event.target.value)}
            disabled={!isEditing}
            placeholder="YouTube Data API Key"
          />
        )}
        <p className={statusClass}>{statusText}</p>
        <div className="mypageModalActionRow">
          <button
            className="mypageModalEditButton mypageModalEditButtonSecondary"
            onClick={handleCancel}
            disabled={!canCancelApiKeyEdit}
            type="button"
          >
            취소
          </button>
          <button
            className="mypageModalEditButton"
            onClick={isEditing ? handleSave : handleEdit}
            disabled={isLoading || isTesting || isQueryLoading || (isEditing && !hasApiKeyChanged)}
            type="button"
          >
            {isEditing
              ? isLoading || isTesting
                ? "저장 중"
                : hasApiKeyChanged
                  ? "저장"
                  : "수정"
              : "수정"}
          </button>
        </div>
        <button
          onClick={() => setShowHelpBox(!showHelpBox)}
          className="apiHelpToggle apiHelpToggleCompact"
          type="button"
        >
          <span>API 키 발급 방법 보기</span>
          <ChevronDown
            size={16}
            style={{
              transform: showHelpBox ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          />
        </button>
        {showHelpBox && (
          <div className="apiHelpBox">
            <div className="apiHelpList">
              {[
                "Google Cloud Console에 접속합니다.",
                "API 및 서비스에서 YouTube Data API v3를 사용 설정합니다.",
                "사용자 인증 정보 메뉴에서 API 키를 생성합니다.",
                "생성된 API Key를 복사해 입력창에 붙여넣습니다.",
              ].map((step, index) => (
                <div key={index} className="apiHelpStep">
                  <span className="apiHelpStepNumber">{index + 1}</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
        {/* Description */}
        <p className={`text-slate-300 text-sm ${compact ? "mb-4" : "mb-6"}`}>
          {isEditing && maskedKey
            ? "새 YouTube Data API Key를 입력하면 기존 키가 새 키로 교체됩니다."
            : "YouTube 트렌드 데이터를 불러오기 위해 본인의 YouTube Data API Key를 등록해주세요."}
        </p>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-md p-3 mb-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Content */}
        {isQueryLoading ? (
          <div className="text-center py-8 text-slate-400">
            로딩 중...
          </div>
        ) : isEditing ? (
          // Edit Mode
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                YouTube API Key
              </label>
              <Input
                type={isMaskedValue ? "text" : "password"}
                placeholder={maskedKey ? "새 YouTube Data API Key를 입력하세요" : "YouTube Data API Key를 입력하세요"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white placeholder-slate-500"
              />
              {(!inputValue.trim() || isMaskedValue) && (
                <p className="text-slate-400 text-xs mt-2">
                  {maskedKey ? "새 API Key를 입력하면 저장할 수 있습니다." : "API Key를 입력하면 저장할 수 있습니다."}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={isLoading || isTesting || !canSaveInputValue}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isLoading || isTesting ? "저장 및 연결 확인 중..." : maskedKey ? "새 키 저장" : "저장"}
              </Button>
              <Button
                onClick={handleCancel}
                variant="outline"
                className="flex-1"
              >
                취소
              </Button>
            </div>

            {/* API Help Toggle */}
            <div className="apiHelpToggleWrap">
              <button
                onClick={() => setShowHelpBox(!showHelpBox)}
                className="apiHelpToggle"
                type="button"
              >
                <span>API 키 발급 방법 보기</span>
                <ChevronDown
                  size={16}
                  style={{
                    transform: showHelpBox ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>
            </div>

            {/* API Help Box */}
            {showHelpBox && (
              <div className="apiHelpBox">
                <div className="apiHelpList">
                  {[
                    "Google Cloud Console에 접속합니다.",
                    "새 프로젝트를 만들거나 기존 프로젝트를 선택합니다.",
                    "API 및 서비스에서 YouTube Data API v3를 사용 설정합니다.",
                    "사용자 인증 정보 메뉴에서 API 키를 생성합니다.",
                    "생성된 API Key를 복사해 이 입력창에 붙여넣습니다.",
                  ].map((step, index) => (
                    <div key={index} className="apiHelpStep">
                      <span className="apiHelpStepNumber">{index + 1}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>

                {/* Help Info */}
                <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2 text-sm text-slate-400">
                  <p>
                    <span className="text-slate-300">💡 팁:</span> API 키는 본인 Google 계정에서 발급한 키를 사용해주세요.
                  </p>
                  <p>저장된 키는 본인 계정에서만 사용됩니다.</p>
                  <p className="text-red-400/80 mt-3">
                    <span className="font-semibold">⚠️ 주의:</span> API Key는 외부에 공개하지 마세요.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : maskedKey ? (
          // View Mode (Key Exists)
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                저장된 API Key
              </label>
              <div className="bg-slate-800 border border-slate-600 rounded-md p-3 text-slate-300 font-mono text-sm break-all">
                {maskedKey}
              </div>
            </div>

            {/* Test Status Display */}
            {testStatus && (
              <div className={`rounded-md p-3 flex items-start gap-3 ${
                testStatus === "success" 
                  ? "bg-green-500/10 border border-green-500/30" 
                  : testStatus === "failed"
                  ? "bg-red-500/10 border border-red-500/30"
                  : "bg-blue-500/10 border border-blue-500/30"
              }`}>
                <div className="flex-shrink-0 mt-0.5">
                  {testStatus === "success" && (
                    <CheckCircle size={18} className="text-green-400" />
                  )}
                  {testStatus === "failed" && (
                    <AlertCircle size={18} className="text-red-400" />
                  )}
                  {testStatus === "untested" && (
                    <Clock size={18} className="text-blue-400" />
                  )}
                </div>
                <div className="flex-1">
                  {testStatus === "success" && (
                    <div>
                      <p className="text-green-400 text-sm font-medium">
                        YouTube API 연결이 확인되었습니다
                      </p>
                    </div>
                  )}
                  {testStatus === "failed" && (
                    <div>
                      <p className="text-red-400 text-sm font-medium">
                        YouTube API 연결에 실패했습니다
                      </p>
                      {testError && (
                        <p className="text-red-400/80 text-xs mt-1">
                          {testError}
                        </p>
                      )}
                    </div>
                  )}
                  {testStatus === "untested" && (
                    <p className="text-blue-400 text-sm font-medium">
                      연결 테스트를 진행해주세요
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleTestConnection}
                disabled={isTesting || testStatus === "success"}
                className={`flex-1 ${
                  testStatus === "success"
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {isTesting ? "테스트 중..." : testStatus === "success" ? "연결 완료" : "연결 테스트"}
              </Button>
              <Button
                onClick={handleEdit}
                variant="outline"
                className="flex-1"
              >
                수정
              </Button>
            </div>

            {/* Delete Button */}
            <Button
              onClick={handleDelete}
              disabled={isLoading}
              variant="destructive"
              className="w-full"
            >
              {isLoading ? "삭제 중..." : "삭제"}
            </Button>
          </div>
        ) : null}
    </>
  );
}
