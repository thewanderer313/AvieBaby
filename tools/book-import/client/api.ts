export interface ImageAsset {
  id: string; type: 'image'; source: string; filename: string; originalName?: string; archived?: boolean;
}
export interface AudioAsset {
  id: string; type: 'audio'; source: string; reader: string; filename: string; originalName?: string; archived?: boolean;
}
export type Asset = ImageAsset | AudioAsset;

export interface TitleGroup {
  id: string; displayName: string; cover?: string;
}

export interface Reading {
  id: string; titleId: string; reader: string;
  pages: Array<{ image: string; audio: string }>;
}

export interface PipelineEvent {
  step: string; status: 'started' | 'succeeded' | 'failed';
  stdout?: string; stderr?: string;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status, body });
  }
  return res.json();
}

export async function listAssets(): Promise<Asset[]> {
  return (await json<{ assets: Asset[] }>(await fetch('/api/library'))).assets;
}

export async function uploadImages(source: string, files: File[]): Promise<string> {
  const fd = new FormData();
  fd.append('source', source);
  for (const f of files) fd.append('files', f);
  const res = await fetch('/api/library/images', { method: 'POST', body: fd });
  const { jobId } = await json<{ jobId: string }>(res);
  return jobId;
}

export async function uploadAudio(
  source: string, reader: string, keepTail: boolean, files: File[],
): Promise<string> {
  const fd = new FormData();
  fd.append('source', source);
  fd.append('reader', reader);
  fd.append('keepTail', String(keepTail));
  for (const f of files) fd.append('files', f);
  const res = await fetch('/api/library/audio', { method: 'POST', body: fd });
  const { jobId } = await json<{ jobId: string }>(res);
  return jobId;
}

export async function deleteAsset(id: string): Promise<void> {
  const res = await fetch(`/api/library/${id}`, { method: 'DELETE' });
  await json(res);
}

export async function setAssetArchived(id: string, archived: boolean): Promise<Asset> {
  const res = await fetch(`/api/library/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ archived }),
  });
  return (await json<{ asset: Asset }>(res)).asset;
}

export async function renameAsset(id: string, originalName: string): Promise<Asset> {
  const res = await fetch(`/api/library/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalName }),
  });
  return (await json<{ asset: Asset }>(res)).asset;
}

export async function listTitles(): Promise<TitleGroup[]> {
  return (await json<{ titles: TitleGroup[] }>(await fetch('/api/titles'))).titles;
}

export async function createTitle(displayName: string): Promise<TitleGroup> {
  const res = await fetch('/api/titles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName }),
  });
  return (await json<{ title: TitleGroup }>(res)).title;
}

export async function renameTitle(id: string, displayName: string): Promise<TitleGroup> {
  const res = await fetch(`/api/titles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName }),
  });
  return (await json<{ title: TitleGroup }>(res)).title;
}

export async function uploadTitleCover(id: string, file: File): Promise<TitleGroup> {
  const fd = new FormData(); fd.append('file', file);
  const res = await fetch(`/api/titles/${id}/cover`, { method: 'POST', body: fd });
  return (await json<{ title: TitleGroup }>(res)).title;
}

export async function deleteTitle(id: string): Promise<void> {
  await json(await fetch(`/api/titles/${id}`, { method: 'DELETE' }));
}

export async function listReadings(): Promise<Reading[]> {
  return (await json<{ readings: Reading[] }>(await fetch('/api/readings'))).readings;
}

export async function createReading(reading: Omit<Reading, 'id'>): Promise<Reading> {
  const res = await fetch('/api/readings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reading),
  });
  return (await json<{ reading: Reading }>(res)).reading;
}

export async function updateReading(id: string, reading: Omit<Reading, 'id'>): Promise<Reading> {
  const res = await fetch(`/api/readings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reading),
  });
  return (await json<{ reading: Reading }>(res)).reading;
}

export async function deleteReading(id: string): Promise<void> {
  await json(await fetch(`/api/readings/${id}`, { method: 'DELETE' }));
}

export function streamJob(
  jobId: string,
  onEvent: (e: PipelineEvent) => void,
  onClose: () => void,
): () => void {
  const es = new EventSource(`/api/jobs/${jobId}/events`);
  es.onmessage = (msg) => {
    try { onEvent(JSON.parse(msg.data) as PipelineEvent); } catch {}
  };
  es.onerror = () => { es.close(); onClose(); };
  return () => es.close();
}
