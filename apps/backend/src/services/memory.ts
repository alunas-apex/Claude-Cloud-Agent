import { ChromaClient, Collection } from 'chromadb';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { eventBus } from './event-bus.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const DEFAULT_VAULT_PATH = path.join(DATA_DIR, 'obsidian-vault');
const COLLECTION_NAME = 'agent-memory';

interface MemoryDocument {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  source: 'agent' | 'vault' | 'conversation';
  similarity?: number;
}

interface VaultStatus {
  path: string;
  exists: boolean;
  noteCount: number;
  indexedCount: number;
  watching: boolean;
}

/**
 * MemoryService — Persistent AI memory with ChromaDB vector search
 * and bidirectional Obsidian vault sync.
 *
 * Features:
 * - Store and recall memories with semantic similarity search
 * - Index Obsidian vault markdown files into ChromaDB
 * - Watch vault for changes and auto-reindex
 * - Agent can store conversation insights for long-term recall
 */
export class MemoryService {
  private client: ChromaClient | null = null;
  private collection: Collection | null = null;
  private vaultPath: string;
  private indexedFiles: Set<string> = new Set();
  private watcher: any = null; // chokidar FSWatcher
  private initialized = false;
  private chromaAvailable = false;

  constructor(vaultPath?: string) {
    this.vaultPath = vaultPath || process.env.OBSIDIAN_VAULT_PATH || DEFAULT_VAULT_PATH;
  }

  /**
   * Initialize ChromaDB connection and Obsidian vault.
   */
  async initialize(): Promise<void> {
    // Ensure vault directory exists
    if (!fs.existsSync(this.vaultPath)) {
      fs.mkdirSync(this.vaultPath, { recursive: true });
      // Create a welcome note
      fs.writeFileSync(
        path.join(this.vaultPath, 'Welcome.md'),
        `---\ntags: [system]\ncreated: ${new Date().toISOString()}\n---\n\n# Claude Cloud Agent Memory\n\nThis vault is synced with the AI agent's memory system.\nNotes added here will be indexed for semantic search.\n\nThe agent can also create notes from conversations.\n`
      );
    }

    // Try to connect to ChromaDB
    try {
      const chromaHost = process.env.CHROMA_HOST || 'http://localhost:8000';
      this.client = new ChromaClient({ path: chromaHost });
      // Test connection
      await this.client.heartbeat();
      this.collection = await this.client.getOrCreateCollection({
        name: COLLECTION_NAME,
        metadata: { 'hnsw:space': 'cosine' },
      });
      this.chromaAvailable = true;
      console.log(`[Memory] ChromaDB connected, collection "${COLLECTION_NAME}" ready`);
    } catch (err: any) {
      console.warn(`[Memory] ChromaDB not available (${err.message}). Using file-based memory only.`);
      this.chromaAvailable = false;
    }

    // Index existing vault files
    await this.indexVault();

    // Start watching for vault changes
    await this.startWatching();

    this.initialized = true;
    console.log(`[Memory] Initialized — vault: ${this.vaultPath}, indexed: ${this.indexedFiles.size} files`);
  }

  /**
   * Store a memory (agent insight, conversation summary, etc.)
   */
  async store(params: {
    content: string;
    source?: 'agent' | 'conversation';
    tags?: string[];
    title?: string;
    sessionId?: string;
  }): Promise<string> {
    const { content, source = 'agent', tags = [], title, sessionId } = params;
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();

    const metadata: Record<string, unknown> = {
      source,
      tags: tags.join(','),
      title: title || content.slice(0, 60),
      sessionId: sessionId || null,
      timestamp,
    };

    // Store in ChromaDB if available
    if (this.chromaAvailable && this.collection) {
      try {
        await this.collection.add({
          ids: [id],
          documents: [content],
          metadatas: [metadata as Record<string, string>],
        });
      } catch (err: any) {
        console.error(`[Memory] ChromaDB store error:`, err.message);
      }
    }

    // Always write to vault as a markdown note
    const noteName = this.sanitizeFilename(title || `memory-${id}`);
    const frontmatter = matter.stringify(content, {
      id,
      source,
      tags,
      created: timestamp,
      ...(sessionId ? { sessionId } : {}),
    });

    const notePath = path.join(this.vaultPath, 'memories', `${noteName}.md`);
    const dirPath = path.dirname(notePath);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(notePath, frontmatter);

    this.indexedFiles.add(notePath);

    eventBus.emit('memory:stored', { id, title: metadata.title, source });
    console.log(`[Memory] Stored: ${metadata.title} (${source})`);

    return id;
  }

  /**
   * Search memories by semantic similarity.
   */
  async search(query: string, limit = 5): Promise<MemoryDocument[]> {
    const results: MemoryDocument[] = [];

    // ChromaDB vector search
    if (this.chromaAvailable && this.collection) {
      try {
        const queryResult = await this.collection.query({
          queryTexts: [query],
          nResults: limit,
        });

        if (queryResult.documents?.[0]) {
          for (let i = 0; i < queryResult.documents[0].length; i++) {
            const doc = queryResult.documents[0][i];
            const meta = queryResult.metadatas?.[0]?.[i] || {};
            const dist = queryResult.distances?.[0]?.[i];

            if (doc) {
              results.push({
                id: queryResult.ids[0][i],
                content: doc,
                metadata: meta,
                source: (meta.source as 'agent' | 'vault' | 'conversation') || 'vault',
                similarity: dist != null ? 1 - dist : undefined, // cosine: 1 = perfect match
              });
            }
          }
        }
      } catch (err: any) {
        console.error(`[Memory] ChromaDB search error:`, err.message);
      }
    }

    // Fallback: simple file-based text search if ChromaDB unavailable or returned nothing
    if (results.length === 0) {
      return this.fileSearch(query, limit);
    }

    return results;
  }

  /**
   * Get recent memories.
   */
  async getRecent(limit = 10): Promise<MemoryDocument[]> {
    if (this.chromaAvailable && this.collection) {
      try {
        const result = await this.collection.get({
          limit,
        });

        return (result.documents || []).map((doc, i) => ({
          id: result.ids[i],
          content: doc || '',
          metadata: result.metadatas?.[i] || {},
          source: ((result.metadatas?.[i]?.source as string) || 'vault') as 'agent' | 'vault' | 'conversation',
        }));
      } catch (err: any) {
        console.error(`[Memory] ChromaDB get error:`, err.message);
      }
    }

    // Fallback to file listing
    return this.listVaultNotes(limit);
  }

  /**
   * Get memory/vault status.
   */
  getStatus(): VaultStatus {
    return {
      path: this.vaultPath,
      exists: fs.existsSync(this.vaultPath),
      noteCount: this.countVaultFiles(),
      indexedCount: this.indexedFiles.size,
      watching: this.watcher !== null,
    };
  }

  /**
   * Check if ChromaDB is connected.
   */
  isChromaAvailable(): boolean {
    return this.chromaAvailable;
  }

  // ── Vault operations ─────────────────────────────────────────────────

  /**
   * Index all markdown files in the vault into ChromaDB.
   */
  private async indexVault(): Promise<void> {
    const files = this.getVaultFiles();

    for (const filePath of files) {
      try {
        await this.indexFile(filePath);
      } catch (err: any) {
        console.warn(`[Memory] Failed to index ${filePath}:`, err.message);
      }
    }
  }

  /**
   * Index a single file into ChromaDB.
   */
  private async indexFile(filePath: string): Promise<void> {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data: frontmatter, content } = matter(raw);
    const relativePath = path.relative(this.vaultPath, filePath);
    const id = `vault_${relativePath.replace(/[/\\]/g, '_').replace(/\.md$/, '')}`;

    if (this.chromaAvailable && this.collection) {
      try {
        await this.collection.upsert({
          ids: [id],
          documents: [content.trim() || raw.trim()],
          metadatas: [{
            source: 'vault',
            path: relativePath,
            title: frontmatter.title || path.basename(filePath, '.md'),
            tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.join(',') : (frontmatter.tags || ''),
            created: frontmatter.created || '',
          }],
        });
      } catch (err: any) {
        console.warn(`[Memory] ChromaDB index error for ${relativePath}:`, err.message);
      }
    }

    this.indexedFiles.add(filePath);
  }

  /**
   * Start watching the vault directory for changes.
   */
  private async startWatching(): Promise<void> {
    try {
      const chokidar = await import('chokidar');
      this.watcher = chokidar.watch(path.join(this.vaultPath, '**/*.md'), {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true,
      });

      this.watcher.on('add', (filePath: string) => {
        console.log(`[Memory] Vault file added: ${path.relative(this.vaultPath, filePath)}`);
        this.indexFile(filePath);
      });

      this.watcher.on('change', (filePath: string) => {
        console.log(`[Memory] Vault file changed: ${path.relative(this.vaultPath, filePath)}`);
        this.indexFile(filePath);
      });

      this.watcher.on('unlink', (filePath: string) => {
        console.log(`[Memory] Vault file removed: ${path.relative(this.vaultPath, filePath)}`);
        this.indexedFiles.delete(filePath);
        // Note: ChromaDB deletion would need collection.delete({ ids: [id] })
      });
    } catch (err: any) {
      console.warn(`[Memory] File watcher failed:`, err.message);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private getVaultFiles(): string[] {
    if (!fs.existsSync(this.vaultPath)) return [];
    return this.walkDir(this.vaultPath).filter((f) => f.endsWith('.md') && !f.includes('.obsidian'));
  }

  private walkDir(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) results.push(...this.walkDir(full));
      else results.push(full);
    }
    return results;
  }

  private countVaultFiles(): number {
    return this.getVaultFiles().length;
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-').slice(0, 100);
  }

  /**
   * Simple text-based search as fallback when ChromaDB is unavailable.
   */
  private fileSearch(query: string, limit: number): MemoryDocument[] {
    const queryLower = query.toLowerCase();
    const files = this.getVaultFiles();
    const results: MemoryDocument[] = [];

    for (const filePath of files) {
      if (results.length >= limit) break;
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        if (raw.toLowerCase().includes(queryLower)) {
          const { data: frontmatter, content } = matter(raw);
          const relativePath = path.relative(this.vaultPath, filePath);
          results.push({
            id: `vault_${relativePath}`,
            content: content.trim(),
            metadata: { ...frontmatter, path: relativePath },
            source: 'vault',
          });
        }
      } catch {}
    }

    return results;
  }

  /**
   * List vault notes (most recent first) as fallback.
   */
  private listVaultNotes(limit: number): MemoryDocument[] {
    const files = this.getVaultFiles()
      .map((f) => ({ path: f, mtime: fs.statSync(f).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, limit);

    return files.map((f) => {
      const raw = fs.readFileSync(f.path, 'utf-8');
      const { data: frontmatter, content } = matter(raw);
      const relativePath = path.relative(this.vaultPath, f.path);
      return {
        id: `vault_${relativePath}`,
        content: content.trim(),
        metadata: { ...frontmatter, path: relativePath },
        source: 'vault' as const,
      };
    });
  }

  /**
   * Close watcher and cleanup.
   */
  async close(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }
}
