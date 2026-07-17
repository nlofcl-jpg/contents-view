import { isSupabaseConfigured, signInWithGoogle } from "@/lib/supabase";
import { Check, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

type SocialProvider = "google" | "naver" | "kakao";

const socialButtons: Array<{
  provider: SocialProvider;
  label: string;
  mark: string;
}> = [
  { provider: "google", label: "Google로 로그인", mark: "G" },
  { provider: "naver", label: "네이버로 로그인", mark: "N" },
  { provider: "kakao", label: "카카오로 로그인", mark: "K" },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const handleGoogleLogin = async () => {
    if (!isSupabaseConfigured) {
      setError("Supabase 로그인 환경변수가 아직 설정되지 않았습니다.");
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const { error: signInError } = await signInWithGoogle();
      if (signInError) {
        setError(signInError.message);
        setIsStarting(false);
      }
    } catch (signInError) {
      setError(
        signInError instanceof Error
          ? signInError.message
          : "로그인을 시작하지 못했습니다.",
      );
      setIsStarting(false);
    }
  };

  const handleProviderClick = (provider: SocialProvider) => {
    if (provider === "google") {
      handleGoogleLogin();
      return;
    }

    setError(`${provider === "naver" ? "네이버" : "카카오"} 로그인은 준비 중입니다.`);
  };

  return (
    <div className="loginPage">
      <section className="loginPanel" aria-labelledby="login-title">
        <button
          className="loginBrand"
          type="button"
          onClick={() => setLocation("/")}
          aria-label="홈으로 이동"
        >
          <img src="/contents-view-symbol.png" alt="" className="loginBrandLogo" />
          <span>
            CONTENTS <strong>VIEW</strong>
          </span>
        </button>

        <div className="loginSection">
          <h1 id="login-title" className="loginTitle">간편 로그인</h1>
          <div className="loginSocialStack">
            {socialButtons.map((button) => (
              <button
                key={button.provider}
                type="button"
                className={`loginSocialButton is-${button.provider}`}
                onClick={() => handleProviderClick(button.provider)}
                disabled={isStarting}
              >
                <span className="loginSocialMark" aria-hidden="true">
                  {button.mark}
                </span>
                <span>{button.provider === "google" && isStarting ? "Google 로그인으로 이동 중" : button.label}</span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        <label className="loginKeepSignedIn">
          <input
            type="checkbox"
            checked={keepSignedIn}
            onChange={(event) => setKeepSignedIn(event.target.checked)}
          />
          <span className="loginKeepBox" aria-hidden="true">
            {keepSignedIn && <Check size={13} strokeWidth={3} />}
          </span>
          <span>로그인 상태 유지</span>
        </label>

        {error && (
          <p className="loginError" role="alert">
            {error}
          </p>
        )}

        <div className="loginSignup">
          <span>CONTENTS VIEW가 처음이신가요?</span>
          <button type="button" onClick={() => setError("회원 가입은 다음 단계에서 연결됩니다.")}>
            회원 가입하기
          </button>
        </div>
      </section>
    </div>
  );
}
