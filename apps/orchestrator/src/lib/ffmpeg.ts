import { spawn } from 'node:child_process';
// @ts-ignore — no types shipped
import ffmpegPath from 'ffmpeg-static';

/**
 * Runs ffmpeg with the given args. Resolves on exit code 0, rejects otherwise
 * with the last 500 chars of stderr.
 */
export function runFfmpeg(args: string[]): Promise<void> {
  const bin = (ffmpegPath as unknown as string) || 'ffmpeg';
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => reject(new Error(`ffmpeg spawn failed: ${err.message}`)));
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/** Concat a PNG sequence into an H.264 MP4 at the given fps. */
export async function pngSequenceToMp4(input: {
  framesGlob: string; // e.g. "/tmp/ltx-xxxx/frame_%05d.png"
  outputPath: string;
  fps: number;
}): Promise<void> {
  await runFfmpeg([
    '-y',
    '-framerate',
    String(input.fps),
    '-i',
    input.framesGlob,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    input.outputPath,
  ]);
}
