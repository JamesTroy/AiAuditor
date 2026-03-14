export type AgentType = 'code-quality' | 'security' | 'seo-performance' | 'accessibility';

export interface AuditRequestBody {
  agentType: AgentType;
  input: string;
}

export interface AgentConfig {
  id: AgentType;
  name: string;
  description: string;
  accentClass: string;
  buttonClass: string;
  placeholder: string;
  systemPrompt: string;
}
