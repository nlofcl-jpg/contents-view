import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { authenticateSupabaseBearer } from "./supabase";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  if (!user) {
    const req = opts.req as unknown as {
      headers?: Record<string, string | string[] | undefined>;
    };
    const authorizationHeader = req.headers?.["authorization"];
    const supabaseTokenHeader = req.headers?.["x-supabase-access-token"];
    const authorization = Array.isArray(authorizationHeader)
      ? authorizationHeader[0]
      : authorizationHeader;
    const supabaseToken = Array.isArray(supabaseTokenHeader)
      ? supabaseTokenHeader[0]
      : supabaseTokenHeader;
    user = await authenticateSupabaseBearer(
      authorization || (supabaseToken ? `Bearer ${supabaseToken}` : undefined),
    );
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
