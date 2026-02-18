/**
 * Knowledge Base Manager for RAG Chat
 * Handles KB selection, file upload, ingestion, and persistence
 */

class KBManager {
  constructor() {
    this.currentKB = null;
    this.kbs = [];
    this.isIngesting = false;
    this.ingestionProgress = { current: 0, total: 0, currentFile: '' };
    
    // Local state
    this.loadLastKB();
  }

  /**
   * Load last used KB from localStorage
   */
  loadLastKB() {
    const lastKBName = localStorage.getItem('__vai_last_kb');
    if (lastKBName) {
      this.currentKB = lastKBName;
    }
  }

  /**
   * Save last used KB to localStorage
   */
  saveLastKB() {
    if (this.currentKB) {
      localStorage.setItem('__vai_last_kb', this.currentKB);
    }
  }

  /**
   * Fetch list of all KBs from server
   */
  async listKBs() {
    try {
      const res = await fetch('/api/rag/kbs');
      if (!res.ok) throw new Error('Failed to fetch KBs');
      const data = await res.json();
      this.kbs = data.kbs || [];
      return this.kbs;
    } catch (err) {
      console.error('Error listing KBs:', err);
      return [];
    }
  }

  /**
   * Select a KB (or null to create new)
   */
  async selectKB(kbName) {
    try {
      const res = await fetch('/api/rag/kb-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kbName })
      });
      if (!res.ok) throw new Error('Failed to select KB');
      const data = await res.json();
      this.currentKB = data.selected || null;
      this.saveLastKB();
      return data;
    } catch (err) {
      console.error('Error selecting KB:', err);
      throw err;
    }
  }

  /**
   * Upload files and start ingestion
   * Yields progress events
   */
  async *ingestFiles(files, kbName = null) {
    if (!files || files.length === 0) {
      throw new Error('No files selected');
    }

    // Validate file types and sizes
    for (const file of files) {
      if (!['text/plain', 'text/markdown', 'application/x-markdown'].includes(file.type)) {
        throw new Error(`Invalid file type: ${file.name}. Only .txt and .md supported.`);
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error(`File too large: ${file.name}. Max 10MB.`);
      }
    }

    // Create FormData
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    if (kbName) {
      formData.append('kbName', kbName);
    }

    try {
      this.isIngesting = true;
      const res = await fetch('/api/rag/ingest', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Ingestion failed');
      }

      // Parse streaming response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            yield event;

            // Update progress
            if (event.type === 'progress') {
              this.ingestionProgress = {
                current: event.current || 0,
                total: event.total || 0,
                currentFile: event.file || ''
              };
            }
          } catch (e) {
            console.warn('Failed to parse event:', line, e);
          }
        }
      }

      // Final flush of buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer);
          yield event;
        } catch (e) {
          console.warn('Failed to parse final event:', buffer, e);
        }
      }

      this.isIngesting = false;
    } catch (err) {
      this.isIngesting = false;
      console.error('Error ingesting files:', err);
      throw err;
    }
  }

  /**
   * Remove a document from KB
   */
  async removeDoc(kbName, docId) {
    try {
      const res = await fetch(`/api/rag/docs/${encodeURIComponent(kbName)}/${encodeURIComponent(docId)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to remove document');
      return await res.json();
    } catch (err) {
      console.error('Error removing doc:', err);
      throw err;
    }
  }

  /**
   * Get KB details and doc list
   */
  async getKBDetails(kbName) {
    try {
      const res = await fetch(`/api/rag/kb/${encodeURIComponent(kbName)}`);
      if (!res.ok) throw new Error('Failed to fetch KB details');
      return await res.json();
    } catch (err) {
      console.error('Error fetching KB details:', err);
      throw err;
    }
  }

  /**
   * Clear a KB (delete all docs)
   */
  async clearKB(kbName) {
    try {
      const res = await fetch(`/api/rag/kb/${encodeURIComponent(kbName)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to clear KB');
      return await res.json();
    } catch (err) {
      console.error('Error clearing KB:', err);
      throw err;
    }
  }
}

// Global instance
window.kbManager = new KBManager();
