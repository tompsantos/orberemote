import { randomUUID } from 'node:crypto';
import type { PendingApproval, RiskAssessment } from './types.js';
import { assessCommand, requiresApproval } from './risk.js';

export class PolicyEngine {
  private approvals = new Map<string, PendingApproval>();
  private readonly ttlMs: number;

  constructor(ttlMs = 5 * 60_000) {
    this.ttlMs = ttlMs;
  }

  evaluate(deviceId: string, host: string, command: string, timeoutMs?: number):
    | { decision: 'allow'; assessment: RiskAssessment }
    | { decision: 'approval_required'; assessment: RiskAssessment; approval: PendingApproval } {
    const assessment = assessCommand(command);
    if (!requiresApproval(assessment)) return { decision: 'allow', assessment };

    const now = Date.now();
    const approval: PendingApproval = {
      approvalId: randomUUID(),
      deviceId,
      host,
      command,
      ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      assessment,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.ttlMs).toISOString(),
      used: false
    };
    this.approvals.set(approval.approvalId, approval);
    return { decision: 'approval_required', assessment, approval };
  }

  consume(approvalId: string): PendingApproval {
    const approval = this.approvals.get(approvalId);
    if (!approval) throw new Error('approval not found');
    if (approval.used) throw new Error('approval already used');
    if (Date.now() > Date.parse(approval.expiresAt)) {
      this.approvals.delete(approvalId);
      throw new Error('approval expired');
    }
    approval.used = true;
    return approval;
  }

  deny(approvalId: string): PendingApproval {
    const approval = this.approvals.get(approvalId);
    if (!approval) throw new Error('approval not found');
    approval.used = true;
    return approval;
  }

  get(approvalId: string): PendingApproval | undefined {
    return this.approvals.get(approvalId);
  }
}
