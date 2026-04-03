'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';

interface MemoryStatus {
  path: string;
  exists: boolean;
  noteCount: number;
  indexedCount: number;
  watching: boolean;
  chromaAvailable: boolean;
}

interface MemoryDoc {
  id: string;
  content: string;
  metadata: Record<string, any>;
  source: string;
  similarity?: number;
}

export default function MemoryPage() {
  const [status, setStatus] = useState<MemoryStatus | null>(null);
  const [recentMemories, setRecentMemories] = useState<MemoryDoc[]>([]);
  const [searchResults, setSearchResults] = useState<MemoryDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [showStoreForm, setShowStoreForm] = useState(false);
  const [newMemory, setNewMemory] = useState({ content: '', title: '', tags: '' });
  const [storing, setStoring] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([api.memory.status(), api.memory.recent(10)]);
      setStatus(s);
      setRecentMemories(r);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, [refresh]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await api.memory.search(searchQuery, 10);
      setSearchResults(results);
    } catch {}
    setSearching(false);
  };

  const handleStore = async () => {
    if (!newMemory.content.trim()) return;
    setStoring(true);
    try {
      const tags = newMemory.tags ? newMemory.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
      await api.memory.store(newMemory.content, newMemory.title || undefined, tags);
      setNewMemory({ content: '', title: '', tags: '' });
      setShowStoreForm(false);
      await refresh();
    } catch (err: any) {
      alert(`Failed to store memory: ${err.message}`);
    }
    setStoring(false);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Memory & AI Brain</h2>
          <p className="text-[var(--muted)] text-sm mt-1">Obsidian vault sync, ChromaDB vector memory, semantic search</p>
        </div>
        <button
          onClick={() => setShowStoreForm(!showStoreForm)}
          className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-md hover:opacity-90 transition-opacity"
        >
          {showStoreForm ? 'Cancel' : 'Store Memory'}
        </button>
      </div>

      {/* Store Memory Form */}
      {showStoreForm && (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold text-white mb-4">Store New Memory</h3>
          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Title (optional)</label>
              <input
                className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded px-3 py-1.5 text-sm text-white"
                placeholder="Short description"
                value={newMemory.title}
                onChange={(e) => setNewMemory({ ...newMemory, title: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Content</label>
              <textarea
                className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded px-3 py-2 text-sm text-white min-h-[100px]"
                placeholder="The information to remember..."
                value={newMemory.content}
                onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)] block mb-1">Tags (comma-separated)</label>
              <input
                className="w-full bg-[var(--background)] border border-[var(--card-border)] rounded px-3 py-1.5 text-sm text-white"
                placeholder="preference, project, contact"
                value={newMemory.tags}
                onChange={(e) => setNewMemory({ ...newMemory, tags: e.target.value })}
              />
            </div>
          </div>
          <button
            onClick={handleStore}
            disabled={storing || !newMemory.content.trim()}
            className="px-4 py-2 bg-[var(--accent)] text-white text-sm rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {storing ? 'Storing...' : 'Store Memory'}
          </button>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Obsidian Vault</h3>
          <div className="space-y-3">
            <StatusRow label="Vault Path" value={status?.path || '--'} />
            <StatusRow label="Status" value={status?.exists ? 'Active' : 'Not found'} />
            <StatusRow label="Notes" value={String(status?.noteCount || 0)} />
            <StatusRow label="Indexed" value={String(status?.indexedCount || 0)} />
            <StatusRow label="File Watcher" value={status?.watching ? 'Active' : 'Inactive'} />
          </div>
        </div>

        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Vector Memory (ChromaDB)</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--muted)]">Connection</span>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${status?.chromaAvailable ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="text-gray-300">{status?.chromaAvailable ? 'Connected' : 'Unavailable (file search fallback)'}</span>
              </div>
            </div>
            <StatusRow label="Indexed Documents" value={String(status?.indexedCount || 0)} />
            <StatusRow label="Search Mode" value={status?.chromaAvailable ? 'Semantic (vector)' : 'Keyword (text)'} />
          </div>
          {!status?.chromaAvailable && (
            <div className="mt-4 p-3 bg-[var(--background)] rounded text-xs text-[var(--muted)]">
              <p className="mb-1">To enable semantic search, start ChromaDB:</p>
              <code className="text-yellow-400">docker run -p 8000:8000 chromadb/chroma</code>
            </div>
          )}
        </div>
      </div>

      {/* Semantic Search */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5 mb-6">
        <h3 className="text-sm font-semibold text-white mb-4">Semantic Search</h3>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Search across all memories and vault notes..."
            className="flex-1 bg-[var(--background)] border border-[var(--card-border)] rounded-md px-4 py-2.5 text-sm text-white placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="px-6 py-2.5 bg-[var(--accent)] text-white text-sm rounded-md hover:opacity-90 disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-3">
            {searchResults.map((doc) => (
              <MemoryCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>

      {/* Recent Memories */}
      <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Recent Memories</h3>
        {recentMemories.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No memories stored yet. The agent will store memories automatically, or you can add them manually.</p>
        ) : (
          <div className="space-y-3">
            {recentMemories.map((doc) => (
              <MemoryCard key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-gray-300 text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

function MemoryCard({ doc }: { doc: MemoryDoc }) {
  const [expanded, setExpanded] = useState(false);
  const title = doc.metadata?.title || doc.id;
  const tags = doc.metadata?.tags ? String(doc.metadata.tags).split(',').filter(Boolean) : [];
  const similarity = doc.similarity !== undefined ? `${(doc.similarity * 100).toFixed(0)}%` : null;

  const sourceColor: Record<string, string> = {
    agent: 'bg-purple-500/20 text-purple-400',
    vault: 'bg-blue-500/20 text-blue-400',
    conversation: 'bg-green-500/20 text-green-400',
  };

  return (
    <div
      className="bg-[var(--background)] rounded-lg p-3 cursor-pointer hover:bg-[var(--background)]/80"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${sourceColor[doc.source] || 'bg-gray-500/20 text-gray-400'}`}>
              {doc.source}
            </span>
            {similarity && (
              <span className="text-[10px] text-green-400 font-medium">{similarity} match</span>
            )}
            {tags.map((tag) => (
              <span key={tag} className="text-[10px] text-[var(--muted)] bg-[var(--card)] px-1.5 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
          <p className="text-sm text-white font-medium truncate">{title}</p>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {expanded ? doc.content : (doc.content?.slice(0, 120) + (doc.content?.length > 120 ? '...' : ''))}
          </p>
        </div>
      </div>
    </div>
  );
}
