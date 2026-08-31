import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const side = v.union(v.literal('A'), v.literal('B'));

export default defineSchema({
  matches: defineTable({
    sideA: v.string(),
    sideB: v.string(),
    status: v.union(v.literal('live'), v.literal('finished')),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    gamesA: v.number(),
    gamesB: v.number(),
    pointsA: v.number(),
    pointsB: v.number(),
    gameComplete: v.boolean(),
    winner: v.optional(side),
    eventCount: v.number(),
  }).index('by_started_at', ['startedAt']),

  scoreEvents: defineTable({
    matchId: v.id('matches'),
    eventId: v.string(),
    sequence: v.number(),
    elapsedMs: v.number(),
    gamesA: v.number(),
    gamesB: v.number(),
    pointsA: v.number(),
    pointsB: v.number(),
    gameComplete: v.boolean(),
    winner: v.optional(side),
  })
    .index('by_match_sequence', ['matchId', 'sequence'])
    .index('by_event_id', ['eventId']),
});
