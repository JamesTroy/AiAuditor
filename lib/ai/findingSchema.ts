// STRUCT-001: Structured finding schema for tool-use based audit output.
// Defines the JSON schema for the `report_findings` tool that Claude calls
// at the end of each audit to emit machine-validated findings alongside
// the streaming markdown report.

import type Anthropic from '@anthropic-ai/sdk';

// ── TypeScript interfaces ──────────────────────────────────────────

export interface StructuredFinding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  confidence: 'certain' | 'likely' | 'possible';
  classification: 'vulnerability' | 'deficiency' | 'suggestion';
  title: string;
  location?: string;
  code_snippet?: string;
  cwe?: string;
  attack_vector?: string;
  exploit_scenario?: string;
  dataflow_path?: string[];
  sanitization_checked?: string;
  assumption?: string;
  remediation: string;
}

export interface StructuredAuditResult {
  findings: StructuredFinding[];
  overall_score: number;
}

// ── Anthropic tool definition ──────────────────────────────────────

export const REPORT_FINDINGS_TOOL: Anthropic.Messages.Tool = {
  name: 'report_findings',
  description:
    'Report all audit findings in structured JSON format. Call this tool exactly once ' +
    'at the end of your report with every finding you identified. Each finding must ' +
    'include the exact code snippet quoted verbatim from the submitted code.',
  input_schema: {
    type: 'object' as const,
    properties: {
      findings: {
        type: 'array',
        description: 'All findings from the audit, in severity order (critical first).',
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Finding ID matching the report, e.g. VULN-001, SEC-002, CQ-3',
            },
            severity: {
              type: 'string',
              enum: ['critical', 'high', 'medium', 'low', 'informational'],
            },
            confidence: {
              type: 'string',
              enum: ['certain', 'likely', 'possible'],
              description: 'How confident you are this is a real issue in this specific code.',
            },
            classification: {
              type: 'string',
              enum: ['vulnerability', 'deficiency', 'suggestion'],
            },
            title: {
              type: 'string',
              description: 'Concise finding title (no severity/confidence/classification tags).',
            },
            location: {
              type: 'string',
              description: 'File path, line number, and/or function name where the issue occurs.',
            },
            code_snippet: {
              type: 'string',
              description:
                'Exact verbatim quote of the problematic code from the submission. ' +
                'Do NOT paraphrase or approximate — copy the code character-for-character.',
            },
            cwe: {
              type: 'string',
              description: 'CWE identifier if applicable, e.g. CWE-89, CWE-79.',
            },
            attack_vector: {
              type: 'string',
              description: 'How an attacker could exploit this (for vulnerabilities).',
            },
            exploit_scenario: {
              type: 'string',
              description: 'Concrete exploit scenario with specific attacker actions.',
            },
            dataflow_path: {
              type: 'array',
              items: { type: 'string' },
              description:
                'Source-to-sink data flow path, e.g. ["req.query.id (line 12)", "buildQuery() (line 45)", "db.query() (line 47)"].',
            },
            sanitization_checked: {
              type: 'string',
              description: 'What sanitization/validation was checked and found absent or present.',
            },
            assumption: {
              type: 'string',
              description:
                'For [LIKELY] findings only: the explicit assumption about unseen code or runtime context.',
            },
            remediation: {
              type: 'string',
              description: 'What needs to change and why the fix works.',
            },
          },
          required: ['id', 'severity', 'confidence', 'classification', 'title', 'remediation'],
        },
      },
      overall_score: {
        type: 'number',
        description:
          'Overall audit score from 0 to 100. Higher = fewer/less severe issues. ' +
          '100 = no issues found. Only [VULNERABILITY] and [DEFICIENCY] findings reduce the score.',
      },
    },
    required: ['findings', 'overall_score'],
  },
};

// ── Prompt instruction appended to all agent system prompts ────────

export const STRUCTURED_OUTPUT_INSTRUCTION =
  '\n\nSTRUCTURED OUTPUT REQUIREMENT: After writing your complete markdown report, ' +
  'you MUST call the `report_findings` tool exactly once with a JSON summary of ALL findings. ' +
  'Rules for the tool call:\n' +
  '  - Include every finding from your report — do not omit any.\n' +
  '  - The `code_snippet` field must be an EXACT verbatim quote from the submitted code. ' +
  'Copy the code character-for-character. Do not paraphrase, abbreviate, or approximate.\n' +
  '  - If you cannot quote the exact code for a finding (e.g. the issue is architectural), ' +
  'omit the `code_snippet` field for that finding rather than fabricating code.\n' +
  '  - The `overall_score` must match the score in your markdown report.\n' +
  '  - The `title` field should NOT include severity, confidence, or classification tags — those go in their own fields.\n' +
  '  - For [LIKELY] findings, the `assumption` field is required.\n';
