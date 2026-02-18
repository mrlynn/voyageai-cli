/**
 * Knowledge Base UI Manager
 * Handles wizard, panel, and file upload interactions
 */

class KBUIManager {
  constructor(kbManager) {
    this.kbManager = kbManager;
    this.isWizardOpen = false;
    this.isPanelOpen = true;
    this.currentStep = 'select'; // 'select' | 'add-docs'
    this.init();
  }

  init() {
    // Load last KB on init
    this.loadInitialKB();
    
    // Set up event listeners
    this.setupWizardEvents();
    this.setupPanelEvents();
    this.setupFileDropZone();
  }

  /**
   * Load last used KB, or show wizard if none exists
   */
  async loadInitialKB() {
    const lastKB = localStorage.getItem('__vai_last_kb');
    if (lastKB) {
      // Try to load last KB
      try {
        await this.kbManager.selectKB(lastKB);
        this.updatePanelUI();
      } catch (err) {
        // KB not found, show wizard
        console.warn('Last KB not found, showing wizard');
        this.openWizard();
      }
    } else {
      // First time, show wizard
      this.openWizard();
    }
  }

  /**
   * Open the KB setup wizard
   */
  openWizard() {
    const wizardEl = document.getElementById('kbWizard');
    if (wizardEl) {
      wizardEl.classList.add('visible');
      this.isWizardOpen = true;
      this.currentStep = 'select';
      this.updateWizardUI();
    }
  }

  /**
   * Close the wizard
   */
  closeWizard() {
    const wizardEl = document.getElementById('kbWizard');
    if (wizardEl) {
      wizardEl.classList.remove('visible');
      this.isWizardOpen = false;
    }
  }

  /**
   * Update wizard UI based on current step
   */
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

  /**
   * Handle "Use Existing KB" selection
   */
  async onSelectExisting() {
    const select = document.getElementById('kbWizardExistingSelect');
    if (!select || !select.value) {
      alert('Please select a knowledge base');
      return;
    }

    try {
      await this.kbManager.selectKB(select.value);
      this.updatePanelUI();
      this.closeWizard();
    } catch (err) {
      console.error('Error selecting KB:', err);
      alert(`Error: ${err.message}`);
    }
  }

  /**
   * Handle "Start Fresh" button
   */
  async onStartFresh() {
    try {
      // Create new KB (pass null for auto-generated name)
      await this.kbManager.selectKB(null);
      this.currentStep = 'add-docs';
      this.updateWizardUI();
      this.updatePanelUI();
    } catch (err) {
      console.error('Error creating KB:', err);
      alert(`Error: ${err.message}`);
    }
  }

  /**
   * Handle "Start Chatting" in wizard
   */
  onStartChatting() {
    this.closeWizard();
  }

  /**
   * Set up wizard event listeners
   */
  setupWizardEvents() {
    // Populate existing KB dropdown
    this.populateKBDropdown();

    // Button handlers
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

    // Set up wizard file drop zone (for step 2)
    this.setupWizardFileDropZone();
  }

  /**
   * Set up wizard file drop zone
   */
  setupWizardFileDropZone() {
    const dropZone = document.getElementById('kbWizardDropZone');
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('drag-over');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      this.handleWizardFileSelect(files);
    });

    dropZone.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '.txt,.md';
      input.onchange = (e) => this.handleWizardFileSelect(e.target.files);
      input.click();
    });
  }

  /**
   * Handle wizard file selection
   */
  async handleWizardFileSelect(files) {
    if (!files || files.length === 0) return;

    const kbName = this.kbManager.currentKB;
    if (!kbName) {
      alert('No knowledge base selected');
      return;
    }

    // Validate files
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

    if (validFiles.length === 0) {
      alert('No valid files selected (.txt or .md, max 10MB each)');
      return;
    }

    // Close wizard, then ingest
    this.closeWizard();
    await this.ingestFiles(validFiles, kbName);
  }

  /**
   * Populate "Use Existing" dropdown
   */
  async populateKBDropdown() {
    try {
      const kbs = await this.kbManager.listKBs();
      const select = document.getElementById('kbWizardExistingSelect');
      if (!select) return;

      select.innerHTML = '<option value="">— Choose a knowledge base —</option>';
      kbs.forEach(kb => {
        const option = document.createElement('option');
        option.value = kb.name;
        option.textContent = `${kb.name} (${kb.docCount} docs)`;
        select.appendChild(option);
      });
    } catch (err) {
      console.error('Error populating KB dropdown:', err);
    }
  }

  /**
   * Set up panel event listeners
   */
  setupPanelEvents() {
    const addBtn = document.getElementById('kbPanelAddBtn');
    const switchBtn = document.getElementById('kbPanelSwitchBtn');
    const clearBtn = document.getElementById('kbPanelClearBtn');
    const collapseBtn = document.getElementById('kbPanelCollapseBtn');

    if (addBtn) addBtn.addEventListener('click', () => {
      const fileInput = document.getElementById('kbPanelFileInput');
      if (fileInput) fileInput.click();
    });
    if (switchBtn) switchBtn.addEventListener('click', () => this.openWizard());
    if (clearBtn) clearBtn.addEventListener('click', () => this.onClearKB());
    if (collapseBtn) collapseBtn.addEventListener('click', () => this.togglePanelCollapse());
  }

  /**
   * Set up file drop zone
   */
  setupFileDropZone() {
    const dropZone = document.getElementById('kbPanelDropZone');
    const fileInput = document.getElementById('kbPanelFileInput');

    if (!dropZone || !fileInput) return;

    // Prevent default drag behavior
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    // Highlight on drag
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('drag-over');
      });
    });

    // Handle drop
    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      this.handleFileSelect(files);
    });

    // Handle file input change
    fileInput.addEventListener('change', (e) => {
      this.handleFileSelect(e.target.files);
    });

    // Click to browse
    dropZone.addEventListener('click', () => {
      fileInput.click();
    });
  }

  /**
   * Handle file selection (from drop or browse)
   */
  async handleFileSelect(files) {
    if (!files || files.length === 0) return;

    const kbName = this.kbManager.currentKB;
    if (!kbName) {
      alert('No knowledge base selected');
      return;
    }

    // Validate files
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

    if (validFiles.length === 0) {
      alert('No valid files selected (.txt or .md, max 10MB each)');
      return;
    }

    // Start ingestion
    await this.ingestFiles(validFiles, kbName);
  }

  /**
   * Ingest files and show progress
   */
  async ingestFiles(files, kbName) {
    const progressContainer = document.getElementById('kbPanelProgress');
    const progressBar = document.getElementById('kbPanelProgressBar');
    const progressLabel = document.getElementById('kbPanelProgressLabel');

    if (!progressContainer) return;

    try {
      progressContainer.style.display = 'block';

      // Generator-based ingestion with progress
      for await (const event of this.kbManager.ingestFiles(files, kbName)) {
        if (event.type === 'progress') {
          const percent = Math.round((event.current / event.total) * 100);
          if (progressBar) progressBar.style.width = `${percent}%`;
          if (progressLabel) progressLabel.textContent = `${event.current}/${event.total} — ${event.file}`;
        } else if (event.type === 'complete') {
          if (progressBar) progressBar.style.width = '100%';
          if (progressLabel) progressLabel.textContent = `✓ Complete: ${event.docCount} docs, ${event.chunkCount} chunks`;

          // Update panel UI
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

    // Reset file input
    const fileInput = document.getElementById('kbPanelFileInput');
    if (fileInput) fileInput.value = '';
  }

  /**
   * Update panel UI with current KB info
   */
  async updatePanelUI() {
    if (!this.kbManager.currentKB) return;

    try {
      const kb = await this.kbManager.getKBDetails(this.kbManager.currentKB);
      
      const nameEl = document.getElementById('kbPanelName');
      const docsEl = document.getElementById('kbPanelDocCount');
      const chunksEl = document.getElementById('kbPanelChunkCount');
      const sizeEl = document.getElementById('kbPanelSize');

      if (nameEl) nameEl.textContent = kb.name;
      if (docsEl) docsEl.textContent = kb.docCount || 0;
      if (chunksEl) chunksEl.textContent = kb.chunkCount || 0;
      if (sizeEl) {
        const sizeKB = ((kb.size || 0) / 1024).toFixed(1);
        sizeEl.textContent = `${sizeKB} KB`;
      }
    } catch (err) {
      console.error('Error updating panel:', err);
    }
  }

  /**
   * Clear current KB
   */
  async onClearKB() {
    if (!this.kbManager.currentKB) return;

    const confirm = window.confirm(`Clear knowledge base "${this.kbManager.currentKB}"? This cannot be undone.`);
    if (!confirm) return;

    try {
      await this.kbManager.clearKB(this.kbManager.currentKB);
      this.updatePanelUI();
    } catch (err) {
      console.error('Error clearing KB:', err);
      alert(`Error: ${err.message}`);
    }
  }

  /**
   * Toggle panel collapse
   */
  togglePanelCollapse() {
    const panel = document.getElementById('kbPanel');
    if (panel) {
      panel.classList.toggle('collapsed');
      this.isPanelOpen = !this.isPanelOpen;
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  if (window.kbManager) {
    window.kbUI = new KBUIManager(window.kbManager);
  }
});
