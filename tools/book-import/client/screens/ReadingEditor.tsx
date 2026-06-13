import React, { useEffect, useMemo, useState } from 'react';
import {
  Reading, TitleGroup, ImageAsset, AudioAsset, listTitles, listAssets,
  createReading, updateReading,
} from '../api';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
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

  useEffect(() => {
    listTitles().then(setTitles).catch(console.error);
    listAssets().then((assets) => {
      setImageAssets(assets.filter((a): a is ImageAsset => a.type === 'image'));
      setAudioAssets(assets.filter((a): a is AudioAsset => a.type === 'audio'));
    }).catch(console.error);
  }, []);

  const title = titles.find((t) => t.id === titleId);

  const imageOptions = useMemo(() =>
    imageAssets.filter((a) => !title || a.source === title.displayName),
  [imageAssets, title]);

  const audioOptions = useMemo(() =>
    audioAssets.filter((a) =>
      (!title || a.source === title.displayName) &&
      (!readerName || a.reader === readerName),
    ),
  [audioAssets, title, readerName]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRows((rs) => {
        const oldIdx = rs.findIndex((r) => r.rowId === active.id);
        const newIdx = rs.findIndex((r) => r.rowId === over.id);
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
        <h2>{isNew ? 'New reading' : `Edit reading ${reading!.id}`}</h2>
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
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
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map((r) => r.rowId)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflow: 'auto' }}>
              {rows.map((row, idx) => (
                <SortableRow
                  key={row.rowId}
                  row={row}
                  index={idx}
                  imageOptions={imageOptions}
                  audioOptions={audioOptions}
                  onChange={(patch) => updateRow(row.rowId, patch)}
                  onRemove={() => removeRow(row.rowId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button onClick={addRow}>+ Add page</button>
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

interface RowProps {
  row: Row;
  index: number;
  imageOptions: ImageAsset[];
  audioOptions: AudioAsset[];
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
}

const SortableRow: React.FC<RowProps> = ({ row, index, imageOptions, audioOptions, onChange, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.rowId });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: 8,
        background: isDragging ? '#f0f4ff' : '#f8f8fa',
        borderRadius: 6,
      }}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Drag handle page ${index + 1}`}
        style={{ cursor: 'grab', padding: '4px 8px', background: 'transparent', border: 'none' }}
      >☰</button>
      <span style={{ minWidth: 40, fontFamily: 'monospace' }}>{index + 1}</span>
      <select value={row.image} onChange={(e) => onChange({ image: e.target.value })} style={{ flex: 1 }}>
        <option value="">— image —</option>
        {imageOptions.map((a) => <option key={a.id} value={a.id}>{a.id} ({a.source})</option>)}
      </select>
      <select value={row.audio} onChange={(e) => onChange({ audio: e.target.value })} style={{ flex: 1 }}>
        <option value="">— audio —</option>
        {audioOptions.map((a) => <option key={a.id} value={a.id}>{a.id} ({a.reader})</option>)}
      </select>
      <button
        onClick={onRemove}
        style={{ background: '#ff3b30', color: 'white', border: 'none', borderRadius: 4, padding: '4px 8px' }}
      >×</button>
    </div>
  );
};

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
};
const modal: React.CSSProperties = {
  background: 'white', borderRadius: 12, padding: 24,
  width: 'min(900px, 95vw)', maxHeight: '90vh', overflow: 'auto',
};
