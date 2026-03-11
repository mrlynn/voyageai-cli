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
    const isBuiltin = this.kbManager.isBuiltinKB();

    try {
      const docs = await this.kbManager.listDocs(kbName);
      if (fileCount) fileCount.textContent = docs.length;

      if (docs.length === 0) {
        fileList.innerHTML = isBuiltin
          ? '<li class="kb-file-empty">Not set up yet. Run <code>vai kb setup</code> in your terminal.</li>'
          : '<li class="kb-file-empty">No documents ingested</li>';
        return;
      }

      fileList.innerHTML = docs.map(doc => {
        const sizeStr = doc.size > 1024
          ? (doc.size / 1024).toFixed(1) + ' KB'
          : (doc.size || 0) + ' B';
        const safeName = this.escapeHtml(doc.fileName);
        const categoryBadge = isBuiltin && doc.category
          ? `<span class="kb-file-category">${this.escapeHtml(doc.category)}</span>`
          : '';

        const deleteBtn = isBuiltin ? '' : `
          <button class="kb-file-delete" onclick="window.kbUI.removeFile('${safeName.replace(/'/g, "\\'")}')" title="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>`;

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
              ${categoryBadge}
            </div>
          </div>
          ${deleteBtn}
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

    if (this.kbManager.isBuiltinKB()) {
      const meta = this.kbManager.currentKBMeta;
      if (dbEl) dbEl.value = meta.db;
      if (collEl) collEl.value = meta.collection;
      // Store overrides for the chat message payload
      this._overrideIndex = meta.index;
      this._overrideTextField = meta.textField;
    } else {
      if (dbEl) dbEl.value = 'vai_rag';
      if (collEl) collEl.value = `kb_${kbName}_docs`;
      this._overrideIndex = null;
      this._overrideTextField = null;
    }

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
        console.warn('Could not restore last KB:', err.message);
        // Clear stale reference so it doesn't keep failing on reload
        localStorage.removeItem('__vai_last_kb');
        this.kbManager.currentKB = null;
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
      alert(`Failed to select KB: ${err.message}\n\nCheck that MongoDB is running and your connection string is configured.`);
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
      alert(`Failed to create KB: ${err.message}\n\nCheck that MongoDB is running and your connection string is configured.`);
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
      input.type = 'file'; input.multiple = true; input.accept = '.txt,.md,.pdf';
      input.onchange = (e) => this.handleWizardFileSelect(e.target.files);
      input.click();
    });
  }

  async handleWizardFileSelect(files) {
    if (!files || files.length === 0) return;
    const kbName = this.kbManager.currentKB;
    if (!kbName) { alert('No knowledge base selected'); return; }

    const validFiles = this.validateFiles(files);
    if (validFiles.length === 0) { alert('No valid files selected (.txt, .md, or .pdf, max 10MB each)'); return; }

    this.closeWizard();
    await this.ingestFiles(validFiles, kbName);
  }

  async populateKBDropdown() {
    const select = document.getElementById('kbWizardExistingSelect');
    if (!select) return;

    try {
      const kbs = await this.kbManager.listKBs();
      select.innerHTML = '<option value="">-- Choose a knowledge base --</option>';

      if (kbs.length === 0) {
        select.innerHTML = '<option value="">No knowledge bases found</option>';
        return;
      }

      // Separate built-in from custom KBs
      const builtinKBs = kbs.filter(kb => kb.builtin);
      const customKBs = kbs.filter(kb => !kb.builtin);

      // Built-in KB group
      if (builtinKBs.length > 0) {
        const group = document.createElement('optgroup');
        group.label = 'Built-in';
        builtinKBs.forEach(kb => {
          const option = document.createElement('option');
          option.value = kb.name;
          if (kb.seeded) {
            option.textContent = `${kb.displayName} (${kb.chunkCount} chunks)`;
          } else {
            option.textContent = `${kb.displayName} (not set up)`;
            option.disabled = true;
          }
          group.appendChild(option);
        });
        select.appendChild(group);
      }

      // Custom KB group
      if (customKBs.length > 0) {
        const group = document.createElement('optgroup');
        group.label = 'My Knowledge Bases';
        customKBs.forEach(kb => {
          const option = document.createElement('option');
          option.value = kb.name;
          option.textContent = `${kb.displayName || kb.name} (${kb.docCount} docs)`;
          group.appendChild(option);
        });
        select.appendChild(group);
      }
    } catch (err) {
      console.error('Error populating KB dropdown:', err);
      select.innerHTML = `<option value="">Connection error: ${err.message}</option>`;
    }
  }

  // ── Panel events ──

  setupPanelEvents() {
    const switchBtn = document.getElementById('kbPanelSwitchBtn');
    const clearBtn = document.getElementById('kbPanelClearBtn');
    const deleteBtn = document.getElementById('kbPanelDeleteBtn');
    const collapseBtn = document.getElementById('kbPanelCollapseBtn');

    if (switchBtn) switchBtn.addEventListener('click', () => this.openWizard());
    if (clearBtn) clearBtn.addEventListener('click', () => this.onClearKB());
    if (deleteBtn) deleteBtn.addEventListener('click', () => this.onDeleteKB());
    if (collapseBtn) collapseBtn.addEventListener('click', () => this.togglePanelCollapse());

    // Paste and URL ingest buttons
    const pasteBtn = document.getElementById('kbPasteIngestBtn');
    const urlBtn = document.getElementById('kbURLIngestBtn');
    if (pasteBtn) pasteBtn.addEventListener('click', () => this.handlePasteIngest());
    if (urlBtn) urlBtn.addEventListener('click', () => this.handleURLIngest());
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
      if (!['text/plain', 'text/markdown', 'application/x-markdown', 'application/pdf'].includes(file.type)) {
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
    if (validFiles.length === 0) { alert('No valid files selected (.txt, .md, or .pdf, max 10MB each)'); return; }

    await this.ingestFiles(validFiles, kbName);
  }

  async ingestFiles(files, kbName) {
    const progressContainer = document.getElementById('kbPanelProgress');
    const progressBar = document.getElementById('kbPanelProgressBar');
    const progressLabel = document.getElementById('kbPanelProgressLabel');
    if (!progressContainer) return;
    const warnings = [];

    try {
      progressContainer.style.display = 'block';

      for await (const event of this.kbManager.ingestFiles(files, kbName)) {
        if (event.type === 'progress') {
          let label = '';
          let percent = 0;

          if (event.stage === 'reading') {
            label = `Reading ${event.file}...`;
            percent = 5;
          } else if (event.stage === 'chunking') {
            label = `Chunking ${event.file} (${event.chunks} chunks)`;
            percent = 15;
          } else if (event.stage === 'embedding') {
            label = `Embedding ${event.current}/${event.total} chunks`;
            percent = 15 + Math.round((event.current / event.total) * 70);
          } else if (event.stage === 'storing') {
            label = `Storing ${event.file}...`;
            percent = 90;
          } else if (event.stage === 'fetching') {
            label = 'Fetching URL...';
            percent = 5;
          } else {
            // Fallback for old-style progress (file-level)
            label = `${event.current}/${event.total} — ${event.file || ''}`;
            percent = event.total ? Math.round((event.current / event.total) * 100) : 0;
          }

          if (progressBar) progressBar.style.width = `${percent}%`;
          if (progressLabel) progressLabel.textContent = label;
        } else if (event.type === 'warning') {
          if (event.warning) warnings.push(event.warning);
          if (progressLabel) progressLabel.textContent = event.warning || 'Upload completed with warnings';
        } else if (event.type === 'complete') {
          if (progressBar) progressBar.style.width = '100%';
          const hasWarnings = warnings.length > 0 || event.docCount === 0;
          if (progressLabel) {
            progressLabel.textContent = hasWarnings
              ? `Complete with warnings: ${event.docCount} docs, ${event.chunkCount} chunks`
              : `✓ Complete: ${event.docCount} docs, ${event.chunkCount} chunks`;
          }
          setTimeout(() => {
            this.updatePanelUI();
            progressContainer.style.display = 'none';
            const messages = [...warnings];
            if (event.docCount === 0) {
              messages.unshift('No documents were stored from that upload.');
            }
            if (messages.length > 0) {
              alert(messages.join('\n'));
            }
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

  // ── Paste text ingest ──

  async handlePasteIngest() {
    const textarea = document.getElementById('kbPasteText');
    const titleInput = document.getElementById('kbPasteTitle');
    if (!textarea) return;

    const text = textarea.value.trim();
    if (!text) { alert('Please paste some text content first.'); return; }

    const kbName = this.kbManager.currentKB;
    if (!kbName) { alert('No knowledge base selected'); return; }

    const title = titleInput ? titleInput.value.trim() : '';
    await this.ingestText(text, kbName, title);

    // Clear inputs after successful ingest
    textarea.value = '';
    if (titleInput) titleInput.value = '';
  }

  async ingestText(text, kbName, title) {
    const progressContainer = document.getElementById('kbPanelProgress');
    const progressBar = document.getElementById('kbPanelProgressBar');
    const progressLabel = document.getElementById('kbPanelProgressLabel');
    if (!progressContainer) return;

    try {
      progressContainer.style.display = 'block';

      for await (const event of this.kbManager.ingestText(text, kbName, title)) {
        if (event.type === 'progress') {
          const percent = event.total > 0 ? Math.round((event.current / event.total) * 100) : 0;
          if (progressBar) progressBar.style.width = `${percent}%`;
          const stageLabel = event.stage === 'chunking' ? 'Chunking...'
            : event.stage === 'embedding' ? `Embedding ${event.current}/${event.total} chunks`
            : 'Processing...';
          if (progressLabel) progressLabel.textContent = stageLabel;
        } else if (event.type === 'complete') {
          if (progressBar) progressBar.style.width = '100%';
          if (progressLabel) progressLabel.textContent = `Done: ${event.chunkCount} chunks ingested`;
          setTimeout(() => {
            this.updatePanelUI();
            progressContainer.style.display = 'none';
          }, 1000);
        } else if (event.type === 'error') {
          console.error('Text ingestion error:', event.error);
          alert(`Ingestion error: ${event.error}`);
          progressContainer.style.display = 'none';
        }
      }
    } catch (err) {
      console.error('Error ingesting text:', err);
      alert(`Error: ${err.message}`);
      progressContainer.style.display = 'none';
    }
  }

  // ── URL ingest ──

  async handleURLIngest() {
    const urlInput = document.getElementById('kbURLInput');
    if (!urlInput) return;

    const url = urlInput.value.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      alert('Please enter a valid URL starting with http:// or https://');
      return;
    }

    const kbName = this.kbManager.currentKB;
    if (!kbName) { alert('No knowledge base selected'); return; }

    await this.ingestURL(url, kbName);

    // Clear input after successful ingest
    urlInput.value = '';
  }

  async ingestURL(url, kbName) {
    const progressContainer = document.getElementById('kbPanelProgress');
    const progressBar = document.getElementById('kbPanelProgressBar');
    const progressLabel = document.getElementById('kbPanelProgressLabel');
    if (!progressContainer) return;

    try {
      progressContainer.style.display = 'block';

      for await (const event of this.kbManager.ingestURL(url, kbName)) {
        if (event.type === 'progress') {
          const percent = event.total > 0 ? Math.round((event.current / event.total) * 100) : 0;
          if (progressBar) progressBar.style.width = `${percent}%`;
          const stageLabel = event.stage === 'fetching' ? 'Fetching URL...'
            : event.stage === 'chunking' ? 'Chunking...'
            : event.stage === 'embedding' ? `Embedding ${event.current}/${event.total} chunks`
            : 'Processing...';
          if (progressLabel) progressLabel.textContent = stageLabel;
        } else if (event.type === 'complete') {
          if (progressBar) progressBar.style.width = '100%';
          if (progressLabel) progressLabel.textContent = `Done: ${event.chunkCount} chunks ingested`;
          setTimeout(() => {
            this.updatePanelUI();
            progressContainer.style.display = 'none';
          }, 1000);
        } else if (event.type === 'error') {
          console.error('URL ingestion error:', event.error);
          alert(`Ingestion error: ${event.error}`);
          progressContainer.style.display = 'none';
        }
      }
    } catch (err) {
      console.error('Error ingesting URL:', err);
      alert(`Error: ${err.message}`);
      progressContainer.style.display = 'none';
    }
  }

  // ── Panel UI updates ──

  async updatePanelUI() {
    if (!this.kbManager.currentKB) return;
    const isBuiltin = this.kbManager.isBuiltinKB();

    try {
      const kb = await this.kbManager.getKBDetails(this.kbManager.currentKB);

      const nameEl = document.getElementById('kbPanelName');
      const docsEl = document.getElementById('kbPanelDocCount');
      const chunksEl = document.getElementById('kbPanelChunkCount');
      const sizeEl = document.getElementById('kbPanelSize');

      this._currentDisplayName = kb.displayName || kb.name;
      if (nameEl) {
        nameEl.textContent = this._currentDisplayName;
        // Disable rename for built-in KB
        nameEl.classList.toggle('kb-name-editable', !isBuiltin);
      }
      if (docsEl) docsEl.textContent = kb.docCount || 0;
      if (chunksEl) chunksEl.textContent = kb.chunkCount || 0;
      if (sizeEl) {
        const sizeKB = ((kb.size || 0) / 1024).toFixed(1);
        sizeEl.textContent = `${sizeKB} KB`;
      }

      // Toggle built-in badge
      const builtinBadge = document.getElementById('kbBuiltinBadge');
      if (builtinBadge) builtinBadge.style.display = isBuiltin ? 'inline-flex' : 'none';

      // Toggle built-in setup prompt (shown when seeded === false)
      const setupPrompt = document.getElementById('kbBuiltinSetupPrompt');
      if (setupPrompt) setupPrompt.style.display = (isBuiltin && !kb.seeded) ? 'block' : 'none';

      // Hide mutating controls for built-in KB
      const clearBtn = document.getElementById('kbPanelClearBtn');
      const deleteBtn = document.getElementById('kbPanelDeleteBtn');
      const uploadSection = document.querySelector('.kb-section[data-kb-section="upload"]');

      if (clearBtn) clearBtn.style.display = isBuiltin ? 'none' : '';
      if (deleteBtn) deleteBtn.style.display = isBuiltin ? 'none' : '';
      if (uploadSection) uploadSection.style.display = isBuiltin ? 'none' : '';

      // Show version info for built-in KB
      const versionEl = document.getElementById('kbBuiltinVersion');
      if (versionEl) {
        if (isBuiltin && kb.builtinVersion) {
          versionEl.textContent = `v${kb.builtinVersion}`;
          versionEl.style.display = 'inline';
        } else {
          versionEl.style.display = 'none';
        }
      }

      // Refresh files list
      await this.updateFilesList();
    } catch (err) {
      console.error('Error updating panel:', err);
    }
  }

  async onClearKB() {
    if (!this.kbManager.currentKB) return;
    const displayName = this._currentDisplayName || this.kbManager.currentKB;
    const ok = window.confirm(`Clear all documents from "${displayName}"? This will remove the knowledge base and all its documents. This cannot be undone.`);
    if (!ok) return;

    const kbToClear = this.kbManager.currentKB;
    try {
      await this.kbManager.clearKB(kbToClear);
      this.clearSelectionAndOpenWizard();
    } catch (err) {
      console.error('Error clearing KB:', err);
      alert(`Error: ${err.message}`);
    }
  }

  async onDeleteKB() {
    if (!this.kbManager.currentKB) return;
    const displayName = this._currentDisplayName || this.kbManager.currentKB;
    const ok = window.confirm(`Delete knowledge base "${displayName}"? This will remove it and all its documents permanently. This cannot be undone.`);
    if (!ok) return;

    const kbToDelete = this.kbManager.currentKB;
    try {
      await this.kbManager.clearKB(kbToDelete);
      this.clearSelectionAndOpenWizard();
    } catch (err) {
      console.error('Error deleting KB:', err);
      alert(`Error: ${err.message}`);
    }
  }

  clearSelectionAndOpenWizard() {
    this.kbManager.currentKB = null;
    localStorage.removeItem('__vai_last_kb');
    if (typeof saveChatSettings === 'function') saveChatSettings();
    if (typeof updateChatStatus === 'function') updateChatStatus();
    this.openWizard();
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
