import { useMemo, useState, useEffect } from 'react';
import { downloadFile, runQuantumProof, toMarkdown, checkStatus } from './lib/quantumProof';

export default function App() {
  const [creditScore, setCreditScore] = useState(720);
  const [debtToIncome, setDebtToIncome] = useState(32);
  const [annualIncome, setAnnualIncome] = useState(95000);
  const [purpose, setPurpose] = useState('home-loan');

  const [fallback, setFallback] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState(null);

  useEffect(() => {
    checkStatus()
      .then((status) => setBackendStatus(status))
      .catch(() => setError('Backend not available. Start API: python3 app/api.py'));
  }, []);

  const status = useMemo(() => {
    if (error) return 'Error';
    if (loading) return 'Computing...';
    if (!report) return 'Ready';
    return report.proof.verificationResult ? 'Verified ✅' : 'Failed ❌';
  }, [error, loading, report]);

  async function handleRun(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setReport(null);

    try {
      const next = await runQuantumProof({
        scenario: 'private-loan-preapproval',
        forceFallback: fallback,
        loanProfile: {
          creditScore,
          debtToIncome,
          annualIncome,
          purpose,
        },
      });
      setReport(next);
    } catch (err) {
      setReport(null);
      setError(err.message || 'Run failed');
    } finally {
      setLoading(false);
    }
  }

  function exportJson() {
    if (!report) return;
    downloadFile(`${report.runId}.json`, JSON.stringify(report, null, 2), 'application/json');
  }

  function exportMd() {
    if (!report) return;
    downloadFile(`${report.runId}.md`, toMarkdown(report), 'text/markdown');
  }

  return (
    <div className="page">
      <div className="hero-glow" aria-hidden="true" />
      <main className="card">
        <header className="hero">
          <p className="kicker">QuantumProof Ops</p>
          <h1>Private Loan Pre-Approval</h1>
          <p className="sub">
            Bank receives a verified decision signal without seeing raw financial credentials.
          </p>
          {backendStatus && (
            <div style={{ marginTop: '1rem', padding: '0.5rem', background: backendStatus.fhe_available ? '#0f4' : '#f80', borderRadius: '4px', fontSize: '0.9rem' }}>
              <strong>{backendStatus.fhe_available ? '✅ FHE Available' : '⚠️ FHE Unavailable'}</strong> - {backendStatus.library}
            </div>
          )}
        </header>

        <section className="context-panel">
          <h2>Why This Is Useful</h2>
          <p>
            Traditional pre-approval requires sharing sensitive financial credentials with a bank.
            This demo shows a privacy-preserving alternative where the bank receives a decision signal,
            verification proof, and audit metadata without viewing raw applicant inputs.
          </p>
          <ul>
            <li>Applicant data is processed privately during computation.</li>
            <li>Output is verification-gated to reduce tampering risk.</li>
            <li>Exports include proof hash and metrics, not raw credentials.</li>
          </ul>
        </section>

        <section className="layout">
          <form className="panel" onSubmit={handleRun}>
            <h2>Applicant Inputs (Private)</h2>

            <label>
              Credit Score
              <input type="number" min="300" max="850" value={creditScore} onChange={(e) => setCreditScore(Number(e.target.value))} required />
            </label>

            <label>
              Debt-to-Income (%)
              <input type="number" min="0" max="100" step="0.1" value={debtToIncome} onChange={(e) => setDebtToIncome(Number(e.target.value))} required />
            </label>

            <label>
              Annual Income (USD)
              <input type="number" min="1" step="1" value={annualIncome} onChange={(e) => setAnnualIncome(Number(e.target.value))} required />
            </label>

            <label>
              Loan Purpose
              <input value={purpose} onChange={(e) => setPurpose(e.target.value)} required />
            </label>

            <label className="check-row">
              <input type="checkbox" checked={fallback} onChange={(e) => setFallback(e.target.checked)} />
              Fallback mode (disable FHE)
            </label>

            <button type="submit" disabled={loading || !backendStatus}>
              {loading ? 'Computing...' : 'Run Private Pre-Approval'}
            </button>
          </form>

          <aside className="panel result">
            <h2>Decision Output</h2>
            <div className={`status ${error ? 'error' : report ? 'ok' : ''}`}>{status}</div>
            {error && <p className="error-text">{error}</p>}

            {report && (
              <>
                <dl>
                  <dt>Decision</dt>
                  <dd style={{ textTransform: 'uppercase', fontWeight: 700 }}>{report.computeResult.preapprovalDecision || 'n/a'}</dd>

                  <dt>Reason</dt>
                  <dd>{report.computeResult.decisionReason || 'No reason available'}</dd>

                  <dt>Privacy</dt>
                  <dd>{report.computeResult.privacyNote || 'No raw credentials stored in artifacts'}</dd>

                  <dt>Verification</dt>
                  <dd>{report.proof.verificationResult ? '✅ Verified' : '❌ Failed'}</dd>

                  <dt>Runtime</dt>
                  <dd>{report.benchmark.runtimeMs} ms</dd>

                  <dt>Proof Hash</dt>
                  <dd style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{report.proof.proofHash}</dd>
                </dl>

                <div className="actions">
                  <button type="button" onClick={exportJson}>Export JSON</button>
                  <button type="button" onClick={exportMd}>Export Markdown</button>
                </div>
              </>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}
