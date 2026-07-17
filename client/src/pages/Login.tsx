import { isSupabaseConfigured, signInWithGoogle } from "@/lib/supabase";
import { Check, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

type SocialProvider = "google" | "naver" | "kakao";

const socialButtons: Array<{
  provider: SocialProvider;
  label: string;
}> = [
  { provider: "google", label: "Google로 로그인" },
  { provider: "naver", label: "네이버로 로그인" },
  { provider: "kakao", label: "카카오로 로그인" },
];

function SocialLogo({ provider }: { provider: SocialProvider }) {
  if (provider === "google") {
    return (
      <svg className="loginSocialIcon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.49 12.27c0-.82-.07-1.42-.22-2.04H12v4.05h6.62c-.13 1.01-.86 2.54-2.46 3.56l-.02.14 3.56 2.51.25.02c2.3-1.94 3.54-4.8 3.54-8.24Z"
        />
        <path
          fill="#34A853"
          d="M12 23c3.29 0 6.05-.99 8.06-2.69l-3.84-2.71c-1.03.66-2.4 1.12-4.22 1.12a7.32 7.32 0 0 1-6.93-4.6l-.14.01-3.7 2.61-.05.13C3.23 20.5 7.28 23 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.07 14.12A6.6 6.6 0 0 1 4.68 12c0-.74.14-1.45.37-2.12l-.01-.14L1.3 7.1l-.12.05A10.26 10.26 0 0 0 0 12c0 1.74.46 3.38 1.25 4.83l3.82-2.71Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.28c2.29 0 3.83.9 4.71 1.66l3.44-3.06C18.04 2.1 15.29 1 12 1 7.28 1 3.23 3.5 1.25 7.17l3.81 2.71A7.35 7.35 0 0 1 12 5.28Z"
        />
      </svg>
    );
  }

  if (provider === "naver") {
    return (
      <svg className="loginSocialIcon" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M15.05 12.7 8.62 3.5H3.3v17h5.65v-9.2l6.43 9.2h5.32v-17h-5.65v9.2Z" />
      </svg>
    );
  }

  return (
    <svg className="loginSocialIcon kakaoIcon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3.5c-5.1 0-9.2 3.18-9.2 7.1 0 2.5 1.67 4.7 4.19 5.96l-.7 2.78c-.06.23.2.42.39.28l3.32-2.22c.65.1 1.32.15 2 .15 5.1 0 9.2-3.18 9.2-7.1s-4.1-6.95-9.2-6.95Z"
      />
    </svg>
  );
}

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
          <h1 id="login-title" className="loginTitle">간편 로그인 / 회원가입</h1>
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
                  <SocialLogo provider={button.provider} />
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
      </section>
    </div>
  );
}
