import { RefreshCw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function TrendResetButton({ name, description, onReset, disabled }: {
  name: string;
  description: string;
  onReset: () => void;
  disabled?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button type="button" className="grid size-8 shrink-0 place-items-center rounded-md border-0 bg-transparent text-inherit opacity-65 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 disabled:opacity-40" aria-label={`${name} 초기화`} title="초기화" disabled={disabled}>
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="trend-comparison-glass max-w-[min(calc(100%-2rem),20rem)] gap-3 p-4 text-center sm:max-w-xs">
        <AlertDialogTitle className="text-sm text-white">{name}를 초기화할까요?</AlertDialogTitle>
        <AlertDialogDescription className="text-xs leading-relaxed text-slate-400">{description}</AlertDialogDescription>
        <div className="mt-1 grid grid-cols-2 gap-2">
          <AlertDialogCancel className="h-8 border-slate-700 text-xs">취소</AlertDialogCancel>
          <AlertDialogAction className="h-8 bg-blue-600 text-xs text-white hover:bg-blue-500" onClick={onReset}>초기화</AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
