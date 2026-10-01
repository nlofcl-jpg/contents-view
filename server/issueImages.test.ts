import { describe, expect, it } from "vitest";
import { getStoredIssueImagePath, MAX_ISSUE_IMAGE_SIZE, validateIssueImage } from "../client/src/lib/issueImages";

describe("issue image uploads", () => {
  it("accepts supported image formats and rejects other files", () => {
    expect(validateIssueImage(new File(["image"], "issue.png", { type: "image/png" }))).toBeNull();
    expect(validateIssueImage(new File(["svg"], "issue.svg", { type: "image/svg+xml" }))).toMatch(/JPG/);
  });

  it("rejects files larger than the upload limit", () => {
    const largeImage = new File([new Uint8Array(MAX_ISSUE_IMAGE_SIZE + 1)], "issue.jpg", { type: "image/jpeg" });
    expect(validateIssueImage(largeImage)).toMatch(/5MB/);
  });

  it("only cleans up images in the configured public bucket", () => {
    const projectUrl = "https://example.supabase.co";
    expect(getStoredIssueImagePath(
      `${projectUrl}/storage/v1/object/public/issue-images/issues/photo.webp`, projectUrl,
    )).toBe("issues/photo.webp");
    expect(getStoredIssueImagePath("https://other.example/photo.webp", projectUrl)).toBeNull();
    expect(getStoredIssueImagePath(`${projectUrl}/storage/v1/object/public/other-bucket/photo.webp`, projectUrl)).toBeNull();
  });
});
