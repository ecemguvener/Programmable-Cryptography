import { useMemo, useState, useEffect } from 'react';
import { downloadFile, runQuantumProof, toMarkdown, checkStatus, simulateQuantumAttack } from './lib/quantumProof';

function deriveDecision(creditScore, debtToIncome, riskScore) {
  if (creditScore >= 720 && debtToIncome <= 35 && riskScore <= 45) {
    return {
      status: 'ACCEPTED ✅',
      reason: 'Strong profile and low computed risk',
    };
  }
  if (creditScore >= 640 && debtToIncome <= 45 && riskScore <= 70) {
    return {
      status: 'MANUAL REVIEW ⚠️',
      reason: 'Borderline profile; needs additional checks',
    };
  }
  return {
    status: 'NOT ACCEPTED ❌',
    reason: 'Risk profile exceeds pre-approval threshold',
  };
}

export default function App() {
  const [creditScore, setCreditScore] = useState(720);
  const [debtToIncome, setDebtToIncome] = useState(32);
  const [annualIncome, setAnnualIncome] = useState(95000);
  const [purpose, setPurpose] = useState('home-loan');

  const [fallback, setFallback] = useState(false);
  const [report, setReport] = useState(null);
  const [lastProfile, setLastProfile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState(null);

  const [securityMode, setSecurityMode] = useState('NORMAL');
  const [quantumEvent, setQuantumEvent] = useState(null);
  const [quantumLoading, setQuantumLoading] = useState(false);

  useEffect(() => {
    checkStatus()
      .then((status) => setBackendStatus(status))
      .catch(() => setError('Backend not available. Start the API server first!'));
  }, []);

  const status = useMemo(() => {
    if (error) return 'Error';
    if (loading) return 'Computing...';
    if (!report) return 'Ready';
    return report.proof.verificationResult ? 'Verified ✅' : 'Failed ❌';
  }, [error, loading, report]);

  const bankDecision = useMemo(() => {
    if (!report || !lastProfile) return null;

    if (report.computeResult.preapprovalDecision) {
      return {
        status: `${report.computeResult.preapprovalDecision.toUpperCase()} ${report.computeResult.preapprovalDecision === 'approve' ? '✅' : report.computeResult.preapprovalDecision === 'review' ? '⚠️' : '❌'}`,
        reason: report.computeResult.decisionReason || 'Decision returned by backend',
      };
    }

    return deriveDecision(
      lastProfile.creditScore,
      lastProfile.debtToIncome,
      report.computeResult.riskReductionPercent
    );
  }, [report, lastProfile]);

  async function handleRun(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setReport(null);

    const profile = {
      creditScore: Number(creditScore),
      debtToIncome: Number(debtToIncome),
      annualIncome: Number(annualIncome),
      purpose,
    };

    const sensitiveInput = `loan::${profile.creditScore}::${profile.debtToIncome}::${profile.annualIncome}::${profile.purpose}`;

    try {
      const next = await runQuantumProof({
        sensitiveInput,
        scenario: 'private-loan-preapproval',
        forceFallback: fallback,
        loanProfile: profile,
        securityMode,
      });
      setLastProfile(profile);
      setReport(next);
    } catch (err) {
      setReport(null);
      setError(err.message || 'Run failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleQuantumSimulation(attackType) {
    setError('');
    setQuantumLoading(true);

    try {
      const simulation = await simulateQuantumAttack({ attackType, currentMode: securityMode });
      setSecurityMode(simulation.new_mode);
      setQuantumEvent(simulation);

      // Reflect mode transition in already-visible results so user sees immediate linkage.
      setReport((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          computeResult: {
            ...prev.computeResult,
            securityMode: simulation.new_mode,
            securityResponse: simulation.auto_response,
          },
        };
      });
    } catch (err) {
      setError(err.message || 'Quantum simulation failed');
    } finally {
      setQuantumLoading(false);
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
          <h1>🔐 QuantumProof Ops - Real FHE Computation</h1>
          <p className="sub">
            Privacy-preserving computation using <strong>Microsoft SEAL</strong> (FHE) + verifiable computation layer (Circom/SNARK-compatible) + quantum-resistant primitives.
          </p>

          {backendStatus && (
            <div style={{ marginTop: '1rem', padding: '0.5rem', background: backendStatus.fhe_available ? '#0f4' : '#f80', borderRadius: '4px', fontSize: '0.9rem' }}>
              <strong>{backendStatus.fhe_available ? '✅ FHE Available' : '⚠️ FHE Unavailable'}</strong> - {backendStatus.library}
            </div>
          )}
        </header>

        <section className="context-panel">
          <h2>Context: Private Loan Pre-Approval</h2>
          <p>
            Traditional pre-approval asks applicants to hand over sensitive financial credentials. This workflow shows a privacy-preserving alternative.
          </p>
          <ul>
            <li><strong>Bank sees:</strong> decision signal, verification status, proof hash, and runtime metrics.</li>
            <li><strong>Bank does not see:</strong> raw applicant credentials in exported artifacts.</li>
            <li><strong>Trust model:</strong> results are verification-gated, so tampered output should fail verification.</li>
          </ul>
        </section>

        <section className="quantum-panel">
          <h2>Quantum Attack Simulator</h2>
          <p className="quantum-sub">Security mode transitions: NORMAL → HYBRID → POST_QUANTUM</p>
          <div className="quantum-row">
            <span className={`mode-chip mode-${securityMode.toLowerCase()}`}>Mode: {securityMode}</span>
            <button type="button" onClick={() => handleQuantumSimulation('grover')} disabled={quantumLoading || !backendStatus}>
              Simulate Grover Attack
            </button>
            <button type="button" onClick={() => handleQuantumSimulation('shor')} disabled={quantumLoading || !backendStatus}>
              Simulate Shor Attack
            </button>
          </div>

          {quantumEvent && (
            <div className="quantum-result">
              <p><strong>Detection:</strong> {quantumEvent.detector_summary}</p>
              <p><strong>Transition:</strong> {quantumEvent.previous_mode} → {quantumEvent.new_mode}</p>
              <p><strong>Response:</strong> {quantumEvent.auto_response}</p>
              <p><strong>PQ Stack:</strong> {quantumEvent.post_quantum_stack.join(', ')}</p>
              <p><strong>Tip:</strong> Rerun computation to apply full mode effect to runtime/overhead.</p>
            </div>
          )}
        </section>

        <section className="layout">
          <form className="panel" onSubmit={handleRun}>
            <h2>Applicant Inputs (Private)</h2>

            <label>
              Credit Score
              <input
                type="number"
                min="300"
                max="850"
                value={creditScore}
                onChange={(e) => setCreditScore(Number(e.target.value))}
                required
              />
            </label>

            <label>
              Debt-to-Income (%)
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={debtToIncome}
                onChange={(e) => setDebtToIncome(Number(e.target.value))}
                required
              />
            </label>

            <label>
              Annual Income (USD)
              <input
                type="number"
                min="1"
                step="1"
                value={annualIncome}
                onChange={(e) => setAnnualIncome(Number(e.target.value))}
                required
              />
            </label>

            <label>
              Loan Purpose
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                required
                placeholder="home-loan"
              />
            </label>

            <label className="check-row">
              <input type="checkbox" checked={fallback} onChange={(e) => setFallback(e.target.checked)} />
              Disable FHE (fallback mode)
            </label>

            <button type="submit" disabled={loading || !backendStatus}>
              {loading ? 'Computing...' : 'Run FHE Workflow'}
            </button>
          </form>

          <aside className="panel result">
            <h2>Results</h2>
            <div className={`status ${error ? 'error' : report ? 'ok' : ''}`}>{status}</div>

            {error && <p className="error-text">{error}</p>}

            {loading && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div className="spinner"></div>
                <p>Running real FHE computation...</p>
              </div>
            )}

            {report && (
              <>
                {bankDecision && (
                  <>
                    <h3 style={{ marginTop: '1rem' }}>Bank Pre-Approval</h3>
                    <dl>
                      <dt>Status</dt>
                      <dd>{bankDecision.status}</dd>

                      <dt>Reason</dt>
                      <dd>{bankDecision.reason}</dd>
                    </dl>
                  </>
                )}

                <h3 style={{ marginTop: '1rem' }}>Computation Results</h3>
                <dl>
                  <dt>Run ID</dt>
                  <dd>{report.runId}</dd>

                  <dt>FHE Enabled</dt>
                  <dd>{report.computeResult.fheEnabled ? '✅ Yes' : '❌ No'}</dd>

                  <dt>FHE Scheme</dt>
                  <dd>{report.computeResult.fheScheme}</dd>

                  <dt>Verification</dt>
                  <dd>{report.proof.verificationResult ? '✅ Verified' : '❌ Failed'}</dd>

                  <dt>Security Mode</dt>
                  <dd>{report.computeResult.securityMode}</dd>

                  <dt>Defense Profile</dt>
                  <dd>{report.computeResult.defenseProfile}</dd>

                  <dt>Security Response</dt>
                  <dd>{report.computeResult.securityResponse}</dd>

                  <dt>Total Runtime</dt>
                  <dd>{report.benchmark.runtimeMs} ms</dd>

                  <dt>Encryption Time</dt>
                  <dd>{report.benchmark.encryptionTimeMs} ms</dd>

                  <dt>Computation Time</dt>
                  <dd>{report.benchmark.computationTimeMs} ms</dd>

                  <dt>Risk Score</dt>
                  <dd>{report.computeResult.riskReductionPercent}%</dd>

                  <dt>FHE Overhead</dt>
                  <dd>{report.computeResult.performanceOverheadPercent}%</dd>
                </dl>

                <h3 style={{ marginTop: '1.5rem' }}>Crypto Primitives Used</h3>
                <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                  {report.proof.cryptoPrimitivesUsed.map((p, i) => (
                    <li key={i} style={{ fontSize: '0.9rem' }}>{p}</li>
                  ))}
                </ul>

                <div className="actions">
                  <button type="button" onClick={exportJson}>
                    Export JSON
                  </button>
                  <button type="button" onClick={exportMd}>
                    Export Markdown
                  </button>
                </div>
              </>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}
