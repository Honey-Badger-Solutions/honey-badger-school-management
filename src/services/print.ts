/**
 * Print settings — the school's choices about its own paper.
 *
 * One row per school, so this is a patch-and-save service with no list. The
 * logo is held as a data URL exactly like an avatar (`services/profile.ts`);
 * server-side it becomes a Storage object and this field holds its URL, which
 * is why nothing downstream reads the string as anything but an `<img src>`.
 */
import type { PrintSettings } from '../types'
import { update, delay } from './db'
import { actingUserId, assertPermission } from './users'

/**
 * Largest logo we will hold. Data URLs share the same localStorage budget as
 * the rest of the database, and a letterhead mark prints at ~54px tall — a
 * 128 KB PNG is already more resolution than the paper can show.
 */
export const MAX_LOGO_BYTES = 128 * 1024

export async function savePrintSettings(patch: Partial<PrintSettings>): Promise<void> {
  assertPermission('print.configure', 'changing print settings')
  await delay()
  const actor = actingUserId()
  update((d) => {
    Object.assign(d.printSettings, patch)
    d.printSettings.updatedAt = new Date().toISOString()
    d.printSettings.updatedByUserId = actor
  })
}

/** Set or clear the letterhead logo. Null restores the HoneyBadger mark. */
export async function saveLogo(dataUrl: string | null): Promise<void> {
  assertPermission('print.configure', 'changing the school logo')
  if (dataUrl && dataUrl.length > MAX_LOGO_BYTES) {
    throw new Error('That image is too large.')
  }
  await savePrintSettings({ logoUrl: dataUrl })
}
