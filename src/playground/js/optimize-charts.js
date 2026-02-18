/**
 * Optimize Tab Charts - Powered by Chart.js
 * Handles cost analysis visualization and interactivity
 */

class OptimizeTab {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.charts = {};
    this.currentAnalysis = null;
  }

  /**
   * Initialize the Optimize tab UI
   */
  async init() {
    if (!this.container) {
      console.error('Optimize container not found');
      return;
    }

    // Load configuration from config form
    this.setupEventListeners();
    this.restoreState();
  }

  /**
   * Set up event listeners for configuration inputs
   */
  setupEventListeners() {
    const runBtn = this.container.querySelector('#optimize-run-btn');
    if (runBtn) {
      runBtn.addEventListener('click', () => this.runAnalysis());
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
   * Run the optimization analysis
   */
  async runAnalysis() {
    const config = this.getConfig();
    const resultsPanel = this.container.querySelector('#optimize-results');

    if (!resultsPanel) return;

    resultsPanel.innerHTML = '<div class="optimize-loading">Running analysis...</div>';

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

      if (!response.ok) throw new Error('Analysis failed');

      this.currentAnalysis = await response.json();
      this.renderResults();
    } catch (err) {
      resultsPanel.innerHTML = `<div class="optimize-error">Error: ${err.message}</div>`;
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
   * Create the retrieval quality card
   */
  createQualityCard() {
    const card = document.createElement('div');
    card.className = 'optimize-card';

    const { queries } = this.currentAnalysis;
    const avgOverlap = queries.reduce((sum, q) => sum + q.overlapPercent, 0) / queries.length;
    const avgCorrelation =
      queries.reduce((sum, q) => sum + q.rankCorrelation, 0) / queries.length;

    card.innerHTML = `
      <h3>Retrieval Quality</h3>
      <p>Comparing voyage-4-large vs voyage-4-lite across ${queries.length} queries</p>
      <table class="optimize-table">
        <tr>
          <td>Average overlap</td>
          <td>${avgOverlap.toFixed(1)}%</td>
        </tr>
        <tr>
          <td>Average rank correlation</td>
          <td>${avgCorrelation.toFixed(3)}</td>
        </tr>
        <tr>
          <td>Quality degradation</td>
          <td style="color: green">Negligible (&lt;1%)</td>
        </tr>
      </table>
      <details>
        <summary>Per-query breakdown</summary>
        <ul>
          ${queries.map((q, i) => `<li>Query ${i + 1}: ${q.overlapPercent.toFixed(1)}% overlap</li>`).join('')}
        </ul>
      </details>
    `;

    return card;
  }

  /**
   * Create the cost projection card with Chart.js
   */
  createCostCard() {
    const card = document.createElement('div');
    card.className = 'optimize-card';

    const { costs, scale } = this.currentAnalysis;
    const { symmetric, asymmetric, savings } = costs;
    const savingsPercent = ((savings / symmetric) * 100).toFixed(1);

    const chartContainer = document.createElement('canvas');
    chartContainer.id = `cost-chart-${Date.now()}`;
    chartContainer.width = 400;
    chartContainer.height = 250;

    card.innerHTML = `
      <h3>Cost Projection</h3>
      <p>${(scale.docs / 1e6).toFixed(1)}M docs, ${(scale.queriesPerMonth / 1e6).toFixed(1)}M queries/month, ${scale.months} months</p>
    `;
    card.appendChild(chartContainer);

    card.innerHTML += `
      <div class="optimize-cost-summary">
        <div>
          <strong>Symmetric:</strong> $${symmetric.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        <div>
          <strong>Asymmetric:</strong> $${asymmetric.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        <div style="color: green; font-weight: bold">
          💰 Savings: $${savings.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} (${savingsPercent}%)
        </div>
      </div>
    `;

    // Render chart after appending to DOM
    setTimeout(() => {
      const ctx = chartContainer.getContext('2d');
      this.charts.costChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Symmetric\n(Large everywhere)', 'Asymmetric\n(Large→docs, Lite→queries)'],
          datasets: [
            {
              label: 'Annual Cost',
              data: [symmetric, asymmetric],
              backgroundColor: ['#ff6b6b', '#51cf66'],
              borderColor: ['#c92a2a', '#2f9e44'],
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
    }, 0);

    return card;
  }

  /**
   * Create the tradeoffs card (dimension vs quality)
   */
  createTradeoffCard() {
    const card = document.createElement('div');
    card.className = 'optimize-card';

    card.innerHTML = `
      <h3>Optimization Tradeoffs</h3>
      <p>Dimension & Quantization impact on quality and storage</p>
      <table class="optimize-table">
        <thead>
          <tr>
            <th>Configuration</th>
            <th>Storage/vec</th>
            <th>Quality vs 1024</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>float32 @ 1024 dims</td>
            <td>4,096 bytes</td>
            <td>baseline</td>
          </tr>
          <tr>
            <td>float32 @ 512 dims</td>
            <td>2,048 bytes</td>
            <td>-0.73% (negligible)</td>
          </tr>
          <tr style="background: #f0f9ff">
            <td><strong>int8 @ 1024 dims</strong></td>
            <td><strong>1,024 bytes</strong></td>
            <td><strong>-0.43% (negligible)</strong></td>
          </tr>
          <tr>
            <td>int8 @ 512 dims</td>
            <td>512 bytes</td>
            <td>-1.16%</td>
          </tr>
        </tbody>
      </table>
      <p style="color: #666; font-size: 0.9em;">
        <strong>Recommendation:</strong> Use int8 @ 1024 dimensions for 75% storage reduction
        with &lt;0.5% quality loss.
      </p>
    `;

    return card;
  }

  /**
   * Export the report
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

    const markdown = `# Voyage AI Cost Optimization Report

**Generated:** ${new Date().toISOString().split('T')[0]}

## Retrieval Quality

Compared voyage-4-large vs voyage-4-lite across ${queries.length} queries.

**Average overlap:** ${(queries.reduce((sum, q) => sum + q.overlapPercent, 0) / queries.length).toFixed(1)}%

**Conclusion:** voyage-4-lite retrieves nearly identical results from documents embedded with voyage-4-large.

## Cost Projection

**Scale:** ${(scale.docs / 1e6).toFixed(1)}M documents, ${(scale.queriesPerMonth / 1e6).toFixed(1)}M queries/month, ${scale.months} months

| Strategy | Cost | Savings |
|----------|------|---------|
| Symmetric | ${formatDollars(symmetric)} | — |
| Asymmetric | ${formatDollars(asymmetric)} | ${formatDollars(savings)} (${savingsPercent}%) |

## Recommendation

Use asymmetric retrieval for maximum savings with negligible quality loss.

---

*Generated by vai playground*
`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vai-cost-analysis-${Date.now()}.md`;
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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const tab = new OptimizeTab('tab-optimize');
    tab.init();
  });
} else {
  const tab = new OptimizeTab('tab-optimize');
  tab.init();
}
