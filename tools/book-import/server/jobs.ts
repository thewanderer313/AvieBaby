import { EventEmitter } from 'node:events';
import type { PipelineEvent } from './pipeline.js';

interface Job {
  emitter: EventEmitter;
  events: PipelineEvent[];
  finished: boolean;
}

const jobs = new Map<string, Job>();
let _next = 1;

export function createJob(): { id: string; emit: (e: PipelineEvent) => void; finish: (ok: boolean, error?: string) => void } {
  const id = `job-${_next++}`;
  const emitter = new EventEmitter();
  const events: PipelineEvent[] = [];
  const job: Job = { emitter, events, finished: false };
  jobs.set(id, job);

  const emit = (e: PipelineEvent) => {
    // Reject events after finish — `done` must be terminal per SSE contract.
    if (job.finished) return;
    events.push(e);
    emitter.emit('event', e);
  };
  const finish = (ok: boolean, error?: string) => {
    // Idempotent: ignore subsequent calls.
    if (job.finished) return;
    job.finished = true;
    const finalEvent: PipelineEvent = {
      step: 'done',
      status: ok ? 'succeeded' : 'failed',
      stderr: error,
    };
    events.push(finalEvent);
    emitter.emit('event', finalEvent);
    // GC after 5 min. unref() so the timer doesn't keep the event loop alive on shutdown.
    setTimeout(() => jobs.delete(id), 5 * 60 * 1000).unref();
  };
  return { id, emit, finish };
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}
