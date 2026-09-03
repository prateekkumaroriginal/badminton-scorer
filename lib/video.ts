import type { TimedScore } from './srt';

export const SCORE_VIDEO_WIDTH = 960;
export const SCORE_VIDEO_HEIGHT = 400;
export const SCORE_ROLL_DURATION_MS = 650;
export const SCORE_ROLL_FPS = 30;

export type ScoreVideoFrame = {
  timestampMs: number;
  durationMs: number;
  eventIndex: number;
  progress: number;
};

type ScoreVideoArgs = {
  sideA: string;
  sideB: string;
  durationMs: number;
  events: TimedScore[];
};

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function padScore(value: number) {
  return String(value).padStart(2, '0');
}

export function fitLabel(
  context: CanvasRenderingContext2D,
  label: string,
  maxWidth: number,
): string[] {
  const words = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.toLocaleUpperCase());
  if (words.length === 0) return [''];

  const fullLabel = words.join(' ');
  if (context.measureText(fullLabel).width <= maxWidth) return [fullLabel];

  let currentLine = '';
  let splitIndex = 0;

  for (const [index, word] of words.entries()) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      splitIndex = index + 1;
      continue;
    }
    break;
  }

  if (!currentLine) {
    currentLine = truncateLabel(context, words[0], maxWidth);
    splitIndex = 1;
  }

  const remainingLabel = words.slice(splitIndex).join(' ');
  if (!remainingLabel) return [currentLine];

  return [
    currentLine,
    context.measureText(remainingLabel).width <= maxWidth
      ? remainingLabel
      : truncateLabel(context, remainingLabel, maxWidth),
  ];
}

function truncateLabel(
  context: CanvasRenderingContext2D,
  label: string,
  maxWidth: number,
) {
  let shortened = label.trimEnd();
  while (
    shortened.length > 0 &&
    context.measureText(`${shortened}…`).width > maxWidth
  ) {
    shortened = shortened.slice(0, -1).trimEnd();
  }
  return `${shortened}…`;
}

function cubicBezierY(x: number) {
  const x1 = 0.55;
  const y1 = 0;
  const x2 = 0.2;
  const y2 = 1;
  let parameter = x;

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const inverse = 1 - parameter;
    const estimate =
      3 * inverse * inverse * parameter * x1 +
      3 * inverse * parameter * parameter * x2 +
      parameter * parameter * parameter;
    const derivative =
      3 * inverse * inverse * x1 +
      6 * inverse * parameter * (x2 - x1) +
      3 * parameter * parameter * (1 - x2);
    if (Math.abs(derivative) < 0.0001) break;
    parameter -= (estimate - x) / derivative;
    parameter = Math.min(1, Math.max(0, parameter));
  }

  const inverse = 1 - parameter;
  return (
    3 * inverse * inverse * parameter * y1 +
    3 * inverse * parameter * parameter * y2 +
    parameter * parameter * parameter
  );
}

function drawScore(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  value: number,
  previousValue: number,
  progress: number,
) {
  context.save();
  roundedRect(context, x, y, width, height, 40);
  context.clip();

  const gradient = context.createLinearGradient(x, y, x + width, y + height);
  gradient.addColorStop(0, '#08744a');
  gradient.addColorStop(1, '#075b3c');
  context.fillStyle = gradient;
  context.fillRect(x, y, width, height);

  context.strokeStyle = 'rgba(11, 107, 69, 0.16)';
  context.lineWidth = 2;
  roundedRect(context, x + 1, y + 1, width - 2, height - 2, 39);
  context.stroke();

  context.fillStyle = '#ffffff';
  context.font =
    '900 142px Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const centerX = x + width / 2;
  const centerY = y + height / 2 + 3;
  if (value === previousValue || progress >= 1) {
    context.fillText(padScore(value), centerX, centerY);
  } else {
    const eased = cubicBezierY(progress);
    context.globalAlpha = 1 - eased;
    context.fillText(
      padScore(previousValue),
      centerX,
      centerY - height * eased,
    );
    context.globalAlpha = eased;
    context.fillText(padScore(value), centerX, centerY + height * (1 - eased));
  }

  context.restore();
}

function drawScoreboard(
  context: CanvasRenderingContext2D,
  sideA: string,
  sideB: string,
  current: TimedScore,
  previous: TimedScore,
  progress: number,
) {
  context.resetTransform();
  context.clearRect(0, 0, SCORE_VIDEO_WIDTH, SCORE_VIDEO_HEIGHT);

  const boardX = 30;
  const boardY = 28;
  const boardWidth = 900;
  const boardHeight = 344;

  context.save();
  context.shadowColor = 'rgba(0, 0, 0, 0.24)';
  context.shadowBlur = 34;
  context.shadowOffsetY = 18;
  context.fillStyle = 'rgba(235, 245, 240, 0.9)';
  roundedRect(context, boardX, boardY, boardWidth, boardHeight, 58);
  context.fill();
  context.restore();

  context.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  context.lineWidth = 3;
  roundedRect(
    context,
    boardX + 1.5,
    boardY + 1.5,
    boardWidth - 3,
    boardHeight - 3,
    56.5,
  );
  context.stroke();

  const columnWidth = 270;
  const columnGap = 94;
  const firstX = (SCORE_VIDEO_WIDTH - columnWidth * 2 - columnGap) / 2;
  const secondX = firstX + columnWidth + columnGap;
  const scoreWidth = 238;
  const scoreHeight = 202;
  const scoreY = 132;

  context.fillStyle = '#10271d';
  context.font =
    '850 30px Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  const sideALines = fitLabel(context, sideA, columnWidth);
  for (const [index, line] of sideALines.entries()) {
    context.fillText(
      line,
      firstX + columnWidth / 2,
      91 + (index - (sideALines.length - 1) / 2) * 34,
    );
  }
  const sideBLines = fitLabel(context, sideB, columnWidth);
  for (const [index, line] of sideBLines.entries()) {
    context.fillText(
      line,
      secondX + columnWidth / 2,
      91 + (index - (sideBLines.length - 1) / 2) * 34,
    );
  }

  drawScore(
    context,
    firstX + (columnWidth - scoreWidth) / 2,
    scoreY,
    scoreWidth,
    scoreHeight,
    current.pointsA,
    previous.pointsA,
    progress,
  );
  drawScore(
    context,
    secondX + (columnWidth - scoreWidth) / 2,
    scoreY,
    scoreWidth,
    scoreHeight,
    current.pointsB,
    previous.pointsB,
    progress,
  );
}

export function buildScoreVideoFramePlan(
  events: TimedScore[],
  durationMs: number,
) {
  const sorted = [...events].sort((a, b) => a.elapsedMs - b.elapsedMs);
  if (sorted.length === 0) return [];

  const lastEventTime = Math.max(0, Math.round(sorted.at(-1)!.elapsedMs));
  const videoDuration = Math.max(
    Math.round(durationMs),
    lastEventTime + 1_000,
    1_000,
  );
  const frames: ScoreVideoFrame[] = [];
  let cursor = 0;

  for (let index = 1; index < sorted.length; index += 1) {
    const timestamp = Math.min(
      videoDuration,
      Math.max(cursor, Math.round(sorted[index].elapsedMs)),
    );
    if (timestamp > cursor) {
      frames.push({
        timestampMs: cursor,
        durationMs: timestamp - cursor,
        eventIndex: index - 1,
        progress: 1,
      });
    }

    const nextTimestamp = Math.min(
      videoDuration,
      Math.max(
        timestamp,
        Math.round(sorted[index + 1]?.elapsedMs ?? videoDuration),
      ),
    );
    const animationEnd = Math.min(
      timestamp + SCORE_ROLL_DURATION_MS,
      nextTimestamp,
      videoDuration,
    );
    const animationDuration = animationEnd - timestamp;
    const frameDuration = 1_000 / SCORE_ROLL_FPS;

    for (let frameTime = timestamp; frameTime < animationEnd;) {
      const duration = Math.min(frameDuration, animationEnd - frameTime);
      frames.push({
        timestampMs: frameTime,
        durationMs: duration,
        eventIndex: index,
        progress:
          animationDuration === 0
            ? 1
            : (frameTime - timestamp) / animationDuration,
      });
      frameTime += duration;
    }
    cursor = animationEnd;
  }

  if (videoDuration > cursor) {
    frames.push({
      timestampMs: cursor,
      durationMs: videoDuration - cursor,
      eventIndex: sorted.length - 1,
      progress: 1,
    });
  }

  return frames;
}

export async function exportScoreVideo(
  args: ScoreVideoArgs,
  onProgress?: (progress: number) => void,
) {
  if (typeof document === 'undefined') {
    throw new Error('Video export is only available in a browser.');
  }

  const events = [...args.events].sort((a, b) => a.elapsedMs - b.elapsedMs);
  if (events.length === 0) throw new Error('The score timeline is empty.');

  const {
    BufferTarget,
    CanvasSource,
    Output,
    Quality,
    WebMOutputFormat,
    canEncodeVideo,
  } = await import('mediabunny');

  const supported = await canEncodeVideo('vp9', {
    width: SCORE_VIDEO_WIDTH,
    height: SCORE_VIDEO_HEIGHT,
    alpha: 'keep',
  });
  if (!supported) {
    throw new Error(
      'This browser cannot create a transparent video. Try the latest Chrome or Edge.',
    );
  }

  const canvas = document.createElement('canvas');
  canvas.width = SCORE_VIDEO_WIDTH;
  canvas.height = SCORE_VIDEO_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create the video canvas.');

  const target = new BufferTarget();
  const output = new Output({
    format: new WebMOutputFormat(),
    target,
  });
  const source = new CanvasSource(canvas, {
    codec: 'vp9',
    quality: new Quality('high'),
    alpha: 'keep',
    keyFrameInterval: 2,
    latencyMode: 'quality',
  });
  output.addVideoTrack(source);

  const frames = buildScoreVideoFramePlan(events, args.durationMs);
  await output.start();

  try {
    for (let index = 0; index < frames.length; index += 1) {
      const frame = frames[index];
      const current = events[frame.eventIndex];
      const previous = events[Math.max(0, frame.eventIndex - 1)];
      drawScoreboard(
        context,
        args.sideA,
        args.sideB,
        current,
        previous,
        frame.progress,
      );
      await source.add(frame.timestampMs / 1_000, frame.durationMs / 1_000);
      onProgress?.((index + 1) / frames.length);
    }
    source.close();
    await output.finalize();
  } catch (error) {
    if (output.state !== 'finalized' && output.state !== 'canceled') {
      await output.cancel();
    }
    throw error;
  }

  if (!target.buffer) throw new Error('The video encoder returned no data.');
  downloadScoreVideo(
    scoreVideoFilename(args.sideA, args.sideB),
    new Blob([target.buffer], { type: 'video/webm' }),
  );
}

export function scoreVideoFilename(sideA: string, sideB: string) {
  const clean = `${sideA}-vs-${sideB}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${clean || 'badminton-match'}-score-overlay.webm`;
}

function downloadScoreVideo(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
