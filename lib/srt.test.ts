import { describe, expect, it } from 'vitest';

import { INITIAL_SCORE } from './scoring';
import { buildSrt, formatSrtTime } from './srt';

describe('SRT export', () => {
  it('formats Filmora timestamps', () => {
    expect(formatSrtTime(3_723_045)).toBe('01:02:03,045');
  });

  it('keeps each score visible until the next event', () => {
    const srt = buildSrt({
      sideA: 'Arjun',
      sideB: 'Rahul',
      durationMs: 65_000,
      events: [
        { ...INITIAL_SCORE, elapsedMs: 0 },
        { ...INITIAL_SCORE, pointsA: 1, elapsedMs: 32_500 },
      ],
    });

    expect(srt).toContain('00:00:00,000 --> 00:00:32,500');
    expect(srt).toContain('00:00:32,500 --> 00:01:05,000');
    expect(srt).toContain('Arjun  |  1');
  });

  it('exports only the scores side by side', () => {
    const srt = buildSrt({
      sideA: 'Arjun',
      sideB: 'Rahul',
      durationMs: 10_000,
      format: 'scores-only',
      events: [{ ...INITIAL_SCORE, pointsA: 3, pointsB: 20, elapsedMs: 0 }],
    });

    expect(srt).toContain(`3${'\u00A0'.repeat(8)}20`);
    expect(srt).not.toContain('Arjun');
    expect(srt).not.toContain('Rahul');
    expect(srt).not.toContain('|');
  });
});
