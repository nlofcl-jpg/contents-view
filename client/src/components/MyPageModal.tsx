import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";

interface MyPageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MyPageModal({ isOpen, onClose }: MyPageModalProps) {
  const { user } = useAuth();
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || "");
  const [originalName, setOriginalName] = useState(user?.name || "");
  const [isSaving, setIsSaving] = useState(false);

  const utils = trpc.useUtils();
  const updateNameMutation = trpc.user.updateName.useMutation();

  // user 변경 시 초기값 업데이트
  useEffect(() => {
    if (user?.name) {
      setNameInput(user.name);
      setOriginalName(user.name);
      setIsEditingName(false);
    }
  }, [user?.name, isOpen]);

  const handleEditClick = () => {
    setIsEditingName(true);
    // focus on input after state update
    setTimeout(() => {
      const input = document.querySelector(".mypageModalNameInput") as HTMLInputElement;
      input?.focus();
    }, 0);
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) {
      toast.error("닉네임을 입력해주세요");
      return;
    }

    if (nameInput.trim() === originalName) {
      setIsEditingName(false);
      return;
    }

    setIsSaving(true);
    try {
      await updateNameMutation.mutateAsync({ name: nameInput.trim() });
      toast.success("닉네임이 저장되었습니다");
      setOriginalName(nameInput.trim());
      setIsEditingName(false);
      // 사용자 정보 갱신을 위해 auth.me 쿼리 무효화
      utils.auth.me.invalidate();
    } catch (error) {
      toast.error("닉네임 저장에 실패했습니다");
      console.error("Error updating name:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setNameInput(originalName);
    setIsEditingName(false);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div className="mypageModalOverlay" onClick={onClose} />

      {/* Modal */}
      <div className="mypageModalContainer">
        <div className="mypageModalContent">
          {/* Header */}
          <div className="mypageModalHeader">
            <div>
              <h2 className="mypageModalTitle">마이페이지</h2>
              <p className="mypageModalDescription">
                계정 정보를 확인하고 닉네임을 수정할 수 있습니다.
              </p>
            </div>
            <button
              className="mypageModalCloseButton"
              onClick={onClose}
              type="button"
              aria-label="닫기"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="mypageModalBody">
            {/* Nickname Field */}
            <div className="mypageModalField">
              <label className="mypageModalLabel">닉네임</label>
              <div className="mypageModalInputWrapper">
                <input
                  type="text"
                  className="mypageModalNameInput"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  disabled={!isEditingName}
                  placeholder="닉네임을 입력해주세요"
                />
                {!isEditingName && (
                  <button
                    className="mypageModalEditButton"
                    onClick={handleEditClick}
                    type="button"
                  >
                    수정
                  </button>
                )}
              </div>
            </div>

            {/* Email Field */}
            <div className="mypageModalField">
              <label className="mypageModalLabel">이메일</label>
              <input
                type="email"
                className="mypageModalEmailInput"
                value={user?.email || ""}
                readOnly
                disabled
              />
            </div>
          </div>

          {/* Footer - Action Buttons */}
          {isEditingName && (
            <div className="mypageModalFooter">
              <button
                className="mypageModalButton mypageModalButtonSecondary"
                onClick={handleCancel}
                disabled={isSaving}
                type="button"
              >
                취소
              </button>
              <button
                className="mypageModalButton mypageModalButtonPrimary"
                onClick={handleSaveName}
                disabled={isSaving || !nameInput.trim()}
                type="button"
              >
                {isSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
