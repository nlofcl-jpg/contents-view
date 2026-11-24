import { FFmpeg } from "@ffmpeg/ffmpeg";
import coreURL from "@ffmpeg/core?url";
import wasmURL from "@ffmpeg/core/wasm?url";
import classWorkerURL from "@ffmpeg/ffmpeg/worker?worker&url";

export async function transcodeNewsMedia(file: File, audio: boolean): Promise<File> {
  const ffmpeg = new FFmpeg();
  const output = audio ? "output.mp3" : "output.mp4";
  const resolve = (url: string) => new URL(url, window.location.href).href;
  try {
    await ffmpeg.load({ coreURL: resolve(coreURL), wasmURL: resolve(wasmURL), classWorkerURL: resolve(classWorkerURL) });
    await ffmpeg.writeFile("input", new Uint8Array(await file.arrayBuffer()));
    const options = audio
      ? ["-map", "0:a:0", "-vn", "-c:a", "libmp3lame", "-b:a", "96k"]
      : ["-map", "0:v:0", "-map", "0:a:0?", "-vf", "scale=w='min(iw,if(gte(iw,ih),1280,720))':h='min(ih,if(gte(iw,ih),720,1280))':force_original_aspect_ratio=decrease:force_divisible_by=2,pad=ceil(iw/2)*2:ceil(ih/2)*2",
          "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-maxrate", "1800k", "-bufsize", "3600k",
          "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart"];
    if (await ffmpeg.exec(["-i", "input", "-map_metadata", "-1", "-map_chapters", "-1", ...options, output], 180_000) !== 0) throw new Error("Transcode failed");
    const data = await ffmpeg.readFile(output);
    if (typeof data === "string" || data.byteLength === 0) throw new Error("Empty transcode");
    const converted = new File([new Uint8Array(data)], `${file.name.replace(/\.[^.]+$/, "")}.${audio ? "mp3" : "mp4"}`, {
      type: audio ? "audio/mpeg" : "video/mp4",
    });
    return converted.size < file.size || /\.mov$/i.test(file.name) ? converted : file;
  } catch {
    throw new Error("파일을 압축하지 못했습니다. 다른 브라우저나 인코딩 형식으로 다시 시도해 주세요.");
  } finally {
    ffmpeg.terminate();
  }
}
