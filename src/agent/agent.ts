import os from 'node:os';
import WebSocket from 'ws';
import type { DeviceHello, DeviceToolCall, DeviceToolResult, RelayMessage, ToolResult } from '../core/types.js';
import { SshExecutor } from './ssh-executor.js';
import { assessCommand, requiresApproval } from '../core/risk.js';

export interface AgentOptions {
  gatewayUrl: string;
  deviceId: string;
  deviceToken: string;
  allowedHosts: string[];
}

export class OrbeRemoteAgent {
  private ws?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private stopped = false;
  private executor: SshExecutor;

  constructor(private readonly options: AgentOptions) {
    this.executor = new SshExecutor(options.allowedHosts);
  }

  async start(): Promise<void> {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  private connect(): void {
    const url = new URL(this.options.gatewayUrl);
    url.searchParams.set('deviceId', this.options.deviceId);
    const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${this.options.deviceToken}` } });
    this.ws = ws;

    ws.on('open', () => {
      const hello: DeviceHello = {
        type: 'hello',
        deviceId: this.options.deviceId,
        hostname: os.hostname(),
        version: '0.1.0-alpha.1',
        capabilities: ['list_hosts', 'host_info', 'check_connectivity', 'run_command']
      };
      ws.send(JSON.stringify(hello));
      console.error(`[orbe-agent] connected as ${this.options.deviceId}`);
    });

    ws.on('message', raw => void this.onMessage(raw.toString()));
    ws.on('error', error => console.error('[orbe-agent] websocket error:', error.message));
    ws.on('close', () => {
      console.error('[orbe-agent] disconnected');
      if (!this.stopped) this.reconnectTimer = setTimeout(() => this.connect(), 2500);
    });
  }

  private async onMessage(raw: string): Promise<void> {
    let message: RelayMessage;
    try { message = JSON.parse(raw) as RelayMessage; }
    catch { return; }

    if (message.type === 'ping') {
      this.ws?.send(JSON.stringify({ type: 'pong', at: new Date().toISOString() }));
      return;
    }
    if (message.type !== 'tool_call') return;

    const envelope = message as DeviceToolCall;
    const result = await this.execute(envelope).catch((error: any): ToolResult => ({
      id: envelope.call.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      completedAt: new Date().toISOString()
    }));
    const response: DeviceToolResult = { type: 'tool_result', result };
    this.ws?.send(JSON.stringify(response));
  }

  private async execute(message: DeviceToolCall): Promise<ToolResult> {
    const { id, tool, args } = message.call;
    let result: unknown;
    switch (tool) {
      case 'list_hosts': result = await this.executor.listHosts(); break;
      case 'host_info': result = await this.executor.hostInfo(String(args.host ?? '')); break;
      case 'check_connectivity': result = await this.executor.checkConnectivity(String(args.host ?? '')); break;
      case 'run_command': {
        const command = String(args.command ?? '');
        const assessment = assessCommand(command);
        const authorization = String(args.authorization ?? '');
        if (requiresApproval(assessment) && authorization !== 'approved') {
          throw new Error(`agent policy refused ${assessment.level}-risk command without approval authorization`);
        }
        if (!requiresApproval(assessment) && authorization !== 'auto_read' && authorization !== 'approved') {
          throw new Error('agent policy refused command without gateway authorization context');
        }
        result = await this.executor.run(String(args.host ?? ''), command, {
          timeoutMs: typeof args.timeoutMs === 'number' ? args.timeoutMs : undefined
        });
        break;
      }
      default: throw new Error(`unsupported tool: ${tool}`);
    }
    return { id, ok: true, result, completedAt: new Date().toISOString() };
  }
}
