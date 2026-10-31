import { z } from "zod";

export const PARTNERSHIP_CONSENT_VERSION = "2026-10-31-v1";
export const PARTNERSHIP_RETENTION_NOTICE =
  "접수일로부터 1년 보관 후 다음 일일 삭제 작업에서 파기";
export const PARTNERSHIP_COLLECTION_NOTICE = {
  controller: "에덴 컴퍼니",
  purpose: "제휴 문의 접수, 검토 및 회신",
  items: "이름(상호명), 연락처, 이메일, 문의 내용, 접수 일시 및 동의 기록",
  retention: PARTNERSHIP_RETENTION_NOTICE,
  refusal:
    "동의를 거부할 수 있으며, 거부 시 온라인 문의를 제출할 수 없습니다. 사이트의 다른 기능 이용에는 영향이 없습니다.",
};
export const PARTNERSHIP_TRANSFER_NOTICE = {
  recipient: "Vercel Inc. (privacy@vercel.com)",
  country: "미국 (현재 서버 실행 지역: 워싱턴 D.C. 권역)",
  items:
    "이름(상호명), 연락처, 이메일, 문의 내용, 동의 정보 및 요청 처리에 필요한 접속 정보",
  purpose: "문의 제출 요청의 서버 처리 및 한국 소재 데이터베이스로의 전달",
  method: "문의 제출 시 암호화된 통신을 통한 전송",
  retention:
    "문의 본문은 요청 처리에 사용되며 별도의 본문 로그로 저장하지 않습니다. 서비스 생성·보안 정보는 Vercel의 처리 목적 달성 시 삭제 또는 익명화되며, 런타임 로그의 열람 기간은 이용 요금제에 따라 다릅니다.",
  refusal:
    "동의를 거부할 수 있으며, 거부 시 온라인 문의를 제출할 수 없습니다. 제출 후 철회·삭제 요청은 edenofcls@gmail.com으로 보내 주세요.",
};

export const partnershipInquiryInput = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .regex(/^[+\d()\s-]+$/)
    .refine(value => value.replace(/\D/g, "").length >= 7),
  email: z.email().trim().max(254),
  message: z.string().trim().min(10).max(5000),
  privacyConsent: z.literal(true),
  overseasConsent: z.literal(true),
  consentVersion: z.literal(PARTNERSHIP_CONSENT_VERSION),
});

// Store the exact notice alongside its version so later edits cannot change the evidence.
export function partnershipConsentRecord() {
  return {
    privacy_consent_version: PARTNERSHIP_CONSENT_VERSION,
    overseas_consent_version: PARTNERSHIP_CONSENT_VERSION,
    consent_notice: {
      collection: PARTNERSHIP_COLLECTION_NOTICE,
      overseas: PARTNERSHIP_TRANSFER_NOTICE,
    },
  };
}
