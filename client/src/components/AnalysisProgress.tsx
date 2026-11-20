import { createPortal } from "react-dom";

export function AnalysisProgress({ label = "분석중..." }: { label?: string }) {
  return createPortal(
    <div className="naverAnalysisProgress" role="status">
      <div className="naverAnalysisProgressTrack" aria-hidden="true" />
      <p>{label}</p>
    </div>,
    document.body
  );
}
