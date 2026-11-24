# News media on Cloudflare R2

News Focus and News Clipping use the same uploader. Existing Supabase image URLs and externally linked images remain readable. The attachment migration adds metadata columns only; new files go into R2.

1. Create a **private** Standard R2 bucket named `contents-view`. Leave `r2.dev` and public custom domains disabled.
2. Create an Object Read & Write R2 API token scoped to that bucket. In the Vercel production environment (and `.env.local` for local testing), configure the server-only `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_NEWS_BUCKET`, and `NEWS_MEDIA_SITE_ORIGIN` shown in `.env.example`. Never prefix the R2 credentials with `VITE_`.
3. Configure [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/) for the exact admin application origins. For production the bucket rule is:

```json
[
  {
    "AllowedOrigins": ["https://contents-view-chi.vercel.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 600
  }
]
```

Add the exact local origin (such as `http://localhost:3001`) only when testing uploads there. Configured production origins should not use a wildcard.

4. Apply `20261124081538_add_news_attachments.sql` to the Contents View database, then deploy. Verify that an admin can upload, a visitor can open media on a published article, and the same media cannot obtain a new signed URL after unpublishing. An already issued read URL expires after 15 minutes.

Images are resized to a 1600px maximum edge and encoded as WebP when useful. Video is optimized using H.264/AAC with a 720p-class frame and MP3 audio is encoded at 96 kbps. When re-encoding an already compressed supported file would make it larger, the original is kept; MOV still converts to MP4 for playback. Documents are stored unchanged. Video and MP3 use the pinned, lazily loaded [FFmpeg WebAssembly build and source](https://github.com/ffmpegwasm/ffmpeg.wasm/releases/tag/v12.15), accompanied by the upstream [FFmpeg core source and license information](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/packages/core).
