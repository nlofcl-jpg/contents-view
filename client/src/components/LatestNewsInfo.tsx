import { CircleAlert } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function LatestNewsInfo() {
  return (
    <Popover>
      <PopoverTrigger
        className="inline-grid size-6 shrink-0 place-items-center rounded-full text-slate-400 hover:text-slate-100 focus-visible:outline focus-visible:outline-blue-400"
        aria-label="최신 뉴스 표시 안내"
        title="최신 뉴스 표시 안내"
      >
        <CircleAlert size={13} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={12}
        className="z-[1200] w-max max-w-[calc(100vw-24px)] border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
        aria-label="최신 뉴스 표시 안내"
      >
        각 언론사별 최신 뉴스가 표시됩니다.
      </PopoverContent>
    </Popover>
  );
}
