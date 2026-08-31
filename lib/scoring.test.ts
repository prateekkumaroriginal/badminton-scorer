import { describe, expect, it } from 'vitest';

import { INITIAL_SCORE, scorePoint, type ScoreState } from './scoring';

function play(state: ScoreState, side: 'A' | 'B', count: number) {
  let current = state;
  for (let index = 0; index < count; index += 1) current = scorePoint(current, side);
  return current;
}

describe('badminton scoring', () => {
  it('wins a game at 21 with a two point lead', () => {
    const score = play(play(INITIAL_SCORE, 'B', 19), 'A', 21);
    expect(score).toMatchObject({ gamesA: 1, pointsA: 21, pointsB: 19, gameComplete: true });
  });

  it('continues through deuce and wins by two', () => {
    let score = play(play(INITIAL_SCORE, 'A', 20), 'B', 20);
    score = scorePoint(score, 'A');
    expect(score.gameComplete).toBe(false);
    score = scorePoint(score, 'A');
    expect(score).toMatchObject({ gamesA: 1, pointsA: 22, pointsB: 20 });
  });

  it('caps a game at 30', () => {
    let score = INITIAL_SCORE;
    for (let point = 0; point < 29; point += 1) {
      score = scorePoint(score, 'A');
      score = scorePoint(score, 'B');
    }
    score = scorePoint(score, 'B');
    expect(score).toMatchObject({ gamesB: 1, pointsA: 29, pointsB: 30 });
  });

  it('keeps the finished game score until the next point', () => {
    const finished = play(INITIAL_SCORE, 'A', 21);
    const nextGame = scorePoint(finished, 'B');
    expect(nextGame).toMatchObject({ gamesA: 1, pointsA: 0, pointsB: 1, gameComplete: false });
  });

  it('wins the match after two games', () => {
    let score = play(INITIAL_SCORE, 'A', 21);
    score = scorePoint(score, 'B');
    score = play(score, 'A', 21);
    expect(score.winner).toBe('A');
  });
});
