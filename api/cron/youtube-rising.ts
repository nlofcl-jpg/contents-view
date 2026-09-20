import { collectYouTubeRisingSnapshots } from "../../server/youtubeRising";

function getHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const cronSecret = process.env.CRON_SECRET;
  const authorization = getHeaderValue(req.headers?.authorization);
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return;
  }

  try {
    const result = await collectYouTubeRisingSnapshots();
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("[YouTube rising collector] Collection failed", error);
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Collection failed",
    });
  }
}
