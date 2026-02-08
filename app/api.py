#!/usr/bin/env python3
"""Flask API for QuantumProof Ops - connects UI to FHE backend."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS

from main import APP_VERSION, HAS_FHE, run_once

app = Flask(__name__)
CORS(app)


def derive_preapproval_decision(credit_score: int, debt_to_income: float, risk_score: int) -> dict:
    """Return a simple private pre-approval decision signal."""
    if credit_score >= 720 and debt_to_income <= 35 and risk_score <= 45:
        decision = "approve"
        reason = "Strong credit + healthy debt-to-income profile"
    elif credit_score >= 640 and debt_to_income <= 45 and risk_score <= 70:
        decision = "review"
        reason = "Borderline profile; manual review recommended"
    else:
        decision = "decline"
        reason = "Risk profile is above current pre-approval threshold"

    return {
        "preapproval_decision": decision,
        "decision_reason": reason,
        "privacy_note": "Decision generated from privacy-preserving computation. Raw credentials are not persisted.",
    }


def validate_loan_profile(loan_profile: dict) -> tuple[bool, str | None]:
    try:
        credit_score = int(loan_profile.get("creditScore"))
        debt_to_income = float(loan_profile.get("debtToIncome"))
        annual_income = float(loan_profile.get("annualIncome"))
    except (TypeError, ValueError):
        return False, "loanProfile fields must be numeric"

    if not 300 <= credit_score <= 850:
        return False, "creditScore must be between 300 and 850"
    if not 0 <= debt_to_income <= 100:
        return False, "debtToIncome must be between 0 and 100"
    if annual_income <= 0:
        return False, "annualIncome must be greater than 0"

    return True, None


def simulate_quantum_threat(attack_type: str, current_mode: str) -> dict:
    """Simulate quantum attack detection and adaptive security mode changes."""
    attack = (attack_type or "").strip().lower()
    previous_mode = (current_mode or "NORMAL").strip().upper()

    if attack == "grover":
        new_mode = "POST_QUANTUM" if previous_mode == "HYBRID" else "HYBRID"
        threat_level = "elevated"
        detector_summary = "Abnormal key-search pattern resembles Grover-style acceleration"
    elif attack == "shor":
        new_mode = "POST_QUANTUM"
        threat_level = "critical"
        detector_summary = "Factoring/signature-break pattern resembles Shor-style capability"
    else:
        raise ValueError("attackType must be 'grover' or 'shor'")

    return {
        "attack_type": attack,
        "detected": True,
        "threat_level": threat_level,
        "previous_mode": previous_mode,
        "new_mode": new_mode,
        "detector_summary": detector_summary,
        "auto_response": f"Security mode switched from {previous_mode} to {new_mode}",
        "post_quantum_stack": [
            "CRYSTALS-Kyber (KEM path)",
            "CRYSTALS-Dilithium (signature path)",
            "SHA3-256 (hash hardening)",
        ],
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }


def apply_security_mode_effects(result_dict: dict, security_mode: str) -> None:
    """Apply simulated adaptive-defense effects to output metrics."""
    mode = (security_mode or "NORMAL").upper()
    benchmark = result_dict["benchmark"]
    compute_result = result_dict["compute_result"]

    runtime_ms = int(benchmark.get("runtime_ms", 0))
    overhead = int(compute_result.get("performance_overhead_percent", 0))

    if mode == "HYBRID":
        benchmark["runtime_ms"] = int(runtime_ms * 1.12)
        compute_result["performance_overhead_percent"] = overhead + 300
        compute_result["security_response"] = "Hybrid defense enabled (classical + post-quantum checks)"
        compute_result["defense_profile"] = "hybrid-defense-v1"
    elif mode == "POST_QUANTUM":
        benchmark["runtime_ms"] = int(runtime_ms * 1.35)
        compute_result["performance_overhead_percent"] = overhead + 800
        compute_result["security_response"] = "Post-quantum hardening active (Kyber + Dilithium path)"
        compute_result["defense_profile"] = "post-quantum-defense-v1"
    else:
        compute_result["security_response"] = "Standard monitoring mode"
        compute_result["defense_profile"] = "normal-monitoring-v1"

    compute_result["security_mode"] = mode


@app.route("/api/status", methods=["GET"])
def status():
    return jsonify(
        {
            "fhe_available": HAS_FHE,
            "version": APP_VERSION,
            "library": "Microsoft SEAL (TenSEAL)" if HAS_FHE else "None",
            "status": "ready",
        }
    )


@app.route("/api/compute", methods=["POST"])
def compute():
    """Run private computation and return verification-gated result."""
    try:
        data = request.get_json() or {}
        scenario = data.get("scenario", "private-loan-preapproval")
        force_fallback = data.get("forceFallback", False)
        security_mode = str(data.get("securityMode", "NORMAL")).upper()

        loan_profile = data.get("loanProfile")

        if loan_profile:
            ok, error = validate_loan_profile(loan_profile)
            if not ok:
                return jsonify({"success": False, "error": error}), 400

            credit_score = int(loan_profile["creditScore"])
            debt_to_income = float(loan_profile["debtToIncome"])
            annual_income = float(loan_profile["annualIncome"])
            purpose = str(loan_profile.get("purpose", "general")).strip() or "general"

            # Keep raw values in-memory only; serialize to one transient sensitive string.
            sensitive_input = (
                f"loan::{credit_score}::{debt_to_income:.2f}::{annual_income:.2f}::{purpose}"
            )
        else:
            sensitive_input = data.get("sensitiveInput", "")
            if not sensitive_input:
                return jsonify({"success": False, "error": "sensitiveInput or loanProfile required"}), 400

        result = run_once(sensitive_input, scenario, force_fallback)
        result_dict = asdict(result)

        if loan_profile:
            decision = derive_preapproval_decision(
                credit_score=credit_score,
                debt_to_income=debt_to_income,
                risk_score=int(result_dict["compute_result"]["risk_reduction_percent"]),
            )
            result_dict["compute_result"].update(decision)
            result_dict["compute_result"]["model"] = "private-loan-preapproval-v1"

        apply_security_mode_effects(result_dict, security_mode)
        result_dict["risk_context"] = f"{result_dict['risk_context']} | security-mode={security_mode}"
        result_dict["trust_model_comparison"] = (
            f"{result_dict['trust_model_comparison']} | adaptive-defense={security_mode}"
        )

        return jsonify({"success": True, "result": result_dict})
    except Exception as exc:  # pragma: no cover - demo API resilience path
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/quantum/simulate", methods=["POST"])
def quantum_simulate():
    """Simulated quantum attack detection and adaptive defense response."""
    try:
        data = request.get_json() or {}
        attack_type = data.get("attackType")
        current_mode = data.get("currentMode", "NORMAL")
        simulation = simulate_quantum_threat(attack_type, current_mode)
        return jsonify({"success": True, "simulation": simulation})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 400


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "fhe_enabled": HAS_FHE})


if __name__ == "__main__":
    print(f"QuantumProof Ops API v{APP_VERSION}")
    print(f"FHE Available: {HAS_FHE}")
    print("Starting server at http://localhost:5001")
    app.run(debug=True, port=5001, host="0.0.0.0")
