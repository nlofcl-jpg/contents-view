import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type GuestAccessPromptProps = {
  open: boolean;
  onBrowse: () => void;
  onLogin: () => void;
  onSignup: () => void;
};

export default function GuestAccessPrompt({ open, onBrowse, onLogin, onSignup }: GuestAccessPromptProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onBrowse(); }}>
      <DialogContent overlayClassName="z-[11000]" className="z-[11001] w-[calc(100%-2rem)] max-w-[360px] gap-0 rounded-md border-slate-700 bg-[#121b2b] px-6 pb-5 pt-7 text-white shadow-2xl sm:max-w-[360px]">
        <DialogTitle className="pr-5 text-[17px] leading-6">컨텐츠뷰 이용 안내</DialogTitle>
        <DialogDescription className="mt-3 text-sm leading-6 text-slate-300">
          간편 회원가입 후 컨텐츠뷰의 더욱 다양한 서비스를 이용해 보세요.
        </DialogDescription>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button type="button" className="h-10 rounded-md border border-slate-600 text-sm font-medium text-white transition-colors hover:bg-slate-800" onClick={onLogin}>로그인</button>
          <button type="button" className="h-10 rounded-md bg-sky-500 text-sm font-semibold text-slate-950 transition-colors hover:bg-sky-400" onClick={onSignup}>가입</button>
        </div>
        <button type="button" className="mx-auto mt-4 block text-xs text-slate-400 underline-offset-2 hover:text-white hover:underline" onClick={onBrowse}>가입 없이 둘러보기</button>
      </DialogContent>
    </Dialog>
  );
}
