export interface BookSummary {
  id: string;
  title: string;
  pageCount: number;
  hasCover: boolean;
  readers: Array<{ id: string; name: string }>;
}

export async function listBooks(): Promise<BookSummary[]> {
  const res = await fetch('/api/books');
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  return json.books as BookSummary[];
}

export interface PipelineEvent {
  step: string;
  status: 'started' | 'succeeded' | 'failed';
  stdout?: string;
  stderr?: string;
}

export async function postBook(formData: FormData): Promise<string> {
  const res = await fetch('/api/books', { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await res.text());
  const { jobId } = await res.json();
  return jobId as string;
}

export function streamJob(jobId: string, onEvent: (e: PipelineEvent) => void): EventSource {
  const es = new EventSource(`/api/jobs/${jobId}/events`);
  es.onmessage = (m) => {
    const event: PipelineEvent = JSON.parse(m.data);
    onEvent(event);
    if (event.step === 'done') es.close();
  };
  return es;
}

export async function deleteBook(id: string, confirmation: string): Promise<string> {
  const res = await fetch(`/api/books/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation }),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).jobId as string;
}

export async function patchBook(
  id: string,
  patch: { title?: string; readers?: Record<string, string> },
): Promise<string> {
  const res = await fetch(`/api/books/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).jobId as string;
}

export async function addReader(bookId: string, formData: FormData): Promise<string> {
  const res = await fetch(`/api/books/${bookId}/readers`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).jobId as string;
}

export async function appendPages(bookId: string, formData: FormData): Promise<string> {
  const res = await fetch(`/api/books/${bookId}/pages`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).jobId as string;
}

export async function replacePage(bookId: string, n: number, image: File): Promise<string> {
  const fd = new FormData();
  fd.append('image', image);
  const res = await fetch(`/api/books/${bookId}/pages/${n}/image`, {
    method: 'PUT',
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).jobId as string;
}

export async function replaceVoice(
  bookId: string,
  n: number,
  readerId: string,
  voice: File,
  keepTail: boolean,
): Promise<string> {
  const fd = new FormData();
  fd.append('voice', voice);
  fd.append('keepTail', keepTail ? 'true' : 'false');
  const res = await fetch(`/api/books/${bookId}/pages/${n}/voices/${readerId}`, {
    method: 'PUT',
    body: fd,
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()).jobId as string;
}
