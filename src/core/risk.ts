import type { RiskAssessment, RiskLevel } from './types.js';

const READ_PREFIXES = [
  'uptime', 'whoami', 'id', 'uname', 'hostname', 'date', 'pwd',
  'df ', 'df\t', 'free ', 'free\t', 'vmstat', 'iostat', 'ls ', 'ls\t',
  'ps ', 'ps\t', 'top ', 'top\t', 'ss ', 'ss\t', 'netstat ',
  'systemctl status', 'systemctl is-active', 'systemctl is-enabled',
  'journalctl ', 'docker ps', 'docker stats', 'docker logs', 'docker inspect',
  'git status', 'git log', 'git diff', 'git show', 'git branch',
  'cat ', 'head ', 'tail ', 'grep ', 'rg ', 'stat ', 'du ', 'which ', 'command -v '
];

const MUTATING_PATTERNS: Array<[RegExp, string, RiskLevel, number]> = [
  [/\bsystemctl\s+(restart|reload|start|stop)\b/i, 'service state change', 'medium', 45],
  [/\bdocker\s+(restart|start|stop|pause|unpause)\b/i, 'container state change', 'medium', 45],
  [/\b(apt|apt-get|dnf|yum|pacman|apk|brew)\s+(install|upgrade|update|remove|purge)\b/i, 'package manager mutation', 'medium', 50],
  [/\b(git\s+(commit|merge|rebase|reset|checkout|switch|clean|push|pull))\b/i, 'git mutation', 'medium', 45],
  [/\b(sed\s+-i|perl\s+-pi|tee\s+|mv\s+|cp\s+|mkdir\s+|touch\s+|chmod\s+|chown\s+)\b/i, 'filesystem mutation', 'medium', 50],
  [/\b(docker\s+(rm|rmi|system\s+prune|volume\s+rm|network\s+rm))\b/i, 'container deletion', 'high', 75],
  [/\b(systemctl\s+(disable|mask))\b/i, 'persistent service configuration change', 'high', 75],
  [/\b(iptables|nft|ufw)\b/i, 'firewall/network policy change', 'high', 80],
  [/\b(useradd|userdel|usermod|groupadd|groupdel|passwd)\b/i, 'identity/account change', 'high', 85],
  [/\b(chmod\s+-R|chown\s+-R)\b/i, 'recursive permission change', 'high', 85],
  [/(?:\brm\s+-(?:rf|fr)\b|\bmkfs\b|\bwipefs\b|\bfdisk\b|\bparted\b|\bdd\s+if=|\bshutdown\b|\breboot\b|\bpoweroff\b|\bhalt\b)/i, 'destructive system operation', 'critical', 100],
  [/(curl|wget)[^|;&]*\|\s*(sh|bash|zsh|python|python3|node)\b/i, 'remote code piped to interpreter', 'critical', 100],
  [/\b(eval\s+|base64\s+-d[^|]*\|\s*(sh|bash)|bash\s+-c\s+['\"]?\$\()/i, 'indirect/dynamic shell execution', 'high', 90],
  [/(?:\.ssh\/|\.env(?:\.[A-Za-z0-9_.-]+)?(?:\s|$)|\/etc\/shadow\b|\/etc\/sudoers\b|credentials?\b|secrets?\b)/i, 'potential sensitive-data access', 'high', 80]
];

const LEVEL_ORDER: RiskLevel[] = ['read', 'low', 'medium', 'high', 'critical'];

function maxLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return LEVEL_ORDER[Math.max(LEVEL_ORDER.indexOf(a), LEVEL_ORDER.indexOf(b))]!;
}

export function assessCommand(command: string): RiskAssessment {
  const normalized = command.trim().replace(/\s+/g, ' ');
  let level: RiskLevel = READ_PREFIXES.some(prefix => normalized === prefix.trim() || normalized.startsWith(prefix))
    ? 'read'
    : 'medium';
  let score = level === 'read' ? 5 : 45;
  const reasons: string[] = [];

  for (const [pattern, reason, candidate, candidateScore] of MUTATING_PATTERNS) {
    if (pattern.test(normalized)) {
      level = maxLevel(level, candidate);
      score = Math.max(score, candidateScore);
      reasons.push(reason);
    }
  }

  const elevated = /(^|[;&|]\s*)sudo\b|\bsu\s+-?\b/.test(normalized);
  if (elevated) {
    level = maxLevel(level, 'high');
    score = Math.max(score, 80);
    reasons.push('privilege elevation');
  }

  // A command that looked read-only by prefix is no longer trusted once shell
  // composition/redirection is involved. Example: `cat file > target` writes.
  // v0.1 fails closed instead of trying to parse shell grammar.
  const hasShellComposition = /(?:[;&|]|&&|\|\||`|\$\(|(?:^|\s)[<>]{1,2}(?:\s|$|[^&]))/.test(normalized);
  if (hasShellComposition && (level === 'read' || level === 'medium')) {
    level = 'medium';
    score = Math.max(score, 45);
    reasons.push('compound shell expression or redirection');
  }

  if (reasons.length === 0) {
    reasons.push(level === 'read' ? 'recognized read-only command' : 'unclassified command; approval required by default');
  }

  return {
    level,
    score,
    reasons,
    destructive: level === 'critical' || reasons.some(r => r.includes('deletion') || r.includes('destructive')),
    elevated
  };
}

export function requiresApproval(assessment: RiskAssessment): boolean {
  return assessment.level === 'medium' || assessment.level === 'high' || assessment.level === 'critical';
}
