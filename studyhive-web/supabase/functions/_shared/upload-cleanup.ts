import { HttpError } from './pro-core.ts';

// Deliberately accepts only a verified profile ID supplied by userContext.
export async function cleanUnusedUploads(db: any, owner: number) {
  const result = await db.rpc('claim_unused_uploads', { owner_ref: owner });
  if (result.error) throw new HttpError(400, result.error.message);
  const rows = result.data;
  if (!Array.isArray(rows) || rows.length > 50 || rows.some((row: any) =>
    typeof row.path !== 'string' || !row.path.startsWith(`${owner}/`) || row.path.includes('..')
  )) throw new HttpError(500, 'Could not validate unused uploads. Nothing was removed.');
  if (!rows.length) return { removed: 0 };
  const removal = await db.storage.from('study-files').remove(rows.map((row: any) => row.path));
  if (removal.error) throw new HttpError(502, 'Some unused uploads could not be removed. Retry cleanup in Settings.');
  // Storage returns the objects actually removed; do not count an overlapping retry twice.
  return { removed: Array.isArray(removal.data) ? removal.data.length : 0 };
}
