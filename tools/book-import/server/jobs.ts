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
  jobs.set(id, { emitter, events, finished: false });

  const emit = (e: PipelineEvent) => {
    events.push(e);
    emitter.emit('event', e);
  };
  const finish = (ok: boolean, error?: string) => {
    const finalEvent: PipelineEvent = {
      step: 'done',
      status: ok ? 'succeeded' : 'failed',
      stderr: error,
    };
    events.push(finalEvent);
    emitter.emit('event', finalEvent);
    const job = jobs.get(id);
    if (job) job.finished = true;
    setTimeout(() => jobs.delete(id), 5 * 60 * 1000); // GC after 5 min
  };
  return { id, emit, finish };
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}
