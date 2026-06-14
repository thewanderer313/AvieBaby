import React, { useRef, useState } from 'react';

interface Props {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  label: string;
}

export const DropZone: React.FC<Props> = ({ accept, multiple = true, onFiles, label }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = (files: FileList | null) => {
    if (!files) return;
    onFiles(Array.from(files));
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        handle(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      style={{
        border: `2px dashed ${over ? '#0a84ff' : '#c7c7cc'}`,
        background: over ? '#e8f4ff' : '#fff',
        borderRadius: 12,
        padding: 24,
        textAlign: 'center',
        cursor: 'pointer',
        marginBottom: 16,
      }}
    >
      <div style={{ fontSize: 14, color: '#555' }}>{label}</div>
      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Drag files here or click to pick</div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={(e) => handle(e.target.files)}
      />
    </div>
  );
};
