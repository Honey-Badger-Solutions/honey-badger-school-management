/**
 * Local data store — the prototype's stand-in for a backend.
 *
 * Everything lives in memory, persisted to localStorage, seeded on first load.
 * Components READ through the useDb() hook (a client-side cache, exactly what
 * a real app would hydrate from the API) and WRITE only through the service
 * functions in this folder (all async). To connect a real backend, reimplement
 * the service functions with fetch() calls and hydrate this cache from the
 * server — no component changes needed.
 */
import { useSyncExternalStore } from 'react'
import type { Db } from '../types'
import { buildSeed } from '../data/seed'

const KEY = 'hbs_db_v1'

/** Bump when the seed or Db shape changes: cached demo data is then rebuilt
 *  instead of leaving an old browser showing stale students and marks. */
const SCHEMA_VERSION = 17

/** A freshly seeded database, stamped with the current schema version. */
function fresh(): Db {
  return { ...buildSeed(), version: SCHEMA_VERSION }
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Db
      if (parsed.version === SCHEMA_VERSION) return parsed
    }
  } catch { /* corrupted → reseed */ }
  const db = fresh()
  persist(db)
  return db
}

function persist(db: Db) {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* storage full — demo keeps running in memory */ }
}

let db: Db = load()
const listeners = new Set<() => void>()

export function getDb(): Db {
  return db
}

/** Mutate the db inside `fn`; commits a new snapshot and notifies subscribers. */
export function update(fn: (draft: Db) => void): void {
  const next: Db = structuredClone(db)
  fn(next)
  db = next
  persist(db)
  listeners.forEach((l) => l())
}

export function resetDb(): void {
  localStorage.removeItem(KEY)
  db = fresh()
  persist(db)
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** Read the current data snapshot; re-renders on any change. */
export function useDb(): Db {
  return useSyncExternalStore(subscribe, getDb)
}

/**
 * Take the next server commit sequence.
 *
 * Mocks what a real backend allocates per school at commit time
 * (SYNC-DESIGN.md §2). Call it INSIDE an update() callback so the number is
 * handed out in the same order the writes commit — that ordering is exactly
 * what a client timestamp cannot provide, and why nothing may resolve on one.
 */
export function takeSeq(d: Db): number {
  return d.nextServerSeq++
}

/** Simulated network latency so optimistic-save states are visible. */
export const delay = (ms = 160) => new Promise<void>((res) => setTimeout(res, ms))
