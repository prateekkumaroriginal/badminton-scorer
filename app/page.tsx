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
  X,
} from 'lucide-react';
import { useConvex, useMutation, useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import type { Doc, Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { scoreFromRecord, scorePoint, type Side } from '@/lib/scoring';
import { buildSrt, downloadSrt, srtFilename } from '@/lib/srt';

const ACTIVE_MATCH_KEY = 'badminton-scorer:active-match-id';

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
            <label
              htmlFor="side-a"
              className="block px-3 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
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
            <label
              htmlFor="side-b"
              className="block px-3 pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground"
            >
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

          {error ? (
            <p className="px-2 text-sm font-medium text-destructive">{error}</p>
          ) : null}

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
          {active ? (
            <span
              className="size-2 rounded-full bg-lime-300"
              aria-label="Winner"
            />
          ) : null}
          <p className="truncate text-lg font-bold tracking-tight">{name}</p>
        </div>
      </div>
      <p className="text-right font-mono text-5xl font-black tracking-[-0.08em]">
        {points}
      </p>
    </div>
  );
}

function ScoringScreen({
  match,
  onPoint,
  onUndo,
  onCancel,
  onFinish,
  busy,
  error,
}: {
  match: Doc<'matches'>;
  onPoint: (side: Side) => void;
  onUndo: () => Promise<void>;
  onCancel: () => Promise<void>;
  onFinish: () => Promise<void>;
  busy: boolean;
  error: string | null;
}) {
  const [finishOpen, setFinishOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const now = useClock(true);
  const elapsedMs = now - match.startedAt;
  const winnerName =
    match.winner === 'A'
      ? match.sideA
      : match.winner === 'B'
        ? match.sideB
        : null;

  return (
    <main className="min-h-dvh bg-[#0c2f24] text-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-5 pt-5 sm:px-6 sm:pt-7">
        <header className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-2 font-mono text-sm font-bold tabular-nums">
            <span className="size-2 animate-pulse rounded-full bg-red-400" />
            {formatClock(elapsedMs)}
          </div>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Cancel match"
            disabled={busy}
            onClick={() => setCancelOpen(true)}
            className="rounded-2xl text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </Button>
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
              <p className="text-xs font-bold uppercase tracking-[0.12em] opacity-65">
                Match winner
              </p>
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
                <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-55">
                  Add point
                </p>
                <p className="mt-1 truncate text-2xl font-black tracking-[-0.035em]">
                  {match.sideA}
                </p>
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
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">
                  Add point
                </p>
                <p className="mt-1 truncate text-2xl font-black tracking-[-0.035em]">
                  {match.sideB}
                </p>
              </div>
              <span className="grid size-16 shrink-0 place-items-center rounded-full bg-lime-300 text-[#153629] transition group-active:scale-95">
                <Plus className="size-8" strokeWidth={2.8} />
              </span>
            </button>
          </section>
        )}

        {error ? (
          <p className="mt-3 px-2 text-sm font-medium text-red-300">{error}</p>
        ) : null}

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
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-sm"
        >
          <div className="p-5">
            <DialogHeader className="flex-row items-center justify-between gap-3">
              <DialogTitle className="text-xl font-black tracking-tight">
                Finish this match?
              </DialogTitle>
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close finish dialog"
                  />
                }
              >
                <X className="size-4" />
              </DialogClose>
            </DialogHeader>
            <DialogDescription className="mt-4 text-base leading-6">
              The timer will stop and the score will be ready to export as SRT.
            </DialogDescription>
          </div>
          <DialogFooter className="m-0 rounded-none p-5">
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

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent
          showCloseButton={false}
          className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-sm"
        >
          <div className="p-5">
            <DialogHeader className="flex-row items-center justify-between gap-3">
              <DialogTitle className="text-xl font-black tracking-tight">
                Cancel this match?
              </DialogTitle>
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close cancel dialog"
                  />
                }
              >
                <X className="size-4" />
              </DialogClose>
            </DialogHeader>
            <DialogDescription className="mt-4 text-base leading-6">
              The match and its score history will be deleted.
            </DialogDescription>
          </div>
          <DialogFooter className="m-0 rounded-none p-5">
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Keep scoring
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await onCancel();
                setCancelOpen(false);
              }}
            >
              Delete match
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
  onResume: (matchId: Id<'matches'>) => void;
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

      <section className="space-y-3 pt-8">
        {matches.length === 0 ? (
          <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-14 text-center">
            <p className="font-bold">No matches yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start a match to create its timeline.
            </p>
          </div>
        ) : null}

        {matches.map((match) => {
          const winner =
            match.winner === 'A'
              ? match.sideA
              : match.winner === 'B'
                ? match.sideB
                : null;
          return (
            <article
              key={match._id}
              className="rounded-3xl border bg-card p-5 shadow-[0_12px_40px_rgb(22_49_39/5%)]"
            >
              <div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">
                    {dateFormat.format(new Date(match.startedAt))}
                  </p>
                  <h2 className="mt-2 truncate text-lg font-black tracking-tight">
                    {match.sideA}{' '}
                    <span className="font-medium text-muted-foreground">
                      vs
                    </span>{' '}
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
              </div>

              <div className="mt-5 border-t pt-4">
                {match.status === 'live' ? (
                  <Button
                    className="w-full rounded-2xl"
                    onClick={() => onResume(match._id)}
                  >
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

function ResumeMatchDialog({
  match,
  busy,
  error,
  onContinue,
  onDiscard,
}: {
  match: Doc<'matches'>;
  busy: boolean;
  error: string | null;
  onContinue: () => void;
  onDiscard: () => Promise<void>;
}) {
  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-sm"
      >
        <div className="p-5">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">
              Continue this match?
            </DialogTitle>
            <DialogDescription className="pt-2 text-base leading-6">
              {match.sideA} vs {match.sideB} is still live at {match.pointsA}-
              {match.pointsB}.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="mt-3 text-sm font-medium text-destructive">{error}</p>
          ) : null}
        </div>
        <DialogFooter className="m-0 rounded-none p-5">
          <Button variant="destructive" disabled={busy} onClick={onDiscard}>
            Discard match
          </Button>
          <Button disabled={busy} onClick={onContinue}>
            Continue match
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Home() {
  const convex = useConvex();
  const [storedMatchId, setStoredMatchId] = useState<Id<'matches'> | null>(
    null,
  );
  const [activeMatchId, setActiveMatchId] = useState<Id<'matches'> | null>(
    null,
  );
  const [view, setView] = useState<'main' | 'history'>('main');
  const [storageReady, setStorageReady] = useState(false);
  const matches = useQuery(
    api.matches.list,
    view === 'history' ? {} : 'skip',
  );
  const storedMatch = useQuery(
    api.matches.get,
    storedMatchId ? { matchId: storedMatchId } : 'skip',
  );
  const startMatch = useMutation(api.matches.start);
  const undoPoint = useMutation(api.matches.undo);
  const cancelMatch = useMutation(api.matches.cancel);
  const finishMatch = useMutation(api.matches.finish);
  const addPoint = useMutation(api.matches.addPoint).withOptimisticUpdate(
    (localStore, args) => {
      const queryArgs = { matchId: args.matchId };
      const current = localStore.getQuery(api.matches.get, queryArgs);
      if (!current || current.status !== 'live' || current.winner) return;
      const next = scorePoint(scoreFromRecord(current), args.side);
      localStore.setQuery(
        api.matches.get,
        queryArgs,
        {
          ...current,
          pointsA: next.pointsA,
          pointsB: next.pointsB,
          winner: next.winner ?? undefined,
          eventCount: current.eventCount + 1,
        },
      );
    },
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<Id<'matches'> | null>(null);
  const liveMatch =
    storedMatch?._id === activeMatchId && storedMatch.status === 'live'
      ? storedMatch
      : undefined;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.removeItem('badminton-scorer:match-history-ids');
        setStoredMatchId(
          window.localStorage.getItem(ACTIVE_MATCH_KEY) as Id<'matches'> | null,
        );
      } catch {
        // A storage-disabled browser can still record a match for this session.
      }
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const rememberActiveMatch = (matchId: Id<'matches'>) => {
    try {
      window.localStorage.setItem(ACTIVE_MATCH_KEY, matchId);
    } catch {
      // The match still works for this session when storage is unavailable.
    }
    setStoredMatchId(matchId);
    setActiveMatchId(matchId);
  };

  const forgetActiveMatch = () => {
    try {
      window.localStorage.removeItem(ACTIVE_MATCH_KEY);
    } catch {
      // State below still forgets the match for this session.
    }
    setStoredMatchId(null);
    setActiveMatchId(null);
  };

  useEffect(() => {
    if (!storedMatchId || storedMatch === undefined) return;
    if (!storedMatch || storedMatch.status !== 'live') {
      const timer = window.setTimeout(() => {
        try {
          window.localStorage.removeItem(ACTIVE_MATCH_KEY);
        } catch {
          // State below still removes a stale match for this session.
        }
        setStoredMatchId(null);
        setActiveMatchId(null);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [storedMatch, storedMatchId]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (
    !storageReady ||
    (storedMatchId && storedMatch === undefined) ||
    (view === 'history' && matches === undefined)
  ) {
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
        matches={matches ?? []}
        onBack={() => setView('main')}
        onResume={(matchId) => {
          rememberActiveMatch(matchId);
          setView('main');
        }}
        exportingId={exportingId}
        onExport={async (matchId) => {
          setExportingId(matchId);
          setError(null);
          try {
            const data = await convex.query(api.matches.getForExport, {
              matchId,
            });
            const srt = buildSrt({
              sideA: data.match.sideA,
              sideB: data.match.sideB,
              durationMs:
                data.match.durationMs ??
                Math.max(0, Date.now() - data.match.startedAt),
              events: data.events.map((event) => ({
                pointsA: event.pointsA,
                pointsB: event.pointsB,
                elapsedMs: event.elapsedMs,
              })),
            });
            downloadSrt(srtFilename(data.match.sideA, data.match.sideB), srt);
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : 'Could not export this match.',
            );
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
            setError(
              caught instanceof Error
                ? caught.message
                : 'The point was not saved.',
            );
          });
        }}
        onUndo={() => run(() => undoPoint({ matchId: liveMatch._id }))}
        onCancel={() =>
          run(async () => {
            await cancelMatch({ matchId: liveMatch._id });
            forgetActiveMatch();
            setView('main');
          })
        }
        onFinish={() =>
          run(async () => {
            const now = Date.now();
            await finishMatch({
              matchId: liveMatch._id,
              durationMs: now - liveMatch.startedAt,
            });
            forgetActiveMatch();
            setView('history');
          })
        }
      />
    );
  }

  return (
    <>
      <SetupScreen
        busy={busy}
        error={error}
        onHistory={() => setView('history')}
        onStart={(sideA, sideB) =>
          run(async () => {
            const matchId = await startMatch({
              sideA,
              sideB,
              startedAt: Date.now(),
            });
            rememberActiveMatch(matchId);
          })
        }
      />
      {storedMatch?.status === 'live' && !activeMatchId ? (
        <ResumeMatchDialog
          match={storedMatch}
          busy={busy}
          error={error}
          onContinue={() => rememberActiveMatch(storedMatch._id)}
          onDiscard={() =>
            run(async () => {
              await cancelMatch({ matchId: storedMatch._id });
              forgetActiveMatch();
            })
          }
        />
      ) : null}
    </>
  );
}
