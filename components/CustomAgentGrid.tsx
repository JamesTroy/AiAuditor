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

// SM-006: Discriminated union includes delete-confirm — makes simultaneous modals structurally impossible.
type ModalState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'edit'; agent: CustomAgent }
  | { mode: 'delete-confirm'; agentId: string };

export default function CustomAgentGrid() {
  const [agents, setAgents] = useState<CustomAgent[]>([]);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [importError, setImportError] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setAgents(getCustomAgents());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const closeModal = useCallback(() => setModal({ mode: 'closed' }), []);

  function handleCreate(data: { name: string; description: string; systemPrompt: string }) {
    saveCustomAgent(data);
    setModal({ mode: 'closed' });
    load();
  }

  function handleEdit(data: { name: string; description: string; systemPrompt: string }) {
    if (modal.mode !== 'edit') return;
    updateCustomAgent(modal.agent.id, data);
    setModal({ mode: 'closed' });
    load();
  }

  function handleDeleteConfirmed(id: string) {
    deleteCustomAgent(id);
    setModal({ mode: 'closed' });
    load();
  }

  function handleExport() {
    try {
      const json = exportCustomAgents();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'custom-agents.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed. Please try again.');
    }
  }

  function handleImportClick() {
    if (!importRef.current) return;
    setImportError('');
    importRef.current.click();
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset so the same file can be re-selected after an error
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? '';
      try {
        const count = importCustomAgents(text);
        load();
        if (count === 0) {
          setImportError('No new agents imported — file may be invalid or all agents already exist.');
        } else {
          setImportError('');
        }
      } catch {
        setImportError('Invalid file format. Please upload a valid agent JSON.');
      }
    };
    reader.readAsText(file);
  }

  return (
    <>
      <div className="mt-12 mb-6 flex flex-col xs:flex-row xs:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Custom Agents</h2>
          {agents.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-zinc-500 mt-0.5">Build your own audit agent with a custom system prompt.</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {agents.length > 0 && (
            <button
              onClick={handleExport}
              className="px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-zinc-400 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Export
            </button>
          )}
          <button
            onClick={handleImportClick}
            className="px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-zinc-400 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Import
          </button>
          {/* sr-only keeps the input in the accessibility tree; hidden removes it entirely */}
          <input
            ref={importRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="sr-only"
            aria-label="Import agents from JSON"
          />
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <span aria-hidden="true" className="text-base leading-none">+</span>
            New agent
          </button>
        </div>
      </div>

      {importError && (
        <p className="mb-4 text-sm text-red-500 dark:text-red-400">{importError}</p>
      )}

      {agents.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {agents.map((agent) => (
            <Link key={agent.id} href={`/audit/custom/${agent.id}`} className="block">
              <AgentCard
                agent={toAgentConfig(agent)}
                onEdit={() => setModal({ mode: 'edit', agent })}
                onDelete={() => setModal({ mode: 'delete-confirm', agentId: agent.id })}
              />
            </Link>
          ))}
        </div>
      )}

      {modal.mode === 'delete-confirm' && (
        <div className="mt-4 p-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg flex items-center justify-between gap-4">
          <p className="text-sm text-gray-700 dark:text-zinc-300">
            Delete &ldquo;{agents.find((a) => a.id === modal.agentId)?.name}&rdquo;? This cannot be undone.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={closeModal}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 border border-gray-300 dark:border-zinc-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDeleteConfirmed(modal.agentId)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-red-700 hover:bg-red-600 rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Single modal render site — mode discriminates create vs edit, making dual-render impossible */}
      {(modal.mode === 'create' || modal.mode === 'edit') && (
        <CreateAgentModal
          editing={modal.mode === 'edit' ? modal.agent : null}
          onSave={modal.mode === 'edit' ? handleEdit : handleCreate}
          onClose={closeModal}
        />
      )}
    </>
  );
}
