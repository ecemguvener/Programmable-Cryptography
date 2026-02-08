# Real ZK Setup (Circom + snarkjs)

## Install tools

```bash
brew install circom
npm install -g snarkjs
```

## Generate proving artifacts

```bash
./scripts/setup_real_zk.sh
```

Generated files:

- `zk/artifacts/loan_signal_js/loan_signal.wasm`
- `zk/artifacts/loan_signal_final.zkey`
- `zk/artifacts/verification_key.json`

When these exist and `snarkjs` is in PATH, `app/main.py` automatically uses real Groth16 proofs.
