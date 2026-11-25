import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { coupangCategories } from "@shared/coupangPartners";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";

const GATEWAY = "https://api-gateway.coupang.com";
const PRODUCT_PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/products";
const TABLE = "coupang_partners_settings";
const CACHE_MS = 10 * 60 * 1000;
const credentialsSchema = z.object({
  accessKey: z.string().trim().min(1).max(200).regex(/^[a-zA-Z0-9_.+/=-]+$/),
  secretKey: z.string().trim().min(1).max(300).regex(/^[^\s\x00-\x1f]+$/),
});
type Credentials = z.infer<typeof credentialsSchema>;
const productQuery = z.discriminatedUnion("feed", [
  z.object({ feed: z.literal("popular"), category: z.enum(coupangCategories.map(({ id }) => id)) }),
  z.object({ feed: z.literal("deals") }),
]);
type ProductQuery = z.infer<typeof productQuery> | { keyword: string };
type Product = { id: number; name: string; price: number; url: string; image: string | null; isRocket: boolean };

const upstreamProduct = z.object({
  productId: z.number().int().positive(),
  productName: z.string().trim().min(1).max(500),
  productPrice: z.number().finite().nonnegative(),
  productUrl: z.string(),
  productImage: z.string().optional(),
  isRocket: z.boolean().optional(),
});
const upstreamEnvelope = z.object({
  rCode: z.union([z.string(), z.number()]),
  data: z.unknown().optional(),
});

function credentialKey(secret: string) {
  return createHmac("sha256", secret).update("contents-view:coupang-partners:v1").digest();
}

export function sealCoupangCredentials(credentials: Credentials, secret: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", credentialKey(secret), nonce);
  const payload = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return [nonce, cipher.getAuthTag(), payload].map(part => part.toString("base64url")).join(".");
}

export function openCoupangCredentials(value: string, secret: string) {
  const [nonce, tag, payload] = value.split(".").map(part => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", credentialKey(secret), nonce);
  decipher.setAuthTag(tag);
  return credentialsSchema.parse(JSON.parse(Buffer.concat([decipher.update(payload), decipher.final()]).toString("utf8")));
}

export function signCoupangRequest(credentials: Credentials, path: string, query: string, now: Date) {
  const signedDate = now.toISOString().slice(2, 19).replace(/[-:]/g, "") + "Z";
  const signature = createHmac("sha256", credentials.secretKey).update(signedDate + "GET" + path + query).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${credentials.accessKey}, signed-date=${signedDate}, signature=${signature}`;
}

function safeUrl(value: string | undefined, hosts: string[]) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    return hosts.some(host => url.hostname === host || url.hostname.endsWith("." + host)) ? url.href : null;
  } catch {
    return null;
  }
}

export async function fetchCoupangProducts(credentials: Credentials, input: ProductQuery, request = fetch, now = new Date()): Promise<Product[]> {
  const isSearch = "keyword" in input;
  const path = isSearch ? `${PRODUCT_PATH}/search`
    : input.feed === "deals" ? `${PRODUCT_PATH}/goldbox` : `${PRODUCT_PATH}/bestcategories/${input.category}`;
  const query = new URLSearchParams(isSearch ? { keyword: input.keyword, limit: "10" } : { limit: "10" }).toString();
  const authorization = signCoupangRequest(credentials, path, query, now);

  let response: Response;
  try {
    response = await request(`${GATEWAY}${path}?${query}`, {
      headers: { Authorization: authorization, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "쿠팡에서 상품을 불러오지 못했습니다." });
  }

  if (response.status === 429) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "쿠팡 API 조회 한도에 도달했습니다. 잠시 후 다시 시도해 주세요." });
  }
  const result = upstreamEnvelope.safeParse(await response.json().catch(() => null));
  if (!response.ok || !result.success || String(result.data.rCode) !== "0") {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "쿠팡 파트너스 API 연결을 확인하지 못했습니다. API 키와 상품 API 권한을 확인해 주세요." });
  }

  const data = result.data.data;
  const items = isSearch && data && typeof data === "object" && "productData" in data ? data.productData : data;
  if (!Array.isArray(items)) {
    throw new TRPCError({ code: "BAD_GATEWAY", message: "쿠팡 상품 응답을 확인할 수 없습니다." });
  }

  const products = new Map<number, Product>();
  for (const entry of items.slice(0, 10)) {
    const parsed = upstreamProduct.safeParse(entry);
    if (!parsed.success) continue;
    const { productId, productName, productPrice, productUrl, productImage, isRocket } = parsed.data;
    const url = safeUrl(productUrl, ["coupang.com", "coupa.ng"]);
    if (!url) continue;
    products.set(productId, {
      id: productId,
      name: productName,
      price: productPrice,
      url,
      image: safeUrl(productImage, ["coupangcdn.com", "coupang.com"]),
      isRocket: isRocket === true,
    });
  }
  return Array.from(products.values());
}

export function createCoupangPartnersRouter(db: SupabaseClient | null, encryptionSecret: string) {
  const cache = new Map<string, { productList: Product[]; fetchedAt: string; expiresAt: number }>();
  const inFlight = new Map<string, Promise<{ productList: Product[]; fetchedAt: string }>>();

  function unavailable() {
    return new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "쿠팡 파트너스 연동을 사용할 수 없습니다." });
  }

  function store() {
    if (!db || !encryptionSecret) throw unavailable();
    return db;
  }

  async function settings() {
    const { data, error } = await store().from(TABLE).select("credentials,updated_at").eq("id", 1).single();
    if (error || !data) throw unavailable();
    return data as { credentials: string | null; updated_at: string };
  }

  async function reserveCall(isSearch: boolean) {
    const { data, error } = await store().rpc("reserve_coupang_partners_call", { p_search: isSearch });
    if (error) throw unavailable();
    if (data !== true) throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "쿠팡 상품 조회 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
    });
  }

  async function products(input: ProductQuery) {
    const record = await settings();
    if (!record.credentials) return { configured: false, productList: [], fetchedAt: null } as const;
    const key = record.updated_at + ":" + JSON.stringify(input);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return { configured: true, productList: cached.productList, fetchedAt: cached.fetchedAt } as const;
    }

    let pending = inFlight.get(key);
    if (!pending) {
      let credentials: Credentials;
      try {
        credentials = openCoupangCredentials(record.credentials, encryptionSecret);
      } catch {
        throw unavailable();
      }
      pending = (async () => {
        await reserveCall("keyword" in input);
        const productList = await fetchCoupangProducts(credentials, input);
        const fetchedAt = new Date().toISOString();
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(key, { productList, fetchedAt, expiresAt: Date.now() + CACHE_MS });
        return { productList, fetchedAt };
      })().finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    return { configured: true, ...await pending } as const;
  }

  return router({
    products: publicProcedure.input(productQuery).query(({ input }) => products(input)),
    search: protectedProcedure.input(z.object({
      keyword: z.string().trim().min(1).max(80).transform(value => value.normalize("NFC").replace(/\s+/g, " ")),
    })).mutation(({ input }) => products(input)),
    adminStatus: adminProcedure.query(async () => {
      const current = await settings();
      return { configured: Boolean(current.credentials) };
    }),
    save: adminProcedure.input(credentialsSchema).mutation(async ({ input }) => {
      await reserveCall(false);
      await fetchCoupangProducts(input, { feed: "popular", category: coupangCategories[0].id });
      const { error } = await store().from(TABLE).update({
        credentials: sealCoupangCredentials(input, encryptionSecret),
        updated_at: new Date().toISOString(),
      }).eq("id", 1);
      if (error) throw unavailable();
      cache.clear();
      return { configured: true };
    }),
    remove: adminProcedure.mutation(async () => {
      const { error } = await store().from(TABLE).update({ credentials: null, updated_at: new Date().toISOString() }).eq("id", 1);
      if (error) throw unavailable();
      cache.clear();
      return { configured: false };
    }),
  });
}
