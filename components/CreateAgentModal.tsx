'use client';

import { useState, useEffect, useRef } from 'react';
import { CustomAgent } from '@/lib/customAgents';

interface Props {
  editing: CustomAgent | null;
  onSave: (data: { name: string; description: string; systemPrompt: string }) => void;
  onClose: () => void;
}

const MAX_NAME = 60;
const MAX_DESC = 200;
const MAX_PROMPT = 10_000;

const TEMPLATES: { label: string; prompt: string }[] = [
  { label: 'Blank', prompt: '' },
  {
    label: 'Code Review',
    prompt: `You are an expert software engineer specializing in code review. Analyze the provided code for:
- Bugs and logic errors
- Security vulnerabilities
- Performance issues
- Code style and best practices
- Maintainability concerns

Produce a structured report with:
## 1. Summary
## 2. Critical Issues
## 3. Recommendations
## 4. Overall Score`,
  },
  {
    label: 'Documentation Audit',
    prompt: `You are a technical writing expert. Audit the provided documentation or code comments for:
- Clarity and completeness
- Accuracy and up-to-date information
- Missing documentation for public APIs
- Grammar and readability

Produce a structured report with:
## 1. Summary
## 2. Gaps Found
## 3. Recommendations`,
  },
  {
    label: 'Dependency Audit',
    prompt: `You are a software supply chain security expert. Audit the provided dependency manifest (package.json, requirements.txt, go.mod, etc.) for:
- Outdated or deprecated packages
- Known vulnerability patterns
- Unnecessary or unused dependencies
- License compatibility issues
- Dependency pinning practices

Produce a structured report with:
## 1. Summary
## 2. High-Risk Dependencies
## 3. Recommendations`,
  },
];

export default function CreateAgentModal({ editing, onSave, onClose }: Props) {
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [systemPrompt, setSystemPrompt] = useState(editing?.systemPrompt ?? '');
  const [errors, setErrors] = useState<{ name?: string; systemPrompt?: string }>({});
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function validate() {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Name is required.';
    if (!systemPrompt.trim()) errs.systemPrompt = 'System prompt is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSave({
      name: name.trim().slice(0, MAX_NAME),
      description: description.trim().slice(0, MAX_DESC),
      systemPrompt: systemPrompt.trim().slice(0, MAX_PROMPT),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-800 shrink-0">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
            {editing ? 'Edit Agent' : 'Create Custom Agent'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-200 transition-colors text-xl leading-none"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-6 py-5 overflow-y-auto">
          <div>
            <label htmlFor="agent-name" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
              Name <span className="text-gray-400 dark:text-zinc-500 font-normal">({name.length}/{MAX_NAME})</span>
            </label>
            <input
              id="agent-name"
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, MAX_NAME))}
              maxLength={MAX_NAME}
              placeholder="e.g. TypeScript Expert"
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-400 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500 transition-colors"
            />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
          </div>

          <div>
            <label htmlFor="agent-desc" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5">
              Description <span className="text-gray-400 dark:text-zinc-500 font-normal">(optional · {description.length}/{MAX_DESC})</span>
            </label>
            <input
              id="agent-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
              maxLength={MAX_DESC}
              placeholder="What does this agent audit?"
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-400 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500 transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="agent-prompt" className="block text-sm font-medium text-gray-700 dark:text-zinc-300">
                System Prompt <span className="text-gray-400 dark:text-zinc-500 font-normal">({systemPrompt.length.toLocaleString()}/{MAX_PROMPT.toLocaleString()})</span>
              </label>
              <select
                value=""
                onChange={(e) => {
                  const tpl = TEMPLATES.find((t) => t.label === e.target.value);
                  if (!tpl) return;
                  if (systemPrompt.trim() && !window.confirm('Replace current system prompt with this template?')) return;
                  setSystemPrompt(tpl.prompt);
                }}
                className="text-xs bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded px-2 py-1 text-gray-600 dark:text-zinc-400 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500 transition-colors cursor-pointer"
                aria-label="Use a template"
              >
                <option value="" disabled>Use template</option>
                {TEMPLATES.map((t) => (
                  <option key={t.label} value={t.label}>{t.label}</option>
                ))}
              </select>
            </div>
            <textarea
              id="agent-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value.slice(0, MAX_PROMPT))}
              maxLength={MAX_PROMPT}
              rows={10}
              placeholder={`You are an expert in...\n\nAnalyze the provided content for:\n- ...\n\nProduce a structured report with:\n## 1. Summary\n## 2. Findings\n...`}
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg px-4 py-3 font-mono text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-400 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500 transition-colors resize-y"
            />
            {errors.systemPrompt && <p className="mt-1 text-xs text-red-400">{errors.systemPrompt}</p>}
            <p className="mt-1.5 text-xs text-gray-500 dark:text-zinc-500 leading-relaxed">
              Sent directly to Claude as the system prompt. Stored in your browser only — never saved on any server.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1 pb-1">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors"
            >
              {editing ? 'Save Changes' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
