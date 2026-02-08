#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ZK_DIR="$ROOT_DIR/zk"
CIRCUIT="$ZK_DIR/circuits/loan_signal.circom"
BUILD_DIR="$ZK_DIR/build"
ARTIFACTS_DIR="$ZK_DIR/artifacts"

mkdir -p "$BUILD_DIR" "$ARTIFACTS_DIR"

CIRCOM_BIN=""
if command -v circom >/dev/null 2>&1; then
  CIRCOM_BIN="circom"
elif command -v circom2 >/dev/null 2>&1; then
  CIRCOM_BIN="circom2"
else
  echo "circom compiler not found. Install first: npm install -g circom2"
  exit 1
fi

if ! command -v snarkjs >/dev/null 2>&1; then
  echo "snarkjs not found. Install first: npm install -g snarkjs"
  exit 1
fi

if [ ! -d "$ROOT_DIR/node_modules/circomlib/circuits" ]; then
  echo "Installing circomlib locally..."
  (cd "$ROOT_DIR" && npm install circomlib)
fi

echo "[1/8] Compiling circuit with $CIRCOM_BIN"
"$CIRCOM_BIN" "$CIRCUIT" --r1cs --wasm --sym -l "$ROOT_DIR/node_modules" -o "$BUILD_DIR"

echo "[2/8] Powers of Tau"
snarkjs powersoftau new bn128 12 "$BUILD_DIR/pot12_0000.ptau" -v

echo "[3/8] Contribute entropy"
snarkjs powersoftau contribute "$BUILD_DIR/pot12_0000.ptau" "$BUILD_DIR/pot12_0001.ptau" --name="First contribution" -v -e="quantumproof-ops"

echo "[4/8] Prepare phase2"
snarkjs powersoftau prepare phase2 "$BUILD_DIR/pot12_0001.ptau" "$BUILD_DIR/pot12_final.ptau" -v

echo "[5/8] Groth16 setup"
snarkjs groth16 setup "$BUILD_DIR/loan_signal.r1cs" "$BUILD_DIR/pot12_final.ptau" "$BUILD_DIR/loan_signal_0000.zkey"

echo "[6/8] zkey contribution"
snarkjs zkey contribute "$BUILD_DIR/loan_signal_0000.zkey" "$BUILD_DIR/loan_signal_final.zkey" --name="1st Contributor" -v -e="quantumproof-ops-final"

echo "[7/8] Export verification key"
snarkjs zkey export verificationkey "$BUILD_DIR/loan_signal_final.zkey" "$BUILD_DIR/verification_key.json"

echo "[8/8] Copy artifacts"
mkdir -p "$ARTIFACTS_DIR/loan_signal_js"
cp -f "$BUILD_DIR/loan_signal_js/loan_signal.wasm" "$ARTIFACTS_DIR/loan_signal_js/loan_signal.wasm"
cp -f "$BUILD_DIR/loan_signal_final.zkey" "$ARTIFACTS_DIR/loan_signal_final.zkey"
cp -f "$BUILD_DIR/verification_key.json" "$ARTIFACTS_DIR/verification_key.json"

echo "Done: artifacts available in $ARTIFACTS_DIR"
