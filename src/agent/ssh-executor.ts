import { spawn } from 'node:child_process';
import { listSshHosts } from './ssh-config.js';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  truncated: boolean;
  durationMs: number;
}

const SAFE_ALIAS = /^[A-Za-z0-9_.@:][A-Za-z0-9._@:-]*$/;

export class SshExecutor {
  constructor(
    private readonly allowedHosts: string[] = ['*'],
    private readonly maxOutputBytes = 1_000_000
  ) {}

  private assertSafeAlias(alias: string): void {
    if (!SAFE_ALIAS.test(alias) || alias.startsWith('-')) throw new Error('invalid SSH host alias');
  }

  private hostAllowed(alias: string): boolean {
    return this.allowedHosts.some(pattern => {
      if (pattern === '*') return true;
      const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*').replaceAll('?', '.');
      return new RegExp(`^${escaped}$`).test(alias);
    });
  }

  async listHosts() {
    const hosts = await listSshHosts();
    return hosts.filter(h => this.hostAllowed(h.alias));
  }

  async hostInfo(alias: string) {
    this.assertSafeAlias(alias);
    if (!this.hostAllowed(alias)) throw new Error(`host '${alias}' is not allowed`);
    const hosts = await listSshHosts();
    return hosts.find(h => h.alias === alias) ?? { alias, source: 'explicit' };
  }

  async checkConnectivity(alias: string): Promise<CommandResult> {
    return this.run(alias, 'printf connected', { timeoutMs: 10_000 });
  }

  async run(alias: string, command: string, options: { timeoutMs?: number; maxOutputBytes?: number } = {}): Promise<CommandResult> {
    this.assertSafeAlias(alias);
    if (!this.hostAllowed(alias)) throw new Error(`host '${alias}' is not allowed`);
    if (!command.trim()) throw new Error('command cannot be empty');

    const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 60_000, 1_000), 300_000);
    const outputLimit = Math.min(options.maxOutputBytes ?? this.maxOutputBytes, 10_000_000);
    const started = Date.now();

    return await new Promise<CommandResult>((resolve, reject) => {
      // Native OpenSSH is intentional: it preserves ProxyJump, ssh-agent, certificates,
      // hardware keys and enterprise SSH policy without us reimplementing auth.
      const child = spawn('ssh', [
        '-o', 'BatchMode=yes',
        '-o', 'StrictHostKeyChecking=yes',
        '--', alias, command
      ], { stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: true });

      let stdout = Buffer.alloc(0);
      let stderr = Buffer.alloc(0);
      let truncated = false;
      let timedOut = false;

      const append = (current: Buffer, chunk: Buffer): Buffer => {
        if (current.length >= outputLimit) { truncated = true; return current; }
        const remaining = outputLimit - current.length;
        if (chunk.length > remaining) truncated = true;
        return Buffer.concat([current, chunk.subarray(0, remaining)]);
      };

      child.stdout.on('data', chunk => { stdout = append(stdout, Buffer.from(chunk)); });
      child.stderr.on('data', chunk => { stderr = append(stderr, Buffer.from(chunk)); });

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 1500).unref();
      }, timeoutMs);

      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('close', code => {
        clearTimeout(timer);
        resolve({
          stdout: stdout.toString('utf8'),
          stderr: stderr.toString('utf8') + (truncated ? '\n[output truncated by orbe remote]' : ''),
          exitCode: timedOut ? 124 : (code ?? 1),
          timedOut,
          truncated,
          durationMs: Date.now() - started
        });
      });
    });
  }
}
