import { supabase } from "@/integrations/supabase/client";

/**
 * Offline-first round submission queue.
 *
 * Stores pending round payloads in `localStorage` so they survive page
 * reloads, dead zones, and Wi-Fi/4G handoffs. Each queued round carries a
 * stable client-generated `submission_id`; the database has a unique index
 * on `(user_id, submission_id)` so retrying a queued round is guaranteed
 * never to create a duplicate, even if the original network call actually
 * landed before the device dropped offline.
 *
 * The queue lives entirely client-side — no service-worker background sync
 * required — and is flushed:
 *  - whenever this module mounts (`startRoundQueueDrainer`)
 *  - on every `online` event
 *  - explicitly after a fresh user submit
 */

const STORAGE_KEY = "birdie:roundQueue:v1";
const NOTIFY_EVENT = "birdie:round-queue:changed";

/**
 * Drop a queued round after this many failed flush attempts. Stops a
 * permanently-poison item (e.g. user no longer in the team, schema mismatch
 * from an old client) from sticking the badge on forever.
 */
const MAX_ATTEMPTS = 10;

/**
 * Hard ceiling on how long a single flush pass may run. If a Supabase call
 * hangs (dead-zone handoff: request neither resolves nor rejects), we still
 * want the `flushing` lock to release so the next trigger can try again.
 */
const FLUSH_TIMEOUT_MS = 20_000;
/** Per-call timeout inside flushOne — avoids a single hung insert wedging the loop. */
const CALL_TIMEOUT_MS = 10_000;

const log = (...args: unknown[]) => {
  // Tagged so it's easy to filter in the console.
  // eslint-disable-next-line no-console
  console.info("[round-queue]", ...args);
};

function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${label} after ${ms}ms`)), ms);
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export type ShotPayload = {
  shot_type: "eagle" | "albatross" | "hole_in_one";
  course_name: string;
  hole_number: number | null;
  event_name: string | null;
};

export type QueuedRound = {
  /** Stable id generated on the device — used for DB-level dedupe. */
  submission_id: string;
  user_id: string;
  team_id: string;
  course_name: string;
  played_on: string;
  holes_played: number;
  birdies: number;
  eagles: number;
  albatrosses: number;
  hole_in_ones: number;
  shots: ShotPayload[];
  /** Client-side timestamp; useful for sorting and debugging. */
  queued_at: number;
  /** How many flush attempts have been made; used for backoff. */
  attempts: number;
  /** Last error message we saw, for diagnostics. */
  last_error?: string;
};

function safeRandomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers — sufficient for dedupe purposes.
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function readQueue(): QueuedRound[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedRound[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedRound[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage quota or private mode — nothing we can do here.
  }
  window.dispatchEvent(new CustomEvent(NOTIFY_EVENT));
}

export function getQueuedRounds(): QueuedRound[] {
  return readQueue();
}

export function getQueuedCount(): number {
  return readQueue().length;
}

/**
 * Drop every queued round. Used by the badge's "clear" affordance when an
 * item is poison and the user wants to dismiss it.
 */
export function clearRoundQueue() {
  writeQueue([]);
}

export function subscribeToRoundQueue(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = () => listener();
  window.addEventListener(NOTIFY_EVENT, handler);
  // Storage events fire across tabs — keep them in sync too.
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(NOTIFY_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function enqueueRound(
  round: Omit<QueuedRound, "submission_id" | "queued_at" | "attempts"> & {
    submission_id?: string;
  },
): QueuedRound {
  const queued: QueuedRound = {
    submission_id: round.submission_id ?? safeRandomUUID(),
    user_id: round.user_id,
    team_id: round.team_id,
    course_name: round.course_name,
    played_on: round.played_on,
    holes_played: round.holes_played,
    birdies: round.birdies,
    eagles: round.eagles,
    albatrosses: round.albatrosses,
    hole_in_ones: round.hole_in_ones,
    shots: round.shots,
    queued_at: Date.now(),
    attempts: 0,
  };
  const items = readQueue();
  items.push(queued);
  writeQueue(items);
  return queued;
}

function removeFromQueue(submissionId: string) {
  const items = readQueue().filter((r) => r.submission_id !== submissionId);
  writeQueue(items);
}

function updateInQueue(submissionId: string, patch: Partial<QueuedRound>) {
  const items = readQueue().map((r) => (r.submission_id === submissionId ? { ...r, ...patch } : r));
  writeQueue(items);
}

/**
 * Try to push a single queued round to the server. Resolves to `true` if it
 * succeeded (or was already on the server, treated as success thanks to the
 * unique-index dedupe), `false` if it should stay in the queue.
 */
export async function uploadQueuedRound(round: QueuedRound): Promise<boolean> {
  // Step 1: insert the round itself. The unique index on
  // (user_id, submission_id) means a retry after a network blip won't
  // create a duplicate — Postgres will raise 23505 instead.
  let data: { id: string } | null = null;
  let error: { code?: string; message: string } | null = null;
  try {
    const res = await withTimeout(
      supabase
        .from("rounds")
        .insert({
          team_id: round.team_id,
          user_id: round.user_id,
          course_name: round.course_name,
          played_on: round.played_on,
          holes_played: round.holes_played,
          birdies: round.birdies,
          eagles: round.eagles,
          albatrosses: round.albatrosses,
          hole_in_ones: round.hole_in_ones,
          submission_id: round.submission_id,
        })
        .select("id")
        .single(),
      CALL_TIMEOUT_MS,
      "rounds.insert",
    );
    data = (res.data as { id: string } | null) ?? null;
    error = res.error as { code?: string; message: string } | null;
  } catch (e) {
    error = { message: e instanceof Error ? e.message : String(e) };
  }

  let roundId = data?.id;

  if (error) {
    log("rounds.insert failed", { submission_id: round.submission_id, error });
    // Unique violation = the round was already inserted by an earlier
    // attempt that we never confirmed. Look it up and continue with shots.
    if (error.code === "23505") {
      const { data: existing } = await withTimeout(
        supabase
          .from("rounds")
          .select("id")
          .eq("user_id", round.user_id)
          .eq("submission_id", round.submission_id)
          .maybeSingle(),
        CALL_TIMEOUT_MS,
        "rounds.lookup-existing",
      );
      if (existing?.id) {
        roundId = existing.id;
      } else {
        // Couldn't recover the id — leave it queued and try again later.
        updateInQueue(round.submission_id, {
          attempts: round.attempts + 1,
          last_error: error.message,
        });
        return false;
      }
    } else {
      updateInQueue(round.submission_id, {
        attempts: round.attempts + 1,
        last_error: error.message,
      });
      return false;
    }
  }

  if (!roundId) {
    updateInQueue(round.submission_id, {
      attempts: round.attempts + 1,
      last_error: "Missing round id after insert",
    });
    return false;
  }

  // Step 2: insert notable shots, also deduped by submission_id.
  if (round.shots.length > 0) {
    const shotRows = round.shots.map((s, idx) => ({
      round_id: roundId,
      team_id: round.team_id,
      user_id: round.user_id,
      shot_type: s.shot_type,
      course_name: s.course_name,
      hole_number: s.hole_number,
      event_name: s.event_name,
      played_on: round.played_on,
      // Per-shot dedupe id derived from the parent submission_id.
      submission_id: `${round.submission_id}-${idx}`,
    }));
    let shotsErr: { code?: string; message: string } | null = null;
    try {
      const res = await withTimeout(
        supabase.from("notable_shots").insert(shotRows),
        CALL_TIMEOUT_MS,
        "notable_shots.insert",
      );
      shotsErr = res.error as { code?: string; message: string } | null;
    } catch (e) {
      shotsErr = { message: e instanceof Error ? e.message : String(e) };
    }
    // Ignore unique-violations on shots — same dedupe story.
    if (shotsErr && shotsErr.code !== "23505") {
      log("notable_shots.insert failed", { submission_id: round.submission_id, error: shotsErr });
      updateInQueue(round.submission_id, {
        attempts: round.attempts + 1,
        last_error: shotsErr.message,
      });
      return false;
    }
  }

  // Step 3: best-effort team_courses upsert (we don't care if this fails).
  await withTimeout(
    supabase
      .from("team_courses")
      .upsert(
        {
          team_id: round.team_id,
          name: round.course_name,
          added_by: round.user_id,
          is_official: false,
        },
        { onConflict: "team_id,name", ignoreDuplicates: true },
      ),
    CALL_TIMEOUT_MS,
    "team_courses.upsert",
  ).then(
    () => undefined,
    () => undefined,
  );

  log("uploaded round", { submission_id: round.submission_id });
  return true;
}

let flushing = false;
let flushingSince = 0;

/**
 * Try to push everything in the queue to the server. Safe to call frequently
 * — concurrent calls are coalesced. Returns the number of items still queued
 * after the attempt.
 */
export async function flushRoundQueue(): Promise<number> {
  // Self-heal a wedged lock: if a previous flush hung past the timeout, let
  // the next caller through instead of being silently blocked forever.
  if (flushing && Date.now() - flushingSince < FLUSH_TIMEOUT_MS) {
    log("flush already in progress, skipping");
    return getQueuedCount();
  }
  if (flushing) {
    log("previous flush wedged, forcing reset");
  }
  // NOTE: do not bail on `navigator.onLine === false` — it's unreliable
  // (false negatives after sleep / Wi-Fi handoff). Let the actual request
  // try and fail; the connectivity provider does its own probing.
  flushing = true;
  flushingSince = Date.now();
  try {
    // Auth must be present, otherwise RLS will reject everything.
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      log("no session, skipping flush");
      return getQueuedCount();
    }
    const currentUserId = sessionData.session.user.id;

    const items = readQueue();
    log("flush starting", { queued: items.length, user: currentUserId });
    for (const round of items) {
      // Drop rounds that belong to a different signed-in user. They can
      // never be flushed by this account, and counting them in the badge
      // is misleading. (User explicitly approved auto-discard.)
      if (round.user_id !== currentUserId) {
        log("dropping cross-session round", {
          submission_id: round.submission_id,
          owner: round.user_id,
        });
        removeFromQueue(round.submission_id);
        continue;
      }
      // Drop poison items that have failed too many times — otherwise the
      // badge sticks forever and the user has no way to recover.
      if (round.attempts >= MAX_ATTEMPTS) {
        log("dropping poison round", {
          submission_id: round.submission_id,
          attempts: round.attempts,
          last_error: round.last_error,
        });
        removeFromQueue(round.submission_id);
        continue;
      }
      const ok = await uploadQueuedRound(round);
      // Don't abort the whole queue on one failure — a single poison item
      // would block every other queued round behind it. Keep going; failed
      // items stay queued (with their attempts counter bumped) and get
      // dropped once they hit MAX_ATTEMPTS.
      if (ok) removeFromQueue(round.submission_id);
    }
    const remaining = getQueuedCount();
    log("flush done", { remaining });
    return getQueuedCount();
  } catch (e) {
    log("flush threw", e);
    return getQueuedCount();
  } finally {
    flushing = false;
    flushingSince = 0;
  }
}

let drainerStarted = false;

/**
 * Mount once at the root: kicks off an initial flush and listens for the
 * `online` event so queued rounds get sent the moment the connection
 * returns. Idempotent.
 */
export function startRoundQueueDrainer() {
  if (drainerStarted || typeof window === "undefined") return;
  drainerStarted = true;

  const tryFlush = () => {
    void flushRoundQueue();
  };

  window.addEventListener("online", tryFlush);
  // Also retry whenever the tab becomes visible — covers the case where the
  // device went online while the page was backgrounded.
  window.addEventListener("focus", tryFlush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") tryFlush();
  });

  // Initial attempt shortly after boot.
  setTimeout(tryFlush, 500);
}
