import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import type { DeviceHello, DeviceToolResult, RelayMessage, ToolName, ToolResult } from '../core/types.js';

interface DeviceEntry {
  id: string;
  hostname?: string;
  version?: string;
  capabilities: ToolName[];
  socket: WebSocket;
  connectedAt: string;
  lastSeenAt: string;
}

interface PendingCall {
  deviceId: string;
  resolve: (result: ToolResult) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class DeviceRegistry {
  private devices = new Map<string, DeviceEntry>();
  private pending = new Map<string, PendingCall>();

  register(deviceId: string, socket: WebSocket): void {
    const now = new Date().toISOString();
    const previous = this.devices.get(deviceId);
    if (previous && previous.socket !== socket) {
      // One active transport per device id. This prevents stale/reconnected agents
      // from receiving work intended for the current connection.
      previous.socket.close(4001, 'replaced by newer device connection');
    }

    const entry: DeviceEntry = { id: deviceId, capabilities: [], socket, connectedAt: now, lastSeenAt: now };
    this.devices.set(deviceId, entry);

    socket.on('message', raw => this.onMessage(deviceId, raw.toString()));
    socket.on('close', () => {
      if (this.devices.get(deviceId)?.socket === socket) this.devices.delete(deviceId);
    });
  }

  list() {
    return [...this.devices.values()].map(({ socket: _socket, ...safe }) => safe);
  }

  async call(deviceId: string, tool: ToolName, args: Record<string, unknown>, timeoutMs = 90_000): Promise<ToolResult> {
    const device = this.devices.get(deviceId);
    if (!device || device.socket.readyState !== WebSocket.OPEN) throw new Error(`device '${deviceId}' is offline`);
    if (device.capabilities.length && !device.capabilities.includes(tool)) throw new Error(`device '${deviceId}' does not support ${tool}`);

    const id = randomUUID();
    const request = { type: 'tool_call', call: { id, tool, args, requestedAt: new Date().toISOString() } };
    return await new Promise<ToolResult>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`device call timed out after ${timeoutMs}ms`)); }, timeoutMs);
      this.pending.set(id, { deviceId, resolve, reject, timer });
      device.socket.send(JSON.stringify(request), error => {
        if (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
      });
    });
  }

  private onMessage(deviceId: string, raw: string): void {
    let message: RelayMessage;
    try { message = JSON.parse(raw) as RelayMessage; } catch { return; }
    const entry = this.devices.get(deviceId);
    if (entry) entry.lastSeenAt = new Date().toISOString();

    if (message.type === 'hello') {
      const hello = message as DeviceHello;
      if (entry) {
        entry.hostname = hello.hostname;
        entry.version = hello.version;
        entry.capabilities = hello.capabilities;
      }
      return;
    }

    if (message.type === 'tool_result') {
      const result = (message as DeviceToolResult).result;
      const pending = this.pending.get(result.id);
      if (!pending) return;
      // A result is only valid from the exact device that received the call.
      // This closes a class of cross-device routing/confusion bugs.
      if (pending.deviceId !== deviceId) return;
      clearTimeout(pending.timer);
      this.pending.delete(result.id);
      pending.resolve(result);
    }
  }
}
