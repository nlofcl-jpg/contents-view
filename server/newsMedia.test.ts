import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NEWS_IMAGE_LIMIT, newsImageKeyFromUrl, newsMediaHref, parseNewsMediaKey } from "../shared/newsMedia";
import newsMediaHandler from "./newsMedia";

const { authenticate, from } = vi.hoisted(() => ({ authenticate: vi.fn(), from: vi.fn() }));
vi.mock("./_core/env", () => ({ ENV: { supabaseUrl: "https://example.supabase.co", supabaseServiceRoleKey: "example" } }));
vi.mock("./_core/supabase", () => ({ authenticateSupabaseBearer: authenticate }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from }) }));

const image = "r2/images/77f52259-845e-4eb3-86be-e72b923a1fb9.webp";
const audio = "r2/attachments/e211657a-ad96-4197-98ed-716dbeadceb9.mp3";

function request(method: string, body?: object, query: object = {}) {
  const req = { method, body, query, headers: {} } as Request;
  const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn(), redirect: vi.fn(), end: vi.fn() };
  return { req, res, run: () => newsMediaHandler(req, res as unknown as Response) };
}

function attachmentQuery(result: { data: object | null; error: null }) {
  return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue(result) };
}

describe("private news media storage", () => {
  beforeEach(() => {
    authenticate.mockReset();
    from.mockReset();
    vi.stubEnv("R2_ACCOUNT_ID", "a".repeat(32));
    vi.stubEnv("R2_ACCESS_KEY_ID", "fake-test-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "fake-test-secret");
    vi.stubEnv("R2_NEWS_BUCKET", "contents-view-test");
    vi.stubEnv("NEWS_MEDIA_SITE_ORIGIN", "https://contents.example");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("recognizes managed media paths without accepting arbitrary object keys", () => {
    expect(parseNewsMediaKey(audio)?.contentType).toBe("audio/mpeg");
    expect(newsImageKeyFromUrl(`https://contents.example${newsMediaHref(image)}`)).toBe(image);
    expect(newsImageKeyFromUrl(`https://contents.example${newsMediaHref(audio)}`)).toBeNull();
    expect(parseNewsMediaKey("r2/images/../draft.webp")).toBeNull();
    expect(parseNewsMediaKey(image.replace("webp", "html"))).toBeNull();
  });

  it("blocks non-admin uploads and rejects oversize image uploads", async () => {
    authenticate.mockResolvedValueOnce({ role: "user" }).mockResolvedValueOnce({ role: "admin" });
    const body = { action: "upload", kind: "images", extension: "webp", bytes: NEWS_IMAGE_LIMIT + 1 };
    const guest = request("POST", body);
    await guest.run();
    expect(guest.res.status).toHaveBeenCalledWith(403);
    const admin = request("POST", body);
    await admin.run();
    expect(admin.res.status).toHaveBeenCalledWith(400);
  });

  it("signs both content type and length on direct admin uploads", async () => {
    authenticate.mockResolvedValue({ role: "admin" });
    const handler = request("POST", { action: "upload", kind: "attachments", extension: "mp3", bytes: 1200 });
    await handler.run();
    const { key, uploadUrl, mediaUrl } = handler.res.json.mock.calls[0][0];
    expect(parseNewsMediaKey(key)?.contentType).toBe("audio/mpeg");
    expect(new URL(uploadUrl).searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(["content-length", "content-type", "host"]);
    expect(mediaUrl).toBe(`https://contents.example${newsMediaHref(key)}`);
  });

  it("signs public attachment reads only for a published article reference", async () => {
    const lookup = attachmentQuery({ data: null, error: null });
    from.mockReturnValue(lookup);
    const unpublished = request("GET", undefined, { key: audio });
    await unpublished.run();
    expect(unpublished.res.status).toHaveBeenCalledWith(404);
    expect(unpublished.res.redirect).not.toHaveBeenCalled();
    expect(lookup.eq).toHaveBeenCalledWith("is_published", true);

    from.mockReturnValue(attachmentQuery({ data: { attachment_name: "음원.mp3" }, error: null }));
    const published = request("GET", undefined, { key: audio, download: "1" });
    await published.run();
    const [status, url] = published.res.redirect.mock.calls[0];
    expect(status).toBe(302);
    expect(new URL(url).searchParams.get("response-content-disposition")).toContain("attachment; filename*=");
  });
});
