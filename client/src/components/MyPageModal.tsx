import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Check, Pencil, X } from "lucide-react";
import { YouTubeApiKeySettingsPanel } from "./YouTubeApiKeyModal";

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
      const input = document.querySelector(
        ".mypageModalNameInput"
      ) as HTMLInputElement;
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
          <div className="mypageModalHeader">
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
            <section className="mypageProfileSummary" aria-label="프로필 정보">
              <div className="mypageProfileAvatar" aria-hidden="true">
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>
                    {user?.name?.trim().charAt(0).toUpperCase() || "U"}
                  </span>
                )}
              </div>

              {isEditingName ? (
                <div className="mypageNicknameEditor">
                  <input
                    type="text"
                    className="mypageModalNameInput"
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    placeholder="닉네임을 입력해주세요"
                    onKeyDown={event => {
                      if (event.key === "Enter") handleSaveName();
                      if (event.key === "Escape") handleCancel();
                    }}
                  />
                  <button
                    className="mypageNicknameIconButton mypageNicknameSaveButton"
                    onClick={handleSaveName}
                    disabled={isSaving}
                    type="button"
                    aria-label="닉네임 저장"
                    title="저장"
                  >
                    <Check size={15} />
                  </button>
                  <button
                    className="mypageNicknameIconButton"
                    onClick={handleCancel}
                    disabled={isSaving}
                    type="button"
                    aria-label="닉네임 수정 취소"
                    title="취소"
                  >
                    <X size={15} />
                  </button>
                </div>
              ) : (
                <div className="mypageNicknameRow">
                  <strong className="mypageNickname">
                    {nameInput || "사용자"}
                  </strong>
                  <button
                    className="mypageNicknameEditButton"
                    onClick={handleEditClick}
                    type="button"
                    aria-label="닉네임 수정"
                    title="닉네임 수정"
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              )}

              <div className="mypageAccountEmail">
                <span>이메일</span>
                <strong>{user?.email || "가입 이메일 정보 없음"}</strong>
              </div>
            </section>

            <div className="mypageModalField mypageApiField">
              <label className="mypageModalLabel">YouTube API key</label>
              <YouTubeApiKeySettingsPanel isActive={isOpen} compact />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
