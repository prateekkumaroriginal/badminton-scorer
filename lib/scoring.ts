export type Side = 'A' | 'B';

export type ScoreState = {
  pointsA: number;
  pointsB: number;
  winner: Side | null;
};

export const INITIAL_SCORE: ScoreState = {
  pointsA: 0,
  pointsB: 0,
  winner: null,
};

function winsGame(points: number, opponentPoints: number) {
  return points === 30 || (points >= 21 && points - opponentPoints >= 2);
}

export function scorePoint(state: ScoreState, side: Side): ScoreState {
  if (state.winner) return state;

  const next = { ...state };

  if (side === 'A') next.pointsA += 1;
  else next.pointsB += 1;

  const sideWonGame =
    side === 'A'
      ? winsGame(next.pointsA, next.pointsB)
      : winsGame(next.pointsB, next.pointsA);

  if (!sideWonGame) return next;

  next.winner = side;

  return next;
}

export function scoreFromRecord(record: {
  pointsA: number;
  pointsB: number;
  winner?: Side;
}): ScoreState {
  return {
    pointsA: record.pointsA,
    pointsB: record.pointsB,
    winner: record.winner ?? null,
  };
}
