const STORAGE_KEY = 'ai-audit-history';
const MAX_ENTRIES = 20;

export interface AuditEntry {
  id: string;
  agentId: string;
  agentName: string;
  inputSnippet: string;
  result: string;
  timestamp: number;
}

export function saveAudit(entry: Omit<AuditEntry, 'id'>): void {
  try {
    const history = getHistory();
    const newEntry: AuditEntry = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    const updated = [newEntry, ...history].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable (SSR, private browsing)
  }
}

export function getHistory(agentId?: string): AuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const all: AuditEntry[] = JSON.parse(raw);
    return agentId ? all.filter((e) => e.agentId === agentId) : all;
  } catch {
    return [];
  }
}

export function deleteAudit(id: string): void {
  try {
    const updated = getHistory().filter((e) => e.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
