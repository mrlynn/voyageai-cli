/**
 * BugReporter Component
 * 
 * Floating bug report button + modal for the Vai desktop app.
 * Captures environment info automatically and submits to vai.mlynn.org/api/bugs
 */

const BUG_API_URL = 'https://vai.mlynn.org/api/bugs';
const GITHUB_ISSUES_URL = 'https://github.com/mrlynn/voyageai-cli/issues/new';

/**
 * Get environment info from Electron
 */
function getEnvironmentInfo() {
  try {
    const remote = window.electronAPI || {};
    return {
      appVersion: remote.appVersion || window.APP_VERSION || 'unknown',
      cliVersion: remote.cliVersion || 'unknown',
      platform: remote.platform || navigator.platform,
      arch: remote.arch || 'unknown',
      electronVersion: remote.electronVersion || process.versions?.electron || 'unknown',
      nodeVersion: remote.nodeVersion || process.versions?.node || 'unknown',
    };
  } catch {
    return {
      appVersion: 'unknown',
      platform: navigator.platform,
    };
  }
}

/**
 * Generate GitHub issue URL with pre-filled template
 */
function generateGitHubUrl(bug) {
  const title = encodeURIComponent(`[Bug] ${bug.title}`);
  const env = getEnvironmentInfo();
  
  const body = encodeURIComponent(`## Description
${bug.description}

## Steps to Reproduce
${bug.stepsToReproduce || '1. \n2. \n3. '}

## Expected Behavior


## Actual Behavior


## Environment
- **App Version:** ${env.appVersion}
- **CLI Version:** ${env.cliVersion}
- **Platform:** ${env.platform}
- **Arch:** ${env.arch}
- **Current Screen:** ${bug.currentScreen || 'N/A'}

## Error Details
${bug.errorMessage ? `\`\`\`\n${bug.errorMessage}\n\`\`\`` : 'No error message'}

## Additional Context
Add any other context here.
`);

  return `${GITHUB_ISSUES_URL}?title=${title}&body=${body}&labels=bug`;
}

/**
 * Submit bug report to API
 */
async function submitBugReport(data) {
  const env = getEnvironmentInfo();
  
  const response = await fetch(BUG_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...data,
      source: 'desktop-app',
      ...env,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * BugReporter React Component
 */
function BugReporter({ currentScreen, onClose, isOpen, recentError }) {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [steps, setSteps] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [includeError, setIncludeError] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [result, setResult] = React.useState(null);

  // Reset form when opened
  React.useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setSteps('');
      setEmail('');
      setSubmitted(false);
      setError(null);
      setResult(null);
    }
  }, [isOpen]);

  const handleSubmit = async (alsoOpenGithub = false) => {
    if (!title.trim() || !description.trim()) {
      setError('Please provide a title and description');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const bugData = {
        title: title.trim(),
        description: description.trim(),
        stepsToReproduce: steps.trim() || null,
        email: email.trim() || null,
        currentScreen,
        errorMessage: includeError && recentError ? recentError.message : null,
        errorStack: includeError && recentError ? recentError.stack : null,
      };

      const res = await submitBugReport(bugData);
      setResult(res);
      setSubmitted(true);

      if (alsoOpenGithub) {
        window.open(generateGitHubUrl(bugData), '_blank');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenGithub = () => {
    const bugData = {
      title: title.trim() || 'Bug Report',
      description: description.trim(),
      stepsToReproduce: steps.trim(),
      currentScreen,
      errorMessage: includeError && recentError ? recentError.message : null,
    };
    window.open(generateGitHubUrl(bugData), '_blank');
  };

  if (!isOpen) return null;

  const env = getEnvironmentInfo();

  return (
    <div className="bug-reporter-overlay" onClick={onClose}>
      <div className="bug-reporter-modal" onClick={e => e.stopPropagation()}>
        <div className="bug-reporter-header">
          <span className="bug-icon">🐛</span>
          <h2>Report a Bug</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {submitted ? (
          <div className="bug-reporter-success">
            <div className="success-icon">✓</div>
            <h3>Bug Reported!</h3>
            <p>Bug ID: <code>{result?.bugId}</code></p>
            <p>Thank you for helping improve Vai!</p>
            <div className="success-actions">
              <button onClick={onClose}>Close</button>
              {result?.githubIssueUrl && (
                <button onClick={() => window.open(result.githubIssueUrl, '_blank')}>
                  Also Create GitHub Issue
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bug-reporter-form">
            <div className="form-group">
              <label>Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Brief description of the bug"
                maxLength={200}
              />
            </div>

            <div className="form-group">
              <label>Description *</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What happened? What did you expect?"
                rows={4}
                maxLength={5000}
              />
            </div>

            <div className="form-group">
              <label>Steps to Reproduce</label>
              <textarea
                value={steps}
                onChange={e => setSteps(e.target.value)}
                placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
                rows={3}
                maxLength={2000}
              />
            </div>

            <div className="form-group">
              <label>Email (optional, for follow-up)</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>

            {recentError && (
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={includeError}
                    onChange={e => setIncludeError(e.target.checked)}
                  />
                  Include recent error: <code>{recentError.message?.slice(0, 50)}...</code>
                </label>
              </div>
            )}

            <div className="environment-info">
              <span>📋 Environment will be included:</span>
              <code>
                {env.platform} • App v{env.appVersion} • {currentScreen || 'Unknown screen'}
              </code>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="form-actions">
              <button
                className="submit-btn primary"
                onClick={() => handleSubmit(false)}
                disabled={submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Bug Report'}
              </button>
              <button
                className="submit-btn secondary"
                onClick={handleOpenGithub}
                disabled={submitting}
              >
                Open GitHub Issue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Floating Bug Button Component
 */
function BugButton({ onClick }) {
  return (
    <button
      className="bug-floating-button"
      onClick={onClick}
      title="Report a Bug"
    >
      🐛
    </button>
  );
}

// Export for use in Electron renderer
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BugReporter, BugButton };
}

// Also make available globally for script tag usage
if (typeof window !== 'undefined') {
  window.BugReporter = BugReporter;
  window.BugButton = BugButton;
}
