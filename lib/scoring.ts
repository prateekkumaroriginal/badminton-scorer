export type Side = 'A' | 'B';

export type ScoreState = {
  gamesA: number;
  gamesB: number;
  pointsA: number;
  pointsB: number;
  gameComplete: boolean;
  winner: Side | null;
};

export const INITIAL_SCORE: ScoreState = {
  gamesA: 0,
  gamesB: 0,
  pointsA: 0,
  pointsB: 0,
  gameComplete: false,
  winner: null,
};

function winsGame(points: number, opponentPoints: number) {
  return points === 30 || (points >= 21 && points - opponentPoints >= 2);
}

export function scorePoint(state: ScoreState, side: Side): ScoreState {
  if (state.winner) return state;

  const next = state.gameComplete
    ? { ...state, pointsA: 0, pointsB: 0, gameComplete: false }
    : { ...state };

  if (side === 'A') next.pointsA += 1;
  else next.pointsB += 1;

  const sideWonGame =
    side === 'A'
      ? winsGame(next.pointsA, next.pointsB)
      : winsGame(next.pointsB, next.pointsA);

  if (!sideWonGame) return next;

  next.gameComplete = true;
  if (side === 'A') next.gamesA += 1;
  else next.gamesB += 1;

  if (next.gamesA === 2) next.winner = 'A';
  if (next.gamesB === 2) next.winner = 'B';

  return next;
}

export function scoreFromRecord(record: {
  gamesA: number;
  gamesB: number;
  pointsA: number;
  pointsB: number;
  gameComplete: boolean;
  winner?: Side;
}): ScoreState {
  return {
    gamesA: record.gamesA,
    gamesB: record.gamesB,
    pointsA: record.pointsA,
    pointsB: record.pointsB,
    gameComplete: record.gameComplete,
    winner: record.winner ?? null,
  };
}
