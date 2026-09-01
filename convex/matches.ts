import { v } from 'convex/values';

import { INITIAL_SCORE, scoreFromRecord, scorePoint } from '../lib/scoring';
import { mutation, query } from './_generated/server';

const sideValidator = v.union(v.literal('A'), v.literal('B'));

function scoreFields(score: ReturnType<typeof scoreFromRecord>) {
  return {
    gamesA: score.gamesA,
    gamesB: score.gamesB,
    pointsA: score.pointsA,
    pointsB: score.pointsB,
    gameComplete: score.gameComplete,
    ...(score.winner ? { winner: score.winner } : {}),
  };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('matches')
      .withIndex('by_started_at')
      .order('desc')
      .take(50);
  },
});

export const start = mutation({
  args: {
    sideA: v.string(),
    sideB: v.string(),
    startedAt: v.number(),
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const sideA = args.sideA.trim().slice(0, 50);
    const sideB = args.sideB.trim().slice(0, 50);
    if (!sideA || !sideB) throw new Error('Both sides need a name.');

    const existingLive = await ctx.db
      .query('matches')
      .filter((q) => q.eq(q.field('status'), 'live'))
      .first();
    if (existingLive) return existingLive._id;

    const matchId = await ctx.db.insert('matches', {
      sideA,
      sideB,
      status: 'live',
      startedAt: args.startedAt,
      ...scoreFields(INITIAL_SCORE),
      eventCount: 1,
    });

    await ctx.db.insert('scoreEvents', {
      matchId,
      eventId: args.eventId,
      sequence: 0,
      elapsedMs: 0,
      ...scoreFields(INITIAL_SCORE),
    });

    return matchId;
  },
});

export const addPoint = mutation({
  args: {
    matchId: v.id('matches'),
    side: sideValidator,
    elapsedMs: v.number(),
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const duplicate = await ctx.db
      .query('scoreEvents')
      .withIndex('by_event_id', (q) => q.eq('eventId', args.eventId))
      .unique();
    if (duplicate) return duplicate;

    const match = await ctx.db.get(args.matchId);
    if (!match || match.status !== 'live') throw new Error('This match is not live.');
    if (match.winner) throw new Error('The match already has a winner.');

    const previous = await ctx.db
      .query('scoreEvents')
      .withIndex('by_match_sequence', (q) => q.eq('matchId', args.matchId))
      .order('desc')
      .first();
    if (!previous) throw new Error('The score timeline is missing.');

    const nextScore = scorePoint(scoreFromRecord(match), args.side);
    const elapsedMs = Math.max(previous.elapsedMs, Math.round(args.elapsedMs));
    const sequence = match.eventCount;

    await ctx.db.patch(match._id, {
      ...scoreFields(nextScore),
      winner: nextScore.winner ?? undefined,
      eventCount: sequence + 1,
    });

    return await ctx.db.insert('scoreEvents', {
      matchId: match._id,
      eventId: args.eventId,
      sequence,
      elapsedMs,
      ...scoreFields(nextScore),
    });
  },
});

export const undo = mutation({
  args: { matchId: v.id('matches') },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match || match.status !== 'live') throw new Error('This match is not live.');

    const latest = await ctx.db
      .query('scoreEvents')
      .withIndex('by_match_sequence', (q) => q.eq('matchId', args.matchId))
      .order('desc')
      .take(2);
    if (latest.length < 2) return match;

    await ctx.db.delete(latest[0]._id);
    const previous = latest[1];
    await ctx.db.patch(match._id, {
      gamesA: previous.gamesA,
      gamesB: previous.gamesB,
      pointsA: previous.pointsA,
      pointsB: previous.pointsB,
      gameComplete: previous.gameComplete,
      winner: previous.winner,
      eventCount: match.eventCount - 1,
    });
    return previous;
  },
});

export const finish = mutation({
  args: { matchId: v.id('matches'), finishedAt: v.number(), durationMs: v.number() },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new Error('Match not found.');
    if (match.status === 'finished') return match;

    const latest = await ctx.db
      .query('scoreEvents')
      .withIndex('by_match_sequence', (q) => q.eq('matchId', args.matchId))
      .order('desc')
      .first();
    const durationMs = Math.max(latest?.elapsedMs ?? 0, Math.round(args.durationMs));

    await ctx.db.patch(match._id, {
      status: 'finished',
      finishedAt: args.finishedAt,
      durationMs,
    });
    return match._id;
  },
});

export const cancel = mutation({
  args: { matchId: v.id('matches') },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) return;
    if (match.status !== 'live') throw new Error('Only a live match can be cancelled.');

    const events = await ctx.db
      .query('scoreEvents')
      .withIndex('by_match_sequence', (q) => q.eq('matchId', args.matchId))
      .collect();

    for (const event of events) await ctx.db.delete(event._id);
    await ctx.db.delete(match._id);
  },
});

export const getForExport = query({
  args: { matchId: v.id('matches') },
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new Error('Match not found.');
    const events = await ctx.db
      .query('scoreEvents')
      .withIndex('by_match_sequence', (q) => q.eq('matchId', args.matchId))
      .order('asc')
      .collect();
    return { match, events };
  },
});
