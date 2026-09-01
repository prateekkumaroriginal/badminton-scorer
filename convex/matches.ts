import { v } from 'convex/values';

import { INITIAL_SCORE, scoreFromRecord, scorePoint } from '../lib/scoring';
import { mutation, query } from './_generated/server';

const sideValidator = v.union(v.literal('A'), v.literal('B'));

const matchValidator = v.object({
  _id: v.id('matches'),
  _creationTime: v.number(),
  sideA: v.string(),
  sideB: v.string(),
  status: v.union(v.literal('live'), v.literal('finished')),
  startedAt: v.number(),
  durationMs: v.optional(v.number()),
  pointsA: v.number(),
  pointsB: v.number(),
  winner: v.optional(sideValidator),
  eventCount: v.number(),
});

const scoreEventValidator = v.object({
  _id: v.id('scoreEvents'),
  _creationTime: v.number(),
  matchId: v.id('matches'),
  eventId: v.string(),
  sequence: v.number(),
  elapsedMs: v.number(),
  pointsA: v.number(),
  pointsB: v.number(),
});

function scoreFields(score: ReturnType<typeof scoreFromRecord>) {
  return {
    pointsA: score.pointsA,
    pointsB: score.pointsB,
    ...(score.winner ? { winner: score.winner } : {}),
  };
}

export const list = query({
  args: {},
  returns: v.array(matchValidator),
  handler: async (ctx) =>
    await ctx.db.query('matches').order('desc').collect(),
});

export const get = query({
  args: { matchId: v.id('matches') },
  returns: v.union(matchValidator, v.null()),
  handler: async (ctx, args) => await ctx.db.get(args.matchId),
});

export const start = mutation({
  args: {
    sideA: v.string(),
    sideB: v.string(),
    startedAt: v.number(),
  },
  returns: v.id('matches'),
  handler: async (ctx, args) => {
    const sideA = args.sideA.trim().slice(0, 50);
    const sideB = args.sideB.trim().slice(0, 50);
    if (!sideA || !sideB) throw new Error('Both sides need a name.');

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
      eventId: `start:${matchId}`,
      sequence: 0,
      elapsedMs: 0,
      pointsA: INITIAL_SCORE.pointsA,
      pointsB: INITIAL_SCORE.pointsB,
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
  returns: v.id('scoreEvents'),
  handler: async (ctx, args) => {
    const duplicate = await ctx.db
      .query('scoreEvents')
      .withIndex('by_event_id', (q) => q.eq('eventId', args.eventId))
      .unique();
    if (duplicate) return duplicate._id;

    const match = await ctx.db.get(args.matchId);
    if (!match || match.status !== 'live')
      throw new Error('This match is not live.');
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
      pointsA: nextScore.pointsA,
      pointsB: nextScore.pointsB,
    });
  },
});

export const undo = mutation({
  args: { matchId: v.id('matches') },
  returns: v.union(matchValidator, scoreEventValidator),
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match || match.status !== 'live')
      throw new Error('This match is not live.');

    const latest = await ctx.db
      .query('scoreEvents')
      .withIndex('by_match_sequence', (q) => q.eq('matchId', args.matchId))
      .order('desc')
      .take(2);
    if (latest.length < 2) return match;

    await ctx.db.delete(latest[0]._id);
    const previous = latest[1];
    await ctx.db.patch(match._id, {
      pointsA: previous.pointsA,
      pointsB: previous.pointsB,
      winner: undefined,
      eventCount: match.eventCount - 1,
    });
    return previous;
  },
});

export const finish = mutation({
  args: { matchId: v.id('matches'), durationMs: v.number() },
  returns: v.id('matches'),
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) throw new Error('Match not found.');
    if (match.status === 'finished') return match._id;

    const latest = await ctx.db
      .query('scoreEvents')
      .withIndex('by_match_sequence', (q) => q.eq('matchId', args.matchId))
      .order('desc')
      .first();
    const durationMs = Math.max(
      latest?.elapsedMs ?? 0,
      Math.round(args.durationMs),
    );

    await ctx.db.patch(match._id, {
      status: 'finished',
      durationMs,
    });
    return match._id;
  },
});

export const cancel = mutation({
  args: { matchId: v.id('matches') },
  returns: v.null(),
  handler: async (ctx, args) => {
    const match = await ctx.db.get(args.matchId);
    if (!match) return null;
    if (match.status !== 'live')
      throw new Error('Only a live match can be cancelled.');

    const events = await ctx.db
      .query('scoreEvents')
      .withIndex('by_match_sequence', (q) => q.eq('matchId', args.matchId))
      .collect();

    for (const event of events) await ctx.db.delete(event._id);
    await ctx.db.delete(match._id);
    return null;
  },
});

export const getForExport = query({
  args: { matchId: v.id('matches') },
  returns: v.object({
    match: matchValidator,
    events: v.array(scoreEventValidator),
  }),
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
