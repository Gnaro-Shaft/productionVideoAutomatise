import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Series,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export interface SceneInput {
  imageUrl: string;
  videoUrl?: string | null;
  videoDurationSec?: number | null;
  audioUrl: string | null;
  durationSec: number;
  voiceText?: string;
}

export interface StoryProps {
  scenes: SceneInput[];
  format?: string;
  musicUrl?: string | null;
}

// ── Ken Burns variants — cycled by scene index so each scene moves differently ──

interface KenBurnsVariant {
  startScale: number;
  endScale: number;
  startX: number; // translate in % of element
  endX: number;
  startY: number;
  endY: number;
}

const KEN_BURNS_VARIANTS: KenBurnsVariant[] = [
  { startScale: 1.0,  endScale: 1.14, startX:  0, endX:  0, startY:  0, endY:  0 }, // pure zoom in
  { startScale: 1.14, endScale: 1.0,  startX:  0, endX:  0, startY:  0, endY:  0 }, // pure zoom out
  { startScale: 1.06, endScale: 1.14, startX: -3, endX:  3, startY:  0, endY:  0 }, // pan right + zoom in
  { startScale: 1.14, endScale: 1.06, startX:  3, endX: -3, startY:  0, endY:  0 }, // pan left + zoom out
  { startScale: 1.04, endScale: 1.12, startX:  0, endX:  0, startY: -2, endY:  2 }, // pan down + zoom in
  { startScale: 1.10, endScale: 1.04, startX:  0, endX:  0, startY:  2, endY: -2 }, // pan up + zoom out
];

const KenBurnsImage: React.FC<{
  src: string;
  durationFrames: number;
  variantIdx: number;
}> = ({ src, durationFrames, variantIdx }) => {
  const frame = useCurrentFrame();
  const variant = KEN_BURNS_VARIANTS[variantIdx % KEN_BURNS_VARIANTS.length]!;

  const easing = Easing.bezier(0.4, 0, 0.2, 1);
  const progress = interpolate(
    frame,
    [0, Math.max(1, durationFrames - 1)],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing,
    },
  );

  const scale = variant.startScale + (variant.endScale - variant.startScale) * progress;
  const translateX = variant.startX + (variant.endX - variant.startX) * progress;
  const translateY = variant.startY + (variant.endY - variant.startY) * progress;

  // Gentle fade-in (first ~0.4s) and fade-out (last ~0.4s) → seamless transitions
  const fadeFrames = Math.min(12, Math.floor(durationFrames / 6));
  const opacity = interpolate(
    frame,
    [0, fadeFrames, durationFrames - fadeFrames, durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
          transformOrigin: 'center',
          opacity,
        }}
      />
    </AbsoluteFill>
  );
};

// ── Composition ─────────────────────────────────────────────────────

export const Story: React.FC<StoryProps> = ({ scenes, musicUrl }) => {
  const { fps } = useVideoConfig();
  const totalFrames = scenes.reduce(
    (sum, s) => sum + Math.max(1, Math.ceil(s.durationSec * fps)),
    0,
  );

  // Music fade-in/out (2s each) so it doesn't slam in or cut abruptly.
  const fadeFrames = Math.min(fps * 2, Math.floor(totalFrames / 4));

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Series>
        {scenes.map((scene, idx) => {
          const durationFrames = Math.max(1, Math.ceil(scene.durationSec * fps));
          return (
            <Series.Sequence key={idx} durationInFrames={durationFrames}>
              {scene.videoUrl ? (
                // Use real LTX-Video clip when available. muted = voice plays separately.
                // Stretch the clip with playbackRate so it spans the whole scene without
                // a jarring loop restart. Capped at 0.5 — below that becomes too slow-mo.
                (() => {
                  const videoDur = scene.videoDurationSec ?? scene.durationSec;
                  const rawRate = videoDur / Math.max(0.1, scene.durationSec);
                  const playbackRate = Math.max(0.5, Math.min(1.0, rawRate));
                  return (
                    <AbsoluteFill style={{ overflow: 'hidden' }}>
                      <OffthreadVideo
                        src={scene.videoUrl}
                        muted
                        loop
                        playbackRate={playbackRate}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </AbsoluteFill>
                  );
                })()
              ) : (
                <KenBurnsImage
                  src={scene.imageUrl}
                  durationFrames={durationFrames}
                  variantIdx={idx}
                />
              )}
              {scene.audioUrl ? <Audio src={scene.audioUrl} /> : null}
            </Series.Sequence>
          );
        })}
      </Series>
      {musicUrl ? (
        <Audio
          src={musicUrl}
          volume={(f) =>
            interpolate(
              f,
              [0, fadeFrames, totalFrames - fadeFrames, totalFrames],
              [0, 0.35, 0.35, 0],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
            )
          }
          loop
        />
      ) : null}
    </AbsoluteFill>
  );
};
