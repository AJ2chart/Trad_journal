import Dexie, { type Table } from 'dexie';
import { DEFAULT_SETTINGS, type Lesson, type Settings, type Trade, type TradeImage } from './types';

class JournalDB extends Dexie {
  trades!: Table<Trade, string>;
  images!: Table<TradeImage, string>;
  lessons!: Table<Lesson, string>;
  kv!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('trad-journal');
    this.version(1).stores({
      trades: 'id, date, symbol, setup, createdAt',
      images: 'id, tradeId, createdAt',
      lessons: 'id, createdAt, *tradeIds',
      kv: 'key',
    });
  }
}

export const db = new JournalDB();

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings');
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(s: Settings) {
  await db.kv.put({ key: 'settings', value: s });
}

export async function updateTrade(id: string, patch: Partial<Trade>) {
  await db.trades.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteTrade(id: string) {
  await db.transaction('rw', db.trades, db.images, db.lessons, async () => {
    await db.trades.delete(id);
    await db.images.where('tradeId').equals(id).delete();
    const lessons = await db.lessons.where('tradeIds').equals(id).toArray();
    for (const l of lessons) {
      await db.lessons.update(l.id, { tradeIds: l.tradeIds.filter((t) => t !== id) });
    }
  });
}

/* ---------- Sauvegarde / restauration ---------- */

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(b);
  });

export async function exportBackup(): Promise<Blob> {
  const [trades, lessons, images, settings, instruments] = await Promise.all([
    db.trades.toArray(),
    db.lessons.toArray(),
    db.images.toArray(),
    getSettings(),
    db.kv.get('instruments').then((r) => r?.value ?? {}),
  ]);
  const imgs = await Promise.all(
    images.map(async ({ blob, ...rest }) => ({ ...rest, data: await blobToDataUrl(blob) })),
  );
  const payload = { app: 'trad-journal', version: 1, exportedAt: new Date().toISOString(), settings, instruments, trades, lessons, images: imgs };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

export async function importBackup(file: File, mode: 'merge' | 'replace') {
  const data = JSON.parse(await file.text());
  if (data?.app !== 'trad-journal') throw new Error('Ce fichier n’est pas une sauvegarde Trad Journal.');
  const images: TradeImage[] = await Promise.all(
    (data.images ?? []).map(async ({ data: url, ...rest }: { data: string } & Omit<TradeImage, 'blob'>) => ({
      ...rest,
      blob: await (await fetch(url)).blob(),
    })),
  );
  await db.transaction('rw', [db.trades, db.lessons, db.images, db.kv], async () => {
    if (mode === 'replace') {
      await Promise.all([db.trades.clear(), db.lessons.clear(), db.images.clear()]);
    }
    await db.trades.bulkPut(data.trades ?? []);
    await db.lessons.bulkPut(data.lessons ?? []);
    await db.images.bulkPut(images);
    if (data.settings) await db.kv.put({ key: 'settings', value: data.settings });
    if (data.instruments) {
      const cur = mode === 'merge' ? ((await db.kv.get('instruments'))?.value ?? {}) : {};
      await db.kv.put({ key: 'instruments', value: { ...(cur as object), ...data.instruments } });
    }
  });
  return { trades: data.trades?.length ?? 0, lessons: data.lessons?.length ?? 0, images: images.length };
}
