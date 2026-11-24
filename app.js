(() => {
  "use strict";

  const STORAGE_KEY = "labo_probas_pwa_state_v1";

  const state = {
    view: "home",
    markovTab: "inputs",
    bayesTab: "theory",
    nStates: 4,
    unit: "year",
    mode: "pct",
    horizon: 1,
    matrix: [],
    bayes: {
      n: 60,
      d: 0,
      priorType: "informative",
      targetPdPct: 1.5,
      priorWeight: 40,
      customAlpha: 1,
      customBeta: 49,
      credLevel: 0.95,
    }
  };

  const els = {};

  function cacheDom() {
    els.btnHome = document.getElementById("btn-home");
    els.appTitle = document.getElementById("app-title");
    els.appSubtitle = document.getElementById("app-subtitle");

    els.viewHome = document.getElementById("view-home");
    els.viewMarkov = document.getElementById("view-markov");
    els.viewBayes = document.getElementById("view-bayes");

    els.mkStates = document.getElementById("mk-states");
    els.mkUnit = document.getElementById("mk-unit");
    els.mkMode = document.getElementById("mk-mode");
    els.mkHorizon = document.getElementById("mk-horizon");
    els.mkHorizonLabel = document.getElementById("mk-horizon-label");
    els.mkMatrixWrapper = document.getElementById("mk-matrix-wrapper");
    els.mkValidationPill = document.getElementById("mk-validation-pill");
    els.mkErrorsBox = document.getElementById("mk-errors-box");
    els.mkComputeBtn = document.getElementById("mk-compute-btn");
    els.mkResultsContent = document.getElementById("mk-results-content");
    els.mkTheoryContent = document.getElementById("mk-theory-content");
    els.bayesTheoryContent = document.getElementById("bayes-theory-content");
    els.bayesLabContent = document.getElementById("bayes-lab-content");

    els.presetClean = document.getElementById("mk-preset-clean");
    els.presetZeroDef = document.getElementById("mk-preset-zero-def");
    els.presetInvalidIrw = document.getElementById("mk-preset-invalid-irw");
  }

  function stateLabel(idx, n) {
    if (idx === n - 1) return `D${n}`;
    if (n <= 4) {
      const names = ["AAA", "BBB", "CCC"];
      return names[idx] || `R${idx + 1}`;
    }
    return `R${idx + 1}`;
  }

  function buildCleanMatrix(n, mode) {
    const m = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n - 1; i++) {
      const defProb = 0.015 * (i + 1);
      const downProb = i < n - 2 ? 0.05 : 0;
      const upProb = i > 0 ? 0.04 : 0;
      const stayProb = Math.max(0.1, 1 - (defProb + downProb + upProb));
      const sum = stayProb + upProb + downProb + defProb;

      const rowProbs = Array(n).fill(0);
      rowProbs[i] = stayProb / sum;
      if (i > 0) rowProbs[i - 1] = upProb / sum;
      if (i < n - 2) rowProbs[i + 1] = downProb / sum;
      rowProbs[n - 1] = defProb / sum;

      if (mode === "pct") {
        m[i] = rowProbs.map((p) => Number((p * 100).toFixed(2)));
        const diff = Number((100 - m[i].reduce((a, b) => a + b, 0)).toFixed(2));
        m[i][i] = Number((m[i][i] + diff).toFixed(2));
      } else {
        const total = 1000;
        const counts = rowProbs.map((p) => Math.round(p * total));
        counts[i] += total - counts.reduce((a, b) => a + b, 0);
        m[i] = counts;
      }
    }
    m[n - 1] = Array(n).fill(0);
    m[n - 1][n - 1] = mode === "pct" ? 100 : 500;
    return m;
  }

  function buildZeroDefaultMatrix(n, mode) {
    const m = buildCleanMatrix(n, mode);
    for (let i = 0; i < n - 1; i++) {
      const oldDef = m[i][n - 1];
      m[i][n - 1] = 0;
      m[i][i] = Number((m[i][i] + oldDef).toFixed(2));
    }
    return m;
  }

  function buildInvalidIrwMatrix(n, mode) {
    const m = buildCleanMatrix(n, mode);
    if (n >= 3) {
      m[0] = Array(n).fill(0);
      m[0][1] = mode === "pct" ? 100 : 100;
    }
    return m;
  }

  function resizeMatrix(n, mode, oldMatrix) {
    const base = buildCleanMatrix(n, mode);
    if (!Array.isArray(oldMatrix) || oldMatrix.length === 0) return base;
    for (let i = 0; i < n - 1; i++) {
      if (i < oldMatrix.length - 1 && Array.isArray(oldMatrix[i])) {
        const row = [];
        for (let j = 0; j < n; j++) {
          row.push(j < oldMatrix[i].length ? Number(oldMatrix[i][j]) || 0 : 0);
        }
        base[i] = row;
      }
    }
    base[n - 1] = Array(n).fill(0);
    base[n - 1][n - 1] =
      mode === "pct"
        ? 100
        : Math.max(1, Number(oldMatrix[oldMatrix.length - 1]?.[oldMatrix.length - 1]) || 100);
    return base;
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          nStates: state.nStates,
          unit: state.unit,
          mode: state.mode,
          horizon: state.horizon,
          matrix: state.matrix,
          bayes: state.bayes
        })
      );
    } catch (_) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        state.matrix = buildCleanMatrix(state.nStates, state.mode);
        return;
      }
      const parsed = JSON.parse(raw);
      const n = Math.min(14, Math.max(2, parseInt(parsed.nStates, 10) || 4));
      const unit = parsed.unit === "month" ? "month" : "year";
      const mode = parsed.mode === "count" ? "count" : "pct";
      const horizon = Math.max(0.05, Number(parsed.horizon) || 1);
      state.nStates = n;
      state.unit = unit;
      state.mode = mode;
      state.horizon = horizon;
      state.matrix = resizeMatrix(n, mode, parsed.matrix);

            if (parsed.bayes && typeof parsed.bayes === "object") {
        state.bayes = {
          ...state.bayes,
          n: parsed.bayes.n !== undefined ? parsed.bayes.n : state.bayes.n,
          d: parsed.bayes.d !== undefined ? parsed.bayes.d : state.bayes.d,
          priorType: ["informative", "uniform", "jeffreys", "custom"].includes(parsed.bayes.priorType)
            ? parsed.bayes.priorType
            : "informative",
          targetPdPct: Math.min(99, Math.max(0.01, Number(parsed.bayes.targetPdPct) || 1.5)),
          priorWeight: Math.max(0.5, Number(parsed.bayes.priorWeight) || 40),
          customAlpha: Math.max(0.05, Number(parsed.bayes.customAlpha) || 1),
          customBeta: Math.max(0.05, Number(parsed.bayes.customBeta) || 49),
          credLevel: parsed.bayes.credLevel === 0.9 ? 0.9 : 0.95
        };
      }

    } catch (_) {
      state.matrix = buildCleanMatrix(state.nStates, state.mode);
    }
  }

  function validateMatrix(matrix, mode) {
    const n = matrix.length;
    const rowErrors = Array.from({ length: n }, () => []);
    const cellErrors = Array.from({ length: n }, () => Array(n).fill(false));
    const globalMessages = [];

    for (let i = 0; i < n; i++) {
      let sum = 0;
      let hasNegative = false;
      let hasNaN = false;

      for (let j = 0; j < n; j++) {
        const val = matrix[i][j];
        if (typeof val !== "number" || !Number.isFinite(val)) {
          hasNaN = true;
          cellErrors[i][j] = true;
        } else {
          if (val < 0) {
            hasNegative = true;
            cellErrors[i][j] = true;
          }
          sum += val;
        }
      }

      if (hasNaN) {
        rowErrors[i].push("Valeur non numérique détectée.");
        globalMessages.push(`Ligne ${i + 1} (${stateLabel(i, n)}) : valeur non numérique.`);
      }
      if (hasNegative) {
        rowErrors[i].push("Les probabilités ou effectifs ne peuvent pas être négatifs.");
        globalMessages.push(`Ligne ${i + 1} (${stateLabel(i, n)}) : valeur négative interdite.`);
      }

      if (i === n - 1) {
        for (let j = 0; j < n - 1; j++) {
          if (Math.abs(matrix[i][j]) > 1e-9) {
            cellErrors[i][j] = true;
            rowErrors[i].push("L’état de défaut est absorbant : aucune sortie vers un autre état.");
          }
        }
        if (mode === "pct") {
          if (Math.abs(matrix[i][n - 1] - 100) > 0.05) {
            cellErrors[i][n - 1] = true;
            rowErrors[i].push(`En %, la probabilité de rester en défaut doit être 100 % (actuel : ${matrix[i][n - 1]} %).`);
            globalMessages.push("État défaut : doit rester à 100 % sur lui-même.");
          }
        } else if (matrix[i][n - 1] <= 0) {
          cellErrors[i][n - 1] = true;
          rowErrors[i].push("En effectifs, l’état de défaut doit avoir un volume strictement positif.");
          globalMessages.push("État défaut : effectif > 0 requis.");
        }
      } else if (mode === "pct") {
        if (Math.abs(sum - 100) > 0.05) {
          rowErrors[i].push(`Somme de la ligne = ${sum.toFixed(2)} % (attendu : 100 %).`);
          globalMessages.push(`Ligne ${i + 1} (${stateLabel(i, n)}) : somme = ${sum.toFixed(2)} % ≠ 100 %.`);
        }
      } else if (sum <= 0) {
        rowErrors[i].push("Somme des effectifs de la ligne doit être > 0.");
        globalMessages.push(`Ligne ${i + 1} (${stateLabel(i, n)}) : effectif total nul.`);
      }
    }

    return { valid: globalMessages.length === 0, rowErrors, cellErrors, globalMessages };
  }

  function toTransitionMatrix(matrix, mode) {
    const n = matrix.length;
    const P = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      if (i === n - 1) {
        P[i] = Array(n).fill(0);
        P[i][n - 1] = 1;
        continue;
      }
      const sum = matrix[i].reduce((a, b) => a + b, 0);
      for (let j = 0; j < n; j++) {
        P[i][j] = mode === "pct" ? matrix[i][j] / 100 : matrix[i][j] / sum;
      }
    }
    return P;
  }

  function matMul(A, B) {
    const n = A.length;
    const C = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) {
        const aik = A[i][k];
        for (let j = 0; j < n; j++) C[i][j] += aik * B[k][j];
      }
    }
    return C;
  }

  function matEye(n) {
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)));
  }

  function matScale(A, s) {
    return A.map((row) => row.map((v) => v * s));
  }

  function matAdd(A, B) {
    return A.map((row, i) => row.map((v, j) => v + B[i][j]));
  }

  function matSub(A, B) {
    return A.map((row, i) => row.map((v, j) => v - B[i][j]));
  }

  function matMaxAbs(A) {
    let m = 0;
    for (let i = 0; i < A.length; i++) {
      for (let j = 0; j < A.length; j++) {
        const v = Math.abs(A[i][j]);
        if (!Number.isFinite(v)) return Number.POSITIVE_INFINITY;
        if (v > m) m = v;
      }
    }
    return m;
  }

  function matIntegerPower(P, k) {
    const n = P.length;
    if (k === 0) return matEye(n);
    let res = matEye(n);
    let base = P.map((r) => r.slice());
    let exp = k;
    while (exp > 0) {
      if (exp & 1) res = matMul(res, base);
      exp >>= 1;
      if (exp > 0) base = matMul(base, base);
    }
    return res;
  }

  function expMatrix(M) {
    const n = M.length;
    let maxAbs = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) maxAbs = Math.max(maxAbs, Math.abs(M[i][j]));
    }
    const s = Math.max(0, Math.ceil(Math.log2(Math.max(1, maxAbs))));
    const scaled = matScale(M, 1 / Math.pow(2, s));

    let res = matEye(n);
    let term = matEye(n);
    for (let k = 1; k <= 18; k++) {
      term = matScale(matMul(term, scaled), 1 / k);
      res = matAdd(res, term);
    }
    for (let step = 0; step < s; step++) res = matMul(res, res);
    return res;
  }

  function estimateQ_JLT(P) {
    const n = P.length;
    const Q = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n - 1; i++) {
      let rowOffDiagSum = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          Q[i][j] = Math.max(0, P[i][j]);
          rowOffDiagSum += Q[i][j];
        }
      }
      Q[i][i] = -rowOffDiagSum;
    }
    Q[n - 1] = Array(n).fill(0);
    return Q;
  }

  function estimateQ_IRW(P) {
    const n = P.length;
    const I = matEye(n);
    const diff = matSub(P, I);
    let Q = Array.from({ length: n }, () => Array(n).fill(0));
    let power = diff.map((r) => r.slice());
    let converged = false;
    let lastTermNorm = Number.POSITIVE_INFINITY;

    for (let m = 1; m <= 120; m++) {
      const sign = m % 2 === 1 ? 1 : -1;
      const term = matScale(power, sign / m);
      lastTermNorm = matMaxAbs(term);
      if (!Number.isFinite(lastTermNorm) || lastTermNorm > 1e6) {
        converged = false;
        break;
      }
      Q = matAdd(Q, term);
      if (lastTermNorm < 1e-11) {
        converged = true;
        break;
      }
      power = matMul(power, diff);
    }

    Q[n - 1] = Array(n).fill(0);
    return { Q, converged };
  }

  function diagnoseGenerator(Q) {
    const n = Q.length;
    const issues = [];
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        const v = Q[i][j];
        if (!Number.isFinite(v)) {
          issues.push("valeur non finie");
          continue;
        }
        sum += v;
        if (i !== j && v < -1e-7) issues.push("intensité hors diagonale négative");
        if (i === j && v > 1e-7) issues.push("terme diagonal positif");
      }
      if (Number.isFinite(sum)) {
        if (i === n - 1 && Math.abs(sum) > 1e-6) issues.push("ligne défaut non nulle");
        else if (Math.abs(sum) > 1e-4) issues.push("somme de ligne non nulle");
      }
    }
    return issues;
  }

  function logGamma(z) {
    const g = 7;
    const c = [
      0.99999999999980993,
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.9843695780195716e-6,
      1.5056327351493116e-7
    ];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    let x = c[0];
    const t = z - 1;
    const z1 = t + g + 0.5;
    for (let i = 1; i < g + 2; i++) x += c[i] / (t + i);
    return 0.5 * Math.log(2 * Math.PI) + (t + 0.5) * Math.log(z1) - z1 + Math.log(x);
  }

  function logBeta(a, b) {
    return logGamma(a) + logGamma(b) - logGamma(a + b);
  }

  function betaPdf(x, a, b) {
    if (x <= 0 || x >= 1) {
      if (x === 0) return a < 1 ? Number.POSITIVE_INFINITY : a === 1 ? 1 : 0;
      if (x === 1) return b < 1 ? Number.POSITIVE_INFINITY : b === 1 ? 1 : 0;
      return 0;
    }
    const lp = (a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logBeta(a, b);
    const val = Math.exp(lp);
    return Number.isFinite(val) ? val : 0;
  }

  function betacf(x, a, b) {
    const MAXIT = 120;
    const EPS = 3e-12;
    const FPMIN = 1e-30;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;

    for (let m = 1; m <= MAXIT; m++) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      h *= d * c;

      aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c;
      if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }

  function betaCdf(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(
      logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
    );
    if (x < (a + 1) / (a + b + 2)) return (bt * betacf(x, a, b)) / a;
    return 1 - (bt * betacf(1 - x, b, a)) / b;
  }

  function betaQuantile(prob, a, b) {
    if (prob <= 0) return 0;
    if (prob >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 80; i++) {
      const mid = 0.5 * (lo + hi);
      if (betaCdf(mid, a, b) < prob) lo = mid;
      else hi = mid;
    }
    return 0.5 * (lo + hi);
  }

  function syncValidationVisuals() {
    if (!els.mkValidationPill || !els.mkErrorsBox || !els.mkMatrixWrapper) return;
    const n = state.nStates;
    const validation = validateMatrix(state.matrix, state.mode);

    els.mkValidationPill.textContent = validation.valid ? "Cohérente" : "Incohérente";
    els.mkValidationPill.className = `pill ${validation.valid ? "pill-ok" : "pill-err"}`;

    if (validation.valid) {
      els.mkErrorsBox.classList.add("hidden");
      els.mkErrorsBox.innerHTML = "";
    } else {
      els.mkErrorsBox.classList.remove("hidden");
      els.mkErrorsBox.innerHTML = `<strong>Points à corriger :</strong><ul>${validation.globalMessages
        .map((m) => `<li>${m}</li>`)
        .join("")}</ul>`;
    }

    const table = els.mkMatrixWrapper.querySelector("table.mk-table");
    if (!table) return;

    for (let i = 0; i < n; i++) {
      const tr = table.querySelector(`tbody tr[data-row="${i}"]`);
      if (!tr) continue;
      tr.classList.toggle("row-error", validation.rowErrors[i].length > 0);

      for (let j = 0; j < n; j++) {
        const cellErr = validation.cellErrors[i][j];
        const td = tr.querySelector(`td[data-cell="${i}-${j}"]`);
        const inp = tr.querySelector(`input.cell-input[data-r="${i}"][data-c="${j}"]`);
        if (td) td.classList.toggle("cell-error", cellErr);
        if (inp) inp.classList.toggle("cell-error", cellErr);
      }

      const rowSum = state.matrix[i].reduce((a, b) => a + (Number(b) || 0), 0);
      const sumCell = tr.querySelector(`td[data-row-sum="${i}"] strong`);
      if (sumCell) sumCell.textContent = state.mode === "pct" ? `${rowSum.toFixed(1)}%` : `${rowSum}`;
    }
  }

  function renderMatrixEditor() {
    if (!els.mkMatrixWrapper) return;
    const n = state.nStates;
    const unitSuffix = state.mode === "pct" ? "%" : "";

    let html = `<table class="mk-table"><thead><tr><th>De\\Vers ${unitSuffix}</th>`;
    for (let j = 0; j < n; j++) html += `<th>${stateLabel(j, n)}</th>`;
    html += `<th>Σ</th></tr></thead><tbody>`;

    for (let i = 0; i < n; i++) {
      const rowSum = state.matrix[i].reduce((a, b) => a + (Number(b) || 0), 0);
      html += `<tr data-row="${i}"><th>${stateLabel(i, n)}</th>`;
      for (let j = 0; j < n; j++) {
        const isAbsorbingFixed = i === n - 1 && j < n - 1;
        html += `<td data-cell="${i}-${j}"><input class="cell-input" type="number" inputmode="decimal" step="any" data-r="${i}" data-c="${j}" value="${state.matrix[i][j]}" ${isAbsorbingFixed ? "disabled" : ""} /></td>`;
      }
      const sumDisplay = state.mode === "pct" ? `${rowSum.toFixed(1)}%` : `${rowSum}`;
      html += `<td data-row-sum="${i}"><strong>${sumDisplay}</strong></td></tr>`;
    }

    html += `</tbody></table>`;
    els.mkMatrixWrapper.innerHTML = html;

    els.mkMatrixWrapper.querySelectorAll("input.cell-input").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const r = parseInt(e.target.dataset.r, 10);
        const c = parseInt(e.target.dataset.c, 10);
        const raw = e.target.value;
        const val = raw === "" || raw === "-" ? 0 : Number(raw);
        state.matrix[r][c] = Number.isFinite(val) ? val : 0;
        saveState();
        syncValidationVisuals();
      });

      inp.addEventListener("blur", (e) => {
        const r = parseInt(e.target.dataset.r, 10);
        const c = parseInt(e.target.dataset.c, 10);
        if (e.target.value === "") {
          state.matrix[r][c] = 0;
          e.target.value = "0";
          saveState();
          syncValidationVisuals();
        }
      });
    });

    syncValidationVisuals();
  }

  function updateHorizonLabel() {
    if (!els.mkHorizonLabel) return;
    const unitText = state.unit === "year" ? "an(s)" : "mois";
    els.mkHorizonLabel.textContent = `Horizon cible : k = ${state.horizon} ${unitText} (1 période d’entrée = 1 ${state.unit === "year" ? "an" : "mois"}).`;
  }

  function formatMatrixTable(titleHtml, M, isPct = true) {
    const n = M.length;
    let html = `<h4 class="result-section-title">${titleHtml}</h4><div class="matrix-scroll"><table class="mk-table"><thead><tr><th>État</th>`;
    for (let j = 0; j < n; j++) html += `<th>${stateLabel(j, n)}</th>`;
    html += `</tr></thead><tbody>`;
    for (let i = 0; i < n; i++) {
      html += `<tr><th>${stateLabel(i, n)}</th>`;
      for (let j = 0; j < n; j++) {
        const v = M[i][j];
        const txt = !Number.isFinite(v) ? "—" : isPct ? `${(v * 100).toFixed(2)}%` : v.toFixed(4);
        html += `<td>${txt}</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    return html;
  }

  function computeAndRenderResults() {
    if (!els.mkResultsContent) return;
    const validation = validateMatrix(state.matrix, state.mode);
    if (!validation.valid) {
      els.mkResultsContent.innerHTML = `<div class="error-box"><strong>Calcul bloqué :</strong> corrige d’abord les lignes ou cellules en rouge dans l’onglet <strong>Inputs</strong>.</div>`;
      return;
    }

    const P = toTransitionMatrix(state.matrix, state.mode);
    const n = P.length;
    const lastIdx = n - 1;
    const k = state.horizon;
    const isIntegerHorizon = Number.isInteger(k) && k >= 0;
    const Pk = isIntegerHorizon ? matIntegerPower(P, k) : null;

    const Q_jlt = estimateQ_JLT(P);
    const issuesJlt = diagnoseGenerator(Q_jlt);
    const expQ1_jlt = expMatrix(Q_jlt);
    const expQ_jlt = expMatrix(matScale(Q_jlt, k));

    const jltDefaultGaps = [];
    const jltZeroObservedNotes = [];
    for (let i = 0; i < lastIdx; i++) {
      const obsDef = P[i][lastIdx];
      const contDef1 = expQ1_jlt[i][lastIdx];
      const gap = Math.abs(contDef1 - obsDef);
      if (obsDef <= 1e-12 && contDef1 > 1e-12) {
        jltZeroObservedNotes.push(`${stateLabel(i, n)} : taux observé = 0,00% → PD continue à 1 période = ${(contDef1 * 100).toFixed(2)}%.`);
      } else if (gap > 0.01) {
        jltDefaultGaps.push(`${stateLabel(i, n)} : tx observé = ${(obsDef * 100).toFixed(2)}% vs PD(exp(Q<sub>JLT</sub>)) = ${(contDef1 * 100).toFixed(2)}%`);
      }
    }

    const irw = estimateQ_IRW(P);
    const generatorIssuesIrw = irw.converged ? diagnoseGenerator(irw.Q) : [];
    const irwValid = irw.converged && generatorIssuesIrw.length === 0;
    const expQ_irw = irwValid ? expMatrix(matScale(irw.Q, k)) : null;
    const unitLabel = state.unit === "year" ? "an(s)" : "mois";

    let pdSummary = `<table class="mk-table"><thead><tr><th>État</th><th>Tx déf. observé 1 an</th><th>Discret P<sup>k</sup></th><th>Continu JLT</th><th>Continu IRW</th></tr></thead><tbody>`;
    for (let i = 0; i < lastIdx; i++) {
      pdSummary += `<tr><th>${stateLabel(i, n)}</th><td>${(P[i][lastIdx] * 100).toFixed(2)}%</td><td>${isIntegerHorizon ? `<strong>${(Pk[i][lastIdx] * 100).toFixed(2)}%</strong>` : "Bloqué"}</td><td>${(expQ_jlt[i][lastIdx] * 100).toFixed(2)}%</td><td>${irwValid ? `${(expQ_irw[i][lastIdx] * 100).toFixed(2)}%` : "Bloqué"}</td></tr>`;
    }
    pdSummary += `</tbody></table>`;

    const discreteSection = isIntegerHorizon
      ? formatMatrixTable(`Modèle discret : P<sup>${k}</sup>`, Pk, true)
      : `<div class="error-box"><strong>Calcul discret P<sup>${k}</sup> interdit :</strong> l’horizon <em>k = ${k}</em> n’est pas un nombre entier.</div>`;

    let jltDiagnosticHtml =
      issuesJlt.length > 0
        ? `<div class="error-box">Générateur JLT invalide.</div>`
        : jltDefaultGaps.length > 0
        ? `<div class="warn-box"><strong>Écart (&gt; 1 pt) avec JLT (indicateur de non-embeddability ou d’approximation) :</strong><ul>${jltDefaultGaps.map((g) => `<li>${g}</li>`).join("")}</ul></div>`
        : `<p class="helper-text">Diagnostic JLT : générateur valide ; sur un pas unitaire, les PD issues de <em>exp(Q<sub>JLT</sub>)</em> restent cohérentes avec <em>P</em>.</p>`;

    if (jltZeroObservedNotes.length > 0) {
      jltDiagnosticHtml += `<p class="helper-text"><strong>Effet temps continu :</strong> ${jltZeroObservedNotes.join(" ")}</p>`;
    }

    const irwSection = irwValid
      ? `${formatMatrixTable(`Générateur Q<sub>IRW</sub> — Estimateur IRW`, irw.Q, false)}${formatMatrixTable(`Modèle continu (IRW) : exp(${k} · Q<sub>IRW</sub>)`, expQ_irw, true)}`
      : `<h4 class="result-section-title">Modèle continu (IRW)</h4><div class="error-box"><strong>Calcul IRW bloqué :</strong> ${
          !irw.converged
            ? "la série du logarithme matriciel log(P) ne converge pas (échec de l’estimateur IRW sur cette matrice)."
            : "la matrice candidate log(P) présente des intensités hors diagonale négatives (échec de l’estimateur IRW : la matrice obtenue n’est pas un générateur markovien valide)."
        }</div>`;

    els.mkResultsContent.innerHTML = `
      <h2>Résultats — Horizon k = ${k} ${unitLabel}</h2>
      <h3 class="result-section-title">Synthèse des probabilités de défaut vers l’état absorbant</h3>
      <div class="matrix-scroll">${pdSummary}</div>
      ${formatMatrixTable(`Matrice de transition estimée P`, P, true)}
      ${discreteSection}
      ${formatMatrixTable(`Générateur Q<sub>JLT</sub> — Estimateur JLT`, Q_jlt, false)}
      ${jltDiagnosticHtml}
      ${formatMatrixTable(`Modèle continu (JLT) : exp(${k} · Q<sub>JLT</sub>)`, expQ_jlt, true)}
      ${irwSection}
    `;
  }

  function buildBetaShapesSvg() {
    const curves = [
      { label: "Uniforme Bêta(1, 1)", color: "#94a3b8", a: 1, b: 1 },
      { label: "Jeffreys Bêta(0.5, 0.5)", color: "#f59e0b", a: 0.5, b: 0.5 },
      { label: "PD faible Bêta(1, 49)", color: "#38bdf8", a: 1, b: 49 },
      { label: "Cloche Bêta(5, 20)", color: "#a78bfa", a: 5, b: 20 }
    ];
    const W = 520, H = 190, padL = 36, padR = 16, padT = 16, padB = 28;
    const plotW = W - padL - padR, plotH = H - padT - padB, yCap = 8.5;

    const paths = curves.map((c) => {
      const pts = [];
      for (let s = 0; s <= 160; s++) {
        const p = 0.002 + (0.996 * s) / 160;
        const yRaw = Math.min(yCap, betaPdf(p, c.a, c.b));
        const sx = padL + p * plotW;
        const sy = padT + plotH - (yRaw / yCap) * plotH;
        pts.push(`${s === 0 ? "M" : "L"}${sx.toFixed(1)},${sy.toFixed(1)}`);
      }
      return `<path d="${pts.join(" ")}" fill="none" stroke="${c.color}" stroke-width="2.2" />`;
    }).join("");

    const legend = curves.map((c) =>
      `<span style="display:inline-flex;align-items:center;gap:0.3rem;margin-right:0.75rem;font-size:0.76rem;color:#cbd5e1;"><span style="width:10px;height:10px;border-radius:999px;background:${c.color};display:inline-block;"></span>${c.label}</span>`
    ).join("");

    return `
      <div class="svg-chart-wrap">
        <svg viewBox="0 0 ${W} ${H}" aria-label="Formes de lois Bêta">
          <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#475569" stroke-width="1" />
          <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#475569" stroke-width="1" />
          <text x="${padL}" y="${H - 6}" fill="#94a3b8" font-size="10">0 %</text>
          <text x="${padL + plotW * 0.5}" y="${H - 6}" fill="#94a3b8" font-size="10" text-anchor="middle">p (PD = 50 %)</text>
          <text x="${padL + plotW}" y="${H - 6}" fill="#94a3b8" font-size="10" text-anchor="end">100 %</text>
          ${paths}
        </svg>
        <div style="margin-top:0.35rem;">${legend}</div>
      </div>
    `;
  }

  function renderTheoryContent() {
    if (els.mkTheoryContent) {
      els.mkTheoryContent.innerHTML = `
        <h2>Théorie — Chaînes de Markov &amp; Risque de Crédit</h2>
        <div class="theory-block"><h3>1. États &amp; défaut absorbant</h3><p>Chaque ligne correspond à un état initial (rating ou défaut) ; les probabilités sont ≥ 0 et somment à 1 (ou 100 %). Le dernier état est absorbant.</p></div>
        <div class="theory-block"><h3>2. Temps discret vs temps continu</h3><p>En discret, seules les puissances entières <em>P<sup>k</sup></em> ont un sens markovien direct. En continu, <em>P(k) = exp(k · Q)</em> permet tout horizon <em>k &gt; 0</em> et génère des PD indirectes même avec 0 défaut observé.</p></div>
        <div class="theory-block"><h3>3. Embeddability</h3><p>Une matrice <em>P</em> est <em>embeddable</em> s’il existe un générateur markovien valide <em>Q</em> tel que <em>P = exp(Q)</em> exactement.</p></div>
        <div class="theory-block"><h3>4. JLT &amp; IRW</h3><p><strong>JLT</strong> construit <em>Q<sub>JLT</sub></em> directement à partir des transitions hors diagonale ; <strong>IRW</strong> utilise <em>log(P)</em>. Un blocage d’IRW traduit d’abord un échec de cet estimateur sur la matrice (non-convergence de la série ou intensités hors diagonale négatives), sans impliquer à lui seul une non-embeddability absolue.</p></div>
      `;
    }

    if (els.bayesTheoryContent) {
      els.bayesTheoryContent.innerHTML = `
        <h2>Bayes &amp; Conjugaison — Fondements pour la PD</h2>

        <div class="theory-block">
          <h3>1. Fréquentiste vs Bayésien : statut de <em>p</em> et avantages de Bayes</h3>
          <p>
            En approche <strong>fréquentiste</strong>, la probabilité de défaut <em>p</em> est un paramètre fixe et inconnu : ce n’est pas une variable aléatoire. L’aléa provient uniquement de l’échantillon observé, ce qui rend l’estimateur empirique <em>p̂ = d / n</em> variable d’un échantillon à l’autre.
          </p>
          <p>
            En approche <strong>bayésienne</strong>, les données observées (<em>d</em> défauts sur <em>n</em> expositions) sont prises telles quelles, et c’est le paramètre <em>p</em> lui-même qui est modélisé comme une <strong>variable aléatoire</strong> dotée d’une distribution de probabilité.
          </p>
          <ul>
            <li><strong>Échantillons petits ou portefeuilles à faible défaut (LDP) :</strong> évite les estimations extrêmes (comme 0 % de PD lorsque <em>d = 0</em>) en s’appuyant sur une information a priori structurée.</li>
            <li><strong>Intégration d’une expertise ou d’un benchmark :</strong> permet de combiner formellement une croyance métier (historique long, notation externe, dires d’experts) avec les données internes récentes.</li>
            <li><strong>Mesure directe de l’incertitude :</strong> fournit une distribution complète de <em>p</em> (et donc un intervalle de crédibilité exact), là où l’approximation normale fréquentiste devient fragile près de 0 %.</li>
          </ul>
        </div>

        <div class="theory-block">
          <h3>2. Formule de Bayes, conjugaison et vision globale du résultat</h3>
          <div class="formula-callout">
            π(p | d, n) <span class="prop-sign">∝</span> L(d, n | p) · π(p)
          </div>
          <ul>
            <li><strong>π(p) — le <em>prior</em> (loi a priori) :</strong> représente notre croyance initiale sur les valeurs plausibles de la PD <em>p</em> avant d’observer les nouvelles données.</li>
            <li><strong>L(d, n | p) — la <em>vraisemblance</em> :</strong> représente la probabilité d’observer les données (<em>d</em> défauts sur <em>n</em> expositions) sachant une valeur donnée de <em>p</em>. Pour des tirages indépendants de même PD <em>p</em>, elle est proportionnelle à <em>p<sup>d</sup> (1 − p)<sup>n − d</sup></em>.</li>
            <li><strong>π(p | d, n) — le <em>posterior</em> (loi a posteriori) :</strong> représente la distribution mise à jour de <em>p</em> après avoir combiné le <em>prior</em> et les données observées via le signe de proportionnalité (<span class="prop-sign">∝</span>).</li>
          </ul>
          <p>
            <strong>Conjugaison :</strong> lorsque le <em>prior</em> suit une loi <strong>Bêta(α<sub>0</sub>, β<sub>0</sub>)</strong> et que les données suivent un schéma Bernoulli/Binomial, la loi <em>posterior</em> reste dans la même famille Bêta : <strong>Bêta(α<sub>0</sub> + d, β<sub>0</sub> + n − d)</strong>.
          </p>
          <p>
            <strong>Résultat final :</strong> le modèle produit la loi <em>posterior</em> complète de <em>p</em>. On en extrait la <strong>moyenne posterior</strong> <em>E[p | d, n]</em> comme estimation centrale de la PD, et un <strong>intervalle de crédibilité</strong> (90 % ou 95 %) pour encadrer l’incertitude.
          </p>
        </div>

        <div class="theory-block">
          <h3>3. Pourquoi une loi Bêta pour modéliser la PD <em>p</em> ?</h3>
          <p>
            Une probabilité de défaut <em>p</em> est une proportion comprise entre 0 % et 100 % : elle ne peut ni être négative, ni dépasser 1. Une loi Normale (sur −∞ à +∞) est inadaptée car elle déborderait sous 0 % pour des PD faibles et imposerait une symétrie artificielle près des bords.
          </p>
          <p>
            Dans le cadre d’une expérience de Bernoulli répétée (ou Binomiale) où l’on observe des défauts avec une probabilité <em>p</em>, la loi <strong>Bêta</strong> modélise les variations possibles de ce paramètre <em>p</em> sur l’intervalle [0, 1] :
          </p>
          <div class="formula-callout">
            f(p ; α, β) = [ 1 / B(α, β) ] · p<sup>α − 1</sup> · (1 − p)<sup>β − 1</sup> &nbsp;&nbsp; pour p ∈ [0, 1]
          </div>
        </div>

          <div class="theory-block">
          <h3>4. Pseudo-données, poids du <em>prior</em> (<em>n<sub>0</sub></em>) et choix au-delà de la forme</h3>
          <p>
            Pour un <em>prior</em> <strong>Bêta(α<sub>0</sub>, β<sub>0</sub>)</strong>, la somme <strong>n<sub>0</sub> = α<sub>0</sub> + β<sub>0</sub></strong>, également appelée <strong>pseudo-données</strong> (ou pseudo-observations), représente le poids du <em>prior</em> dans la moyenne <em>posterior</em> : elle équivaut au volume d’expositions fictives (<em>α<sub>0</sub></em> défauts et <em>β<sub>0</sub></em> non-défauts) porté par la loi a priori.
          </p>
          <p>
            La moyenne <em>posterior</em> s’écrit alors comme une moyenne pondérée entre la moyenne du <em>prior</em> <em>μ<sub>0</sub> = α<sub>0</sub> / n<sub>0</sub></em> et le taux observé <em>p̂ = d / n</em> :
          </p>
          <div class="formula-callout">
            E[p | d, n] = [ n<sub>0</sub> / (n<sub>0</sub> + n) ] · μ<sub>0</sub> + [ n / (n<sub>0</sub> + n) ] · (d / n)
          </div>
          <p>
            Le poids relatif du <em>prior</em> vaut donc <strong>n<sub>0</sub> / (n<sub>0</sub> + n)</strong> et celui des données observées vaut <strong>n / (n<sub>0</sub> + n)</strong> : l’équilibre se joue entre les <strong>pseudo-données</strong> du <em>prior</em> et les <strong>données observées</strong> sur l’échantillon (<em>n</em>), sans qu’il y ait de séparation temporelle automatique entre « passé » et « récent ».
          </p>
          <ul>
            <li><strong>Au-delà de la forme de la courbe :</strong> fixer une moyenne <em>μ<sub>0</sub></em> et une allure ne suffit pas ; choisir <em>n<sub>0</sub></em> revient à fixer un <strong>budget de conviction</strong> (à combien d’expositions observées on assimile le poids du <em>prior</em>).</li>
            <li><strong>Un grand <em>n<sub>0</sub></em> face à un petit <em>n</em> :</strong> le <em>prior</em> domine fortement l’estimation ; ce choix n’est défendable que s’il est justifié <em>ex ante</em> par une source documentée (benchmark, portefeuille frère, historique de référence).</li>
            <li><strong>Un <em>n<sub>0</sub></em> modéré :</strong> agit comme garde-fou lorsque <em>n</em> est faible ou que <em>d = 0</em>, tout en laissant les données observées prendre le dessus dès que des observations suffisantes s’accumulent.</li>
          </ul>
          ${buildBetaShapesSvg()}
        </div>


        <div class="theory-block">
          <h3>5. Application au Mode 1 : portefeuille à faible défaut (LDP)</h3>
          <p>
            En LDP ou sur petit échantillon, l’estimateur fréquentiste <em>d / n</em> est discret et instable (sur <em>n = 4</em>, 0 défaut donne 0 %, 1 défaut passe à 25 %, 2 défauts à 50 % ; avec <em>d = 0</em>, il reste à 0,00 %).
          </p>
          <p>
            Le <em>prior</em> régularise cette estimation : quand <em>n</em> est faible, il stabilise la PD autour de la croyance initiale <em>μ<sub>0</sub></em> au lieu de la laisser chuter à 0 % ou sauter brusquement, tout en restant sensible au poids <em>n<sub>0</sub></em> choisi.
          </p>
        </div>
      `;
    }
  }

  function getPriorParams(b) {
    if (b.priorType === "uniform") return { alpha0: 1, beta0: 1 };
    if (b.priorType === "jeffreys") return { alpha0: 0.5, beta0: 0.5 };
    if (b.priorType === "custom") {
      return {
        alpha0: Math.max(0.05, Number(b.customAlpha) || 1),
        beta0: Math.max(0.05, Number(b.customBeta) || 49)
      };
    }
    const mu0 = Math.min(0.99, Math.max(0.0001, (Number(b.targetPdPct) || 1.5) / 100));
    const w0 = Math.max(0.5, Number(b.priorWeight) || 40);
    return { alpha0: mu0 * w0, beta0: (1 - mu0) * w0 };
  }

  function buildPosteriorChartSvg(priorA, priorB, postA, postB, freqRate, ciLow, ciHigh, credLevel) {
    const W = 540, H = 215, padL = 36, padR = 16, padT = 18, padB = 30;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const steps = 180;
    const sampleP = (s) => 0.0005 + (0.999 * s) / steps;

    let maxY = 1;
    const priorVals = [], postVals = [];
    for (let s = 0; s <= steps; s++) {
      const p = sampleP(s);
      const yPrior = Math.min(40, betaPdf(p, priorA, priorB));
      const yPost = Math.min(40, betaPdf(p, postA, postB));
      priorVals.push(yPrior);
      postVals.push(yPost);
      if (Number.isFinite(yPrior) && yPrior > maxY) maxY = yPrior;
      if (Number.isFinite(yPost) && yPost > maxY) maxY = yPost;
    }
    maxY *= 1.12;

    const xToSvg = (p) => padL + Math.min(1, Math.max(0, p)) * plotW;
    const yToSvg = (y) => padT + plotH - (Math.min(maxY, Math.max(0, y)) / maxY) * plotH;

    let priorPath = "", postPath = "", ciAreaPath = "";
    for (let s = 0; s <= steps; s++) {
      const p = sampleP(s);
      const sx = xToSvg(p);
      priorPath += `${s === 0 ? "M" : "L"}${sx.toFixed(1)},${yToSvg(priorVals[s]).toFixed(1)}`;
      postPath += `${s === 0 ? "M" : "L"}${sx.toFixed(1)},${yToSvg(postVals[s]).toFixed(1)}`;
      if (p >= ciLow && p <= ciHigh) {
        ciAreaPath += `${ciAreaPath === "" ? "M" : "L"}${sx.toFixed(1)},${yToSvg(postVals[s]).toFixed(1)}`;
      }
    }
    if (ciAreaPath !== "") {
      ciAreaPath += ` L${xToSvg(ciHigh).toFixed(1)},${yToSvg(0).toFixed(1)} L${xToSvg(ciLow).toFixed(1)},${yToSvg(0).toFixed(1)} Z`;
    }

    return `
      <div class="svg-chart-wrap">
        <svg viewBox="0 0 ${W} ${H}" aria-label="Comparaison Prior, Posterior et Fréquentiste">
          ${ciAreaPath ? `<path d="${ciAreaPath}" fill="rgba(56, 189, 248, 0.18)" />` : ""}
          <line x1="${xToSvg(freqRate).toFixed(1)}" y1="${padT}" x2="${xToSvg(freqRate).toFixed(1)}" y2="${padT + plotH}" stroke="#f59e0b" stroke-width="1.6" stroke-dasharray="4,3" />
          <path d="${priorPath}" fill="none" stroke="#a78bfa" stroke-width="2" stroke-dasharray="5,3" />
          <path d="${postPath}" fill="none" stroke="#38bdf8" stroke-width="2.4" />
          <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#475569" stroke-width="1" />
          <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#475569" stroke-width="1" />
          <text x="${padL}" y="${H - 7}" fill="#94a3b8" font-size="10">0 %</text>
          <text x="${padL + plotW * 0.5}" y="${H - 7}" fill="#94a3b8" font-size="10" text-anchor="middle">Probabilité de défaut p</text>
          <text x="${padL + plotW}" y="${H - 7}" fill="#94a3b8" font-size="10" text-anchor="end">100 %</text>
        </svg>
        <div style="margin-top:0.35rem;display:flex;flex-wrap:wrap;gap:0.75rem;font-size:0.76rem;color:#cbd5e1;">
          <span><span style="display:inline-block;width:12px;border-top:2px dashed #a78bfa;vertical-align:middle;margin-right:4px;"></span>Prior</span>
          <span><span style="display:inline-block;width:12px;border-top:2.5px solid #38bdf8;vertical-align:middle;margin-right:4px;"></span>Posterior</span>
          <span><span style="display:inline-block;width:10px;height:10px;background:rgba(56,189,248,0.25);border:1px solid #38bdf8;vertical-align:middle;margin-right:4px;"></span>IC ${Math.round(credLevel * 100)} %</span>
          <span><span style="display:inline-block;width:12px;border-top:2px dashed #f59e0b;vertical-align:middle;margin-right:4px;"></span>Fréquentiste d/n (${(freqRate * 100).toFixed(2)} %)</span>
        </div>
      </div>
    `;
  }

    function computeBayesMetrics(b) {
    const { alpha0, beta0 } = getPriorParams(b);
    const n0 = alpha0 + beta0;
    const priorMean = n0 > 0 ? alpha0 / n0 : 0;
    const priorMeta = { alpha0, beta0, n0, priorMean };

    const rawN = String(b.n ?? "").trim().replace(",", ".");
    const rawD = String(b.d ?? "").trim().replace(",", ".");

    if (rawN === "" || rawD === "" || rawN === "-" || rawD === "-") {
      return {
        ...priorMeta,
        status: "pending",
        message: "En attente d’une valeur valide pour l’effectif (n) et les défauts (d)..."
      };
    }

    const n = Number(rawN);
    const d = Number(rawD);

    if (!Number.isFinite(n) || !Number.isFinite(d) || n < 0 || d < 0) {
      return {
        ...priorMeta,
        status: "error",
        message: "L’effectif et le nombre de défauts doivent être positifs ou nuls."
      };
    }

    if (d > n) {
      return {
        ...priorMeta,
        status: "error",
        message: "Le nombre de défauts (d) ne peut pas dépasser l’effectif (n)."
      };
    }

    const s = n - d;
    const notes = [];
    if (n === 0 && d === 0) {
      notes.push("Aucune observation (n = 0) : les résultats reflètent uniquement la loi a priori.");
    }

    if (b.priorType === "informative") {
      const rawPd = String(b.targetPdPct ?? "").trim().replace(",", ".");
      const rawW = String(b.priorWeight ?? "").trim().replace(",", ".");
      if (rawPd === "" || rawW === "" || rawPd === "-" || rawW === "-") {
        return {
          ...priorMeta,
          status: "pending",
          message: "En attente d’une valeur valide pour la PD cible et le poids..."
        };
      }
      const pd = Number(rawPd);
      const w = Number(rawW);
      if (!Number.isFinite(pd) || pd <= 0 || pd >= 100) {
        return {
          ...priorMeta,
          status: "error",
          message: "La PD cible doit être strictement comprise entre 0 % et 100 %."
        };
      }
      if (!Number.isFinite(w) || w < 0) {
        return {
          ...priorMeta,
          status: "error",
          message: "Le poids de l’a priori ne peut pas être négatif."
        };
      }
      if (w === 0) {
        notes.push("Poids nul : l’a priori n’a aucun impact sur les données observées.");
      }
    } else if (b.priorType === "custom") {
      const rawAlpha = String(b.customAlpha ?? "").trim().replace(",", ".");
      const rawBeta = String(b.customBeta ?? "").trim().replace(",", ".");
      if (rawAlpha === "" || rawBeta === "" || rawAlpha === "-" || rawBeta === "-") {
        return {
          ...priorMeta,
          status: "pending",
          message: "En attente d’une valeur valide pour alpha et bêta..."
        };
      }
      const alpha = Number(rawAlpha);
      const beta = Number(rawBeta);
      if (!Number.isFinite(alpha) || alpha <= 0 || !Number.isFinite(beta) || beta <= 0) {
        return {
          ...priorMeta,
          status: "error",
          message: "Les paramètres alpha et bêta doivent être strictement positifs."
        };
      }
    }

    const alphaN = alpha0 + d;
    const betaN = beta0 + s;
    const totalN = n0 + n;

    const freqPd = n > 0 ? d / n : null;
    const postMean = alphaN / totalN;
    const postMode =
      alphaN > 1 && betaN > 1
        ? (alphaN - 1) / (alphaN + betaN - 2)
        : alphaN <= 1 && betaN > alphaN
        ? 0
        : null;
    const postSd = Math.sqrt((alphaN * betaN) / (Math.pow(totalN, 2) * (totalN + 1)));
    const tail = (1 - b.credLevel) / 2;
    const ciLow = betaQuantile(tail, alphaN, betaN);
    const ciHigh = betaQuantile(1 - tail, alphaN, betaN);
    const wPriorPct = (n0 / totalN) * 100;
    const wDataPct = (n / totalN) * 100;

    return {
      ...priorMeta,
      status: "ok",
      message: "",
      notes,
      n,
      d,
      s,
      alphaN,
      betaN,
      freqPd,
      postMode,
      postSd,
      ciLow,
      ciHigh,
      wPriorPct,
      wDataPct
    };
  }


  function renderBayesPriorMetaHtml(b, m) {
    if (b.priorType === "informative") {
      return `<p id="by-prior-meta" class="helper-text">α<sub>0</sub> = ${m.alpha0.toFixed(3)}, β<sub>0</sub> = ${m.beta0.toFixed(3)} (moyenne prior = ${(m.priorMean * 100).toFixed(2)} %, poids n<sub>0</sub> = ${m.n0.toFixed(2)}).</p>`;
    }
    if (b.priorType === "custom") {
      return `<p id="by-prior-meta" class="helper-text">Poids total n<sub>0</sub> = ${m.n0.toFixed(2)} (moyenne prior = ${(m.priorMean * 100).toFixed(2)} %).</p>`;
    }
    return `<p id="by-prior-meta" class="helper-text">α<sub>0</sub> = ${m.alpha0}, β<sub>0</sub> = ${m.beta0} (poids total n<sub>0</sub> = ${m.n0}, moyenne prior = ${(m.priorMean * 100).toFixed(2)} %).</p>`;
  }

  function renderBayesDynamicHtml(b, m) {
      if (m && (m.status === "pending" || m.status === "error")) {
    const isErr = m.status === "error";
    return `
      <div class="${isErr ? "warn-box" : "helper-text"}" role="${isErr ? "alert" : "status"}">
        <strong>${isErr ? "Entrée invalide :" : "En attente :"}</strong> ${m.message || "—"}
      </div>
      <div class="bayes-kpi-grid">
        <div class="kpi-box"><div class="kpi-label">Moyenne a posteriori</div><div class="kpi-value">—</div></div>
        <div class="kpi-box"><div class="kpi-label">Médiane / Mode</div><div class="kpi-value">—</div></div>
        <div class="kpi-box"><div class="kpi-label">Écart-type</div><div class="kpi-value">—</div></div>
        <div class="kpi-box"><div class="kpi-label">Intervalle de crédibilité</div><div class="kpi-value">—</div></div>
        <div class="kpi-box"><div class="kpi-label">PD fréquentiste</div><div class="kpi-value">—</div></div>
      </div>
    `;
  }
    return `
      <div class="formula-callout">Posterior : Bêta(${m.alphaN.toFixed(2)}, ${m.betaN.toFixed(2)})</div>
      <div class="bayes-kpi-grid">
        <div class="kpi-box"><div class="kpi-label">Moyenne posterior</div><div class="kpi-value">${(m.postMean * 100).toFixed(2)} %</div><div class="kpi-sub">Écart-type : ${(m.postSd * 100).toFixed(2)} %</div></div>
        <div class="kpi-box"><div class="kpi-label">Fréquentiste d / n</div><div class="kpi-value">${(m.freqPd * 100).toFixed(2)} %</div><div class="kpi-sub">${m.d} / ${m.n} (${m.s} sains)</div></div>
        <div class="kpi-box"><div class="kpi-label">IC ${Math.round(b.credLevel * 100)} %</div><div class="kpi-value">${(m.ciLow * 100).toFixed(2)} % – ${(m.ciHigh * 100).toFixed(2)} %</div><div class="kpi-sub">Quantiles Bêta</div></div>
        <div class="kpi-box"><div class="kpi-label">Mode posterior</div><div class="kpi-value">${m.postMode !== null ? `${(m.postMode * 100).toFixed(2)} %` : "Bord / plat"}</div><div class="kpi-sub">Max densité</div></div>
      </div>
      <h4 class="result-section-title">Poids : Prior ${m.wPriorPct.toFixed(1)} % vs Données ${m.wDataPct.toFixed(1)} %</h4>
      <div class="weight-bar"><div class="weight-prior" style="width:${m.wPriorPct.toFixed(1)}%"></div><div class="weight-data" style="width:${m.wDataPct.toFixed(1)}%"></div></div>
      ${m.d === 0 ? `<div class="warn-box"><strong>d = 0 :</strong> fréquentiste = 0,00 %, moyenne posterior = <strong>${(m.postMean * 100).toFixed(2)} %</strong>.</div>` : ""}
      ${buildPosteriorChartSvg(m.alpha0, m.beta0, m.alphaN, m.betaN, m.freqPd, m.ciLow, m.ciHigh, b.credLevel)}
      ${Array.isArray(m.notes) && m.notes.length > 0 ? `<div class="helper-text">${m.notes.join("<br>")}</div>` : ""}
    `;
  }

  function updateBayesLabOutput() {
    const b = state.bayes;
    const m = computeBayesMetrics(b);
    const metaEl = document.getElementById("by-prior-meta");
    if (metaEl) {
      metaEl.outerHTML = renderBayesPriorMetaHtml(b, m);
    }
    const dynEl = document.getElementById("bayes-lab-dynamic");
    if (dynEl) {
      dynEl.innerHTML = renderBayesDynamicHtml(b, m);
    }
  }

  function renderBayesLab() {
    if (!els.bayesLabContent) return;
    const b = state.bayes;
    const m = computeBayesMetrics(b);

    const priorInputsHtml =
      b.priorType === "informative"
        ? `<div class="form-grid"><label class="field"><span>PD cible du prior (%)</span><input id="by-target-pd" type="number" inputmode="decimal" step="0.05" min="0.01" max="99" value="${b.targetPdPct}" /></label><label class="field"><span>Poids du prior n<sub>0</sub></span><input id="by-prior-weight" type="number" inputmode="decimal" step="1" min="0.5" value="${b.priorWeight}" /></label></div>${renderBayesPriorMetaHtml(b, m)}`
        : b.priorType === "custom"
        ? `<div class="form-grid"><label class="field"><span>α<sub>0</sub></span><input id="by-custom-alpha" type="number" inputmode="decimal" step="0.1" min="0.05" value="${b.customAlpha}" /></label><label class="field"><span>β<sub>0</sub></span><input id="by-custom-beta" type="number" inputmode="decimal" step="0.1" min="0.5" value="${b.customBeta}" /></label></div>${renderBayesPriorMetaHtml(b, m)}`
        : renderBayesPriorMetaHtml(b, m);

    els.bayesLabContent.innerHTML = `
      <div class="card">
        <h2>Mode 1 — Segment / Portefeuille LDP (mono-segment)</h2>
        <p class="helper-text">
          <strong>Question posée dans les 3 cas :</strong> sachant un nombre de défauts <em>d</em> sur <em>n</em> expositions dans le cadre <em>X</em> (précisé ci-dessous), quelle probabilité de défaut (PD) retenir et avec quelle incertitude ?
        </p>
        <h3>Exemples pré-remplis</h3>
        <div class="actions-row">
          <button id="by-preset-ldp-zero" type="button" class="btn-ghost">Exemple LDP (n = 60, d = 0)</button>
          <button id="by-preset-small-n" type="button" class="btn-ghost">Petit échantillon (n = 4, d = 2)</button>
          <button id="by-preset-large-n" type="button" class="btn-ghost">Échantillon large (n = 800, d = 12)</button>
        </div>
        <p class="helper-text">
          <strong>Cadre X :</strong> <em>Exemple LDP</em> = portefeuille faible défaut sans défaut observé ; <em>Petit échantillon</em> = historique très court (4 expositions, 2 défauts) ; <em>Échantillon large</em> = portefeuille plus étoffé (800 expositions, 12 défauts).
        </p>
      </div>
      <div class="card">
        <h3>1. Données &amp; prior</h3>
        <div class="form-grid">
          <label class="field"><span>Expositions n</span><input id="by-n" type="number" inputmode="numeric" step="1" min="0" value="${b.n}" /></label>
<label class="field"><span>Défauts d</span><input id="by-d" type="number" inputmode="numeric" step="1" min="0" value="${b.d}" /></label>
          <label class="field"><span>Prior</span><select id="by-prior-type"><option value="informative" ${b.priorType === "informative" ? "selected" : ""}>Informatif</option><option value="uniform" ${b.priorType === "uniform" ? "selected" : ""}>Uniforme Bêta(1,1)</option><option value="jeffreys" ${b.priorType === "jeffreys" ? "selected" : ""}>Jeffreys Bêta(0.5,0.5)</option><option value="custom" ${b.priorType === "custom" ? "selected" : ""}>Personnalisé</option></select></label>
          <label class="field"><span>Crédibilité</span><select id="by-cred"><option value="0.95" ${b.credLevel === 0.95 ? "selected" : ""}>95 %</option><option value="0.9" ${b.credLevel === 0.9 ? "selected" : ""}>90 %</option></select></label>
        </div>
        ${priorInputsHtml}
      </div>
      <div class="card">
        <h3>2. Posterior &amp; comparaison</h3>
        <div id="bayes-lab-dynamic">${renderBayesDynamicHtml(b, m)}</div>
      </div>
    `;
    bindBayesLabEvents();
  }

  function bindBayesLabEvents() {
    const byN = document.getElementById("by-n");
    const byD = document.getElementById("by-d");
    const byPriorType = document.getElementById("by-prior-type");
    const byCred = document.getElementById("by-cred");
    const byTargetPd = document.getElementById("by-target-pd");
    const byPriorWeight = document.getElementById("by-prior-weight");
    const byCustomAlpha = document.getElementById("by-custom-alpha");
    const byCustomBeta = document.getElementById("by-custom-beta");

      if (byN) {
    byN.addEventListener("input", () => {
      state.bayes.n = byN.value;
      saveState();
      updateBayesLabOutput();
    });
    byN.addEventListener("blur", () => {
      state.bayes.n = byN.value;
      saveState();
      updateBayesLabOutput();
    });
  }

      if (byD) {
    byD.addEventListener("input", () => {
      state.bayes.d = byD.value;
      saveState();
      updateBayesLabOutput();
    });
    byD.addEventListener("blur", () => {
      state.bayes.d = byD.value;
      saveState();
      updateBayesLabOutput();
    });
  }

    if (byPriorType) {
      byPriorType.addEventListener("change", () => {
        state.bayes.priorType = byPriorType.value;
        saveState();
        renderBayesLab();
      });
    }

    if (byCred) {
      byCred.addEventListener("change", () => {
        state.bayes.credLevel = Number(byCred.value) === 0.9 ? 0.9 : 0.95;
        saveState();
        updateBayesLabOutput();
      });
    }

    if (byTargetPd) {
      byTargetPd.addEventListener("input", () => {
        if (byTargetPd.value === "") return;
        const val = Number(byTargetPd.value);
        if (!Number.isFinite(val) || val <= 0) return;
        state.bayes.targetPdPct = Math.min(99, Math.max(0.01, val));
        saveState();
        updateBayesLabOutput();
      });
      byTargetPd.addEventListener("blur", () => {
        const val = Number(byTargetPd.value);
        state.bayes.targetPdPct =
          Number.isFinite(val) && val > 0 ? Math.min(99, Math.max(0.01, val)) : 1.5;
        byTargetPd.value = String(state.bayes.targetPdPct);
        saveState();
        updateBayesLabOutput();
      });
    }

    if (byPriorWeight) {
      byPriorWeight.addEventListener("input", () => {
        if (byPriorWeight.value === "") return;
        const val = Number(byPriorWeight.value);
        if (!Number.isFinite(val) || val <= 0) return;
        state.bayes.priorWeight = Math.max(0.5, val);
        saveState();
        updateBayesLabOutput();
      });
      byPriorWeight.addEventListener("blur", () => {
        const val = Number(byPriorWeight.value);
        state.bayes.priorWeight = Number.isFinite(val) && val > 0 ? Math.max(0.5, val) : 40;
        byPriorWeight.value = String(state.bayes.priorWeight);
        saveState();
        updateBayesLabOutput();
      });
    }

    if (byCustomAlpha) {
      byCustomAlpha.addEventListener("input", () => {
        if (byCustomAlpha.value === "") return;
        const val = Number(byCustomAlpha.value);
        if (!Number.isFinite(val) || val <= 0) return;
        state.bayes.customAlpha = Math.max(0.05, val);
        saveState();
        updateBayesLabOutput();
      });
      byCustomAlpha.addEventListener("blur", () => {
        const val = Number(byCustomAlpha.value);
        state.bayes.customAlpha = Number.isFinite(val) && val > 0 ? Math.max(0.05, val) : 1;
        byCustomAlpha.value = String(state.bayes.customAlpha);
        saveState();
        updateBayesLabOutput();
      });
    }

    if (byCustomBeta) {
      byCustomBeta.addEventListener("input", () => {
        if (byCustomBeta.value === "") return;
        const val = Number(byCustomBeta.value);
        if (!Number.isFinite(val) || val <= 0) return;
        state.bayes.customBeta = Math.max(0.05, val);
        saveState();
        updateBayesLabOutput();
      });
      byCustomBeta.addEventListener("blur", () => {
        const val = Number(byCustomBeta.value);
        state.bayes.customBeta = Number.isFinite(val) && val > 0 ? Math.max(0.05, val) : 49;
        byCustomBeta.value = String(state.bayes.customBeta);
        saveState();
        updateBayesLabOutput();
      });
    }

    const pZero = document.getElementById("by-preset-ldp-zero");
    const pSmall = document.getElementById("by-preset-small-n");
    const pLarge = document.getElementById("by-preset-large-n");
    if (pZero) {
      pZero.addEventListener("click", () => {
        state.bayes = {
          ...state.bayes,
          n: 60,
          d: 0,
          priorType: "informative",
          targetPdPct: 1.5,
          priorWeight: 40
        };
        saveState();
        renderBayesLab();
      });
    }
    if (pSmall) {
      pSmall.addEventListener("click", () => {
        state.bayes = {
          ...state.bayes,
          n: 4,
          d: 2,
          priorType: "informative",
          targetPdPct: 2.0,
          priorWeight: 20
        };
        saveState();
        renderBayesLab();
      });
    }
    if (pLarge) {
      pLarge.addEventListener("click", () => {
        state.bayes = { ...state.bayes, n: 800, d: 12, priorType: "jeffreys" };
        saveState();
        renderBayesLab();
      });
    }
  }

  function setView(viewName) {
    state.view = viewName;
    if (els.viewHome) els.viewHome.classList.toggle("hidden", viewName !== "home");
    if (els.viewMarkov) els.viewMarkov.classList.toggle("hidden", viewName !== "markov");
    if (els.viewBayes) els.viewBayes.classList.toggle("hidden", viewName !== "bayes");
    if (els.btnHome) els.btnHome.classList.toggle("hidden", viewName === "home");

    if (els.appTitle && els.appSubtitle) {
      if (viewName === "home") {
        els.appTitle.textContent = "Labo Probas & Risque";
        els.appSubtitle.textContent = "100 % local • Sans serveur • Sans suivi";
      } else if (viewName === "markov") {
        els.appTitle.textContent = "Module 1 — Chaînes de Markov";
        els.appSubtitle.textContent = "Discret & Continu • JLT & IRW • Contrôles locaux";
      } else if (viewName === "bayes") {
        els.appTitle.textContent = "Module 2 — Bayes & Conjugaison";
        els.appSubtitle.textContent = "Bêta-Bernoulli • Prior & Posterior • LDP";
        renderBayesLab();
      }
    }
  }

  function setMarkovTab(tabName) {
    state.markovTab = tabName;
    document.querySelectorAll("[data-markov-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.markovTab === tabName);
    });
    const tIn = document.getElementById("markov-tab-inputs");
    const tRe = document.getElementById("markov-tab-results");
    const tTh = document.getElementById("markov-tab-theory");
    if (tIn) tIn.classList.toggle("hidden", tabName !== "inputs");
    if (tRe) tRe.classList.toggle("hidden", tabName !== "results");
    if (tTh) tTh.classList.toggle("hidden", tabName !== "theory");
  }

  function setBayesTab(tabName) {
    state.bayesTab = tabName;
    document.querySelectorAll("[data-bayes-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.bayesTab === tabName);
    });
    const bTh = document.getElementById("bayes-tab-theory");
    const bLa = document.getElementById("bayes-tab-lab");
    if (bTh) bTh.classList.toggle("hidden", tabName !== "theory");
    if (bLa) bLa.classList.toggle("hidden", tabName !== "lab");
    if (tabName === "lab") renderBayesLab();
  }

  function bindEvents() {
    if (els.btnHome) els.btnHome.addEventListener("click", () => setView("home"));

    document.querySelectorAll("[data-open-module]").forEach((card) => {
      card.addEventListener("click", () => {
        const mod = card.dataset.openModule;
        if (mod) setView(mod);
      });
    });

    document.querySelectorAll("[data-markov-tab]").forEach((btn) => {
      btn.addEventListener("click", () => setMarkovTab(btn.dataset.markovTab));
    });

    document.querySelectorAll("[data-bayes-tab]").forEach((btn) => {
      btn.addEventListener("click", () => setBayesTab(btn.dataset.bayesTab));
    });

    if (els.mkStates) {
      els.mkStates.addEventListener("change", () => {
        const n = Math.min(14, Math.max(2, parseInt(els.mkStates.value, 10) || 4));
        state.nStates = n;
        els.mkStates.value = String(n);
        state.matrix = resizeMatrix(n, state.mode, state.matrix);
        saveState();
        renderMatrixEditor();
      });
    }

    if (els.mkUnit) {
      els.mkUnit.addEventListener("change", () => {
        state.unit = els.mkUnit.value === "month" ? "month" : "year";
        updateHorizonLabel();
        saveState();
      });
    }

    if (els.mkMode) {
      els.mkMode.addEventListener("change", () => {
        const prevMode = state.mode;
        const nextMode = els.mkMode.value === "count" ? "count" : "pct";
        if (prevMode !== nextMode) {
          state.mode = nextMode;
          state.matrix = buildCleanMatrix(state.nStates, state.mode);
          saveState();
          renderMatrixEditor();
        }
      });
    }

    if (els.mkHorizon) {
      els.mkHorizon.addEventListener("input", () => {
        const h = Number(els.mkHorizon.value);
        state.horizon = Number.isFinite(h) && h > 0 ? h : 1;
        updateHorizonLabel();
        saveState();
      });
    }

    if (els.presetClean) {
      els.presetClean.addEventListener("click", () => {
        state.matrix = buildCleanMatrix(state.nStates, state.mode);
        saveState();
        renderMatrixEditor();
      });
    }

    if (els.presetZeroDef) {
      els.presetZeroDef.addEventListener("click", () => {
        state.matrix = buildZeroDefaultMatrix(state.nStates, state.mode);
        saveState();
        renderMatrixEditor();
      });
    }

    if (els.presetInvalidIrw) {
      els.presetInvalidIrw.addEventListener("click", () => {
        state.matrix = buildInvalidIrwMatrix(state.nStates, state.mode);
        saveState();
        renderMatrixEditor();
      });
    }

    if (els.mkComputeBtn) {
      els.mkComputeBtn.addEventListener("click", () => {
        computeAndRenderResults();
        setMarkovTab("results");
      });
    }
  }

  function init() {
    try {
      cacheDom();
      loadState();
      if (els.mkStates) els.mkStates.value = String(state.nStates);
      if (els.mkUnit) els.mkUnit.value = state.unit;
      if (els.mkMode) els.mkMode.value = state.mode;
      if (els.mkHorizon) els.mkHorizon.value = String(state.horizon);

      updateHorizonLabel();
      renderMatrixEditor();
      renderTheoryContent();
      renderBayesLab();
      setView("home");
    } catch (_) {}

    try {
      bindEvents();
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
