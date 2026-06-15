import React, { useEffect, useMemo, useState } from 'react';
import {
  Reading, TitleGroup, ImageAsset, AudioAsset, listTitles, listAssets,
  createReading, updateReading,
} from '../api';
import {
  DndContext, KeyboardSensor, PointerSensor, pointerWithin,
  useSensor, useSensors, DragEndEvent, useDroppable, useDraggable, DragOverlay, DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Props {
  reading: Reading | null;
  onClose: () => void;
}

interface Row {
  rowId: string;
  image: string;
  audio: string;
}

let rowSeq = 0;
const makeRowId = () => `row-${++rowSeq}`;

const PAGE_PREFIX = 'page-';
const AUDIO_PREFIX = 'audio-';

export const ReadingEditor: React.FC<Props> = ({ reading, onClose }) => {
  const isNew = !reading;
  const [titles, setTitles] = useState<TitleGroup[]>([]);
  const [imageAssets, setImageAssets] = useState<ImageAsset[]>([]);
  const [audioAssets, setAudioAssets] = useState<AudioAsset[]>([]);
  const [titleId, setTitleId] = useState<string>(reading?.titleId ?? '');
  const [readerName, setReaderName] = useState<string>(reading?.reader ?? '');
  const [rows, setRows] = useState<Row[]>(
    reading?.pages.map((p) => ({ rowId: makeRowId(), image: p.image, audio: p.audio })) ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<ImageAsset | null>(null);

  useEffect(() => {
    listTitles().then(setTitles).catch(console.error);
    listAssets().then((assets) => {
      setImageAssets(assets.filter((a): a is ImageAsset => a.type === 'image'));
      setAudioAssets(assets.filter((a): a is AudioAsset => a.type === 'audio'));
    }).catch(console.error);
  }, []);

  const title = titles.find((t) => t.id === titleId);

  const imageOptions = useMemo(() =>
    imageAssets
      .filter((a) => !title || a.source === title.displayName)
      .sort(byOriginalName),
  [imageAssets, title]);

  const audioOptions = useMemo(() =>
    audioAssets
      .filter((a) =>
        (!title || a.source === title.displayName) &&
        (!readerName || a.reader === readerName),
      )
      .sort(byOriginalName),
  [audioAssets, title, readerName]);

  const imageById = useMemo(
    () => Object.fromEntries(imageAssets.map((a) => [a.id, a])) as Record<string, ImageAsset>,
    [imageAssets],
  );
  const audioById = useMemo(
    () => Object.fromEntries(audioAssets.map((a) => [a.id, a])) as Record<string, AudioAsset>,
    [audioAssets],
  );

  const usedAudioIds = useMemo(() => new Set(rows.map((r) => r.audio).filter(Boolean)), [rows]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    if (id.startsWith(AUDIO_PREFIX)) {
      setActiveAudioId(id.slice(AUDIO_PREFIX.length));
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveAudioId(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith(AUDIO_PREFIX) && overId.startsWith(PAGE_PREFIX)) {
      const audioId = activeId.slice(AUDIO_PREFIX.length);
      const rowId = overId.slice(PAGE_PREFIX.length);
      setRows((rs) => rs.map((r) => (r.rowId === rowId ? { ...r, audio: audioId } : r)));
      return;
    }

    if (activeId.startsWith(PAGE_PREFIX) && overId.startsWith(PAGE_PREFIX) && activeId !== overId) {
      const oldId = activeId.slice(PAGE_PREFIX.length);
      const newId = overId.slice(PAGE_PREFIX.length);
      setRows((rs) => {
        const oldIdx = rs.findIndex((r) => r.rowId === oldId);
        const newIdx = rs.findIndex((r) => r.rowId === newId);
        return arrayMove(rs, oldIdx, newIdx);
      });
    }
  };

  const addRow = () => setRows((rs) => [...rs, { rowId: makeRowId(), image: '', audio: '' }]);
  const updateRow = (rowId: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  const removeRow = (rowId: string) => setRows((rs) => rs.filter((r) => r.rowId !== rowId));

  const onSave = async () => {
    if (!titleId) return alert('Pick a title');
    if (!readerName.trim()) return alert('Reader required');
    for (const [i, row] of rows.entries()) {
      if (!row.image || !row.audio) return alert(`Page ${i + 1} is missing an image or audio`);
    }
    setBusy(true);
    try {
      const payload = {
        titleId, reader: readerName.trim(),
        pages: rows.map((r) => ({ image: r.image, audio: r.audio })),
      };
      if (isNew) await createReading(payload);
      else await updateReading(reading!.id, payload);
      onClose();
    } catch (err: unknown) {
      alert(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally { setBusy(false); }
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={{ margin: '0 0 12px' }}>{isNew ? 'New reading' : `Edit reading ${reading!.id}`}</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <label style={{ flex: 1 }}>Title:<br/>
            <select value={titleId} onChange={(e) => setTitleId(e.target.value)} style={{ width: '100%' }}>
              <option value="">— pick title —</option>
              {titles.map((t) => <option key={t.id} value={t.id}>{t.displayName}</option>)}
            </select>
          </label>
          <label style={{ flex: 1 }}>Reader:<br/>
            <input value={readerName} onChange={(e) => setReaderName(e.target.value)} style={{ width: '100%' }} />
          </label>
        </div>

        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'flex-start' }}>
            {/* Pages column */}
            <div>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                Pages ({rows.length}) — drag audio cards from the right onto a page to pair them
              </div>
              <SortableContext items={rows.map((r) => PAGE_PREFIX + r.rowId)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '60vh', overflow: 'auto', paddingRight: 4 }}>
                  {rows.map((row, idx) => (
                    <PageCard
                      key={row.rowId}
                      row={row}
                      index={idx}
                      image={row.image ? imageById[row.image] : undefined}
                      audio={row.audio ? audioById[row.audio] : undefined}
                      imageOptions={imageOptions}
                      audioOptions={audioOptions}
                      onChange={(patch) => updateRow(row.rowId, patch)}
                      onRemove={() => removeRow(row.rowId)}
                      onZoomImage={(img) => setZoomed(img)}
                    />
                  ))}
                  {rows.length === 0 && (
                    <div style={{ padding: 16, border: '1px dashed #ccc', borderRadius: 8, color: '#888', textAlign: 'center' }}>
                      No pages yet. Click "+ Add page" below to start.
                    </div>
                  )}
                </div>
              </SortableContext>
              <button onClick={addRow} style={{ marginTop: 12 }}>+ Add page</button>
            </div>

            {/* Audio library column */}
            <aside style={{ position: 'sticky', top: 0 }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                Audio library ({audioOptions.length}) — drag onto a page
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflow: 'auto', paddingRight: 4 }}>
                {audioOptions.map((a) => (
                  <DraggableAudioCard
                    key={a.id}
                    asset={a}
                    used={usedAudioIds.has(a.id)}
                  />
                ))}
                {audioOptions.length === 0 && (
                  <div style={{ padding: 12, color: '#888', fontSize: 12 }}>
                    {title && readerName ? 'No audio matches this title + reader yet.' : 'Pick a title and reader to see matching audio.'}
                  </div>
                )}
              </div>
            </aside>
          </div>

          <DragOverlay>
            {activeAudioId ? <AudioDragGhost asset={audioById[activeAudioId]} /> : null}
          </DragOverlay>
        </DndContext>

        {zoomed && (
          <div style={lightboxOverlay} onClick={() => setZoomed(null)}>
            <img
              src={`/assets/library/images/${zoomed.filename}`}
              style={{ maxWidth: '95vw', maxHeight: '85vh', borderRadius: 8, background: '#000' }}
              onClick={(e) => e.stopPropagation()}
            />
            <div style={lightboxCaption}>
              {zoomed.originalName ?? zoomed.id} &nbsp;·&nbsp; <span style={{ fontFamily: 'monospace' }}>{zoomed.id}</span>
              <button onClick={() => setZoomed(null)} style={{ marginLeft: 16 }}>Close</button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} disabled={busy}>Cancel</button>
          <button
            onClick={onSave}
            disabled={busy}
            style={{ background: '#0a84ff', color: 'white', border: 'none', padding: '6px 16px', borderRadius: 6, cursor: 'pointer' }}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface PageCardProps {
  row: Row;
  index: number;
  image?: ImageAsset;
  audio?: AudioAsset;
  imageOptions: ImageAsset[];
  audioOptions: AudioAsset[];
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
  onZoomImage: (image: ImageAsset) => void;
}

const PageCard: React.FC<PageCardProps> = ({ row, index, image, audio, imageOptions, audioOptions, onChange, onRemove, onZoomImage }) => {
  const sortableId = PAGE_PREFIX + row.rowId;
  const { attributes, listeners, setNodeRef: setSortableRef, transform, transition, isDragging } = useSortable({ id: sortableId });
  const { isOver, setNodeRef: setDropRef } = useDroppable({ id: sortableId });

  const ref = (node: HTMLElement | null) => {
    setSortableRef(node);
    setDropRef(node);
  };

  return (
    <div
      ref={ref}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: 'grid',
        gridTemplateColumns: 'auto 200px 1fr auto',
        gap: 12,
        alignItems: 'center',
        padding: 12,
        background: isOver ? '#e6f3ff' : (isDragging ? '#f0f4ff' : '#f8f8fa'),
        border: isOver ? '2px solid #0a84ff' : '2px solid transparent',
        borderRadius: 8,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <button
          {...attributes}
          {...listeners}
          aria-label={`Drag handle page ${index + 1}`}
          style={{ cursor: 'grab', padding: '4px 8px', background: 'transparent', border: 'none', fontSize: 18 }}
        >☰</button>
        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{index + 1}</span>
      </div>

      {image ? (
        <img
          src={`/assets/library/images/${image.filename}`}
          style={{ width: 200, height: 150, objectFit: 'contain', background: '#000', borderRadius: 4, cursor: 'zoom-in' }}
          title={`${image.originalName ?? image.id} — click to enlarge`}
          onClick={(e) => { e.stopPropagation(); onZoomImage(image); }}
        />
      ) : (
        <div style={{ width: 200, height: 150, background: '#eee', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 12 }}>
          No image
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <select value={row.image} onChange={(e) => onChange({ image: e.target.value })} style={{ width: '100%' }}>
          <option value="">— pick image —</option>
          {imageOptions.map((a) => (
            <option key={a.id} value={a.id}>{a.originalName ?? a.id}</option>
          ))}
        </select>
        {audio ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 6, background: '#e8f5e9', borderRadius: 4 }}>
            <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {audio.originalName ?? audio.id}
            </span>
            <audio src={`/assets/library/audio/${audio.filename}`} controls style={{ height: 28 }} />
            <button onClick={() => onChange({ audio: '' })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16 }} title="Unlink audio">✕</button>
          </div>
        ) : (
          <select value={row.audio} onChange={(e) => onChange({ audio: e.target.value })} style={{ width: '100%' }}>
            <option value="">— drop audio here or pick —</option>
            {audioOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.originalName ?? a.id}</option>
            ))}
          </select>
        )}
      </div>

      <button
        onClick={onRemove}
        style={{ background: '#ff3b30', color: 'white', border: 'none', borderRadius: 4, padding: '4px 8px', alignSelf: 'flex-start' }}
        title="Remove this page from the reading"
      >×</button>
    </div>
  );
};

interface DraggableAudioCardProps {
  asset: AudioAsset;
  used: boolean;
}

const DraggableAudioCard: React.FC<DraggableAudioCardProps> = ({ asset, used }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: AUDIO_PREFIX + asset.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: 8,
        background: used ? '#f0f0f0' : 'white',
        border: '1px solid #ddd',
        borderRadius: 6,
        opacity: isDragging ? 0.4 : (used ? 0.6 : 1),
      }}
    >
      <span
        {...attributes}
        {...listeners}
        style={{ cursor: 'grab', padding: '2px 6px', fontSize: 14 }}
        aria-label={`Drag ${asset.originalName ?? asset.id}`}
        title="Drag onto a page to pair"
      >☰</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {asset.originalName ?? asset.id}
        </div>
        {used && <div style={{ fontSize: 10, color: '#888' }}>already paired</div>}
      </div>
      <audio src={`/assets/library/audio/${asset.filename}`} controls style={{ height: 24, maxWidth: 140 }} />
    </div>
  );
};

const AudioDragGhost: React.FC<{ asset?: AudioAsset }> = ({ asset }) => {
  if (!asset) return null;
  return (
    <div style={{
      padding: 8,
      background: '#0a84ff',
      color: 'white',
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      whiteSpace: 'nowrap',
    }}>
      {asset.originalName ?? asset.id}
    </div>
  );
};

function byOriginalName(a: { originalName?: string; id: string }, b: { originalName?: string; id: string }): number {
  const an = (a.originalName ?? a.id).toLowerCase();
  const bn = (b.originalName ?? b.id).toLowerCase();
  return an.localeCompare(bn, undefined, { numeric: true });
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
};
const lightboxOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  zIndex: 300, gap: 16, cursor: 'zoom-out',
};
const lightboxCaption: React.CSSProperties = {
  color: 'white', fontSize: 14,
  display: 'flex', alignItems: 'center',
};
const modal: React.CSSProperties = {
  background: 'white', borderRadius: 12, padding: 24,
  width: 'min(1200px, 95vw)', maxHeight: '95vh', overflow: 'auto',
};
