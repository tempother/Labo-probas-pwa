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
      priorType: "informative", // "informative" | "uniform" | "jeffreys" | "custom"
      targetPdPct: 1.5,
      priorWeight: 40,
      customAlpha: 1,
      customBeta: 49,
      credLevel: 0.95
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
    } catch (_) {
      // Ignore storage restrictions
    }
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
          n: Math.max(1, parseInt(parsed.bayes.n, 10) || 60),
          d: Math.max(0, parseInt(parsed.bayes.d, 10) || 0),
          priorType: ["informative", "uniform", "jeffreys", "custom"].includes(parsed.bayes.priorType)
            ? parsed.bayes.priorType
            : "informative",
          targetPdPct: Math.min(99, Math.max(0.01, Number(parsed.bayes.targetPdPct) || 1.5)),
          priorWeight: Math.max(0.5, Number(parsed.bayes.priorWeight) || 40),
          customAlpha: Math.max(0.05, Number(parsed.bayes.customAlpha) || 1),
          customBeta: Math.max(0.05, Number(parsed.bayes.customBeta) || 49),
          credLevel: parsed.bayes.credLevel === 0.9 ? 0.9 : 0.95
        };
        if (state.bayes.d > state.bayes.n) state.bayes.d = state.bayes.n;
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

    return {
      valid: globalMessages.length === 0,
      rowErrors,
      cellErrors,
      globalMessages
    };
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
        for (let j = 0; j < n; j++) {
          C[i][j] += aik * B[k][j];
        }
      }
    }
    return C;
  }

  function matEye(n) {
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (__, j) => (i === j ? 1 : 0))
    );
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
      for (let j = 0; j < n; j++) {
        maxAbs = Math.max(maxAbs, Math.abs(M[i][j]));
      }
    }
    const s = Math.max(0, Math.ceil(Math.log2(Math.max(1, maxAbs))));
    const scaled = matScale(M, 1 / Math.pow(2, s));

    let res = matEye(n);
    let term = matEye(n);
    for (let k = 1; k <= 18; k++) {
      term = matScale(matMul(term, scaled), 1 / k);
      res = matAdd(res, term);
    }

    for (let step = 0; step < s; step++) {
      res = matMul(res, res);
    }
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

    const MAX_TERMS = 120;
    for (let m = 1; m <= MAX_TERMS; m++) {
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

    const convergenceIssues = [];
    if (!converged) {
      convergenceIssues.push(
        "La série du logarithme matriciel log(P) ne converge pas (certaines valeurs propres de P sont trop éloignées de 1 ; la génératrice candidate n’a pas pu être calculée)."
      );
    }

    return { Q, convergenceIssues, converged };
  }

  function diagnoseGenerator(Q) {
    const n = Q.length;
    const issues = [];
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        const v = Q[i][j];
        if (!Number.isFinite(v)) {
          issues.push(`Ligne ${i + 1} (${stateLabel(i, n)}) : valeur non finie dans le générateur.`);
          continue;
        }
        sum += v;
        if (i !== j && v < -1e-7) {
          issues.push(
            `Ligne ${i + 1} (${stateLabel(i, n)}), colonne ${stateLabel(j, n)} : intensité hors diagonale négative (${v.toFixed(4)}).`
          );
        }
        if (i === j && v > 1e-7) {
          issues.push(`Ligne ${i + 1} (${stateLabel(i, n)}) : terme diagonal positif (${v.toFixed(4)}).`);
        }
      }
      if (Number.isFinite(sum)) {
        if (i === n - 1 && Math.abs(sum) > 1e-6) {
          issues.push("La ligne du défaut absorbant doit être nulle.");
        } else if (Math.abs(sum) > 1e-4) {
          issues.push(`Ligne ${i + 1} (${stateLabel(i, n)}) : somme des intensités = ${sum.toFixed(4)} ≠ 0.`);
        }
      }
    }
    return issues;
  }

  /* --- Fonctions mathématiques Bêta (Module 2) --- */
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
    if (z < 0.5) {
      return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
    }
    let x = c[0];
    const t = z - 1;
    const z1 = t + g + 0.5;
    for (let i = 1; i < g + 2; i++) {
      x += c[i] / (t + i);
    }
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

  // Fraction continue de Lentz pour la fonction Bêta incomplète régularisée I_x(a, b)
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
    if (x < (a + 1) / (a + b + 2)) {
      return (bt * betacf(x, a, b)) / a;
    }
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
      const rowHasErr = validation.rowErrors[i].length > 0;
      tr.classList.toggle("row-error", rowHasErr);

      for (let j = 0; j < n; j++) {
        const cellErr = validation.cellErrors[i][j];
        const td = tr.querySelector(`td[data-cell="${i}-${j}"]`);
        const inp = tr.querySelector(`input.cell-input[data-r="${i}"][data-c="${j}"]`);
        if (td) td.classList.toggle("cell-error", cellErr);
        if (inp) inp.classList.toggle("cell-error", cellErr);
      }

      const rowSum = state.matrix[i].reduce((a, b) => a + (Number(b) || 0), 0);
      const sumCell = tr.querySelector(`td[data-row-sum="${i}"] strong`);
      if (sumCell) {
        sumCell.textContent = state.mode === "pct" ? `${rowSum.toFixed(1)}%` : `${rowSum}`;
      }
    }
  }

  function renderMatrixEditor() {
    const n = state.nStates;
    const unitSuffix = state.mode === "pct" ? "%" : "";

    let html = `<table class="mk-table"><thead><tr><th>De\\Vers ${unitSuffix}</th>`;
    for (let j = 0; j < n; j++) {
      html += `<th>${stateLabel(j, n)}</th>`;
    }
    html += `<th>Σ</th></tr></thead><tbody>`;

    for (let i = 0; i < n; i++) {
      const rowSum = state.matrix[i].reduce((a, b) => a + (Number(b) || 0), 0);
      html += `<tr data-row="${i}">`;
      html += `<th>${stateLabel(i, n)}</th>`;
      for (let j = 0; j < n; j++) {
        const isAbsorbingFixed = i === n - 1 && j < n - 1;
        html += `<td data-cell="${i}-${j}">`;
        html += `<input class="cell-input" type="number" inputmode="decimal" step="any" data-r="${i}" data-c="${j}" value="${state.matrix[i][j]}" ${isAbsorbingFixed ? "disabled" : ""} />`;
        html += `</td>`;
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
    const validation = validateMatrix(state.matrix, state.mode);
    if (!validation.valid) {
      els.mkResultsContent.innerHTML = `
        <div class="error-box">
          <strong>Calcul bloqué :</strong> corrige d’abord les lignes ou cellules en rouge dans l’onglet <strong>Inputs</strong>.
        </div>`;
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
        jltZeroObservedNotes.push(
          `${stateLabel(i, n)} : taux observé = 0,00% → PD continue à 1 période = ${(contDef1 * 100).toFixed(2)}% (génération normale d’une PD strictement positive par migrations indirectes).`
        );
      } else if (gap > 0.01) {
        jltDefaultGaps.push(
          `${stateLabel(i, n)} : tx observé = ${(obsDef * 100).toFixed(2)}% vs PD(exp(Q<sub>JLT</sub>)) = ${(contDef1 * 100).toFixed(2)}% (écart de ${(gap * 100).toFixed(2)} pts)`
        );
      }
    }

    const irw = estimateQ_IRW(P);
    const generatorIssuesIrw = irw.converged ? diagnoseGenerator(irw.Q) : [];
    const irwValid = irw.converged && generatorIssuesIrw.length === 0;
    const expQ_irw = irwValid ? expMatrix(matScale(irw.Q, k)) : null;

    const unitLabel = state.unit === "year" ? "an(s)" : "mois";

    let pdSummary = `<table class="mk-table"><thead><tr>
      <th>État</th>
      <th>Tx déf. observé 1 an</th>
      <th>Discret P<sup>k</sup></th>
      <th>Continu JLT</th>
      <th>Continu IRW</th>
    </tr></thead><tbody>`;

    for (let i = 0; i < lastIdx; i++) {
      const obs1y = `${(P[i][lastIdx] * 100).toFixed(2)}%`;
      const pdDisc = isIntegerHorizon ? `<strong>${(Pk[i][lastIdx] * 100).toFixed(2)}%</strong>` : "Bloqué";
      const pdJlt = `${(expQ_jlt[i][lastIdx] * 100).toFixed(2)}%`;
      const pdIrw = irwValid ? `${(expQ_irw[i][lastIdx] * 100).toFixed(2)}%` : "Bloqué";

      pdSummary += `<tr>
        <th>${stateLabel(i, n)}</th>
        <td>${obs1y}</td>
        <td>${pdDisc}</td>
        <td>${pdJlt}</td>
        <td>${pdIrw}</td>
      </tr>`;
    }
    pdSummary += `</tbody></table>`;

    const discreteSection = isIntegerHorizon
      ? formatMatrixTable(`Modèle discret : P<sup>${k}</sup>`, Pk, true)
      : `<div class="error-box">
          <strong>Calcul discret P<sup>${k}</sup> interdit :</strong> l’horizon <em>k = ${k}</em> n’est pas un nombre entier.
          En temps discret, les transitions s’opèrent par pas entiers ; une puissance fractionnaire n’a pas de sens direct comme matrice de transition markovienne. Utilise le modèle continu ci-dessous pour un horizon fractionnaire.
        </div>`;

    let jltDiagnosticHtml = "";
    if (issuesJlt.length > 0) {
      jltDiagnosticHtml = `<div class="error-box">${issuesJlt.join(" ")}</div>`;
    } else if (jltDefaultGaps.length > 0) {
      jltDiagnosticHtml = `<div class="warn-box">
        <strong>Problème d’embeddability / écart sur la colonne Défaut (&gt; 1 pt) avec JLT :</strong>
        <p style="margin:0.35rem 0 0;">Sur un pas unitaire, <em>exp(Q<sub>JLT</sub>)</em> s’écarte de plus de 1 point de pourcentage des taux de défaut observés dans <em>P</em> :</p>
        <ul>${jltDefaultGaps.map((g) => `<li>${g}</li>`).join("")}</ul>
      </div>`;
    } else {
      jltDiagnosticHtml = `<p class="helper-text">Diagnostic JLT : générateur valide ; sur un pas unitaire, les PD issues de <em>exp(Q<sub>JLT</sub>)</em> restent cohérentes avec <em>P</em>.</p>`;
    }

    if (jltZeroObservedNotes.length > 0) {
      jltDiagnosticHtml += `<p class="helper-text"><strong>Effet temps continu (0 défaut observé) :</strong> ${jltZeroObservedNotes.join(" ")}</p>`;
    }

    let irwSection = "";
    if (irwValid) {
      irwSection = `
        ${formatMatrixTable(`Générateur Q<sub>IRW</sub> — Estimateur IRW`, irw.Q, false)}
        <p class="helper-text">Générateur IRW valide (somme des lignes = 0, hors diagonale ≥ 0, diagonale ≤ 0).</p>
        ${formatMatrixTable(`Modèle continu (IRW) : exp(${k} · Q<sub>IRW</sub>)`, expQ_irw, true)}
      `;
    } else if (!irw.converged) {
      irwSection = `
        <h4 class="result-section-title">Modèle continu (IRW)</h4>
        <div class="error-box">
          <strong>Calcul IRW bloqué — Série log(P) non convergente :</strong>
          <ul>${irw.convergenceIssues.map((msg) => `<li>${msg}</li>`).join("")}</ul>
        </div>
      `;
    } else {
      irwSection = `
        <h4 class="result-section-title">Modèle continu (IRW)</h4>
        <div class="error-box">
          <strong>Calcul IRW bloqué — Générateur IRW non valide :</strong>
          <ul>${generatorIssuesIrw.map((msg) => `<li>${msg}</li>`).join("")}</ul>
        </div>
      `;
    }

    els.mkResultsContent.innerHTML = `
      <h2>Résultats — Horizon k = ${k} ${unitLabel}</h2>
      <p class="helper-text">
        Le <strong>taux de défaut observé à 1 an</strong> (issu de <em>P</em>) est toujours affiché en repère à côté des projections à l’horizon <em>k</em>.
      </p>
      <h3 class="result-section-title">Synthèse des probabilités de défaut vers l’état absorbant</h3>
      <div class="matrix-scroll">${pdSummary}</div>
      ${formatMatrixTable(`Matrice de transition estimée P (1 ${state.unit === "year" ? "an" : "mois"})`, P, true)}
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

    const W = 520;
    const H = 190;
    const padL = 36;
    const padR = 16;
    const padT = 16;
    const padB = 28;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const yCap = 8.5;

    const paths = curves
      .map((c) => {
        const pts = [];
        const steps = 160;
        for (let s = 0; s <= steps; s++) {
          const p = 0.002 + (0.996 * s) / steps;
          const yRaw = Math.min(yCap, betaPdf(p, c.a, c.b));
          const sx = padL + p * plotW;
          const sy = padT + plotH - (yRaw / yCap) * plotH;
          pts.push(`${s === 0 ? "M" : "L"}${sx.toFixed(1)},${sy.toFixed(1)}`);
        }
        return `<path d="${pts.join(" ")}" fill="none" stroke="${c.color}" stroke-width="2.2" />`;
      })
      .join("");

    const legend = curves
      .map(
        (c, idx) =>
          `<span style="display:inline-flex;align-items:center;gap:0.3rem;margin-right:0.75rem;font-size:0.76rem;color:#cbd5e1;" key="${idx}">
            <span style="width:10px;height:10px;border-radius:999px;background:${c.color};display:inline-block;"></span>${c.label}
          </span>`
      )
      .join("");

    return `
      <div class="svg-chart-wrap">
        <svg viewBox="0 0 ${W} ${H}" aria-label="Formes de lois Bêta">
          <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#475569" stroke-width="1" />
          <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#475569" stroke-width="1" />
          <text x="${padL}" y="${H - 6}" fill="#94a3b8" font-size="10">0 %</text>
          <text x="${padL + plotW * 0.5}" y="${H - 6}" fill="#94a3b8" font-size="10" text-anchor="middle">p (PD = 50 %)</text>
          <text x="${padL + plotW}" y="${H - 6}" fill="#94a3b8" font-size="10" text-anchor="end">100 %</text>
          <text x="${padL - 6}" y="${padT + 8}" fill="#94a3b8" font-size="10" text-anchor="end">densité</text>
          ${paths}
        </svg>
        <div style="margin-top:0.35rem;">${legend}</div>
      </div>
    `;
  }

  function renderTheoryContent() {
    els.mkTheoryContent.innerHTML = `
      <h2>Théorie — Chaînes de Markov &amp; Risque de Crédit</h2>
      <div class="theory-block">
        <h3>1. États, défaut absorbant et cohérence de la matrice</h3>
        <p>
          Chaque ligne <em>i</em> d’une matrice de transition correspond à un état initial (rating ou défaut).
          Les probabilités doivent être positives ou nulles et sommer à 1 (ou 100 %). Le dernier état est
          <strong>absorbant</strong> : une fois en défaut, la probabilité de rester en défaut vaut 1 et les sorties
          vers les autres états sont nulles.
        </p>
      </div>
      <div class="theory-block">
        <h3>2. Pourquoi utiliser le temps continu en risque de crédit ?</h3>
        <p>
          En temps discret, une matrice annuelle <em>P</em> ne permet d’évaluer naturellement que des horizons entiers
          (<em>P<sup>1</sup>, P<sup>2</sup>, P<sup>3</sup>…</em>) : un exposant non entier (comme <em>k = 0,5</em> pour 6 mois) est interdit car une
          puissance fractionnaire n’a pas de sens markovien direct et peut produire des probabilités négatives.
          Le <strong>temps continu</strong> modélise les migrations par un flux instantané via un générateur <em>Q</em> :
          il permet d’évaluer n’importe quel horizon réel <em>k &gt; 0</em> (3 mois, 6 mois, 18 mois) via
          <strong>P(k) = exp(k · Q)</strong>, de générer une PD strictement positive même lorsqu’aucun défaut n’a été
          observé sur un pas (via les migrations indirectes) et de raisonner en intensités instantanées de transition.
        </p>
      </div>
      <div class="theory-block">
        <h3>3. Embeddability (plongeabilité en temps continu)</h3>
        <p>
          En mathématiques des chaînes de Markov, une matrice de transition discrète <em>P</em> (sur un pas de temps,
          par exemple 1 an) est dite <strong>embeddable</strong> (plongeable en temps continu) s’il existe au moins un
          générateur markovien valide <em>Q</em> tel que <strong>P = exp(Q)</strong>, avec les propriétés d’un
          générateur : chaque ligne somme à 0, les termes hors diagonale sont ≥ 0 et la diagonale est ≤ 0.
          Toutes les matrices empiriques ne sont pas <em>embeddables</em> : un générateur markovien exact peut ne pas exister.
        </p>
      </div>
      <div class="theory-block">
        <h3>4. Estimateurs JLT et IRW : signification et limites</h3>
        <p>
          <strong>JLT</strong> désigne l’estimateur de <strong>Jarrow, Lando et Turnbull (1997)</strong> : il construit un
          générateur <em>Q<sub>JLT</sub></em> en général valide directement à partir des probabilités hors diagonale de <em>P</em>,
          mais <em>exp(Q<sub>JLT</sub>)</em> ne retrouve pas nécessairement <em>P</em> exactement. Si l’écart sur la colonne de
          défaut dépasse 1 point de pourcentage (hors passage normal d’un taux observé nul à une PD continue &gt; 0), le
          labo signale un problème d’<em>embeddability</em> ou d’approximation.
        </p>
        <p>
          <strong>IRW</strong> désigne l’approche d’<strong>Israel, Rosenthal et Wei (2001)</strong> : elle estime une
          génératrice candidate via le logarithme matriciel <em>log(P)</em>. Si la série ne converge pas, le calcul IRW
          est bloqué faute de convergence ; si elle converge mais que le générateur obtenu présente des intensités hors
          diagonale négatives (ou ne respecte pas les propriétés d’un générateur), il n’est pas valide et le calcul IRW
          est également bloqué.
        </p>
      </div>
    `;

    els.bayesTheoryContent.innerHTML = `
      <h2>Bayes &amp; Conjugaison — Fondements pour la PD</h2>

      <div class="theory-block">
        <h3>1. Fréquentiste vs Bayésien : quel statut pour la PD <em>p</em> ?</h3>
        <p>
          En approche <strong>fréquentiste</strong>, la probabilité de défaut <em>p</em> est un paramètre <strong>fixe mais inconnu</strong> :
          ce n’est pas une variable aléatoire. L’aléa vient de l’échantillon tiré, ce qui rend l’estimateur
          <em>p̂<sub>fréq</sub> = d / n</em> aléatoire d’un échantillon à l’autre. Un intervalle de confiance fréquentiste porte
          sur la procédure d’échantillonnage répétée, pas sur une loi de probabilité attribuée à <em>p</em>.
        </p>
        <p>
          En approche <strong>bayésienne</strong>, les données observées (<em>d</em> défauts sur <em>n</em> expositions) sont
          prises comme fixes une fois observées, et <strong><em>p</em> lui-même est traité comme une variable aléatoire</strong>
          sur [0, 1]. On représente l’incertitude sur <em>p</em> par une distribution de probabilité, et un
          <strong>intervalle de crédibilité</strong> exprime directement la probabilité que <em>p</em> se situe dans cet intervalle
          sachant le <em>prior</em> et les données.
        </p>
      </div>

      <div class="theory-block">
        <h3>2. Formule de Bayes et sens de la « conjugaison »</h3>
        <div class="formula-callout">
          <strong>π(p | d, n) ∝ L(d, n | p) · π(p)</strong>
        </div>
        <p>
          Chaque terme a un rôle précis : <strong>π(p)</strong> est le <em>prior</em> (la croyance initiale sur <em>p</em> avant
          les nouvelles données), <strong>L(d, n | p) ∝ p<sup>d</sup>(1 − p)<sup>n − d</sup></strong> est la <em>vraisemblance</em>
          (la probabilité d’observer <em>d</em> défauts sur <em>n</em> expositions pour une valeur donnée de <em>p</em>), et
          <strong>π(p | d, n)</strong> est le <em>posterior</em> (la distribution mise à jour de <em>p</em> après observation des données).
        </p>
        <p>
          On appelle le résultat le <strong>posterior</strong>, et on dit que la loi <strong>Bêta</strong> est <strong>conjuguée</strong>
          à la vraisemblance Bernoulli/Binomiale parce que le produit des deux garde la <strong>même forme algébrique</strong> :
          partir d’un <em>prior</em> <strong>Bêta(α<sub>0</sub>, β<sub>0</sub>)</strong> et observer <em>d</em> défauts sur <em>n</em> expositions
          donne directement un <em>posterior</em> <strong>Bêta(α<sub>0</sub> + d, β<sub>0</sub> + n − d)</strong>, sans calcul numérique lourd.
        </p>
      </div>

      <div class="theory-block">
        <h3>3. Pourquoi une loi Bêta (et non une loi Normale) ?</h3>
        <p>
          Une probabilité de défaut <em>p</em> est bornée entre 0 et 1. Une loi Normale s’étend de −∞ à +∞ et peut
          déborder sous 0 % lorsque la PD est faible ou l’échantillon petit, tout en imposant une symétrie inadaptée
          près des bords. La densité d’une loi Bêta s’écrit :
        </p>
        <div class="formula-callout">
          <strong>f(p ; α, β) = [ 1 / B(α, β) ] · p<sup>α − 1</sup> · (1 − p)<sup>β − 1</sup></strong> &nbsp; sur [0, 1]
        </div>
        <p>
          Elle respecte naturellement le support [0, 1], épouse l’asymétrie près de 0 % et conserve la conjugaison.
        </p>
      </div>

      <div class="theory-block">
        <h3>4. Poids du prior vs poids des données : à quoi ressemblent les lois Bêta ?</h3>
        <p>
          L’espérance du <em>posterior</em> s’écrit comme une <strong>moyenne pondérée</strong> entre la moyenne du <em>prior</em>
          <em>μ<sub>0</sub> = α<sub>0</sub> / (α<sub>0</sub> + β<sub>0</sub>)</em> et le taux observé <em>p̂<sub>obs</sub> = d / n</em> :
        </p>
        <div class="formula-callout">
          <strong>E[p | d, n] = [ (α<sub>0</sub> + β<sub>0</sub>) / (α<sub>0</sub> + β<sub>0</sub> + n) ] · μ<sub>0</sub> + [ n / (α<sub>0</sub> + β<sub>0</sub> + n) ] · (d / n)</strong>
        </div>
        <p>
          Ce ne sont pas les noms des lois qui fixent les poids, mais la comparaison entre la <strong>taille du pseudo-échantillon
          a priori</strong> <em>n<sub>0</sub> = α<sub>0</sub> + β<sub>0</sub></em> (<em>α<sub>0</sub></em> pseudo-défauts, <em>β<sub>0</sub></em> pseudo-sains)
          et le volume réel <em>n</em>. Plus <em>n<sub>0</sub></em> est grand devant <em>n</em>, plus le <em>prior</em> pèse ; plus <em>n</em>
          est grand, plus les données dominent.
        </p>
        ${buildBetaShapesSvg()}
      </div>

      <div class="theory-block">
        <h3>5. Limites du fréquentiste en LDP et question du Labo (Mode 1)</h3>
        <p>
          Sur un portefeuille à faible défaut (<strong>LDP</strong>), l’approche fréquentiste <em>d / n</em> peut produire
          <strong>0 %</strong> quand <em>d = 0</em> (difficile à justifier pour un risque de crédit non nul) ou sauter entre
          0 % et 100 % sur un très petit échantillon <em>n</em>. En contrepartie, quand <em>n</em> est petit ou <em>d = 0</em>,
          le <em>posterior</em> bayésien reste sensible au choix du <em>prior</em> : ce choix doit donc être explicite et justifié.
        </p>
        <p>
          <strong>Question traitée dans le Labo (Mode 1) :</strong> <em>« Sur un segment où l’on observe n expositions et d défauts
          (y compris d = 0 ou un petit n), quelle loi posterior obtient-on pour p à partir d’un prior choisi, quelle est
          l’estimation posterior et son incertitude, et comment se compare-t-elle au taux fréquentiste d / n ? »</em>
        </p>
      </div>
    `;
  }

  function getPriorParams(b) {
    if (b.priorType === "uniform") {
      return { alpha0: 1, beta0: 1, name: "Uniforme Bêta(1, 1)" };
    }
    if (b.priorType === "jeffreys") {
      return { alpha0: 0.5, beta0: 0.5, name: "Jeffreys Bêta(0.5, 0.5)" };
    }
    if (b.priorType === "custom") {
      return {
        alpha0: Math.max(0.05, Number(b.customAlpha) || 1),
        beta0: Math.max(0.05, Number(b.customBeta) || 49),
        name: `Personnalisé Bêta(${(Number(b.customAlpha) || 1).toFixed(2)}, ${(Number(b.customBeta) || 49).toFixed(2)})`
      };
    }
    const mu0 = Math.min(0.99, Math.max(0.0001, (Number(b.targetPdPct) || 1.5) / 100));
    const w0 = Math.max(0.5, Number(b.priorWeight) || 40);
    return {
      alpha0: mu0 * w0,
      beta0: (1 - mu0) * w0,
      name: `Informatif (PD cible ${(mu0 * 100).toFixed(2)} %, poids ${w0})`
    };
  }

  function buildPosteriorChartSvg(priorA, priorB, postA, postB, freqRate, ciLow, ciHigh, credLevel) {
    const W = 540;
    const H = 215;
    const padL = 36;
    const padR = 16;
    const padT = 18;
    const padB = 30;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const steps = 180;
    const sampleP = (s) => 0.0005 + (0.999 * s) / steps;

    let maxY = 1;
    const priorVals = [];
    const postVals = [];
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

    let priorPath = "";
    let postPath = "";
    let ciAreaPath = "";

    for (let s = 0; s <= steps; s++) {
      const p = sampleP(s);
      const sx = xToSvg(p);
      const syPrior = yToSvg(priorVals[s]);
      const syPost = yToSvg(postVals[s]);
      priorPath += `${s === 0 ? "M" : "L"}${sx.toFixed(1)},${syPrior.toFixed(1)}`;
      postPath += `${s === 0 ? "M" : "L"}${sx.toFixed(1)},${syPost.toFixed(1)}`;

      if (p >= ciLow && p <= ciHigh) {
        ciAreaPath += `${ciAreaPath === "" ? "M" : "L"}${sx.toFixed(1)},${syPost.toFixed(1)}`;
      }
    }

    if (ciAreaPath !== "") {
      ciAreaPath += ` L${xToSvg(ciHigh).toFixed(1)},${yToSvg(0).toFixed(1)} L${xToSvg(ciLow).toFixed(1)},${yToSvg(0).toFixed(1)} Z`;
    }

    const freqX = xToSvg(freqRate);

    return `
      <div class="svg-chart-wrap">
        <svg viewBox="0 0 ${W} ${H}" aria-label="Comparaison Prior, Posterior et Fréquentiste">
          ${ciAreaPath ? `<path d="${ciAreaPath}" fill="rgba(56, 189, 248, 0.18)" />` : ""}
          <line x1="${freqX.toFixed(1)}" y1="${padT}" x2="${freqX.toFixed(1)}" y2="${padT + plotH}" stroke="#f59e0b" stroke-width="1.6" stroke-dasharray="4,3" />
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

  function renderBayesLab() {
    const b = state.bayes;
    const n = Math.max(1, parseInt(b.n, 10) || 1);
    const d = Math.min(n, Math.max(0, parseInt(b.d, 10) || 0));
    const s = n - d;
    const prior = getPriorParams(b);
    const alpha0 = prior.alpha0;
    const beta0 = prior.beta0;
    const n0 = alpha0 + beta0;

    const alphaN = alpha0 + d;
    const betaN = beta0 + s;
    const totalN = n0 + n;

    const freqPd = d / n;
    const priorMean = alpha0 / n0;
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

    const priorInputsHtml =
      b.priorType === "informative"
        ? `
          <div class="form-grid">
            <label class="field">
              <span>PD cible du prior (%)</span>
              <input id="by-target-pd" type="number" inputmode="decimal" step="0.05" min="0.01" max="99" value="${b.targetPdPct}" />
            </label>
            <label class="field">
              <span>Poids du prior n<sub>0</sub> = α<sub>0</sub> + β<sub>0</sub></span>
              <input id="by-prior-weight" type="number" inputmode="decimal" step="1" min="0.5" value="${b.priorWeight}" />
            </label>
          </div>
          <p class="helper-text">Paramètres déduits : α<sub>0</sub> = ${alpha0.toFixed(3)}, β<sub>0</sub> = ${beta0.toFixed(3)} (moyenne prior = ${(priorMean * 100).toFixed(2)} %).</p>
        `
        : b.priorType === "custom"
        ? `
          <div class="form-grid">
            <label class="field">
              <span>α<sub>0</sub> (pseudo-défauts &gt; 0)</span>
              <input id="by-custom-alpha" type="number" inputmode="decimal" step="0.1" min="0.05" value="${b.customAlpha}" />
            </label>
            <label class="field">
              <span>β<sub>0</sub> (pseudo-sains &gt; 0)</span>
              <input id="by-custom-beta" type="number" inputmode="decimal" step="0.1" min="0.5" value="${b.customBeta}" />
            </label>
          </div>
          <p class="helper-text">Poids total du prior : n<sub>0</sub> = ${n0.toFixed(2)} (moyenne prior = ${(priorMean * 100).toFixed(2)} %).</p>
        `
        : `<p class="helper-text"><strong>${prior.name}</strong> — α<sub>0</sub> = ${alpha0}, β<sub>0</sub> = ${beta0} (poids total n<sub>0</sub> = ${n0}, moyenne prior = ${(priorMean * 100).toFixed(2)} %).</p>`;

    const zeroDefaultNote =
      d === 0
        ? `<div class="warn-box"><strong>Cas d = 0 défaut observé :</strong> l’estimateur fréquentiste vaut <strong>0,00 %</strong>, alors que la moyenne <em>posterior</em> reste à <strong>${(postMean * 100).toFixed(2)} %</strong> tant que α<sub>0</sub> &gt; 0. Elle diminue lorsque <em>n</em> augmente sans défaut, tout en restant sensible au choix du prior.</div>`
        : "";

    els.bayesLabContent.innerHTML = `
      <div class="card">
        <h2>Mode 1 — Segment / Portefeuille LDP (mono-segment)</h2>
        <p class="helper-text">
          <strong>Question :</strong> Sur un segment de <em>n</em> expositions avec <em>d</em> défauts observés (<em>s = n − d</em> sains), quelle loi <em>posterior</em> obtient-on pour la PD <em>p</em> et comment se compare-t-elle à <em>d / n</em> ?
        </p>
        <div class="actions-row">
          <button id="by-preset-ldp-zero" type="button" class="btn-ghost">Exemple LDP (n = 60, d = 0)</button>
          <button id="by-preset-small-n" type="button" class="btn-ghost">Petit échantillon (n = 4, d = 2)</button>
          <button id="by-preset-large-n" type="button" class="btn-ghost">Échantillon large (n = 800, d = 12)</button>
        </div>
      </div>

      <div class="card">
        <h3>1. Données observées &amp; choix du prior</h3>
        <div class="form-grid">
          <label class="field">
            <span>Expositions observées n (≥ 1)</span>
            <input id="by-n" type="number" inputmode="numeric" step="1" min="1" value="${n}" />
          </label>
          <label class="field">
            <span>Défauts observés d (0 ≤ d ≤ n)</span>
            <input id="by-d" type="number" inputmode="numeric" step="1" min="0" max="${n}" value="${d}" />
          </label>
          <label class="field">
            <span>Famille / choix du prior</span>
            <select id="by-prior-type">
              <option value="informative" ${b.priorType === "informative" ? "selected" : ""}>Informatif (PD cible + poids)</option>
              <option value="uniform" ${b.priorType === "uniform" ? "selected" : ""}>Uniforme Bêta(1, 1)</option>
              <option value="jeffreys" ${b.priorType === "jeffreys" ? "selected" : ""}>Jeffreys Bêta(0.5, 0.5)</option>
              <option value="custom" ${b.priorType === "custom" ? "selected" : ""}>Personnalisé (α₀, β₀)</option>
            </select>
          </label>
          <label class="field">
            <span>Niveau de crédibilité</span>
            <select id="by-cred">
              <option value="0.95" ${b.credLevel === 0.95 ? "selected" : ""}>95 %</option>
              <option value="0.9" ${b.credLevel === 0.9 ? "selected" : ""}>90 %</option>
            </select>
          </label>
        </div>
        ${priorInputsHtml}
      </div>

      <div class="card">
        <h3>2. Posterior conjuguée &amp; comparaison fréquentiste</h3>
        <div class="formula-callout">
          <strong>Posterior : Bêta(α<sub>n</sub>, β<sub>n</sub>) = Bêta(${alphaN.toFixed(2)}, ${betaN.toFixed(2)})</strong>
          &nbsp; (α<sub>0</sub> + d = ${alpha0.toFixed(2)} + ${d} ; β<sub>0</sub> + n − d = ${beta0.toFixed(2)} + ${s})
        </div>

        <div class="bayes-kpi-grid">
          <div class="kpi-box">
            <div class="kpi-label">Moyenne posterior E[p | données]</div>
            <div class="kpi-value">${(postMean * 100).toFixed(2)} %</div>
            <div class="kpi-sub">Écart-type : ${(postSd * 100).toFixed(2)} %</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Fréquentiste d / n</div>
            <div class="kpi-value">${(freqPd * 100).toFixed(2)} %</div>
            <div class="kpi-sub">${d} défaut(s) / ${n} sains+déf. (${s} sains)</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Intervalle crédibilité ${Math.round(b.credLevel * 100)} %</div>
            <div class="kpi-value">${(ciLow * 100).toFixed(2)} % – ${(ciHigh * 100).toFixed(2)} %</div>
            <div class="kpi-sub">Quantiles de la loi Bêta</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-label">Mode posterior</div>
            <div class="kpi-value">${postMode !== null ? `${(postMode * 100).toFixed(2)} %` : "Sur bord / plat"}</div>
            <div class="kpi-sub">Max de densité sur [0, 1]</div>
          </div>
        </div>

        <h4 class="result-section-title">Décomposition des poids (moyenne pondérée)</h4>
        <div class="weight-bar" aria-hidden="true">
          <div class="weight-prior" style="width:${wPriorPct.toFixed(1)}%"></div>
          <div class="weight-data" style="width:${wDataPct.toFixed(1)}%"></div>
        </div>
        <p class="helper-text">
          <strong>Prior</strong> (n<sub>0</sub> = ${n0.toFixed(1)}) : <strong>${wPriorPct.toFixed(1)} %</strong>
          &nbsp;•&nbsp;
          <strong>Données</strong> (n = ${n}) : <strong>${wDataPct.toFixed(1)} %</strong>
        </p>

        ${zeroDefaultNote}

        <h4 class="result-section-title">Densités Prior vs Posterior &amp; repère fréquentiste</h4>
        ${buildPosteriorChartSvg(alpha0, beta0, alphaN, betaN, freqPd, ciLow, ciHigh, b.credLevel)}
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
        const nextN = Math.max(1, parseInt(byN.value, 10) || 1);
        state.bayes.n = nextN;
        if (state.bayes.d > nextN) state.bayes.d = nextN;
        saveState();
        renderBayesLab();
      });
    }
    if (byD) {
      byD.addEventListener("input", () => {
        const nextD = Math.min(state.bayes.n, Math.max(0, parseInt(byD.value, 10) || 0));
        state.bayes.d = nextD;
        saveState();
        renderBayesLab();
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
        renderBayesLab();
      });
    }
    if (byTargetPd) {
      byTargetPd.addEventListener("input", () => {
        state.bayes.targetPdPct = Math.min(99, Math.max(0.01, Number(byTargetPd.value) || 0.01));
        saveState();
        renderBayesLab();
      });
    }
    if (byPriorWeight) {
      byPriorWeight.addEventListener("input", () => {
        state.bayes.priorWeight = Math.max(0.5, Number(byPriorWeight.value) || 0.5);
        saveState();
        renderBayesLab();
      });
    }
    if (byCustomAlpha) {
      byCustomAlpha.addEventListener("input", () => {
        state.bayes.customAlpha = Math.max(0.05, Number(byCustomAlpha.value) || 0.05);
        saveState();
        renderBayesLab();
      });
    }
    if (byCustomBeta) {
      byCustomBeta.addEventListener("input", () => {
        state.bayes.customBeta = Math.max(0.05, Number(byCustomBeta.value) || 0.05);
        saveState();
        renderBayesLab();
      });
    }

    const pZero = document.getElementById("by-preset-ldp-zero");
    const pSmall = document.getElementById("by-preset-small-n");
    const pLarge = document.getElementById("by-preset-large-n");

    if (pZero) {
      pZero.addEventListener("click", () => {
        state.bayes.n = 60;
        state.bayes.d = 0;
        state.bayes.priorType = "informative";
        state.bayes.targetPdPct = 1.5;
        state.bayes.priorWeight = 40;
        saveState();
        renderBayesLab();
      });
    }
    if (pSmall) {
      pSmall.addEventListener("click", () => {
        state.bayes.n = 4;
        state.bayes.d = 2;
        state.bayes.priorType = "informative";
        state.bayes.targetPdPct = 2.0;
        state.bayes.priorWeight = 20;
        saveState();
        renderBayesLab();
      });
    }
    if (pLarge) {
      pLarge.addEventListener("click", () => {
        state.bayes.n = 800;
        state.bayes.d = 12;
        state.bayes.priorType = "jeffreys";
        saveState();
        renderBayesLab();
      });
    }
  }

  function setView(viewName) {
    state.view = viewName;
    els.viewHome.classList.toggle("hidden", viewName !== "home");
    els.viewMarkov.classList.toggle("hidden", viewName !== "markov");
    els.viewBayes.classList.toggle("hidden", viewName !== "bayes");
    els.btnHome.classList.toggle("hidden", viewName === "home");

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

  function setMarkovTab(tabName) {
    state.markovTab = tabName;
    document.querySelectorAll("[data-markov-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.markovTab === tabName);
    });
    document.getElementById("markov-tab-inputs").classList.toggle("hidden", tabName !== "inputs");
    document.getElementById("markov-tab-results").classList.toggle("hidden", tabName !== "results");
    document.getElementById("markov-tab-theory").classList.toggle("hidden", tabName !== "theory");
  }

  function setBayesTab(tabName) {
    state.bayesTab = tabName;
    document.querySelectorAll("[data-bayes-tab]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.bayesTab === tabName);
    });
    document.getElementById("bayes-tab-theory").classList.toggle("hidden", tabName !== "theory");
    document.getElementById("bayes-tab-lab").classList.toggle("hidden", tabName !== "lab");
    if (tabName === "lab") renderBayesLab();
  }

  function bindEvents() {
    els.btnHome.addEventListener("click", () => setView("home"));

    document.querySelectorAll("[data-open-module]").forEach((card) => {
      card.addEventListener("click", () => {
        setView(card.dataset.openModule);
      });
    });

    document.querySelectorAll("[data-markov-tab]").forEach((btn) => {
      btn.addEventListener("click", () => setMarkovTab(btn.dataset.markovTab));
    });

    document.querySelectorAll("[data-bayes-tab]").forEach((btn) => {
      btn.addEventListener("click", () => setBayesTab(btn.dataset.bayesTab));
    });

    els.mkStates.addEventListener("change", () => {
      const n = Math.min(14, Math.max(2, parseInt(els.mkStates.value, 10) || 4));
      state.nStates = n;
      els.mkStates.value = String(n);
      state.matrix = resizeMatrix(n, state.mode, state.matrix);
      saveState();
      renderMatrixEditor();
    });

    els.mkUnit.addEventListener("change", () => {
      state.unit = els.mkUnit.value === "month" ? "month" : "year";
      updateHorizonLabel();
      saveState();
    });

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

    els.mkHorizon.addEventListener("input", () => {
      const h = Number(els.mkHorizon.value);
      state.horizon = Number.isFinite(h) && h > 0 ? h : 1;
      updateHorizonLabel();
      saveState();
    });

    els.presetClean.addEventListener("click", () => {
      state.matrix = buildCleanMatrix(state.nStates, state.mode);
      saveState();
      renderMatrixEditor();
    });

    els.presetZeroDef.addEventListener("click", () => {
      state.matrix = buildZeroDefaultMatrix(state.nStates, state.mode);
      saveState();
      renderMatrixEditor();
    });

    els.presetInvalidIrw.addEventListener("click", () => {
      state.matrix = buildInvalidIrwMatrix(state.nStates, state.mode);
      saveState();
      renderMatrixEditor();
    });

    els.mkComputeBtn.addEventListener("click", () => {
      computeAndRenderResults();
      setMarkovTab("results");
    });
  }

  function init() {
    cacheDom();
    loadState();

    els.mkStates.value = String(state.nStates);
    els.mkUnit.value = state.unit;
    els.mkMode.value = state.mode;
    els.mkHorizon.value = String(state.horizon);

    updateHorizonLabel();
    renderMatrixEditor();
    renderTheoryContent();
    renderBayesLab();
    bindEvents();
    setView("home");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
