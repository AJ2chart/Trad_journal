import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';

/** Réduit les grosses captures pour ne pas saturer le stockage du téléphone. */
async function shrink(file: Blob, max = 2000): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), 'image/webp', 0.85));
  } catch {
    return file;
  }
}

export default function ImageGallery({ tradeId }: { tradeId: string }) {
  const images = useLiveQuery(() => db.images.where('tradeId').equals(tradeId).sortBy('createdAt'), [tradeId]) ?? [];
  const [drag, setDrag] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);

  const urls = useMemo(() => images.map((i) => ({ id: i.id, url: URL.createObjectURL(i.blob) })), [images]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u.url)), [urls]);

  async function addFiles(files: Iterable<Blob>) {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      await db.images.add({ id: uid(), tradeId, blob: await shrink(f), createdAt: Date.now() });
    }
  }

  // Coller une capture (Ctrl/Cmd+V) n'importe où sur la page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (files.length) {
        e.preventDefault();
        void addFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [tradeId]);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setZoom(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoom]);

  return (
    <div>
      {urls.length > 0 && (
        <div className="gallery">
          {urls.map((u) => (
            <figure key={u.id}>
              <img src={u.url} alt="Capture du trade" onClick={() => setZoom(u.url)} />
              <button className="img-del" title="Supprimer l’image"
                onClick={() => confirm('Supprimer cette image ?') && db.images.delete(u.id)}>✕</button>
            </figure>
          ))}
        </div>
      )}
      <label
        className={`dropzone ${drag ? 'drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void addFiles(e.dataTransfer.files); }}
      >
        <input type="file" accept="image/*" multiple hidden onChange={(e) => { void addFiles(e.target.files ?? []); e.target.value = ''; }} />
        <strong>Ajouter une capture</strong>
        <span className="muted">Cliquer, glisser une image, ou coller (Ctrl+V)</span>
      </label>
      {zoom && (
        <div className="lightbox" onClick={() => setZoom(null)} role="dialog" aria-label="Capture agrandie">
          <img src={zoom} alt="Capture agrandie" />
        </div>
      )}
    </div>
  );
}
