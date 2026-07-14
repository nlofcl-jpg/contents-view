import { isSupabaseConfigured, signInWithGoogle } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function Login() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsStarting(false);
      return;
    }

    signInWithGoogle().then(({ error: signInError }) => {
      if (signInError) {
        setError(signInError.message);
        setIsStarting(false);
      }
    }).catch((signInError: unknown) => {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "로그인을 시작하지 못했습니다.",
      );
      setIsStarting(false);
    });
  }, []);

  if (isStarting && isSupabaseConfigured && !error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-blue-500/25 bg-slate-950/90 px-5 py-4 text-sm font-medium text-slate-200 shadow-2xl shadow-blue-950/30"
        >
          Google 로그인으로 이동 중입니다.
        </div>
      </div>
    );
  }

  return (
    <div className="pageContainer">
      <div className="pageHeader">
        <h1 className="pageTitle">로그인</h1>
        <p className="pageDescription">
          Google 계정으로 CONTENTS VIEW에 로그인합니다.
        </p>
      </div>

      <div className="max-w-md rounded-lg border border-blue-500/20 bg-slate-900/60 p-6">
        {isStarting ? (
          <p className="text-sm text-slate-300">Google 로그인으로 이동 중입니다.</p>
        ) : isSupabaseConfigured ? (
          <>
            <p className="mb-4 text-sm text-red-300">
              {error || "로그인을 시작하지 못했습니다."}
            </p>
            <button
              type="button"
              className="primaryButton"
              onClick={() => {
                setIsStarting(true);
                setError(null);
                signInWithGoogle().then(({ error: signInError }) => {
                  if (signInError) {
                    setError(signInError.message);
                    setIsStarting(false);
                  }
                });
              }}
            >
              다시 시도
              <span>→</span>
            </button>
          </>
        ) : (
          <>
            <p className="mb-4 text-sm text-slate-300">
              Supabase 환경변수가 아직 설정되지 않았습니다. `.env` 또는 배포
              환경에 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`를
              추가하면 Google 로그인이 활성화됩니다.
            </p>
            <button
              type="button"
              className="primaryButton"
              onClick={() => setLocation("/")}
            >
              홈으로 돌아가기
              <span>→</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
