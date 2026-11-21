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
    matrix: []
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
          matrix: state.matrix
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
    const Q = Array.from({ length: n }, () => Array(n).fill(0));
    const invalidReasons = [];

    for (let i = 0; i < n - 1; i++) {
      const pii = P[i][i];
      if (pii <= 1e-12) {
        invalidReasons.push(
          `Ligne ${i + 1} (${stateLabel(i, n)}) : probabilité diagonale P_ii ≈ 0 ; le logarithme ln(P_ii) est impossible et la génératrice IRW n’est pas valide.`
        );
        Q[i][i] = Number.NaN;
        continue;
      }
      if (pii >= 1 - 1e-12) {
        Q[i][i] = 0;
        for (let j = 0; j < n; j++) {
          if (i !== j) Q[i][j] = 0;
        }
        continue;
      }

      const qii = Math.log(pii);
      Q[i][i] = qii;

      let rawOffSum = 0;
      const offVals = Array(n).fill(0);
      for (let j = 0; j < n; j++) {
        if (i !== j && P[i][j] > 0) {
          const val = (P[i][j] * qii) / (pii - 1);
          offVals[j] = val;
          rawOffSum += val;
        }
      }

      const targetOffSum = -qii;
      const scale = Math.abs(rawOffSum) > 1e-12 ? targetOffSum / rawOffSum : 0;
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          Q[i][j] = offVals[j] * scale;
        }
      }
    }
    Q[n - 1] = Array(n).fill(0);
    return { Q, invalidReasons };
  }

  function diagnoseGenerator(Q) {
    const n = Q.length;
    const issues = [];
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        const v = Q[i][j];
        if (!Number.isFinite(v)) {
          issues.push(`Ligne ${i + 1} (${stateLabel(i, n)}) : valeur non finie dans Q.`);
          continue;
        }
        sum += v;
        if (i !== j && v < -1e-9) {
          issues.push(`Ligne ${i + 1} (${stateLabel(i, n)}), colonne ${stateLabel(j, n)} : intensité hors diagonale négative (${v.toFixed(4)}).`);
        }
        if (i === j && v > 1e-9) {
          issues.push(`Ligne ${i + 1} (${stateLabel(i, n)}) : diagonale positive (${v.toFixed(4)}).`);
        }
      }
      if (Number.isFinite(sum)) {
        if (i === n - 1 && Math.abs(sum) > 1e-6) {
          issues.push("La ligne du défaut absorbant doit être nulle.");
        } else if (Math.abs(sum) > 1e-4) {
          issues.push(`Ligne ${i + 1} (${stateLabel(i, n)}) : somme de Q = ${sum.toFixed(4)} ≠ 0.`);
        }
      }
    }
    return issues;
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

  function formatMatrixTable(title, M, isPct = true) {
    const n = M.length;
    let html = `<h4>${title}</h4><div class="matrix-scroll"><table class="mk-table"><thead><tr><th>État</th>`;
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
    for (let i = 0; i < lastIdx; i++) {
      const gap = Math.abs(expQ1_jlt[i][lastIdx] - P[i][lastIdx]);
      if (gap > 0.01) {
        jltDefaultGaps.push(
          `${stateLabel(i, n)} : PD(P) = ${(P[i][lastIdx] * 100).toFixed(2)}% vs PD(exp(Q_JLT)) = ${(expQ1_jlt[i][lastIdx] * 100).toFixed(2)}% (écart de ${(gap * 100).toFixed(2)} pts)`
        );
      }
    }

    const irw = estimateQ_IRW(P);
    const issuesIrw = [...irw.invalidReasons, ...diagnoseGenerator(irw.Q)];
    const irwValid = issuesIrw.length === 0;
    const expQ_irw = irwValid ? expMatrix(matScale(irw.Q, k)) : null;

    const unitLabel = state.unit === "year" ? "an(s)" : "mois";

    let pdSummary = `<table class="mk-table"><thead><tr>
      <th>État</th>
      <th>PD 1 an</th>
      <th>Discret P^k</th>
      <th>Continu JLT</th>
      <th>Continu IRW</th>
    </tr></thead><tbody>`;

    for (let i = 0; i < lastIdx; i++) {
      const pd1y = `${(P[i][lastIdx] * 100).toFixed(2)}%`;
      const pdDisc = isIntegerHorizon ? `<strong>${(Pk[i][lastIdx] * 100).toFixed(2)}%</strong>` : "Bloqué";
      const pdJlt = `${(expQ_jlt[i][lastIdx] * 100).toFixed(2)}%`;
      const pdIrw = irwValid ? `${(expQ_irw[i][lastIdx] * 100).toFixed(2)}%` : "Bloqué";

      pdSummary += `<tr>
        <th>${stateLabel(i, n)}</th>
        <td>${pd1y}</td>
        <td>${pdDisc}</td>
        <td>${pdJlt}</td>
        <td>${pdIrw}</td>
      </tr>`;
    }
    pdSummary += `</tbody></table>`;

    const discreteSection = isIntegerHorizon
      ? formatMatrixTable(`Modèle discret : P^(${k})`, Pk, true)
      : `<div class="error-box">
          <strong>Calcul discret P^(${k}) interdit :</strong> l’horizon <em>k = ${k}</em> n’est pas un nombre entier.
          En temps discret, les transitions s’opèrent par pas entiers ; une puissance fractionnaire n’a pas de sens direct comme matrice de transition markovienne. Utilise le modèle continu ci-dessous pour un horizon fractionnaire.
        </div>`;

    const jltDiagnosticBox =
      jltDefaultGaps.length > 0
        ? `<div class="warn-box">
            <strong>Problème d’embeddability / écart sur la colonne Défaut (> 1 pt) avec JLT :</strong>
            <p style="margin:0.35rem 0 0;">Sur un pas unitaire, <em>exp(Q_JLT)</em> s’écarte de plus de 1 point de pourcentage des probabilités de défaut de <em>P</em> :</p>
            <ul>${jltDefaultGaps.map((g) => `<li>${g}</li>`).join("")}</ul>
          </div>`
        : `<p class="helper-text">Diagnostic JLT : génératrice valide et écart sur la colonne Défaut ≤ 1 point de pourcentage par rapport à <em>P</em>.</p>`;

    const irwSection = irwValid
      ? `
        ${formatMatrixTable(`Générateur Q — Estimateur IRW`, irw.Q, false)}
        <p class="helper-text">Générateur IRW valide (somme des lignes = 0, hors diagonale ≥ 0, diagonale ≤ 0).</p>
        ${formatMatrixTable(`Modèle continu (IRW) : exp(${k} · Q_IRW)`, expQ_irw, true)}
      `
      : `<div class="error-box">
          <strong>Calcul IRW bloqué — Génératrice IRW non valide :</strong>
          <ul>${issuesIrw.map((msg) => `<li>${msg}</li>`).join("")}</ul>
        </div>`;

    els.mkResultsContent.innerHTML = `
      <h2>Résultats — Horizon k = ${k} ${unitLabel}</h2>
      <p class="helper-text">
        La <strong>PD à 1 an</strong> (issue de <em>P</em>) est toujours affichée en repère à côté des projections à l’horizon <em>k</em>.
      </p>
      <h3>Synthèse des probabilités de défaut vers l’état absorbant</h3>
      <div class="matrix-scroll">${pdSummary}</div>
      ${formatMatrixTable(`Matrice de transition estimée P (1 ${state.unit === "year" ? "an" : "mois"})`, P, true)}
      ${discreteSection}
      ${formatMatrixTable(`Générateur Q — Estimateur JLT`, Q_jlt, false)}
      ${issuesJlt.length > 0 ? `<div class="error-box">${issuesJlt.join(" ")}</div>` : jltDiagnosticBox}
      ${formatMatrixTable(`Modèle continu (JLT) : exp(${k} · Q_JLT)`, expQ_jlt, true)}
      ${irwSection}
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
          (<em>P^1, P^2, P^3…</em>) : un exposant non entier (comme <em>k = 0,5</em> pour 6 mois) est interdit car une
          puissance fractionnaire n’a pas de sens markovien direct et peut produire des probabilités négatives.
          Le <strong>temps continu</strong> modélise les migrations par un flux instantané via un générateur <em>Q</em> :
          il permet d’évaluer n’importe quel horizon réel <em>k &gt; 0</em> (3 mois, 6 mois, 18 mois) via
          <strong>P(k) = exp(k · Q)</strong>, de tenir compte des migrations intermédiaires survenant en cours d’année
          et de lire directement les vitesses instantanées de sortie de chaque rating.
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
        <h3>4. Estimateurs JLT vs IRW</h3>
        <p>
          Avec <strong>JLT</strong>, la génératrice est en général valide, mais <em>exp(Q_JLT)</em> ne retrouve pas
          nécessairement <em>P</em> exactement : si l’écart sur la colonne de défaut dépasse 1 point de pourcentage,
          le labo signale un problème d’<em>embeddability</em> (ou de divergence d’approximation). Avec <strong>IRW</strong>,
          l’approche cherche à restituer <em>P</em> via l’exponentielle, mais si la génératrice produite n’est pas valide
          (par exemple si la diagonale est nulle ou empêche un logarithme valide), le calcul est bloqué et signalé explicitement.
        </p>
      </div>
    `;

    els.bayesTheoryContent.innerHTML = `
      <h2>Bayes &amp; Conjugaison — Fondements pour la PD</h2>
      <div class="theory-block">
        <h3>1. Pourquoi une approche bayésienne en risque de crédit ?</h3>
        <p>
          Sur des portefeuilles à faible défaut (<strong>LDP — Low Default Portfolios</strong>), les observations
          historiques de défauts sont rares. Une estimation fréquentiste brute peut produire une PD nulle ou très
          instable. L’approche bayésienne combine une information préalable (<em>prior</em>) et les données
          observées (<em>vraisemblance</em>) pour produire une distribution complète (<em>posterior</em>).
        </p>
      </div>
      <div class="theory-block">
        <h3>2. Conjugaison Bêta–Bernoulli</h3>
        <p>
          Si chaque exposition suit une loi de Bernoulli de paramètre <em>p</em> (PD), et que l’on choisit un
          <em>prior</em> <strong>Bêta(α₀, β₀)</strong>, alors après avoir observé <em>d</em> défauts sur <em>n</em>
          expositions (<em>s = n - d</em> sains), la loi <em>posterior</em> reste une loi Bêta :
          <strong>Bêta(α₀ + d, β₀ + n - d)</strong>.
        </p>
      </div>
      <div class="theory-block">
        <h3>3. Prior informatif, prior plat ou Jeffreys</h3>
        <p>
          Le choix de (α₀, β₀) encode le niveau de confiance initial : un prior faiblement informatif ou de Jeffreys
          laisse davantage parler les données, tandis qu’un prior plus informatif stabilise l’estimation lorsque
          l’échantillon est petit, tout en restant transparent sur l’hypothèse retenue.
        </p>
      </div>
    `;
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
    bindEvents();
    setView("home");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
