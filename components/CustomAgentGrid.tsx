'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import AgentCard from '@/components/AgentCard';
import CreateAgentModal from '@/components/CreateAgentModal';
import {
  getCustomAgents,
  saveCustomAgent,
  updateCustomAgent,
  deleteCustomAgent,
  toAgentConfig,
  exportCustomAgents,
  importCustomAgents,
  CustomAgent,
} from '@/lib/customAgents';

export default function CustomAgentGrid() {
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CustomAgent | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setAgents(getCustomAgents());
  }, []);

  // Load after mount to avoid SSR/localStorage mismatch
  useEffect(() => {
    load();
  }, [load]);

  function handleCreate(data: { name: string; description: string; systemPrompt: string }) {
    saveCustomAgent(data);
    setModalOpen(false);
    load();
  }

  function handleEdit(data: { name: string; description: string; systemPrompt: string }) {
    if (!editing) return;
    updateCustomAgent(editing.id, data);
    setEditing(null);
    load();
  }

  function handleDeleteConfirmed(id: string) {
    deleteCustomAgent(id);
    setDeleteConfirm(null);
    load();
  }

  function handleExport() {
    const json = exportCustomAgents();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom-agents.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? '';
      const count = importCustomAgents(text);
      load();
      if (count === 0) alert('No new agents were imported. File may be invalid or all agents already exist.');
      else alert(`${count} agent${count === 1 ? '' : 's'} imported.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <>
      <div className="mt-12 mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Custom Agents</h2>
          {agents.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-zinc-500 mt-0.5">Build your own audit agent with a custom system prompt.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {agents.length > 0 && (
            <button
              onClick={handleExport}
              className="px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-zinc-400 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Export
            </button>
          )}
          <button
            onClick={() => importRef.current?.click()}
            className="px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-zinc-400 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Import
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
            aria-label="Import agents from JSON"
          />
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <span className="text-base leading-none">+</span>
            New agent
          </button>
        </div>
      </div>

      {agents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {agents.map((agent) => (
            <Link key={agent.id} href={`/audit/custom/${agent.id}`} className="block">
              <AgentCard
                agent={toAgentConfig(agent)}
                onEdit={() => setEditing(agent)}
                onDelete={() => setDeleteConfirm(agent.id)}
              />
            </Link>
          ))}
        </div>
      )}

      {deleteConfirm && (
        <div className="mt-4 p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg flex items-center justify-between gap-4">
          <p className="text-sm text-gray-700 dark:text-zinc-300">
            Delete &ldquo;{agents.find((a) => a.id === deleteConfirm)?.name}&rdquo;? This cannot be undone.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setDeleteConfirm(null)}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 border border-gray-300 dark:border-zinc-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDeleteConfirmed(deleteConfirm)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-red-700 hover:bg-red-600 rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <CreateAgentModal
          editing={null}
          onSave={handleCreate}
          onClose={() => setModalOpen(false)}
        />
      )}

      {editing && (
        <CreateAgentModal
          editing={editing}
          onSave={handleEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
