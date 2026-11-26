import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createAiTestRouter } from "./aiTest";
import type { TrpcContext } from "./_core/context";

const input = { consent: true as const, messages: [{ role: "user" as const, text: "콘텐츠 아이디어를 알려줘" }] };
const context = (role: "admin" | "user" | null = "admin") => ({
  user: role ? { role, openId: "test-admin" } : null,
  req: { headers: {} },
  res: {},
}) as unknown as TrpcContext;

function setup(key = "server-test-secret") {
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
    candidates: [{ content: { parts: [{ text: "테스트 답변" }] } }],
  }), { status: 200 }));
  let time = 100000;
  const router = createAiTestRouter({
    getKey: () => key,
    fetcher,
    now: () => time,
  });
  return { fetcher, router, caller: router.createCaller(context()), advance: () => { time += 4000; } };
}

describe("Gemini test access", () => {
  it("requires an administrator even for same-origin localhost requests", async () => {
    const host = "localhost:3000";
    const origin = `http://${host}`;
    const request = (role: "admin" | "user" | null) => ({
      ...context(role), req: { socket: { remoteAddress: "::1" }, headers: { host, origin } },
    }) as unknown as TrpcContext;
    const { router, fetcher } = setup();
    for (const role of [null, "user"] as const) {
      const caller = router.createCaller(request(role));
      await expect(caller.status()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.chat(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(fetcher).not.toHaveBeenCalled();
    const caller = router.createCaller(request("admin"));
    await expect(caller.status()).resolves.toMatchObject({ configured: true, mode: "admin" });
    await expect(caller.chat(input)).resolves.toMatchObject({ reply: "테스트 답변" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects guests and non-admins before any provider request", async () => {
    const { router, fetcher } = setup();
    for (const role of [null, "user"] as const) {
      await expect(router.createCaller(context(role)).chat(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(router.createCaller(context(role)).status()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("shows missing configuration without pretending to generate a response", async () => {
    const { caller, fetcher } = setup("");
    expect(await caller.status()).toEqual({ configured: false, model: "gemini-3.5-flash-lite", mode: "admin" });
    await expect(caller.chat(input)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("requires consent and bounded alternating conversation history", async () => {
    const { caller, fetcher } = setup();
    await expect(caller.chat({ ...input, consent: false } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.chat({ ...input, messages: [{ role: "assistant", text: "hello" }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.chat({ ...input, messages: [{ role: "user", text: "x".repeat(4001) }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("keeps credentials server-side and sends Gemini roles and bounded output settings", async () => {
    const { caller, fetcher } = setup();
    const result = await caller.chat({ consent: true, messages: [
      { role: "user", text: "첫 질문" }, { role: "assistant", text: "이전 답변" }, { role: "user", text: "후속 질문" },
    ] });
    expect(result.reply).toBe("테스트 답변");
    expect(JSON.stringify(result)).not.toContain("server-test-secret");
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
    expect(url).not.toContain("server-test-secret");
    expect(request.headers["x-goog-api-key"]).toBe("server-test-secret");
    const body = JSON.parse(request.body);
    expect(body.contents.map((item: any) => item.role)).toEqual(["user", "model", "user"]);
    expect(body.generationConfig.maxOutputTokens).toBe(1200);
    expect(body).not.toHaveProperty("tools");
    expect(result).toMatchObject({ searched: false, sources: [], searchSuggestions: null });
  });

  it("does not use or return Google Search data even when requested", async () => {
    const { caller, fetcher } = setup();
    const web = { uri: "https://example.org/article", title: "기사" };
    fetcher.mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "답변" }] }, groundingMetadata: {
        groundingChunks: [{ web }, { web }, { web: { uri: "javascript:alert(1)" } }],
        webSearchQueries: ["검색어"],
        searchEntryPoint: { renderedContent: "<div>추천 검색어</div>" },
      } }],
    })));
    expect(await caller.chat({ ...input, webSearch: true })).toMatchObject({
      searched: false,
      sources: [],
      searchSuggestions: null,
    });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).not.toHaveProperty("tools");
  });

  it("does not relay provider error bodies or credentials", async () => {
    const { caller, fetcher } = setup();
    fetcher.mockResolvedValue(new Response(JSON.stringify({ error: "server-test-secret" }), { status: 403 }));
    try { await caller.chat(input); throw new Error("expected failure"); } catch (error: any) {
      expect(error.code).toBe("PRECONDITION_FAILED");
      expect(error.message).not.toContain("server-test-secret");
    }
  });

  it("omits Google Search when explicitly turned off", async () => {
    const { caller, fetcher } = setup();
    await caller.chat({ ...input, webSearch: false });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).not.toHaveProperty("tools");
  });

  it("handles quota, network failures and empty model responses", async () => {
    for (const scenario of ["quota", "network", "empty"] as const) {
      const { caller, fetcher } = setup();
      if (scenario === "quota") fetcher.mockResolvedValue(new Response("", { status: 429 }));
      if (scenario === "network") fetcher.mockRejectedValue(new Error("secret detail"));
      if (scenario === "empty") fetcher.mockResolvedValue(new Response(JSON.stringify({ candidates: [] })));
      await expect(caller.chat(input)).rejects.toMatchObject({ code: scenario === "quota" ? "TOO_MANY_REQUESTS" : "BAD_GATEWAY" });
    }
  });

  it("ignores thought parts in the returned answer", async () => {
    const { caller, fetcher } = setup();
    fetcher.mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [
      { thought: true, text: "hidden reasoning" }, { text: "최종 답변" },
    ] } }] })));
    expect((await caller.chat(input)).reply).toBe("최종 답변");
  });

  it("limits rapid repeat requests without retrying provider calls", async () => {
    const { caller, fetcher, advance } = setup();
    await caller.chat(input);
    await expect(caller.chat(input)).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    advance();
    await caller.chat(input);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("opens AI from a dedicated button and keeps ordinary analysis routes intact", () => {
    const hero = readFileSync(new URL("../client/src/components/Hero.tsx", import.meta.url), "utf8");
    const menu = hero.match(/const searchPlatforms = \[([\s\S]*?)\];/)?.[1];
    expect(menu?.match(/value: "(.*?)"/g)).toEqual(['value: "youtube"', 'value: "naver"', 'value: "news"']);
    expect(menu).not.toContain("aiPlatform");
    expect(hero).toContain('onClick={() => selectPlatform("ai")}');
    expect(hero).toContain('selectedPlatform?.value === "ai"');
    expect(hero).toContain("/trends/naver?keyword=");
    expect(hero).toContain("HeroAiChat");
  });
});
