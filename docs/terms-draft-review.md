# CONTENTS VIEW Terms Draft Review

Review date: 2026-11-18 (Asia/Seoul)

## Scope

The Korean draft is rendered at /terms. The footer now links to it. Like the
privacy policy, it is a standalone light page without the app header, banner,
footer, or chatbot. On 2026-11-18, the owner requested both the announcement and
effective dates be set to 2026-11-18 and the draft labels be removed.
No signup, API access, payment, consent-recording, or quota behavior was changed.

The content is original drafting based on the repository's present features.
Other services' products, payment policies, company details, and retention
periods were not imported into CONTENTS VIEW's terms.

## Sources

- Korean Act on the Regulation of Terms and Conditions, especially unfair terms,
  liability, cancellation, deemed consent, and jurisdiction:
  https://www.law.go.kr/법령/약관의규제에관한법률
  https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1025032507
- Naver service terms: reference for organizing account, content rights,
  restrictions, notice, termination, and complaints provisions (not copied):
  https://policy.naver.com/rules/service.html
- YouTube API Developer Policies, III.A: linking YouTube terms, the user-facing
  YouTube agreement provision, and privacy requirements:
  https://developers.google.com/youtube/terms/developer-policies/
- YouTube API Services terms:
  https://developers.google.com/youtube/terms/api-services-terms-of-service/
- YouTube user terms and Google privacy policy linked from the draft:
  https://www.youtube.com/t/terms
  https://policies.google.com/privacy

## Repository Evidence

- App.tsx: active routes and standalone privacy layout.
- Hero.tsx and YouTubeTrends.tsx: keyword/URL analysis, authenticated features.
- useRisingVideoAccess.tsx: shared guest/member preview limits.
- YouTubeVideoDetailModal.tsx: stored-snapshot analysis on rising surfaces.
- SavedContents.tsx: account bookmarks and URL saving.
- AIStudio.tsx: style mockups, administrator-only style pages, programs and
  open-source links; not an already-launched general AI video generator.
- PrivacyPolicy.tsx: operator, contact, data rights, API-key removal and account
  deletion request path.
- Footer.tsx: contact and partnership inquiry entry points.

## Before Enactment

1. The dates are owner-approved. Confirm the proposed 14+ signup policy (aligned with
   the privacy policy's lack of a parental-consent flow), 7/30-day change notice,
   complaint handling, and account deletion procedures.
2. Implement and test explicit terms/privacy acknowledgement and versioned
   consent records as needed for new and existing accounts and API-client
   access. Merely posting /terms does not implement consent. The current login
   screen does not provide a terms acknowledgement flow.
3. Notify existing users appropriately; do not backdate agreement or assume
   existing Google login implies acceptance of new CONTENTS VIEW terms.
4. Confirm operator identification/contact details and any additional legally
   required disclosures for the eventual business model. Paid services require
   a separate purchase/withdrawal/refund flow and review before launch.
5. Independently review YouTube API compliance, including credential handling,
   derived metrics, storage/refresh, attribution and player behavior. This
   draft is not evidence that the existing product complies with all provider
   policies; publishing a disclaimer cannot resolve a technical violation.
6. Reconcile the privacy policy's outstanding production transfer/contact
   details with the domain-launch review already planned by the owner.
7. Obtain professional legal review before putting this draft into effect,
   especially for consumer liability, minors, and externally sourced content.

Keep this checklist out of the contractual text. The displayed dates do not
prove publication, user notice, or consent. No production deployment was
requested as part of the date change.
