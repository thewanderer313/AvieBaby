import { spawn } from 'node:child_process';

export interface PipelineEvent {
  step: string;
  status: 'started' | 'succeeded' | 'failed';
  stdout?: string;
  stderr?: string;
}

export type PipelineEmit = (event: PipelineEvent) => void;

function runScript(
  repoRoot: string,
  args: string[],
  step: string,
  emit: PipelineEmit,
): Promise<void> {
  emit({ step, status: 'started' });
  return new Promise((resolve, reject) => {
    const proc = spawn('bash', args, { cwd: repoRoot });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    proc.on('error', (err) => {
      emit({ step, status: 'failed', stderr: err.message });
      reject(err);
    });
    proc.on('close', (code) => {
      if (code === 0) {
        emit({ step, status: 'succeeded', stdout });
        resolve();
      } else {
        emit({ step, status: 'failed', stdout, stderr });
        reject(new Error(`${step} failed (exit ${code}): ${stderr.trim()}`));
      }
    });
  });
}

export async function runBookPage(
  repoRoot: string,
  inputPath: string,
  bookId: string,
  pageNum: number,
  title: string | null,
  emit: PipelineEmit,
): Promise<void> {
  const args = ['scripts/book-page.sh'];
  if (title) args.push('--title', title);
  args.push(inputPath, bookId, String(pageNum));
  await runScript(repoRoot, args, `page-${pageNum}`, emit);
}

export async function runBookVoice(
  repoRoot: string,
  inputPath: string,
  bookId: string,
  readerId: string,
  pageNum: number,
  readerName: string | null,
  keepTail: boolean,
  emit: PipelineEmit,
): Promise<void> {
  const args = ['scripts/book-voice.sh'];
  if (keepTail) args.push('--keep-tail');
  if (readerName) args.push('--reader-name', readerName);
  args.push(inputPath, bookId, readerId, String(pageNum));
  await runScript(
    repoRoot,
    args,
    `voice-${readerId}-${pageNum}`,
    emit,
  );
}

export async function runBookCover(
  repoRoot: string,
  inputPath: string,
  bookId: string,
  emit: PipelineEmit,
): Promise<void> {
  await runScript(
    repoRoot,
    ['scripts/book-cover.sh', inputPath, bookId],
    'cover',
    emit,
  );
}

export async function runBookRegister(
  repoRoot: string,
  emit: PipelineEmit,
): Promise<void> {
  emit({ step: 'register', status: 'started' });
  return new Promise((resolve, reject) => {
    const proc = spawn('node', ['scripts/book-register.js'], { cwd: repoRoot });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => (stdout += d.toString()));
    proc.stderr.on('data', (d) => (stderr += d.toString()));
    proc.on('close', (code) => {
      if (code === 0) {
        emit({ step: 'register', status: 'succeeded', stdout });
        resolve();
      } else {
        emit({ step: 'register', status: 'failed', stdout, stderr });
        reject(new Error(`register failed (exit ${code}): ${stderr.trim()}`));
      }
    });
  });
}
