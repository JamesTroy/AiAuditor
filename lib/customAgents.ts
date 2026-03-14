import { AgentConfig } from './types';

const STORAGE_KEY = 'ai-audit-custom-agents';

export const CUSTOM_AGENT_ACCENT = 'border-purple-500 text-purple-400 hover:bg-purple-500/10';
export const CUSTOM_AGENT_BUTTON = 'bg-purple-600 hover:bg-purple-500';
export const CUSTOM_AGENT_PLACEHOLDER = 'Paste your content here...';

export interface CustomAgent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
}

function read(): CustomAgent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CustomAgent[];
  } catch {
    return [];
  }
}

function write(agents: CustomAgent[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  } catch {
    // localStorage unavailable (private browsing, quota exceeded)
  }
}

export function getCustomAgents(): CustomAgent[] {
  return read();
}

export function getCustomAgent(id: string): CustomAgent | undefined {
  return read().find((a) => a.id === id);
}

export function saveCustomAgent(
  agent: Omit<CustomAgent, 'id' | 'createdAt' | 'updatedAt'>
): CustomAgent {
  const now = Date.now();
  const newAgent: CustomAgent = {
    ...agent,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
  write([...read(), newAgent]);
  return newAgent;
}

export function updateCustomAgent(
  id: string,
  updates: Partial<Omit<CustomAgent, 'id' | 'createdAt'>>
): void {
  write(
    read().map((a) =>
      a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a
    )
  );
}

export function deleteCustomAgent(id: string): void {
  write(read().filter((a) => a.id !== id));
}

export function exportCustomAgents(): string {
  return JSON.stringify(read(), null, 2);
}

export function importCustomAgents(json: string): number {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return 0;
  }
  if (!Array.isArray(parsed)) return 0;

  const existing = read();
  const existingIds = new Set(existing.map((a) => a.id));
  let added = 0;

  const toAdd: CustomAgent[] = [];
  for (const item of parsed) {
    if (
      item === null ||
      typeof item !== 'object' ||
      typeof (item as Record<string, unknown>).id !== 'string' ||
      typeof (item as Record<string, unknown>).name !== 'string' ||
      typeof (item as Record<string, unknown>).systemPrompt !== 'string'
    ) {
      continue;
    }
    const entry = item as CustomAgent;
    if (existingIds.has(entry.id)) continue;
    toAdd.push({
      id: entry.id,
      name: String(entry.name).slice(0, 60),
      description: typeof entry.description === 'string' ? entry.description.slice(0, 200) : '',
      systemPrompt: String(entry.systemPrompt).slice(0, 10_000),
      createdAt: typeof entry.createdAt === 'number' ? entry.createdAt : Date.now(),
      updatedAt: typeof entry.updatedAt === 'number' ? entry.updatedAt : Date.now(),
    });
    added++;
  }

  if (toAdd.length > 0) write([...existing, ...toAdd]);
  return added;
}

export function toAgentConfig(agent: CustomAgent): AgentConfig {
  return {
    id: agent.id,
    kind: 'custom' as const,
    name: agent.name,
    description: agent.description,
    category: 'Custom',
    accentClass: CUSTOM_AGENT_ACCENT,
    buttonClass: CUSTOM_AGENT_BUTTON,
    placeholder: CUSTOM_AGENT_PLACEHOLDER,
    systemPrompt: agent.systemPrompt,
  };
}
