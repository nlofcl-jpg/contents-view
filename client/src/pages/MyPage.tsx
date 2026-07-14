import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function MyPage() {
  const [, setLocation] = useLocation();
  const { user, loading, isAuthenticated } = useAuth();
  const [nameInput, setNameInput] = useState(user?.name || "");
  const [isSaving, setIsSaving] = useState(false);

  const updateNameMutation = trpc.user.updateName.useMutation();

  // 로그인하지 않은 경우 로그인 페이지로 이동
  if (!loading && !isAuthenticated) {
    setLocation("/");
    return null;
  }

  if (loading) {
    return (
      <div className="mainContent">
        <div className="mypageContainer">
          <div className="mypageLoading">로딩 중...</div>
        </div>
      </div>
    );
  }

  const handleSaveName = async () => {
    if (!nameInput.trim()) {
      toast.error("닉네임을 입력해주세요");
      return;
    }

    setIsSaving(true);
    try {
      await updateNameMutation.mutateAsync({ name: nameInput.trim() });
      toast.success("닉네임이 저장되었습니다");
      // 사용자 정보 갱신을 위해 auth.me 쿼리 무효화
      trpc.useUtils().auth.me.invalidate();
    } catch (error) {
      toast.error("닉네임 저장에 실패했습니다");
      console.error("Error updating name:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mainContent">
      <div className="mypageContainer">
        <div className="mypageHeader">
          <h1 className="mypageTitle">마이페이지</h1>
          <p className="mypageDescription">
            계정 정보를 확인하고 닉네임을 수정할 수 있습니다.
          </p>
        </div>

        <div className="mypageCard">
          <div className="mypageField">
            <label className="mypageLabel">닉네임</label>
            <input
              type="text"
              className="mypageInput"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="닉네임을 입력해주세요"
            />
          </div>

          <div className="mypageField">
            <label className="mypageLabel">이메일</label>
            <input
              type="email"
              className="mypageInput mypageInputReadonly"
              value={user?.email || ""}
              readOnly
              disabled
            />
          </div>

          <div className="mypageActions">
            <Button
              onClick={handleSaveName}
              disabled={isSaving || !nameInput.trim()}
              className="mypageSaveButton"
            >
              {isSaving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
