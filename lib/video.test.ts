import { describe, expect, it } from 'vitest';

import {
  buildScoreVideoFramePlan,
  fitLabel,
  scoreVideoFilename,
} from './video';

describe('score video export', () => {
  it('wraps labels to two lines and truncates any remaining text', () => {
    const context = {
      measureText: (text: string) => ({ width: text.length * 10 }),
    } as CanvasRenderingContext2D;

    expect(fitLabel(context, 'Tushar & Prateek Sharma', 100)).toEqual([
      'TUSHAR &',
      'PRATEEK S…',
    ]);
    expect(fitLabel(context, 'Monu & Sparsh', 200)).toEqual(['MONU & SPARSH']);
  });

  it('keeps static spans sparse and animates each score change', () => {
    const frames = buildScoreVideoFramePlan(
      [
        { pointsA: 0, pointsB: 0, elapsedMs: 0 },
        { pointsA: 1, pointsB: 0, elapsedMs: 10_000 },
        { pointsA: 1, pointsB: 1, elapsedMs: 20_000 },
      ],
      30_000,
    );

    expect(frames[0]).toMatchObject({
      timestampMs: 0,
      durationMs: 10_000,
      eventIndex: 0,
      progress: 1,
    });
    expect(
      frames.some((frame) => frame.eventIndex === 1 && frame.progress < 1),
    ).toBe(true);
    expect(frames.at(-1)).toMatchObject({
      eventIndex: 2,
      progress: 1,
    });
    expect(
      frames.reduce((total, frame) => total + frame.durationMs, 0),
    ).toBeCloseTo(30_000, 5);
    expect(frames.length).toBeLessThan(50);
  });

  it('holds the final score for at least one second', () => {
    const frames = buildScoreVideoFramePlan(
      [
        { pointsA: 0, pointsB: 0, elapsedMs: 0 },
        { pointsA: 1, pointsB: 0, elapsedMs: 5_000 },
      ],
      5_000,
    );

    const end = frames.reduce(
      (latest, frame) => Math.max(latest, frame.timestampMs + frame.durationMs),
      0,
    );
    expect(end).toBe(6_000);
  });

  it('creates a filesystem-safe WebM filename', () => {
    expect(scoreVideoFilename('Manu / A', 'Prateek B')).toBe(
      'manu-a-vs-prateek-b-score-overlay.webm',
    );
  });
});
