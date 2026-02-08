pragma circom 2.1.9;

include "circomlib/circuits/comparators.circom";

// Range-checked private loan signal circuit.
// Private inputs:
//   creditScore: integer score (must be 300..850)
//   debtToIncomeBp: DTI in basis points (must be 0..10000)
// Public output:
//   weightedSignal = creditScore * 100 - debtToIncomeBp * 120

template LoanSignalChecked() {
    signal input creditScore;
    signal input debtToIncomeBp;
    signal output weightedSignal;

    // creditScore >= 300
    component csMin = LessThan(11);
    csMin.in[0] <== creditScore;
    csMin.in[1] <== 300;
    csMin.out === 0;

    // creditScore <= 850 => creditScore < 851
    component csMax = LessThan(11);
    csMax.in[0] <== creditScore;
    csMax.in[1] <== 851;
    csMax.out === 1;

    // debtToIncomeBp <= 10000 => debtToIncomeBp < 10001
    component dtiMax = LessThan(14);
    dtiMax.in[0] <== debtToIncomeBp;
    dtiMax.in[1] <== 10001;
    dtiMax.out === 1;

    weightedSignal <== creditScore * 100 - debtToIncomeBp * 120;
}

component main = LoanSignalChecked();
