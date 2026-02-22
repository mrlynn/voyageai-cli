/**
 * Knowledge Base UI Manager
 * Handles wizard, panel sections, file list, and config interactions
 */

class KBUIManager {
  constructor(kbManager) {
    this.kbManager = kbManager;
    this.isWizardOpen = false;
    this.isPanelOpen = true;
    this.currentStep = 'select'; // 'select' | 'add-docs'
    this.sectionStates = this.loadSectionStates();
    this.init();
  }

  init() {
    this.loadInitialKB();
    this.setupWizardEvents();
    this.setupPanelEvents();
    this.setupFileDropZone();
    this.initSectionStates();
    this.setupInstructionsSync();
  }

  // ── Section collapse/expand ──

  loadSectionStates() {
    try {
      const saved = localStorage.getItem('__vai_kb_sections');
      return saved ? JSON.parse(saved) : {
        stats: true,
        files: true,
        upload: true,
        instructions: false,
        config: false
      };
    } catch {
      return { stats: true, files: true, upload: true, instructions: false, config: false };
    }
  }

  saveSectionStates() {
    localStorage.setItem('__vai_kb_sections', JSON.stringify(this.sectionStates));
  }

  toggleSection(key) {
    this.sectionStates[key] = !this.sectionStates[key];
    this.saveSectionStates();

    const header = document.querySelector(`.kb-section[data-kb-section="${key}"] .kb-section-header`);
    const body = document.querySelector(`.kb-section-body[data-kb-section="${key}"]`);
    if (!header || !body) return;

    const isExpanding = this.sectionStates[key];
    header.classList.toggle('expanded', isExpanding);

    if (isExpanding) {
      body.style.maxHeight = body.scrollHeight + 'px';
      setTimeout(() => { body.style.maxHeight = 'none'; }, 250);
    } else {
      body.style.maxHeight = body.scrollHeight + 'px';
      requestAnimationFrame(() => { body.style.maxHeight = '0px'; });
    }
  }

  initSectionStates() {
    for (const [key, expanded] of Object.entries(this.sectionStates)) {
      const header = document.querySelector(`.kb-section[data-kb-section="${key}"] .kb-section-header`);
      const body = document.querySelector(`.kb-section-body[data-kb-section="${key}"]`);
      if (header && body) {
        header.classList.toggle('expanded', expanded);
        body.style.maxHeight = expanded ? 'none' : '0px';
      }
    }
  }

  // ── Instructions sync ──

  setupInstructionsSync() {
    const textarea = document.getElementById('kbSystemPrompt');
    if (!textarea) return;
    textarea.addEventListener('input', () => {
      if (typeof saveChatSettingsDebounced === 'function') {
        saveChatSettingsDebounced();
      }
    });
  }

  // ── Files list ──

  async updateFilesList() {
    const kbName = this.kbManager.currentKB;
    if (!kbName) return;

    const fileList = document.getElementById('kbFileList');
    const fileCount = document.getElementById('kbFileCount');
    if (!fileList) return;

    try {
      const docs = await this.kbManager.listDocs(kbName);
      if (fileCount) fileCount.textContent = docs.length;

      if (docs.length === 0) {
        fileList.innerHTML = '<li class="kb-file-empty">No documents ingested</li>';
        return;
      }

      fileList.innerHTML = docs.map(doc => {
        const sizeStr = doc.size > 1024
          ? (doc.size / 1024).toFixed(1) + ' KB'
          : (doc.size || 0) + ' B';
        const safeName = this.escapeHtml(doc.fileName);

        return `<li class="kb-file-item" data-filename="${safeName}">
          <svg class="kb-file-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <div class="kb-file-info">
            <div class="kb-file-name" title="${safeName}">${safeName}</div>
            <div class="kb-file-meta">
              <span>${doc.chunkCount} chunks</span>
              <span>${sizeStr}</span>
            </div>
          </div>
          <button class="kb-file-delete" onclick="window.kbUI.removeFile('${safeName.replace(/'/g, "\\'")}')" title="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </li>`;
      }).join('');
    } catch (err) {
      console.error('Error loading files list:', err);
      fileList.innerHTML = '<li class="kb-file-empty">Error loading documents</li>';
    }
  }

  async removeFile(fileName) {
    if (!this.kbManager.currentKB) return;
    if (!confirm(`Remove "${fileName}" from the knowledge base?`)) return;

    try {
      await this.kbManager.removeDocByName(this.kbManager.currentKB, fileName);
      await this.updatePanelUI();
    } catch (err) {
      console.error('Error removing file:', err);
      alert(`Error: ${err.message}`);
    }
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Rename KB ──

  startRename() {
    const badge = document.getElementById('kbPanelName');
    if (!badge || !this.kbManager.currentKB) return;

    // Show the current display name (not internal name) for editing
    const currentDisplay = this._currentDisplayName || this.kbManager.currentKB;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'kb-name-input';
    input.value = currentDisplay;
    input.maxLength = 80;

    // Replace badge text with input
    badge.textContent = '';
    badge.appendChild(input);
    badge.classList.remove('kb-name-editable');
    input.focus();
    input.select();

    const commit = () => this.commitRename(input, badge, currentDisplay);
    input.addEventListener('blur', commit, { once: true });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = currentDisplay; input.blur(); }
    });
  }

  async commitRename(input, badge, previousDisplay) {
    const newDisplay = input.value.trim();
    badge.classList.add('kb-name-editable');

    // No change or empty — revert
    if (!newDisplay || newDisplay === previousDisplay) {
      badge.textContent = previousDisplay;
      return;
    }

    badge.textContent = 'Saving…';
    try {
      const result = await this.kbManager.renameKB(this.kbManager.currentKB, newDisplay);
      this._currentDisplayName = result.displayName;
      badge.textContent = result.displayName;
    } catch (err) {
      console.error('Rename failed:', err);
      badge.textContent = previousDisplay;
      alert(`Rename failed: ${err.message}`);
    }
  }

  // ── Index status feedback ──

  showIndexStatus(status) {
    const el = document.getElementById('kbIndexStatus');
    if (!el) return;

    if (status === 'created') {
      el.innerHTML = '<span style="color: var(--warning-color, #f59e0b);">⏳ Vector index creating…</span>';
      el.title = 'Atlas vector search index was just created. It may take 1-2 minutes to become active.';
      // Poll until active (Atlas indexes build asynchronously)
      this.pollIndexReady();
    } else if (status === 'exists') {
      el.innerHTML = '<span style="color: var(--success-color, #22c55e);">✓ Index ready</span>';
      el.title = 'Vector search index is active';
      // Fade out after a few seconds
      setTimeout(() => { el.style.opacity = '0.5'; }, 3000);
    } else if (status === 'error') {
      el.innerHTML = '<span style="color: var(--error-color, #ef4444);">⚠ Index error</span>';
      el.title = 'Could not create vector search index. RAG queries may fail.';
    } else {
      el.innerHTML = '';
    }
  }

  async pollIndexReady() {
    // Atlas vector indexes build async — poll KB selection to check status
    let attempts = 0;
    const maxAttempts = 30; // ~60 seconds
    const interval = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        const el = document.getElementById('kbIndexStatus');
        if (el) {
          el.innerHTML = '<span style="color: var(--warning-color, #f59e0b);">⚠ Index may still be building</span>';
        }
        return;
      }
      try {
        const result = await this.kbManager.selectKB(this.kbManager.currentKB);
        if (result.indexStatus === 'exists') {
          clearInterval(interval);
          this.showIndexStatus('exists');
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);
  }

  // ── Auto-configure chat settings from KB ──

  syncKBToChatConfig(kbName) {
    if (!kbName) return;
    const dbEl = document.getElementById('chatDb');
    const collEl = document.getElementById('chatCollection');
    if (dbEl) dbEl.value = 'vai_rag';
    if (collEl) collEl.value = `kb_${kbName}_docs`;
    // Persist and update header status
    if (typeof saveChatSettings === 'function') saveChatSettings();
    if (typeof updateChatStatus === 'function') updateChatStatus();
  }

  // ── Initial load ──

  async loadInitialKB() {
    const lastKB = localStorage.getItem('__vai_last_kb');
    if (lastKB) {
      try {
        const result = await this.kbManager.selectKB(lastKB);
        this.syncKBToChatConfig(lastKB);
        this.updatePanelUI();
        this.showIndexStatus(result.indexStatus);
      } catch (err) {
        console.warn('Last KB not found, showing wizard');
        this.openWizard();
      }
    } else {
      this.openWizard();
    }
  }

  // ── Wizard ──

  openWizard() {
    const wizardEl = document.getElementById('kbWizard');
    if (wizardEl) {
      wizardEl.classList.add('visible');
      this.isWizardOpen = true;
      this.currentStep = 'select';
      this.updateWizardUI();
      this.populateKBDropdown(); // Refresh list every time (picks up renames)
    }
  }

  closeWizard() {
    const wizardEl = document.getElementById('kbWizard');
    if (wizardEl) {
      wizardEl.classList.remove('visible');
      this.isWizardOpen = false;
    }
  }

  updateWizardUI() {
    const selectStep = document.getElementById('kbWizardSelectStep');
    const docsStep = document.getElementById('kbWizardDocsStep');
    if (this.currentStep === 'select') {
      if (selectStep) selectStep.style.display = 'block';
      if (docsStep) docsStep.style.display = 'none';
    } else {
      if (selectStep) selectStep.style.display = 'none';
      if (docsStep) docsStep.style.display = 'block';
    }
  }

  async onSelectExisting() {
    const select = document.getElementById('kbWizardExistingSelect');
    if (!select || !select.value) {
      alert('Please select a knowledge base');
      return;
    }
    try {
      const result = await this.kbManager.selectKB(select.value);
      this.syncKBToChatConfig(this.kbManager.currentKB);
      this.updatePanelUI();
      this.showIndexStatus(result.indexStatus);
      this.closeWizard();
    } catch (err) {
      console.error('Error selecting KB:', err);
      alert(`Error: ${err.message}`);
    }
  }

  async onStartFresh() {
    try {
      await this.kbManager.selectKB(null);
      this.syncKBToChatConfig(this.kbManager.currentKB);
      this.currentStep = 'add-docs';
      this.updateWizardUI();
      this.updatePanelUI();
    } catch (err) {
      console.error('Error creating KB:', err);
      alert(`Error: ${err.message}`);
    }
  }

  onStartChatting() {
    this.closeWizard();
  }

  setupWizardEvents() {
    this.populateKBDropdown();

    const existingBtn = document.getElementById('kbWizardUseExisting');
    const freshBtn = document.getElementById('kbWizardStartFresh');
    const chattingBtn = document.getElementById('kbWizardStartChatting');
    const skipBtn = document.getElementById('kbWizardSkipFiles');
    const closeBtn = document.getElementById('kbWizardClose');

    if (existingBtn) existingBtn.addEventListener('click', () => this.onSelectExisting());
    if (freshBtn) freshBtn.addEventListener('click', () => this.onStartFresh());
    if (chattingBtn) chattingBtn.addEventListener('click', () => this.onStartChatting());
    if (skipBtn) skipBtn.addEventListener('click', () => this.onStartChatting());
    if (closeBtn) closeBtn.addEventListener('click', () => this.closeWizard());

    this.setupWizardFileDropZone();
  }

  setupWizardFileDropZone() {
    const dropZone = document.getElementById('kbWizardDropZone');
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); });
    });
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => { dropZone.classList.add('drag-over'); });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => { dropZone.classList.remove('drag-over'); });
    });
    dropZone.addEventListener('drop', (e) => { this.handleWizardFileSelect(e.dataTransfer.files); });
    dropZone.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.multiple = true; input.accept = '.txt,.md';
      input.onchange = (e) => this.handleWizardFileSelect(e.target.files);
      input.click();
    });
  }

  async handleWizardFileSelect(files) {
    if (!files || files.length === 0) return;
    const kbName = this.kbManager.currentKB;
    if (!kbName) { alert('No knowledge base selected'); return; }

    const validFiles = this.validateFiles(files);
    if (validFiles.length === 0) { alert('No valid files selected (.txt or .md, max 10MB each)'); return; }

    this.closeWizard();
    await this.ingestFiles(validFiles, kbName);
  }

  async populateKBDropdown() {
    try {
      const kbs = await this.kbManager.listKBs();
      const select = document.getElementById('kbWizardExistingSelect');
      if (!select) return;
      select.innerHTML = '<option value="">— Choose a knowledge base —</option>';
      kbs.forEach(kb => {
        const option = document.createElement('option');
        option.value = kb.name;
        option.textContent = `${kb.displayName || kb.name} (${kb.docCount} docs)`;
        select.appendChild(option);
      });
    } catch (err) {
      console.error('Error populating KB dropdown:', err);
    }
  }

  // ── Panel events ──

  setupPanelEvents() {
    const switchBtn = document.getElementById('kbPanelSwitchBtn');
    const clearBtn = document.getElementById('kbPanelClearBtn');
    const collapseBtn = document.getElementById('kbPanelCollapseBtn');

    if (switchBtn) switchBtn.addEventListener('click', () => this.openWizard());
    if (clearBtn) clearBtn.addEventListener('click', () => this.onClearKB());
    if (collapseBtn) collapseBtn.addEventListener('click', () => this.togglePanelCollapse());
  }

  setupFileDropZone() {
    const dropZone = document.getElementById('kbPanelDropZone');
    const fileInput = document.getElementById('kbPanelFileInput');
    if (!dropZone || !fileInput) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => { e.preventDefault(); e.stopPropagation(); });
    });
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => { dropZone.classList.add('drag-over'); });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => { dropZone.classList.remove('drag-over'); });
    });
    dropZone.addEventListener('drop', (e) => { this.handleFileSelect(e.dataTransfer.files); });
    fileInput.addEventListener('change', (e) => { this.handleFileSelect(e.target.files); });
    dropZone.addEventListener('click', () => { fileInput.click(); });
  }

  // ── File handling ──

  validateFiles(files) {
    const validFiles = [];
    for (const file of files) {
      if (!['text/plain', 'text/markdown', 'application/x-markdown'].includes(file.type)) {
        console.warn(`Skipping invalid file type: ${file.name}`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        console.warn(`Skipping oversized file: ${file.name}`);
        continue;
      }
      validFiles.push(file);
    }
    return validFiles;
  }

  async handleFileSelect(files) {
    if (!files || files.length === 0) return;
    const kbName = this.kbManager.currentKB;
    if (!kbName) { alert('No knowledge base selected'); return; }

    const validFiles = this.validateFiles(files);
    if (validFiles.length === 0) { alert('No valid files selected (.txt or .md, max 10MB each)'); return; }

    await this.ingestFiles(validFiles, kbName);
  }

  async ingestFiles(files, kbName) {
    const progressContainer = document.getElementById('kbPanelProgress');
    const progressBar = document.getElementById('kbPanelProgressBar');
    const progressLabel = document.getElementById('kbPanelProgressLabel');
    if (!progressContainer) return;

    try {
      progressContainer.style.display = 'block';

      for await (const event of this.kbManager.ingestFiles(files, kbName)) {
        if (event.type === 'progress') {
          const percent = Math.round((event.current / event.total) * 100);
          if (progressBar) progressBar.style.width = `${percent}%`;
          if (progressLabel) progressLabel.textContent = `${event.current}/${event.total} — ${event.file}`;
        } else if (event.type === 'complete') {
          if (progressBar) progressBar.style.width = '100%';
          if (progressLabel) progressLabel.textContent = `✓ Complete: ${event.docCount} docs, ${event.chunkCount} chunks`;
          setTimeout(() => {
            this.updatePanelUI();
            progressContainer.style.display = 'none';
          }, 1000);
        } else if (event.type === 'error') {
          console.error('Ingestion error:', event.error);
          alert(`Ingestion error: ${event.error}`);
          progressContainer.style.display = 'none';
        }
      }
    } catch (err) {
      console.error('Error ingesting files:', err);
      alert(`Error: ${err.message}`);
      progressContainer.style.display = 'none';
    }

    const fileInput = document.getElementById('kbPanelFileInput');
    if (fileInput) fileInput.value = '';
  }

  // ── Panel UI updates ──

  async updatePanelUI() {
    if (!this.kbManager.currentKB) return;

    try {
      const kb = await this.kbManager.getKBDetails(this.kbManager.currentKB);

      const nameEl = document.getElementById('kbPanelName');
      const docsEl = document.getElementById('kbPanelDocCount');
      const chunksEl = document.getElementById('kbPanelChunkCount');
      const sizeEl = document.getElementById('kbPanelSize');

      this._currentDisplayName = kb.displayName || kb.name;
      if (nameEl) nameEl.textContent = this._currentDisplayName;
      if (docsEl) docsEl.textContent = kb.docCount || 0;
      if (chunksEl) chunksEl.textContent = kb.chunkCount || 0;
      if (sizeEl) {
        const sizeKB = ((kb.size || 0) / 1024).toFixed(1);
        sizeEl.textContent = `${sizeKB} KB`;
      }

      // Refresh files list
      await this.updateFilesList();
    } catch (err) {
      console.error('Error updating panel:', err);
    }
  }

  async onClearKB() {
    if (!this.kbManager.currentKB) return;
    const ok = window.confirm(`Clear knowledge base "${this.kbManager.currentKB}"? This cannot be undone.`);
    if (!ok) return;

    try {
      await this.kbManager.clearKB(this.kbManager.currentKB);
      this.updatePanelUI();
    } catch (err) {
      console.error('Error clearing KB:', err);
      alert(`Error: ${err.message}`);
    }
  }

  togglePanelCollapse() {
    const panel = document.getElementById('kbPanel');
    if (panel) {
      panel.classList.toggle('collapsed');
      this.isPanelOpen = !this.isPanelOpen;
      const toggleBtn = document.getElementById('chatKbToggle');
      if (toggleBtn) toggleBtn.classList.toggle('active', this.isPanelOpen);
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  if (window.kbManager) {
    window.kbUI = new KBUIManager(window.kbManager);
  }
});
