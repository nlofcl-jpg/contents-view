import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { createCoupangPartnersRouter, fetchCoupangProducts, openCoupangCredentials, sealCoupangCredentials } from "./coupangPartners";

const credentials = { accessKey: "test-access", secretKey: "test-secret" };
const storeKey = "test-encryption-key";
const sample = {
  productId: 123,
  productName: "테스트 상품",
  productPrice: 11900,
  productImage: "https://thumbnail.coupangcdn.com/sample.jpg",
  productUrl: "https://link.coupang.com/a/sample",
  isRocket: true,
};

const context = (role: "admin" | "user" | null) => ({ user: role ? { role } : null }) as TrpcContext;

function setup(configured = false) {
  const row = { credentials: configured ? sealCoupangCredentials(credentials, storeKey) : null, updated_at: "now" };
  const update = vi.fn((values: Partial<typeof row>) => ({
    eq: () => {
      Object.assign(row, values);
      return Promise.resolve({ error: null });
    },
  }));
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  const db = {
    rpc,
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: row, error: null }) }) }), update }),
  } as unknown as SupabaseClient;
  const fetcher = vi.fn(async () => Response.json({ rCode: "0", data: [sample] }));
  vi.stubGlobal("fetch", fetcher);
  const router = createCoupangPartnersRouter(db, storeKey);
  return { row, update, rpc, fetcher, admin: router.createCaller(context("admin")), guest: router.createCaller(context(null)), member: router.createCaller(context("user")) };
}

afterEach(() => vi.unstubAllGlobals());

describe("Coupang Partners", () => {
  it("signs the exact UTF-8 query sent and returns only validated public products", async () => {
    const now = new Date("2026-11-25T09:30:40Z");
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ rCode: "0", data: { productData: [
      sample, { ...sample, productId: 124, productUrl: "https://fake.example/a" },
    ] } }));
    const result = await fetchCoupangProducts(credentials, { keyword: "커피 원두" }, request, now);
    expect(result).toEqual([{ id: 123, name: sample.productName, price: 11900, image: sample.productImage, url: sample.productUrl, isRocket: true }]);
    const [url, init] = request.mock.calls[0];
    const endpoint = new URL(String(url));
    const expectedSignature = createHmac("sha256", credentials.secretKey)
      .update("261125T093040ZGET" + endpoint.pathname + endpoint.search.slice(1)).digest("hex");
    expect(endpoint.searchParams.get("keyword")).toBe("커피 원두");
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      `CEA algorithm=HmacSHA256, access-key=test-access, signed-date=261125T093040Z, signature=${expectedSignature}`,
    );
    expect(init?.redirect).toBe("error");
  });

  it("does not let guests or members manage the shared key", async () => {
    const { guest, member, fetcher, update } = setup();
    for (const caller of [guest, member]) {
      await expect(caller.save(credentials)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.adminStatus()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.remove()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    await expect(guest.search({ keyword: "커피" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("tests the connection before saving and keeps credentials out of responses", async () => {
    const { admin, guest, row, fetcher, update } = setup();
    fetcher.mockResolvedValueOnce(Response.json({ message: credentials.secretKey }, { status: 401 }));
    await expect(admin.save(credentials)).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(update).not.toHaveBeenCalled();
    await expect(admin.save(credentials)).resolves.toEqual({ configured: true });
    expect(row.credentials).not.toContain(credentials.secretKey);
    expect(openCoupangCredentials(row.credentials!, storeKey)).toEqual(credentials);
    expect(() => openCoupangCredentials(row.credentials!, "other-key")).toThrow();
    await expect(admin.adminStatus()).resolves.toEqual({ configured: true });
    await expect(guest.products({ feed: "popular", category: "1016" })).resolves.toMatchObject({ configured: true, productList: [{ id: 123 }] });
    await expect(admin.remove()).resolves.toEqual({ configured: false });
    await expect(guest.products({ feed: "popular", category: "1016" })).resolves.toMatchObject({ configured: false, productList: [] });
  });

  it("uses one call for concurrent identical queries and blocks requests when the shared quota is full", async () => {
    const { guest, member, rpc, fetcher } = setup(true);
    await Promise.all([guest.products({ feed: "popular", category: "1016" }), guest.products({ feed: "popular", category: "1016" })]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(member.search({ keyword: "커피" })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    expect(rpc).toHaveBeenLastCalledWith("reserve_coupang_partners_call", { p_search: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("reads Gold Box deals from the separate Coupang feed", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ rCode: "0", data: [sample] }));
    await expect(fetchCoupangProducts(credentials, { feed: "deals" }, request)).resolves.toMatchObject([{ id: 123 }]);
    expect(request.mock.calls[0][0]).toBe("https://api-gateway.coupang.com/v2/providers/affiliate_open_api/apis/openapi/v1/products/goldbox?limit=10");
  });
});
