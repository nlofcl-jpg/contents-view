import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { appRouter } from "../../server/routers";
import { createContext } from "../../server/_core/context";

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

app.use(
  createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

export default function handler(req: express.Request, res: express.Response) {
  return app(req, res);
}
