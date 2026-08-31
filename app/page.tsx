'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  History,
  LoaderCircle,
  Plus,
  RotateCcw,
  Trophy,
} from 'lucide-react';
import { useConvex, useMutation, useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { scoreFromRecord, scorePoint, type Side } from '@/lib/scoring';
import { buildSrt, downloadSrt, srtFilename } from '@/lib/srt';

function useClock(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [enabled]);

  return now;
}

function formatClock(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const core = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return hours ? `${String(hours).padStart(2, '0')}:${core}` : core;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pb-8 pt-6 sm:px-8 sm:pt-10">
        {children}
      </div>
    </main>
  );
}

function SetupScreen({
  onHistory,
  onStart,
  busy,
  error,
}: {
  onHistory: () => void;
  onStart: (sideA: string, sideB: string) => Promise<void>;
  busy: boolean;
  error: string | null;
}) {
  const [sideA, setSideA] = useState('');
  const [sideB, setSideB] = useState('');

  return (
    <PageShell>
      <header className="flex justify-end">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="View match history"
          className="rounded-2xl text-muted-foreground"
          onClick={onHistory}
        >
          <History className="size-5" />
        </Button>
      </header>

      <section className="flex flex-1 flex-col justify-center py-10 sm:py-14">
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            await onStart(sideA, sideB);
          }}
        >
          <div className="rounded-3xl border bg-card p-2 shadow-[0_12px_40px_rgb(22_49_39/6%)] focus-within:border-court/40 focus-within:ring-4 focus-within:ring-court/10">
            <label htmlFor="side-a" className="block px-3 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Side A
            </label>
            <Input
              id="side-a"
              value={sideA}
              onChange={(event) => setSideA(event.target.value)}
              placeholder="Player or team name"
              aria-label="Side A name"
              autoComplete="off"
              maxLength={50}
              className="h-12 border-0 bg-transparent px-3 text-lg font-bold shadow-none focus-visible:ring-0"
            />
          </div>

          <div className="rounded-3xl border bg-card p-2 shadow-[0_12px_40px_rgb(22_49_39/6%)] focus-within:border-court/40 focus-within:ring-4 focus-within:ring-court/10">
            <label htmlFor="side-b" className="block px-3 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Side B
            </label>
            <Input
              id="side-b"
              value={sideB}
              onChange={(event) => setSideB(event.target.value)}
              placeholder="Player or team name"
              aria-label="Side B name"
              autoComplete="off"
              maxLength={50}
              className="h-12 border-0 bg-transparent px-3 text-lg font-bold shadow-none focus-visible:ring-0"
            />
          </div>

          {error ? <p className="px-2 text-sm font-medium text-destructive">{error}</p> : null}

          <Button
            type="submit"
            disabled={busy || !sideA.trim() || !sideB.trim()}
            className="mt-2 h-15 w-full rounded-3xl bg-primary px-6 text-base font-bold shadow-[0_14px_32px_rgb(18_83_58/24%)] hover:bg-primary/92"
          >
            {busy ? <LoaderCircle className="size-5 animate-spin" /> : null}
            Start match
            {!busy ? <ArrowRight className="ml-auto size-5" /> : null}
          </Button>
        </form>
      </section>

    </PageShell>
  );
}

function ScoreRow({
  name,
  points,
  active,
}: {
  name: string;
  points: number;
  active: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_80px] items-center gap-2 border-b border-white/10 px-5 py-4 last:border-b-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {active ? <span className="size-2 rounded-full bg-lime-300" aria-label="Winner" /> : null}
          <p className="truncate text-lg font-bold tracking-tight">{name}</p>
        </div>
      </div>
      <p className="text-right font-mono text-5xl font-black tracking-[-0.08em]">{points}</p>
    </div>
  );
}

function ScoringScreen({
  match,
  onPoint,
  onUndo,
  onFinish,
  busy,
  error,
}: {
  match: Doc<'matches'>;
  onPoint: (side: Side) => void;
  onUndo: () => Promise<void>;
  onFinish: () => Promise<void>;
  busy: boolean;
  error: string | null;
}) {
  const [finishOpen, setFinishOpen] = useState(false);
  const now = useClock(true);
  const elapsedMs = now - match.startedAt;
  const winnerName = match.winner === 'A' ? match.sideA : match.winner === 'B' ? match.sideB : null;

  return (
    <main className="min-h-dvh bg-[#0c2f24] text-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-5 pt-5 sm:px-6 sm:pt-7">
        <header className="flex items-center justify-between px-1">
          <div>
            <p className="text-sm font-bold tracking-tight">Rallyframe</p>
            <p className="mt-0.5 text-[11px] font-medium text-white/50">Match in progress</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-2 font-mono text-sm font-bold tabular-nums">
            <span className="size-2 animate-pulse rounded-full bg-red-400" />
            {formatClock(elapsedMs)}
          </div>
        </header>

        <section className="mt-5 overflow-hidden rounded-[28px] border border-white/10 bg-black/18 shadow-[0_22px_60px_rgb(0_0_0/22%)]">
          <ScoreRow
            name={match.sideA}
            points={match.pointsA}
            active={match.winner === 'A'}
          />
          <ScoreRow
            name={match.sideB}
            points={match.pointsB}
            active={match.winner === 'B'}
          />
        </section>

        {winnerName ? (
          <div className="mt-4 flex items-center gap-3 rounded-3xl bg-lime-300 px-5 py-4 text-[#153629]">
            <div className="grid size-10 place-items-center rounded-2xl bg-[#153629] text-lime-300">
              <Trophy className="size-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-65">Match winner</p>
              <p className="text-lg font-black tracking-tight">{winnerName}</p>
            </div>
          </div>
        ) : (
          <section className="mt-4 grid flex-1 grid-rows-2 gap-3">
            <button
              type="button"
              onClick={() => onPoint('A')}
              disabled={busy}
              aria-label={`Add point to ${match.sideA}`}
              className="group flex min-h-32 items-center justify-between rounded-[30px] border border-white/10 bg-[#f4f6e9] px-6 text-left text-[#153629] shadow-[0_16px_38px_rgb(0_0_0/16%)] transition active:scale-[0.985] disabled:opacity-50"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-55">Add point</p>
                <p className="mt-1 truncate text-2xl font-black tracking-[-0.035em]">{match.sideA}</p>
              </div>
              <span className="grid size-16 shrink-0 place-items-center rounded-full bg-[#153629] text-white transition group-active:scale-95">
                <Plus className="size-8" strokeWidth={2.8} />
              </span>
            </button>

            <button
              type="button"
              onClick={() => onPoint('B')}
              disabled={busy}
              aria-label={`Add point to ${match.sideB}`}
              className="group flex min-h-32 items-center justify-between rounded-[30px] border border-white/12 bg-[#1f5944] px-6 text-left text-white shadow-[0_16px_38px_rgb(0_0_0/16%)] transition active:scale-[0.985] disabled:opacity-50"
            >
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">Add point</p>
                <p className="mt-1 truncate text-2xl font-black tracking-[-0.035em]">{match.sideB}</p>
              </div>
              <span className="grid size-16 shrink-0 place-items-center rounded-full bg-lime-300 text-[#153629] transition group-active:scale-95">
                <Plus className="size-8" strokeWidth={2.8} />
              </span>
            </button>
          </section>
        )}

        {error ? <p className="mt-3 px-2 text-sm font-medium text-red-300">{error}</p> : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button
            variant="ghost"
            disabled={busy || match.eventCount <= 1}
            onClick={onUndo}
            className="h-12 rounded-2xl border border-white/10 bg-white/8 text-white hover:bg-white/12 hover:text-white"
          >
            <RotateCcw className="size-4" />
            Undo point
          </Button>
          <Button
            onClick={() => setFinishOpen(true)}
            className="h-12 rounded-2xl bg-white text-[#153629] hover:bg-white/90"
          >
            <Check className="size-4" />
            Finish match
          </Button>
        </div>
      </div>

      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent className="rounded-3xl p-5 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">Finish this match?</DialogTitle>
            <DialogDescription>
              The timer will stop and the score will be ready to export as SRT.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-5 -mb-5 p-5">
            <Button variant="outline" onClick={() => setFinishOpen(false)}>
              Keep scoring
            </Button>
            <Button
              onClick={async () => {
                await onFinish();
                setFinishOpen(false);
              }}
            >
              Finish match
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function HistoryScreen({
  matches,
  onBack,
  onResume,
  onExport,
  exportingId,
}: {
  matches: Doc<'matches'>[];
  onBack: () => void;
  onResume: () => void;
  onExport: (matchId: Id<'matches'>) => Promise<void>;
  exportingId: Id<'matches'> | null;
}) {
  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    [],
  );
  const liveMatch = matches.find((match) => match.status === 'live');

  return (
    <PageShell>
      <header className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon-lg"
          aria-label="Back"
          className="-ml-2 rounded-2xl"
          onClick={onBack}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <p className="text-sm font-bold">Match history</p>
        <div className="size-9" />
      </header>

      <section className="pb-6 pt-10">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-court">Saved in Convex</p>
        <h1 className="mt-2 font-heading text-4xl font-black tracking-[-0.045em]">Your matches</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Finished matches can be exported again at any time.
        </p>
      </section>

      <section className="space-y-3">
        {matches.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-14 text-center">
            <p className="font-bold">No matches yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Start a match to create its timeline.</p>
          </div>
        ) : null}

        {matches.map((match) => {
          const winner = match.winner === 'A' ? match.sideA : match.winner === 'B' ? match.sideB : null;
          return (
            <article
              key={match._id}
              className="rounded-3xl border bg-card p-5 shadow-[0_12px_40px_rgb(22_49_39/5%)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {dateFormat.format(new Date(match.startedAt))}
                  </p>
                  <h2 className="mt-2 truncate text-lg font-black tracking-tight">
                    {match.sideA} <span className="font-medium text-muted-foreground">vs</span>{' '}
                    {match.sideB}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-court">
                    {match.status === 'live'
                      ? `Live at ${match.pointsA}-${match.pointsB}`
                      : winner
                        ? `${winner} won ${match.pointsA}-${match.pointsB}`
                        : `Finished ${match.pointsA}-${match.pointsB}`}
                  </p>
                </div>
                <div
                  className={`mt-1 size-2.5 shrink-0 rounded-full ${
                    match.status === 'live' ? 'animate-pulse bg-red-500' : 'bg-court/30'
                  }`}
                />
              </div>

              <div className="mt-5 border-t pt-4">
                {match.status === 'live' ? (
                  <Button className="w-full rounded-2xl" onClick={onResume}>
                    Resume scoring
                    <ArrowRight className="ml-auto size-4" />
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl bg-transparent"
                    disabled={exportingId === match._id}
                    onClick={() => onExport(match._id)}
                  >
                    {exportingId === match._id ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}
                    Export Filmora SRT
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {!liveMatch ? (
        <Button className="mt-5 h-12 rounded-2xl" onClick={onBack}>
          <Plus className="size-4" />
          Start another match
        </Button>
      ) : null}
    </PageShell>
  );
}

export default function Home() {
  const convex = useConvex();
  const matches = useQuery(api.matches.list);
  const startMatch = useMutation(api.matches.start);
  const undoPoint = useMutation(api.matches.undo);
  const finishMatch = useMutation(api.matches.finish);
  const addPoint = useMutation(api.matches.addPoint).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.matches.list, {});
      if (!current) return;
      localStore.setQuery(
        api.matches.list,
        {},
        current.map((match) => {
          if (match._id !== args.matchId || match.status !== 'live' || match.winner) return match;
          const next = scorePoint(scoreFromRecord(match), args.side);
          return {
            ...match,
            gamesA: next.gamesA,
            gamesB: next.gamesB,
            pointsA: next.pointsA,
            pointsB: next.pointsB,
            gameComplete: next.gameComplete,
            winner: next.winner ?? undefined,
            eventCount: match.eventCount + 1,
          };
        }),
      );
    },
  );

  const [view, setView] = useState<'main' | 'history'>('main');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<Id<'matches'> | null>(null);
  const liveMatch = matches?.find((match) => match.status === 'live');

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (matches === undefined) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background text-foreground">
        <div className="flex items-center gap-3 text-sm font-semibold text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin text-court" />
          Loading matches
        </div>
      </main>
    );
  }

  if (view === 'history') {
    return (
      <HistoryScreen
        matches={matches}
        onBack={() => setView('main')}
        onResume={() => setView('main')}
        exportingId={exportingId}
        onExport={async (matchId) => {
          setExportingId(matchId);
          setError(null);
          try {
            const data = await convex.query(api.matches.getForExport, { matchId });
            const srt = buildSrt({
              sideA: data.match.sideA,
              sideB: data.match.sideB,
              durationMs:
                data.match.durationMs ?? Math.max(0, Date.now() - data.match.startedAt),
              events: data.events.map((event) => ({
                ...scoreFromRecord(event),
                elapsedMs: event.elapsedMs,
              })),
            });
            downloadSrt(srtFilename(data.match.sideA, data.match.sideB), srt);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Could not export this match.');
          } finally {
            setExportingId(null);
          }
        }}
      />
    );
  }

  if (liveMatch) {
    return (
      <ScoringScreen
        match={liveMatch}
        busy={busy}
        error={error}
        onPoint={(side) => {
          setError(null);
          void addPoint({
            matchId: liveMatch._id,
            side,
            elapsedMs: Date.now() - liveMatch.startedAt,
            eventId: crypto.randomUUID(),
          }).catch((caught) => {
            setError(caught instanceof Error ? caught.message : 'The point was not saved.');
          });
        }}
        onUndo={() => run(() => undoPoint({ matchId: liveMatch._id }))}
        onFinish={() =>
          run(async () => {
            const finishedAt = Date.now();
            await finishMatch({
              matchId: liveMatch._id,
              finishedAt,
              durationMs: finishedAt - liveMatch.startedAt,
            });
            setView('history');
          })
        }
      />
    );
  }

  return (
    <SetupScreen
      busy={busy}
      error={error}
      onHistory={() => setView('history')}
      onStart={(sideA, sideB) =>
        run(() =>
          startMatch({
            sideA,
            sideB,
            startedAt: Date.now(),
            eventId: crypto.randomUUID(),
          }),
        )
      }
    />
  );
}
