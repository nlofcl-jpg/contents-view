import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Request, Response } from "express";
import { authenticateSupabaseBearer } from "./_core/supabase";

const DOWNLOAD_FILE_NAME = "CONTENTS-VIEW-flow-automation.zip";
const DOWNLOAD_FILE_PATH = path.join(
  process.cwd(),
  "server/assets/contents-view-flow-automation.zip",
);

export async function downloadFlowAutomation(req: Request, res: Response) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ message: "Method not allowed" });
    return;
  }

  const user = await authenticateSupabaseBearer(req.headers.authorization);
  if (!user) {
    res.status(401).json({ message: "로그인이 필요합니다." });
    return;
  }

  try {
    const file = await readFile(DOWNLOAD_FILE_PATH);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${DOWNLOAD_FILE_NAME}"`,
    );
    res.setHeader("Content-Length", String(file.byteLength));
    res.setHeader("Cache-Control", "private, no-store");
    res.status(200).send(file);
  } catch (error) {
    console.error("[Flow automation download] Failed to read file", error);
    res.status(500).json({ message: "다운로드 파일을 불러오지 못했습니다." });
  }
}
