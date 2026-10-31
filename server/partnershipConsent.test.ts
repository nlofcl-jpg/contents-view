import { describe, expect, it } from "vitest";
import {
  PARTNERSHIP_CONSENT_VERSION,
  partnershipConsentRecord,
  partnershipInquiryInput,
} from "../shared/partnershipConsent";

const valid = {
  name: "Example company",
  phone: "010-1234-5678",
  email: "contact@example.com",
  message: "A partnership inquiry for testing.",
  privacyConsent: true,
  overseasConsent: true,
  consentVersion: PARTNERSHIP_CONSENT_VERSION,
};

describe("partnership consent", () => {
  it("accepts only the current notice and both explicit consents", () => {
    expect(partnershipInquiryInput.parse(valid).privacyConsent).toBe(true);
  });

  it.each(["privacyConsent", "overseasConsent"])(
    "rejects false or omitted %s",
    key => {
      expect(
        partnershipInquiryInput.safeParse({ ...valid, [key]: false }).success
      ).toBe(false);
      expect(
        partnershipInquiryInput.safeParse({ ...valid, [key]: undefined })
          .success
      ).toBe(false);
    }
  );

  it("rejects an outdated notice version", () => {
    expect(
      partnershipInquiryInput.safeParse({ ...valid, consentVersion: "old" })
        .success
    ).toBe(false);
  });

  it("preserves the notices and ignores client-supplied timestamps", () => {
    const parsed = partnershipInquiryInput.parse({
      ...valid,
      consented_at: "2000-01-01",
      expires_at: "2099-01-01",
    });
    expect(parsed).not.toHaveProperty("consented_at");
    expect(parsed).not.toHaveProperty("expires_at");
    const record = partnershipConsentRecord();
    expect(record.privacy_consent_version).toBe(PARTNERSHIP_CONSENT_VERSION);
    expect(record.consent_notice.collection.retention).toContain("1년");
    expect(record.consent_notice.overseas.country).toContain("미국");
  });
});
