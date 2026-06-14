import React from 'react';

interface Props {
  file: File;
  pageNumber: number;
  onRemove: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

export const PageTile: React.FC<Props> = ({ file, pageNumber, onRemove, onDragStart, onDragOver, onDrop }) => {
  const url = React.useMemo(() => URL.createObjectURL(file), [file]);
  React.useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 8,
        marginBottom: 8,
        background: '#fff',
        borderRadius: 8,
        border: '1px solid #e5e5ea',
      }}
    >
      <div style={{ width: 32, textAlign: 'center', fontWeight: 700 }}>{pageNumber}</div>
      <img src={url} alt="" style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 4 }} />
      <div style={{ flex: 1, fontSize: 13 }}>{file.name}</div>
      <button onClick={onRemove}>×</button>
    </div>
  );
};
