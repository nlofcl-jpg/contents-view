# Gemini Chat Test

The final item in the homepage + menu opens a dedicated chat view with the existing input at the bottom.
The existing support helper remains local and rule-based.

## Local Setup

Set these server-only variables in the gitignored .env.local file:

    GEMINI_API_KEY=your-own-key
    GEMINI_MODEL=gemini-3.5-flash-lite

Restart pnpm dev after changing the variables. On localhost, sign in as an
administrator, choose AI mode in the + menu, and accept the disclosure before sending.
No Gemini request is sent merely by entering AI mode or typing.
Never use a VITE_ prefix, commit the key, paste it into chat, or put it in a URL.
Production would need the equivalent Vercel server environment variables.

The model can be changed to a supported model available to the key's project.
Free-tier availability and quotas must be checked in that project's AI Studio.

## Boundaries

- Server authorization: only signed-in administrators can check AI configuration
  or submit questions, in both local development and production.
- Server-only key in the x-goog-api-key header.
- No chat DB persistence or application logging of prompt/provider payloads.
- The current prompt and up to five preceding conversation pairs are sent to
  Google; previous messages are not trusted as system instructions.
- The provider may retain/process submitted content under its own terms.
- Explicit consent is required each time AI mode is opened.
- Google Search grounding is temporarily disabled in both the UI and the server.
- No database tools, file access, direct URL fetching or account actions are
  connected. Reply text is rendered without executing markup.
- Maximum 11 messages, 4,000 characters each, 16,000 characters total, and
  1,200 output tokens per request. The UI limits new questions to 2,000 chars.
- 25-second provider timeout and no automatic generation retries.
- In-memory throttle: one in-flight request per admin, three seconds between
  starts, and 60 attempts per admin per UTC day per server instance. This is not a global
  durable production quota; instances/restarts reset it. Keep admin-only until
  a persistent usage/budget mechanism and public privacy review are added.
- Missing keys, quota failures, blocked/empty replies, invalid permissions and
  network failures show an error; no mock response is presented as Gemini.

## Verification

server/aiTest.test.ts uses mocked external responses; it does not call Gemini.
A real successful reply requires the owner to set the key and authorize a
test prompt. Do not claim the live provider works without that check.

## Official References

- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/models
- https://aistudio.google.com/docs/api-key
- https://aistudio.google.com/docs/rate-limits
