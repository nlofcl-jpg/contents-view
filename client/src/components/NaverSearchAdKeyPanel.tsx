import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

type CredentialFields = {
  customerId: string;
  accessLicense: string;
  secretKey: string;
};

const emptyCredentials: CredentialFields = {
  customerId: "",
  accessLicense: "",
  secretKey: "",
};

export default function NaverSearchAdKeyPanel({ isActive }: { isActive: boolean }) {
  const { isAuthenticated } = useAuth();
  const [credentials, setCredentials] = useState<CredentialFields>(emptyCredentials);
  const [maskedCredentials, setMaskedCredentials] = useState<CredentialFields | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelpBox, setShowHelpBox] = useState(false);
  const [testStatus, setTestStatus] = useState<"untested" | "success" | "failed" | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const { data, isLoading: isQueryLoading, refetch } =
    trpc.user.apiKey.getNaverSearchAdWithStatus.useQuery(undefined, {
      enabled: isAuthenticated && isActive,
    });
  const saveMutation = trpc.user.apiKey.saveNaverSearchAd.useMutation();
  const testMutation = trpc.user.apiKey.testNaverSearchAd.useMutation();
  const deleteMutation = trpc.user.apiKey.delete.useMutation();

  useEffect(() => {
    if (!isActive || !data) return;

    if (data.exists && data.maskedCredentials) {
      setMaskedCredentials(data.maskedCredentials);
      setCredentials(data.maskedCredentials);
      setTestStatus(data.testStatus as "untested" | "success" | "failed" | null);
      setTestError(data.testError);
      setIsEditing(false);
    } else {
      setMaskedCredentials(null);
      setCredentials(emptyCredentials);
      setTestStatus(data.testStatus as "untested" | "success" | "failed" | null);
      setTestError(data.testError);
      setIsEditing(true);
    }

    setError(null);
  }, [data, isActive]);

  const hasChanged =
    !maskedCredentials ||
    credentials.customerId !== maskedCredentials.customerId ||
    credentials.accessLicense !== maskedCredentials.accessLicense ||
    credentials.secretKey !== maskedCredentials.secretKey;
  const hasAllValues =
    credentials.customerId.trim().length > 0 &&
    credentials.accessLicense.trim().length > 0 &&
    credentials.secretKey.trim().length > 0;
  const canCancel = isEditing && !saveMutation.isPending && !isTesting;
  const statusClass =
    testStatus === "success"
      ? "mypageApiStatus success"
      : testStatus === "failed"
        ? "mypageApiStatus failed"
        : "mypageApiStatus neutral";
  const statusText = isQueryLoading
    ? "네이버 검색광고 API 상태 확인 중"
    : isEditing
      ? "저장하면 네이버 검색광고 API 연결 확인이 진행됩니다."
      : testStatus === "success"
        ? "네이버 검색광고 API 연결이 확인되었습니다."
        : testStatus === "failed"
          ? testError || "네이버 검색광고 API 키 정보가 올바르지 않습니다."
          : maskedCredentials
            ? "네이버 검색광고 API 연결 확인이 필요합니다."
            : "네이버 검색광고 API 키 정보를 입력하세요.";

  const updateField = (field: keyof CredentialFields, value: string) => {
    setCredentials((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleEdit = () => {
    setError(null);
    setCredentials(maskedCredentials ?? emptyCredentials);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setError(null);
    setCredentials(maskedCredentials ?? emptyCredentials);
    setIsEditing(!maskedCredentials);
  };

  const runConnectionTest = async () => {
    setIsTesting(true);
    try {
      const result = await testMutation.mutateAsync();
      if (result.success) {
        setTestStatus("success");
        setTestError(null);
      } else {
        setTestStatus("failed");
        setTestError(result.error || null);
      }
      await refetch();
    } catch (testError) {
      setTestStatus("failed");
      setTestError(testError instanceof Error ? testError.message : "연결 확인에 실패했습니다.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!hasAllValues) {
      setError("Customer ID, Access License, Secret Key를 모두 입력해주세요.");
      return;
    }

    setError(null);
    try {
      await saveMutation.mutateAsync(credentials);
      const nextData = await refetch();
      const nextMaskedCredentials = nextData.data?.maskedCredentials ?? null;
      setMaskedCredentials(nextMaskedCredentials);
      if (nextMaskedCredentials) {
        setCredentials(nextMaskedCredentials);
      }
      setIsEditing(false);
      setTestStatus("untested");
      setTestError(null);
      await runConnectionTest();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "네이버 검색광고 API 키 저장에 실패했습니다.");
    }
  };

  const handleAction = () => {
    if (!isEditing) {
      handleEdit();
      return;
    }

    if (hasChanged) {
      handleSave();
    }
  };

  const handleDelete = async () => {
    if (!confirm("저장된 네이버 검색광고 API 키 정보를 삭제하시겠습니까?")) return;

    setError(null);
    try {
      await deleteMutation.mutateAsync({ provider: "naver-search-ad" });
      setMaskedCredentials(null);
      setCredentials(emptyCredentials);
      setTestStatus(null);
      setTestError(null);
      setIsEditing(true);
      await refetch();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "네이버 검색광고 API 키 삭제에 실패했습니다.");
    }
  };

  if (!isAuthenticated) {
    return <p className="mypageApiStatus neutral">API 키를 저장하려면 로그인이 필요합니다.</p>;
  }

  return (
    <div className="mypageApiKeyPanel">
      {error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="naverSearchAdKeyGrid">
        <input
          type="text"
          className="mypageModalNameInput"
          value={isQueryLoading ? "로딩 중..." : credentials.customerId}
          onChange={(event) => updateField("customerId", event.target.value)}
          disabled={!isEditing || isQueryLoading}
          placeholder="Customer ID"
        />
        <input
          type={isEditing && credentials.accessLicense !== maskedCredentials?.accessLicense ? "password" : "text"}
          className="mypageModalNameInput"
          value={isQueryLoading ? "로딩 중..." : credentials.accessLicense}
          onChange={(event) => updateField("accessLicense", event.target.value)}
          disabled={!isEditing || isQueryLoading}
          placeholder="Access License"
        />
        <input
          type={isEditing && credentials.secretKey !== maskedCredentials?.secretKey ? "password" : "text"}
          className="mypageModalNameInput"
          value={isQueryLoading ? "로딩 중..." : credentials.secretKey}
          onChange={(event) => updateField("secretKey", event.target.value)}
          disabled={!isEditing || isQueryLoading}
          placeholder="Secret Key"
        />
      </div>

      <p className={statusClass}>{statusText}</p>

      <div className="mypageModalActionRow">
        <button
          className="mypageModalEditButton mypageModalEditButtonSecondary"
          onClick={handleCancel}
          disabled={!canCancel}
          type="button"
        >
          취소
        </button>
        <button
          className="mypageModalEditButton"
          onClick={handleAction}
          disabled={
            saveMutation.isPending ||
            isTesting ||
            isQueryLoading ||
            (isEditing && (!hasChanged || !hasAllValues))
          }
          type="button"
        >
          {isEditing
            ? saveMutation.isPending || isTesting
              ? "저장 중"
              : hasChanged
                ? "저장"
                : "수정"
            : "수정"}
        </button>
      </div>

      {maskedCredentials && !isEditing ? (
        <button
          className="apiDeleteButton"
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          type="button"
        >
          {deleteMutation.isPending ? "삭제 중" : "키 삭제"}
        </button>
      ) : null}

      <button
        onClick={() => setShowHelpBox(!showHelpBox)}
        className="apiHelpToggle apiHelpToggleCompact"
        type="button"
      >
        <span>검색광고 API 키 확인 방법 보기</span>
        <ChevronDown
          size={16}
          style={{
            transform: showHelpBox ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        />
      </button>

      {showHelpBox ? (
        <div className="apiHelpBox">
          <div className="apiHelpList">
            {[
              "네이버 검색광고 관리자센터에 접속합니다.",
              "도구 > API 사용 관리 메뉴에서 API 사용을 활성화합니다.",
              "CUSTOMER_ID, Access License, Secret Key를 확인합니다.",
              "세 값을 각각 입력한 뒤 저장하면 연결 확인이 진행됩니다.",
            ].map((step, index) => (
              <div key={step} className="apiHelpStep">
                <span className="apiHelpStepNumber">{index + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
