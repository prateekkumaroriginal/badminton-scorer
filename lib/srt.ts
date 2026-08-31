import type { ScoreState } from './scoring';

export type TimedScore = ScoreState & { elapsedMs: number };

function pad(value: number, width = 2) {
  return String(value).padStart(width, '0');
}

export function formatSrtTime(milliseconds: number) {
  const safe = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1_000);
  const millis = safe % 1_000;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

export function buildSrt(args: {
  sideA: string;
  sideB: string;
  durationMs: number;
  events: TimedScore[];
}) {
  const events = [...args.events].sort((a, b) => a.elapsedMs - b.elapsedMs);

  return events
    .map((event, index) => {
      const nextStart = events[index + 1]?.elapsedMs;
      const end = nextStart ?? Math.max(args.durationMs, event.elapsedMs + 1_000);
      const text = [
        `${args.sideA}  |  ${event.pointsA}`,
        `${args.sideB}  |  ${event.pointsB}`,
      ].join('\n');

      return [
        index + 1,
        `${formatSrtTime(event.elapsedMs)} --> ${formatSrtTime(end)}`,
        text,
      ].join('\n');
    })
    .join('\n\n');
}

export function downloadSrt(filename: string, contents: string) {
  const blob = new Blob([`\uFEFF${contents}`], {
    type: 'application/x-subrip;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function srtFilename(sideA: string, sideB: string) {
  const clean = `${sideA}-vs-${sideB}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${clean || 'badminton-match'}-score.srt`;
}
