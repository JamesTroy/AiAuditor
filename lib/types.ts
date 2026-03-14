export type AgentType =
  | 'code-quality'
  | 'security'
  | 'seo-performance'
  | 'accessibility'
  | 'sql'
  | 'api-design'
  | 'devops'
  | 'performance'
  | 'privacy'
  | 'test-quality'
  | 'architecture';

export interface AuditRequestBody {
  agentType: AgentType;
  input: string;
}

export interface CustomAuditRequestBody {
  agentType: 'custom';
  systemPrompt: string;
  input: string;
}

export interface AgentConfig {
  id: string; // built-in AgentType values or custom UUID
  name: string;
  description: string;
  category: string;
  accentClass: string;
  buttonClass: string;
  placeholder: string;
  systemPrompt: string;
}
