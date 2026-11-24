import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import NewsAttachment from "../client/src/components/NewsAttachment";
import { loadWithNewsAttachments, MAX_NEWS_ATTACHMENT_SIZE, validateNewsAttachment } from "../client/src/lib/newsAttachments";

vi.mock("../client/src/lib/supabase", () => ({ supabase: null }));

describe("news attachments", () => {
  it("loads existing articles when the optional attachment fields are not installed yet", async () => {
    const load = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: "42703", message: "column news_clips.attachment_path does not exist" } })
      .mockResolvedValueOnce({ data: { title: "뉴스 클리핑" }, error: null });
    await expect(loadWithNewsAttachments(load)).resolves.toEqual({ data: { title: "뉴스 클리핑" }, error: null, attachmentColumnsAvailable: false });
    expect(load.mock.calls).toEqual([[",attachment_path,attachment_name"], [""]]);
  });

  it("does not retry access errors as though the migration were missing", async () => {
    const error = { code: "42501", message: "permission denied for column attachment_path" };
    const load = vi.fn().mockResolvedValue({ data: null, error });
    await expect(loadWithNewsAttachments(load)).resolves.toEqual({ data: null, error, attachmentColumnsAvailable: true });
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("validates supported files, ambiguous MIME types and sizes", () => {
    expect(validateNewsAttachment({ name: "동영상.MP4", type: "video/mp4", size: 100 })).toBeNull();
    expect(validateNewsAttachment({ name: "자료.pdf", type: "application/octet-stream", size: MAX_NEWS_ATTACHMENT_SIZE })).toBeNull();
    expect(validateNewsAttachment({ name: "notes.txt", type: "", size: 100 })).toBeNull();
    expect(validateNewsAttachment({ name: "voice.mp3", type: "audio/mpeg", size: 100 })).toBeNull();
    expect(validateNewsAttachment({ name: "page.html", type: "text/html", size: 100 })).not.toBeNull();
    expect(validateNewsAttachment({ name: "page.pdf", type: "text/html", size: 100 })).not.toBeNull();
    expect(validateNewsAttachment({ name: "자료.pdf", type: "application/pdf", size: 0 })).not.toBeNull();
    expect(validateNewsAttachment({ name: "영상.mov", type: "video/quicktime", size: MAX_NEWS_ATTACHMENT_SIZE + 1 })).not.toBeNull();
  });

  it.each([["mp4", "<video"], ["mp3", "<audio"], ["pdf", "lucide-download"]])("renders a %s attachment appropriately", (extension, markup) => {
    const client = new QueryClient();
    const path = `articles/file.${extension}`;
    const name = `파일.${extension}`;
    const href = "https://example.com/signed/file";
    client.setQueryData(["news-attachment", path, name], href);
    vi.stubGlobal("React", React);
    try {
      const html = renderToStaticMarkup(React.createElement(QueryClientProvider, { client }, React.createElement(NewsAttachment, { path, name })));
      expect(html).toContain(markup);
      expect(html).toContain(href);
      expect(html).toContain(name);
      expect(html.includes("<video")).toBe(extension === "mp4");
    } finally {
      client.clear();
      vi.unstubAllGlobals();
    }
  });
});
