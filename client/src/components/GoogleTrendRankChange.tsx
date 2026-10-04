export type RankChange = "up" | "down" | "same" | "new";

const indicators: Record<RankChange, { label: string; symbol: string; className: string }> = {
  up: { label: "순위 상승", symbol: "▲", className: "text-sky-400" },
  down: { label: "순위 하락", symbol: "▼", className: "text-rose-400" },
  same: { label: "순위 변화 없음", symbol: "-", className: "text-slate-500" },
  new: { label: "새로 진입", symbol: "N", className: "text-emerald-400" },
};

export function GoogleTrendRankChange({ change = "same", className = "" }: { change?: RankChange; className?: string }) {
  const indicator = indicators[change] ?? indicators.same;
  return (
    <span
      className={`inline-flex min-w-5 items-center justify-center text-xs font-bold ${indicator.className} ${className}`}
      aria-label={indicator.label}
      title={indicator.label}
    >
      <span aria-hidden="true">{indicator.symbol}</span>
    </span>
  );
}
