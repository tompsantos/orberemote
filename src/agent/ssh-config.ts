import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { glob } from 'glob';
import SSHConfig from 'ssh-config';

export interface SshHost {
  alias: string;
  hostname?: string;
  user?: string;
  port?: number;
  identityFile?: string;
  source: string;
}

function expandTilde(value: string): string {
  return value === '~' ? homedir() : value.startsWith('~/') ? path.join(homedir(), value.slice(2)) : value;
}

async function parseOne(filePath: string, seen: Set<string>): Promise<SshHost[]> {
  const resolved = path.resolve(expandTilde(filePath));
  if (seen.has(resolved)) return [];
  seen.add(resolved);

  let content: string;
  try { content = await readFile(resolved, 'utf8'); }
  catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const parsed: any[] = SSHConfig.parse(content) as any;
  const hosts: SshHost[] = [];

  for (const section of parsed) {
    if (section?.param === 'Include' && section.value) {
      const raw = expandTilde(String(section.value));
      const pattern = path.isAbsolute(raw) ? raw : path.resolve(path.dirname(resolved), raw);
      for (const include of await glob(pattern, { nodir: true })) {
        hosts.push(...await parseOne(include, seen));
      }
      continue;
    }
    if (section?.param !== 'Host') continue;
    const aliases = String(section.value).split(/\s+/).filter(Boolean).filter(a => a !== '*' && !a.includes('*') && !a.includes('?'));
    for (const alias of aliases) {
      const host: SshHost = { alias, source: resolved };
      for (const item of section.config ?? []) {
        const key = String(item?.param ?? '').toLowerCase();
        const value = item?.value;
        if (key === 'hostname') host.hostname = String(value);
        else if (key === 'user') host.user = String(value);
        else if (key === 'port') host.port = Number(value);
        else if (key === 'identityfile') host.identityFile = String(value);
      }
      hosts.push(host);
    }
  }
  return hosts;
}

export async function listSshHosts(configPath = path.join(homedir(), '.ssh', 'config')): Promise<SshHost[]> {
  const hosts = await parseOne(configPath, new Set());
  const dedup = new Map<string, SshHost>();
  for (const host of hosts) if (!dedup.has(host.alias)) dedup.set(host.alias, host);
  return [...dedup.values()].sort((a, b) => a.alias.localeCompare(b.alias));
}
