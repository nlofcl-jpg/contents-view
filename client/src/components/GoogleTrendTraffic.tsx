import { TrendingUp } from "lucide-react";

type GoogleTrendTrafficProps = {
  traffic?: string;
  trafficCount?: number;
  className?: string;
};

export function GoogleTrendTraffic({ traffic, trafficCount, className = "" }: GoogleTrendTrafficProps) {
  if (!traffic) return <span className={className}>-</span>;

  const count = trafficCount ?? Number(traffic.replace(/[^\d]/g, ""));
  const color = count >= 2000 ? "text-rose-400" : count >= 1000 ? "text-amber-400" : "text-sky-400";

  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${color} ${className}`}>
      {traffic.replace(/\+\s*$/, "")}
      <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
    </span>
  );
}
