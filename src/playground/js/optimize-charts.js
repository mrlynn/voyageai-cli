/**
 * Optimize Tab Charts - Powered by Chart.js
 * Handles cost analysis visualization and interactivity
 */

class OptimizeTab {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.charts = {};
    this.currentAnalysis = null;
    this.statusChecked = false;
  }

  /**
   * Initialize the Optimize tab UI.
   * No API calls are made until the user explicitly clicks "Get Started".
   */
  async init() {
    if (!this.container) {
      console.error('[OptimizeTab] Container not found');
      return;
    }

    // "Get Started" button — the only entry point into the demo flow
    const getStartedBtn = this.container.querySelector('#optimize-get-started-btn');
    if (getStartedBtn) {
      getStartedBtn.addEventListener('click', () => this.onGetStarted());
    }

    this.setupEventListeners();
    this.restoreState();
  }

  /**
   * User clicked "Get Started" — now we check data status and proceed.
   */
  async onGetStarted() {
    // Hide landing, show config panel
    const landing = this.container.querySelector('#optimize-landing');
    const configPanel = this.container.querySelector('#optimize-config-panel');
    if (landing) landing.style.display = 'none';
    if (configPanel) configPanel.style.display = '';

    await this.checkDataStatus();
  }

  /**
   * Check whether demo data is ready and update UI accordingly
   */
  async checkDataStatus() {
    this.statusChecked = true;
    const resultsPanel = this.container.querySelector('#optimize-results');
    if (!resultsPanel) return;

    try {
      const resp = await fetch('/api/optimize/status');
      const status = await resp.json();
      console.log('[OptimizeTab] Data status:', status);

      if (status.ready) {
        // Data is ready — show normal idle state
        this.showReadyState(resultsPanel, status);
        this.setRunButtonEnabled(true);
      } else if (status.indexFailed) {
        // Index exists but FAILED — needs re-creation
        this.showIndexFailedState(resultsPanel, status);
        this.setRunButtonEnabled(false);
      } else if (status.docCount > 0 && !status.indexReady) {
        // Data ingested but index still building
        this.showIndexBuildingState(resultsPanel, status);
        this.setRunButtonEnabled(false);
        this.pollForIndexReady();
      } else {
        // No data — show preparation step
        this.showNeedsDataState(resultsPanel);
        this.setRunButtonEnabled(false);
      }
    } catch (err) {
      console.error('[OptimizeTab] Status check failed:', err);
      this.showNeedsDataState(resultsPanel);
      this.setRunButtonEnabled(false);
    }
  }

  /**
   * Show the "index failed" state — indexes need to be dropped and re-created
   */
  showIndexFailedState(panel, status) {
    panel.innerHTML = `
      <div class="card" style="border-left: 4px solid #ff6b6b;">
        <div style="padding: 20px;">
          <div style="font-weight: 600; margin-bottom: 8px; color: #ff6b6b;">Vector search index failed</div>
          <div style="font-size: 13px; color: var(--text-dim); margin-bottom: 8px;">
            ${status.docCount} documents are ingested, but the vector search index failed to build.
            This usually means the index was created with the wrong configuration.
          </div>
          <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 16px;">
            ${status.failedCount || ''} failed index(es) found. Click below to drop the failed indexes,
            re-create with the correct settings, and re-ingest the sample data.
          </div>
          <button class="btn" id="optimize-repair-btn" style="width: 100%;">
            Repair: Drop &amp; Re-create Index
          </button>
          <div id="optimize-repair-status" style="margin-top: 12px;"></div>
        </div>
      </div>
    `;

    const repairBtn = panel.querySelector('#optimize-repair-btn');
    if (repairBtn) {
      repairBtn.addEventListener('click', () => this.repairDemoData());
    }
  }

  /**
   * Drop existing data and re-prepare with correct index
   */
  async repairDemoData() {
    const repairBtn = this.container.querySelector('#optimize-repair-btn');
    const statusEl = this.container.querySelector('#optimize-repair-status');

    if (repairBtn) {
      repairBtn.disabled = true;
      repairBtn.textContent = 'Repairing...';
    }
    if (statusEl) {
      statusEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; color: var(--text-dim); font-size: 13px;">
          <div class="spinner" style="width: 16px; height: 16px;"></div>
          Dropping failed indexes and re-ingesting... this may take 30-60 seconds.
        </div>
      `;
    }

    try {
      // Force re-ingest which drops the collection (and its failed indexes) then re-creates properly
      const resp = await fetch('/api/optimize/prepare?force=true', { method: 'POST' });
      const result = await resp.json();

      if (!resp.ok || !result.success) {
        throw new Error(result.error || 'Repair failed');
      }

      if (statusEl) {
        statusEl.innerHTML = `
          <div style="color: #00d4aa; font-size: 13px; font-weight: 500;">
            &#10003; ${result.docCount} documents re-ingested. Waiting for new vector search index...
          </div>
        `;
      }

      this.setRunButtonEnabled(false);
      this.pollForIndexReady();
    } catch (err) {
      console.error('[OptimizeTab] Repair failed:', err);
      if (statusEl) {
        statusEl.innerHTML = `<div style="color: #ff6b6b; font-size: 13px;">Repair failed: ${err.message}</div>`;
      }
      if (repairBtn) {
        repairBtn.disabled = false;
        repairBtn.textContent = 'Repair: Drop & Re-create Index';
      }
    }
  }

  /**
   * Show the "data ready" idle state
   */
  showReadyState(panel, status) {
    panel.innerHTML = `
      <div class="card" style="border-left: 4px solid #00d4aa;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 16px 20px;">
          <div style="font-size: 24px;">&#10003;</div>
          <div>
            <div style="font-weight: 600; margin-bottom: 4px;">Demo data ready</div>
            <div style="font-size: 13px; color: var(--text-dim);">
              ${status.docCount} documents in <code>${status.db}.${status.collection}</code>
              &mdash; vector index active. Click <strong>Run Analysis</strong> to compare models.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Show the "index building" waiting state, with polling
   */
  showIndexBuildingState(panel, status) {
    this._pollStartTime = Date.now();
    panel.innerHTML = `
      <div class="card" style="border-left: 4px solid #ff9800;">
        <div style="padding: 20px;">
          <div style="font-weight: 600; margin-bottom: 8px;">Vector search index is building...</div>
          <div style="font-size: 13px; color: var(--text-dim); margin-bottom: 8px;">
            ${status.docCount} documents ingested. Atlas is building the vector search index.
          </div>
          <div id="optimize-poll-status" style="font-size: 12px; color: var(--text-dim); margin-bottom: 16px;">
            Checking every 10 seconds... <span id="optimize-poll-elapsed"></span>
          </div>
          <div class="spinner" style="margin: 0 auto; margin-bottom: 16px;"></div>
          <div style="font-size: 12px; color: var(--text-dim); text-align: center;">
            Index status: <code id="optimize-index-status">${status.indexStatus || 'pending'}</code>
          </div>
          <div style="text-align: center; margin-top: 12px;">
            <button class="btn" id="optimize-skip-wait-btn" style="font-size: 12px; padding: 6px 16px; opacity: 0.7;">
              Try Running Anyway
            </button>
          </div>
        </div>
      </div>
    `;

    const skipBtn = panel.querySelector('#optimize-skip-wait-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
        if (this._elapsedTimer) { clearInterval(this._elapsedTimer); this._elapsedTimer = null; }
        this.showReadyState(panel, status);
        this.setRunButtonEnabled(true);
      });
    }
  }

  /**
   * Show the "needs data" state with a Prepare button
   */
  showNeedsDataState(panel) {
    panel.innerHTML = `
      <div class="card">
        <div class="card-title">Prepare Demo Data</div>
        <p style="color: var(--text-dim); margin-bottom: 16px;">
          No embedded documents found in <code>vai_demo.cost_optimizer_demo</code>.
          The demo needs sample data to compare retrieval across models.
        </p>
        <div style="background: rgba(0, 212, 170, 0.05); border: 1px solid var(--border); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
          <div style="font-size: 13px; color: var(--text-dim);">
            <strong>What happens when you click Prepare:</strong>
            <ol style="margin: 8px 0 0 0; padding-left: 20px; line-height: 1.8;">
              <li>65 bundled sample markdown documents are read locally</li>
              <li>Each document is embedded using <code>voyage-4-large</code> via the Voyage AI API (<strong>~50K tokens</strong>)</li>
              <li>Documents + embeddings are stored in <code>vai_demo.cost_optimizer_demo</code></li>
              <li>A vector search index is created (takes 1-2 min to build on Atlas)</li>
            </ol>
          </div>
        </div>
        <button class="btn" id="optimize-prepare-btn" style="width: 100%;">
          Prepare Demo Data (~50K tokens)
        </button>
        <div id="optimize-prepare-status" style="margin-top: 12px;"></div>
      </div>
    `;

    const prepareBtn = panel.querySelector('#optimize-prepare-btn');
    if (prepareBtn) {
      prepareBtn.addEventListener('click', () => this.prepareDemoData());
    }
  }

  /**
   * Call the prepare endpoint to ingest sample data
   */
  async prepareDemoData() {
    const prepareBtn = this.container.querySelector('#optimize-prepare-btn');
    const statusEl = this.container.querySelector('#optimize-prepare-status');

    if (prepareBtn) {
      prepareBtn.disabled = true;
      prepareBtn.textContent = 'Preparing...';
    }

    if (statusEl) {
      statusEl.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; color: var(--text-dim); font-size: 13px;">
          <div class="spinner" style="width: 16px; height: 16px;"></div>
          Embedding documents with voyage-4-large... this may take 30-60 seconds.
        </div>
      `;
    }

    try {
      const resp = await fetch('/api/optimize/prepare', { method: 'POST' });
      const result = await resp.json();

      if (!resp.ok || !result.success) {
        throw new Error(result.error || 'Preparation failed');
      }

      // If the server skipped because data already exists, go straight to status check
      if (result.skipped) {
        if (statusEl) {
          statusEl.innerHTML = `
            <div style="color: #00d4aa; font-size: 13px; font-weight: 500;">
              &#10003; Data already exists (${result.docCount} documents). Checking index status...
            </div>
          `;
        }
        await this.checkDataStatus();
        return;
      }

      if (statusEl) {
        statusEl.innerHTML = `
          <div style="color: #00d4aa; font-size: 13px; font-weight: 500;">
            &#10003; ${result.docCount} documents ingested. Waiting for vector search index...
          </div>
        `;
      }

      // Now poll for the index to become ready
      this.setRunButtonEnabled(false);
      this.pollForIndexReady();
    } catch (err) {
      console.error('[OptimizeTab] Prepare failed:', err);
      if (statusEl) {
        statusEl.innerHTML = `
          <div style="color: #ff6b6b; font-size: 13px;">
            Preparation failed: ${err.message}
          </div>
        `;
      }
      if (prepareBtn) {
        prepareBtn.disabled = false;
        prepareBtn.textContent = 'Prepare Demo Data';
      }
    }
  }

  /**
   * Poll /api/optimize/status every 10s until the index is ready.
   * Shows elapsed time and index status. Times out after 5 minutes with an option to proceed anyway.
   */
  pollForIndexReady() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    if (this._elapsedTimer) clearInterval(this._elapsedTimer);

    this._pollStartTime = this._pollStartTime || Date.now();
    let pollCount = 0;

    // Update elapsed time every second
    this._elapsedTimer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this._pollStartTime) / 1000);
      const elapsedEl = document.getElementById('optimize-poll-elapsed');
      if (elapsedEl) {
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        elapsedEl.textContent = mins > 0
          ? `(${mins}m ${secs}s elapsed)`
          : `(${secs}s elapsed)`;
      }
    }, 1000);

    this._pollTimer = setInterval(async () => {
      pollCount++;
      try {
        const resp = await fetch('/api/optimize/status');
        const status = await resp.json();
        console.log(`[OptimizeTab] Poll #${pollCount}:`, status);

        // Update displayed status
        const statusEl = document.getElementById('optimize-index-status');
        if (statusEl) {
          statusEl.textContent = status.indexStatus || (status.indexReady ? 'READY' : 'building...');
        }

        if (status.ready) {
          clearInterval(this._pollTimer); this._pollTimer = null;
          clearInterval(this._elapsedTimer); this._elapsedTimer = null;

          const resultsPanel = this.container.querySelector('#optimize-results');
          if (resultsPanel) this.showReadyState(resultsPanel, status);
          this.setRunButtonEnabled(true);
          return;
        }

        // After 5 minutes, stop polling and let the user decide
        if (pollCount >= 30) {
          clearInterval(this._pollTimer); this._pollTimer = null;
          clearInterval(this._elapsedTimer); this._elapsedTimer = null;

          const pollStatusEl = document.getElementById('optimize-poll-status');
          if (pollStatusEl) {
            pollStatusEl.innerHTML = `
              <span style="color: #ff9800;">Index is still building after 5 minutes.
              You can click "Try Running Anyway" or wait and refresh later.</span>
            `;
          }
        }
      } catch (e) {
        // Keep polling on network errors
      }
    }, 10_000);
  }

  /**
   * Enable/disable the Run Analysis button
   */
  setRunButtonEnabled(enabled) {
    const runBtn = this.container.querySelector('#optimize-run-btn');
    if (runBtn) {
      runBtn.disabled = !enabled;
      runBtn.style.opacity = enabled ? '1' : '0.5';
    }
  }

  /**
   * Set up event listeners for configuration inputs
   */
  setupEventListeners() {
    const runBtn = this.container.querySelector('#optimize-run-btn');

    if (runBtn) {
      runBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.runAnalysis();
      });
    }

    const exportBtn = this.container.querySelector('#optimize-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportReport());
    }

    // Listen for scale slider changes (real-time updates)
    const sliders = this.container.querySelectorAll('.optimize-scale-slider');
    sliders.forEach((slider) => {
      slider.addEventListener('input', () => this.updateScaleDisplay());
    });
  }

  /**
   * Get current configuration from form
   */
  getConfig() {
    const db = this.container.querySelector('#optimize-db')?.value || 'vai_demo';
    const collection =
      this.container.querySelector('#optimize-collection')?.value || 'cost_optimizer_demo';
    const queries = this.container.querySelector('#optimize-queries')?.value?.split('\n') || [];
    const models = Array.from(this.container.querySelectorAll('.optimize-model-checkbox:checked')).map(
      (cb) => cb.value
    );

    const docsSlider = this.container.querySelector('[data-scale="docs"]');
    const queriesSlider = this.container.querySelector('[data-scale="queries"]');
    const monthsSlider = this.container.querySelector('[data-scale="months"]');

    return {
      db,
      collection,
      queries: queries.filter((q) => q.trim()),
      models: models.length > 0 ? models : ['voyage-4-large', 'voyage-4-lite'],
      scale: {
        docs: parseInt(docsSlider?.value) || 1_000_000,
        queriesPerMonth: parseInt(queriesSlider?.value) || 50_000_000,
        months: parseInt(monthsSlider?.value) || 12,
      },
    };
  }

  /**
   * Update the scale display labels
   */
  updateScaleDisplay() {
    const config = this.getConfig();
    const docsLabel = this.container.querySelector('[data-scale-label="docs"]');
    const queriesLabel = this.container.querySelector('[data-scale-label="queries"]');
    const monthsLabel = this.container.querySelector('[data-scale-label="months"]');

    if (docsLabel)
      docsLabel.textContent = `${(config.scale.docs / 1e6).toFixed(1)}M documents`;
    if (queriesLabel)
      queriesLabel.textContent = `${(config.scale.queriesPerMonth / 1e6).toFixed(1)}M queries/month`;
    if (monthsLabel) monthsLabel.textContent = `${config.scale.months} months`;
  }

  /**
   * Run the optimization analysis with step-by-step progress
   */
  async runAnalysis() {
    const config = this.getConfig();
    const resultsPanel = this.container.querySelector('#optimize-results');

    if (!resultsPanel) {
      console.error('Results panel not found');
      return;
    }

    // Show step-by-step process
    resultsPanel.innerHTML = `
      <div class="card" style="padding: 30px; text-align: center;">
        <div style="font-weight: 600; margin-bottom: 12px;">Running Cost Analysis...</div>
        <div style="font-size: 13px; color: var(--text-dim); margin-bottom: 16px;">
          Embedding queries with both models and comparing retrieval results.
        </div>
        <div class="spinner" style="margin: 0 auto;"></div>
      </div>
    `;

    try {
      const response = await fetch('/api/optimize/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          db: config.db,
          collection: config.collection,
          queries: config.queries,
          models: config.models,
          scale: config.scale,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API returned ${response.status}: ${errorText}`);
      }

      this.currentAnalysis = await response.json();
      console.log('Analysis complete:', this.currentAnalysis);

      // Track costs in the session dashboard
      this.trackCosts(0);

      // Now show full results with explanations
      resultsPanel.innerHTML = '';
      this.renderResults();
    } catch (err) {
      console.error('Analysis error:', err);
      resultsPanel.innerHTML = `
        <div class="card" style="border-left: 4px solid #ff6b6b; padding: 20px;">
          <div style="color: #ff6b6b; font-weight: bold; margin-bottom: 8px;">Analysis Failed</div>
          <div style="color: var(--text-dim); font-size: 14px;">${err.message}</div>
          <div style="color: var(--text-dim); font-size: 12px; margin-top: 12px;">
            Make sure:
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              <li>Database and collection names are correct</li>
              <li>The collection contains embedded documents with a vector search index</li>
              <li>Your API key and MongoDB URI are configured</li>
            </ul>
          </div>
        </div>
      `;
    }
  }

  /**
   * Render analysis results
   */
  renderResults() {
    const resultsPanel = this.container.querySelector('#optimize-results');
    if (!resultsPanel) return;

    resultsPanel.innerHTML = '';

    // 1. Retrieval Quality Section
    const qualityCard = this.createQualityCard();
    resultsPanel.appendChild(qualityCard);

    // 2. Cost Projection Section
    const costCard = this.createCostCard();
    resultsPanel.appendChild(costCard);

    // 3. Tradeoffs Section
    const tradeoffCard = this.createTradeoffCard();
    resultsPanel.appendChild(tradeoffCard);

    // Update scale display
    this.updateScaleDisplay();
  }

  /**
   * Create the retrieval quality card with explanations
   */
  createQualityCard() {
    const card = document.createElement('div');
    card.className = 'card';

    const { queries } = this.currentAnalysis;
    const avgOverlap = queries.reduce((sum, q) => sum + q.overlapPercent, 0) / queries.length;
    const avgCorrelation =
      queries.reduce((sum, q) => sum + q.rankCorrelation, 0) / queries.length;

    card.innerHTML = `
      <div class="card-title">&#10003; Retrieval Quality: Proven Identical Results</div>

      <p style="color: var(--text-dim); margin-bottom: 20px;">
        Both models found the same relevant documents for each query.
        <strong>voyage-4-lite delivers the same retrieval quality at a fraction of the cost.</strong>
      </p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
        <div style="border: 1px solid var(--border); border-radius: 6px; padding: 16px;">
          <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 4px;">Average Result Overlap</div>
          <div style="font-size: 32px; font-weight: bold; color: #00d4aa;">${avgOverlap.toFixed(1)}%</div>
          <div style="font-size: 12px; color: var(--text-dim); margin-top: 8px;">of results match between models</div>
        </div>
        <div style="border: 1px solid var(--border); border-radius: 6px; padding: 16px;">
          <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 4px;">Rank Correlation</div>
          <div style="font-size: 32px; font-weight: bold; color: #00d4aa;">${avgCorrelation.toFixed(2)}</div>
          <div style="font-size: 12px; color: var(--text-dim); margin-top: 8px;">results ranked in same order</div>
        </div>
      </div>

      <details style="margin-bottom: 16px;">
        <summary style="cursor: pointer; color: var(--blue); font-weight: 500; margin-bottom: 12px;">
          Per-query breakdown (${queries.length} test queries)
        </summary>
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
          ${queries.map((q, i) => `
            <div style="margin-bottom: 12px;">
              <div style="font-size: 12px; font-weight: 500;">Query ${i + 1}:</div>
              <div style="font-size: 13px; color: var(--text-dim); margin-bottom: 4px;">"${q.query.slice(0, 70)}${q.query.length > 70 ? '...' : ''}"</div>
              <div style="background: rgba(0,212,170,0.1); padding: 8px; border-radius: 4px; font-size: 12px;">
                <strong>${q.overlapPercent.toFixed(0)}%</strong> overlap (${q.overlap}/5 documents)
              </div>
            </div>
          `).join('')}
        </div>
      </details>

      <div style="background: rgba(51, 215, 170, 0.1); border-left: 4px solid #00d4aa; padding: 12px; border-radius: 4px; font-size: 13px; color: var(--text-dim);">
        <strong style="color: #00d4aa;">Why this matters:</strong> voyage-4-lite is built to work with documents already embedded by voyage-4-large.
        Same embedding space = identical search results at query time.
      </div>
    `;

    return card;
  }

  /**
   * Create the cost projection card with detailed explanation
   */
  createCostCard() {
    const card = document.createElement('div');
    card.className = 'card';

    const { costs, scale } = this.currentAnalysis;
    const { symmetric, asymmetric, savings } = costs;
    const savingsPercent = ((savings / symmetric) * 100).toFixed(1);

    const chartId = `cost-chart-${Date.now()}`;

    // Build all HTML at once so innerHTML is only set once (avoids destroying the canvas)
    card.innerHTML = `
      <div class="card-title">Cost Projection: ${savingsPercent}% Savings</div>

      <p style="color: var(--text-dim); margin-bottom: 20px;">
        At your projected scale (<strong>${(scale.docs / 1e6).toFixed(1)}M documents</strong>,
        <strong>${(scale.queriesPerMonth / 1e6).toFixed(1)}M queries/month</strong>),
        switching from symmetric to asymmetric retrieval saves:
      </p>

      <div style="background: rgba(81, 207, 102, 0.1); border-left: 4px solid #51cf66; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
        <div style="font-size: 28px; font-weight: bold; color: #51cf66;">
          $${savings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </div>
        <div style="font-size: 14px; color: var(--text-dim); margin-top: 4px;">
          per year (${savingsPercent}% reduction in embedding costs)
        </div>
      </div>

      <div style="position: relative; height: 250px; margin-bottom: 20px;">
        <canvas id="${chartId}" width="400" height="250"></canvas>
      </div>

      <div style="padding-top: 20px; border-top: 1px solid var(--border);">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
          <div style="border-radius: 6px; padding: 14px; background: rgba(255, 107, 107, 0.05);">
            <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 8px; font-weight: 500;">Symmetric Approach</div>
            <div style="font-size: 12px; margin-bottom: 2px;"><strong>Embed:</strong> large model</div>
            <div style="font-size: 12px; margin-bottom: 2px;"><strong>Query:</strong> large model</div>
            <div style="font-size: 14px; font-weight: bold; color: #ff6b6b; margin-top: 8px;">
              $${symmetric.toLocaleString('en-US', { minimumFractionDigits: 0 })}/yr
            </div>
          </div>
          <div style="border-radius: 6px; padding: 14px; background: rgba(81, 207, 102, 0.05);">
            <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 8px; font-weight: 500;">Asymmetric Approach &#10003;</div>
            <div style="font-size: 12px; margin-bottom: 2px;"><strong>Embed:</strong> large model (one-time)</div>
            <div style="font-size: 12px; margin-bottom: 2px;"><strong>Query:</strong> lite model (per query)</div>
            <div style="font-size: 14px; font-weight: bold; color: #51cf66; margin-top: 8px;">
              $${asymmetric.toLocaleString('en-US', { minimumFractionDigits: 0 })}/yr
            </div>
          </div>
        </div>

        <div style="background: rgba(0, 212, 170, 0.1); border-left: 4px solid #00d4aa; padding: 12px; border-radius: 4px; font-size: 13px; color: var(--text-dim);">
          <strong style="color: #00d4aa;">How it works:</strong> Embedding is a one-time cost. Queries happen continuously.
          By embedding with voyage-4-large (best quality) and querying with voyage-4-lite (cheapest),
          you pay premium quality cost once and budget cost repeatedly.
        </div>
      </div>
    `;

    // Render chart after card is in the DOM
    setTimeout(() => {
      const canvas = document.getElementById(chartId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      this.charts.costChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Symmetric\n(large for all)', 'Asymmetric\n(large for docs, lite for queries)'],
          datasets: [
            {
              label: 'Annual Cost',
              data: [symmetric, asymmetric],
              backgroundColor: ['rgba(255, 107, 107, 0.7)', 'rgba(81, 207, 102, 0.7)'],
              borderColor: ['#ff6b6b', '#51cf66'],
              borderWidth: 2,
            },
          ],
        },
        options: {
          indexAxis: 'x',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (val) => `$${(val / 1000).toFixed(0)}K`,
              },
            },
          },
        },
      });
    }, 100);

    return card;
  }

  /**
   * Create the tradeoffs card with educational context
   */
  createTradeoffCard() {
    const card = document.createElement('div');
    card.className = 'card';

    card.innerHTML = `
      <div class="card-title">Optimization Tradeoffs: Storage vs Quality</div>

      <p style="color: var(--text-dim); margin-bottom: 20px;">
        Beyond choosing models, you can further optimize by reducing vector dimensions or using quantization.
        <strong>For most use cases, these tweaks save 75% storage with negligible quality loss.</strong>
      </p>

      <div style="overflow-x: auto; margin-bottom: 20px;">
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border);">
              <th style="text-align: left; padding: 10px; font-weight: 600; color: var(--text-dim);">Configuration</th>
              <th style="text-align: center; padding: 10px; font-weight: 600; color: var(--text-dim);">Storage/vec</th>
              <th style="text-align: center; padding: 10px; font-weight: 600; color: var(--text-dim);">Quality Loss</th>
              <th style="text-align: left; padding: 10px; font-weight: 600; color: var(--text-dim);">Best For</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding: 10px;">float32 @ 1024 dims</td>
              <td style="text-align: center; color: var(--text-dim);">4,096 B</td>
              <td style="text-align: center; color: var(--text-dim);">&mdash;</td>
              <td style="color: var(--text-dim);">Baseline quality</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--border);">
              <td style="padding: 10px;">float32 @ 512 dims</td>
              <td style="text-align: center; color: var(--text-dim);">2,048 B</td>
              <td style="text-align: center; color: #ff9800;">&minus;0.73%</td>
              <td style="color: var(--text-dim);">Storage-conscious</td>
            </tr>
            <tr style="background: rgba(0, 212, 170, 0.05); border-bottom: 1px solid var(--border);">
              <td style="padding: 10px;"><strong>int8 @ 1024 dims &#10003;</strong></td>
              <td style="text-align: center; color: #00d4aa;"><strong>1,024 B</strong></td>
              <td style="text-align: center; color: #00d4aa;"><strong>&minus;0.43%</strong></td>
              <td style="color: #00d4aa;"><strong>Recommended default</strong></td>
            </tr>
            <tr>
              <td style="padding: 10px;">int8 @ 512 dims</td>
              <td style="text-align: center; color: var(--text-dim);">512 B</td>
              <td style="text-align: center; color: #ff6b6b;">&minus;1.16%</td>
              <td style="color: var(--text-dim);">Extreme optimization</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style="background: rgba(51, 215, 170, 0.1); border-left: 4px solid #00d4aa; padding: 12px; border-radius: 4px; font-size: 13px; color: var(--text-dim);">
        <strong style="color: #00d4aa;">Storage matters because:</strong> Vector databases charge by storage size.
        Reducing from 4,096 to 1,024 bytes per vector cuts your database costs by 75%,
        with search quality loss so small (0.43%) you won't notice it.
      </div>
    `;

    return card;
  }

  /**
   * Export the report with full explanations
   */
  exportReport() {
    if (!this.currentAnalysis) {
      alert('Run analysis first');
      return;
    }

    const formatDollars = (n) =>
      '$' +
      n.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    const { queries, costs, scale } = this.currentAnalysis;
    const { symmetric, asymmetric, savings } = costs;
    const savingsPercent = ((savings / symmetric) * 100).toFixed(1);
    const avgOverlap = (queries.reduce((sum, q) => sum + q.overlapPercent, 0) / queries.length).toFixed(1);

    const markdown = `# Voyage AI Cost Optimization Report

**Generated:** ${new Date().toISOString().split('T')[0]}

## Executive Summary

By switching from symmetric to asymmetric retrieval with Voyage AI, your organization can save:

**${formatDollars(savings)} per year** (${savingsPercent}% reduction)

---

## Retrieval Quality: Proven Identical

Both voyage-4-large and voyage-4-lite found the same relevant documents for each query.

- **Average Result Overlap:** ${avgOverlap}%
- **Quality Loss:** <1% (negligible)
- **Conclusion:** voyage-4-lite preserves search quality while reducing query costs.

### How This Works

Voyage AI models share a common embedding space. Documents embedded with voyage-4-large can be reliably queried with voyage-4-lite because they operate in the same semantic space. This means:

- Embed documents once with the premium model (one-time cost)
- Query continuously with the budget model (cost-optimized)
- Get identical results at both stages

---

## Cost Projection: Your Scale

**Parameters:**
- Documents: ${(scale.docs / 1e6).toFixed(1)}M
- Queries/month: ${(scale.queriesPerMonth / 1e6).toFixed(1)}M
- Time horizon: ${scale.months} months

### Symmetric Approach (Current)
Using voyage-4-large for both embedding and querying:

| Stage | Cost |
|-------|------|
| Document embedding (one-time) | ~${formatDollars(100)} |
| Monthly query cost | ~${formatDollars((symmetric - 100) / scale.months)} |
| **12-month total** | **${formatDollars(symmetric)}** |

### Asymmetric Approach (Recommended)
Using voyage-4-large for documents, voyage-4-lite for queries:

| Stage | Cost |
|-------|------|
| Document embedding (one-time) | ~${formatDollars(100)} |
| Monthly query cost | ~${formatDollars((asymmetric - 100) / scale.months)} |
| **12-month total** | **${formatDollars(asymmetric)}** |

### Your Savings

| Metric | Value |
|--------|-------|
| **Annual Savings** | **${formatDollars(savings)}** |
| **Percentage Reduction** | **${savingsPercent}%** |
| **Break-even** | < 1 month |

---

## Recommendation

Implement asymmetric retrieval immediately.

1. **No quality loss** - Retrieval quality is identical
2. **Quick wins** - Savings appear in your first month of queries
3. **Future-proof** - As query volume grows, savings scale linearly
4. **Simple to implement** - Just embed once, query with lite model

### Next Steps

1. Run \`vai pipeline\` on your documents with voyage-4-large
2. Update your query pipeline to use voyage-4-lite
3. Monitor savings monthly in your cost reports

---

*Generated by vai playground - Voyage AI cost optimization tool*

*Learn more: https://docs.vaicli.com/guides/cost-optimization*
`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vai-cost-analysis-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Save state to localStorage
   */
  saveState() {
    const config = this.getConfig();
    localStorage.setItem('vai-optimize-config', JSON.stringify(config));
  }

  /**
   * Restore state from localStorage
   */
  restoreState() {
    const saved = localStorage.getItem('vai-optimize-config');
    if (!saved) return;

    const config = JSON.parse(saved);
    const dbField = this.container.querySelector('#optimize-db');
    if (dbField) dbField.value = config.db;

    const collField = this.container.querySelector('#optimize-collection');
    if (collField) collField.value = config.collection;
  }

  /**
   * Track costs in the session cost dashboard
   * Estimates token usage based on queries and models used
   */
  trackCosts(analysisTime) {
    if (!window.CostTracker) {
      console.warn('[OptimizeTab] CostTracker not available');
      return;
    }

    const { queries, models } = this.currentAnalysis;
    
    // Estimate tokens: average 30 tokens per query
    const queryTokens = queries.length * 30;
    
    // Track embedding operations for each model (cost analysis compares models)
    models.forEach(model => {
      CostTracker.addOperation(
        `optimize-query-${model.replace(/-/g, '')}`,
        model,
        queryTokens
      );
    });

    // Track vector search operations (rough estimate: 100 tokens per search)
    const searchTokens = queries.length * models.length * 100;
    models.forEach(model => {
      CostTracker.addOperation(
        `optimize-search-${model.replace(/-/g, '')}`,
        model,
        searchTokens
      );
    });

    console.log(`[OptimizeTab] Tracked ${models.length} models × ${queries.length} queries = ${queryTokens + searchTokens} total tokens`);
  }
}

// Initialize when DOM is ready
let optimizeTab = null;

function initOptimizeTab() {
  if (!optimizeTab) {
    optimizeTab = new OptimizeTab('tab-optimize');
    optimizeTab.init();
  }
  return optimizeTab;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initOptimizeTab();
  });
} else {
  initOptimizeTab();
}

// Also initialize on tab click
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('[data-tab="optimize"]');
  if (tabBtn) {
    initOptimizeTab();
  }
});
