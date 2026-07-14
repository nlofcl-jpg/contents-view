import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { SUPABASE_ACCESS_TOKEN_COOKIE } from "@shared/const";
import express from "express";
import { createContext } from "./_core/context";
import { ENV } from "./_core/env";
import { authenticateSupabaseBearer } from "./_core/supabase";
import { appRouter } from "./routers";

type ExpressLikeRequest = {
  url: string;
};

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

app.use((req: ExpressLikeRequest, _res: unknown, next: () => void) => {
  req.url = req.url.replace(/^\/api\/trpc\/?/, "/");
  next();
});

app.get("/auth-debug", async (req, res) => {
  const authorization = getHeaderValue(req.headers.authorization);
  const supabaseHeaderToken = getHeaderValue(req.headers["x-supabase-access-token"]);
  const cookieToken = getCookieValue(req.headers.cookie, SUPABASE_ACCESS_TOKEN_COOKIE);
  const candidateAuthorization =
    authorization ||
    (supabaseHeaderToken ? `Bearer ${supabaseHeaderToken}` : undefined) ||
    (cookieToken ? `Bearer ${cookieToken}` : undefined);
  const user = await authenticateSupabaseBearer(candidateAuthorization);

  res.status(200).json({
    ok: true,
    received: {
      authorizationHeader: Boolean(authorization),
      supabaseHeader: Boolean(supabaseHeaderToken),
      supabaseCookie: Boolean(cookieToken),
      cookieHeader: Boolean(req.headers.cookie),
    },
    serverEnv: {
      supabaseUrl: Boolean(ENV.supabaseUrl),
      supabaseAnonKey: Boolean(ENV.supabaseAnonKey),
      supabaseServiceRoleKey: Boolean(ENV.supabaseServiceRoleKey),
    },
    auth: {
      authenticated: Boolean(user),
      loginMethod: user?.loginMethod ?? null,
      openIdPrefix: user?.openId ? user.openId.slice(0, 8) : null,
      emailPresent: Boolean(user?.email),
    },
  });
});

app.use(
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

export default function handler(req: express.Request, res: express.Response) {
  return app(req, res);
}

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getCookieValue(cookieHeader: string | string[] | undefined, name: string) {
  const cookie = Array.isArray(cookieHeader) ? cookieHeader.join("; ") : cookieHeader;
  if (!cookie) return null;

  const match = cookie
    .split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${name}=`));
  if (!match) return null;

  return decodeURIComponent(match.slice(name.length + 1));
}
