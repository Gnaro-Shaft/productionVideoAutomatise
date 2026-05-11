import { Composition } from 'remotion';
import { Story, type StoryProps } from './Story';

const FPS = 30;

function pickDimensions(format: string | undefined): { width: number; height: number } {
  switch (format) {
    case 'HORIZONTAL_16_9':
      return { width: 1920, height: 1080 };
    case 'SQUARE_1_1':
      return { width: 1080, height: 1080 };
    case 'VERTICAL_9_16':
    default:
      return { width: 1080, height: 1920 };
  }
}

export const Root: React.FC = () => {
  return (
    <Composition<StoryProps, StoryProps>
      id="Story"
      component={Story as React.ComponentType<StoryProps>}
      durationInFrames={1}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{ scenes: [], format: 'VERTICAL_9_16' }}
      calculateMetadata={({ props }) => {
        const totalSeconds = props.scenes.reduce(
          (sum, s) => sum + Math.max(0.1, s.durationSec),
          0,
        );
        const dims = pickDimensions(props.format);
        return {
          durationInFrames: Math.max(1, Math.ceil(totalSeconds * FPS)),
          width: dims.width,
          height: dims.height,
          props,
        };
      }}
    />
  );
};
