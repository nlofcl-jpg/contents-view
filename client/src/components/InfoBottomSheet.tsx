import React from "react";
import { X } from "lucide-react";

interface InfoBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: React.ReactNode;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export default function InfoBottomSheet({
  isOpen,
  onClose,
  title,
  content,
  triggerRef,
}: InfoBottomSheetProps) {
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  // Handle Esc key
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Handle overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Prevent body scroll when sheet is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      // Focus close button or sheet content
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);
    } else {
      document.body.style.overflow = "";
      // Return focus to trigger button
      triggerRef?.current?.focus();
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, triggerRef]);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity duration-200"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* Bottom Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bottom-sheet-title"
        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl transition-transform duration-250 ease-out ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{
          maxHeight: "50vh",
          overscrollBehavior: "contain",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 id="bottom-sheet-title" className="text-lg font-semibold text-foreground">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 text-slate-400 hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-800"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto text-sm text-slate-300 leading-relaxed">
          {content}
        </div>
      </div>
    </>
  );
}
