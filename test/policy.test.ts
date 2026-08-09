import test from 'node:test';
import assert from 'node:assert/strict';
import { PolicyEngine } from '../src/core/policy.js';

test('approval is frozen and single use', () => {
  const policy = new PolicyEngine(60_000);
  const decision = policy.evaluate('device', 'prod', 'systemctl restart nginx', 42_000);
  assert.equal(decision.decision, 'approval_required');
  if (decision.decision !== 'approval_required') return;
  const approval = policy.consume(decision.approval.approvalId);
  assert.equal(approval.command, 'systemctl restart nginx');
  assert.equal(approval.timeoutMs, 42_000);
  assert.throws(() => policy.consume(decision.approval.approvalId), /already used/);
});
