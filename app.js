(() => {
  "use strict";

  const STORAGE_KEY = "labo_probas_pwa_state_v1";

  const state = {
    view: "home", // "home" | "markov" | "bayes"
    markovTab: "inputs", // "inputs" | "results" | "theory"
    bayesTab: "theory", // "theory" | "lab"
    nStates: 4,
    unit: "year", // "year" | "month"
    mode: "pct", // "pct" | "count"
    horizon: 1,
    matrix: [],
    lastValidResult: null
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
    if (idx === n - 1) return `D (Défaut ${n})`;
    if (n <= 4) {
      const names = ["AAA", "BBB", "CCC"];
      return names[idx] || `R${idx + 1}`;
    }
    return `R${idx + 1}`;
  }

  function buildCleanMatrix(n, mode) {
    const m = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n - 1; i++) {
      let defProb = 0.015 * (i + 1);
      let downProb = i < n - 2 ? 0.05 : 0;
      let upProb = i > 0 ? 0.04 : 0;
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
    // Dernier état : défaut absorbant
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
      // Ligne 0 : 0 sur la diagonale mais non-nul hors diagonale -> IRW impossible
      if (mode === "pct") {
        m[0] = Array(n).fill(0);
        m[0][1] = 100;
      } else {
        m[0] = Array(n).fill(0);
        m[0][1] = 100;
      }
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
    base[n - 1][n - 1] = mode === "pct" ? 100 : Math.max(1, Number(oldMatrix[oldMatrix.length - 1]?.[oldMatrix.length - 1]) || 100);
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
      // Ignore storage quota / private mode issues
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
    const rowErrors = Array(n).fill(null).map(() => []);
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
        // Défaut absorbant : P_{DD} = 100% ou effectif > 0, et 0 ailleurs
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

    const valid = globalMessages.length === 0;
    return { valid, rowErrors, cellErrors, globalMessages };
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

  // Puissance matricielle P^k (k entier >= 0 ou fractionnaire via exp(k * log(P)))
  function matPower(P, k) {
    const n = P.length;
    if (k === 0) return matEye(n);
    if (Number.isInteger(k) && k > 0) {
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
    // Pour k non entier : approximation via série de Mercator autour de I : log(P) ≈ sum_{m=1}^{25} (-1)^{m+1} (P-I)^m / m
    const logP = approxLogMatrix(P);
    return expMatrix(matScale(logP, k));
  }

  function approxLogMatrix(P) {
    const n = P.length;
    const I = matEye(n);
    const X = matSub(P, I);
    let sum = Array.from({ length: n }, () => Array(n).fill(0));
    let term = matEye(n);
    for (let m = 1; m <= 25; m++) {
      term = matMul(term, X);
      const coeff = (m % 2 === 1 ? 1 : -1) / m;
      sum = matAdd(sum, matScale(term, coeff));
    }
    return sum;
  }

  // Exponentielle matricielle exp(M) par mise à l'échelle + Padé / Taylor tronqué d'ordre 18
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

  // Estimateur JLT (Jarrow, Lando, Turnbull) : approximations simples des intensités q_{ij}
  function estimateQ_JLT(P) {
    const n = P.length;
    const Q = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n - 1; i++) {
      let rowOffDiagSum = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          // Approximation JLT de premier ordre : q_{ij} ≈ p_{ij}
          Q[i][j] = Math.max(0, P[i][j]);
          rowOffDiagSum += Q[i][j];
        }
      }
      Q[i][i] = -rowOffDiagSum;
    }
    // Dernière ligne (défaut absorbant) : ligne de zéros
    Q[n - 1] = Array(n).fill(0);
    return Q;
  }

  // Estimateur IRW (Israel, Rosenthal, Wei) : correction diagonale et hors-diagonale
  function estimateQ_IRW(P) {
    const n = P.length;
    const Q = Array.from({ length: n }, () => Array(n).fill(0));
    const warnings = [];

    for (let i = 0; i < n - 1; i++) {
      const pii = P[i][i];
      if (pii <= 1e-12) {
        warnings.push(`Ligne ${i + 1} (${stateLabel(i, n)}) : P_ii ≈ 0, l’estimateur IRW classique est mal défini.`);
      }
      const qii = pii > 1e-12 ? Math.log(pii) : -1;
      Q[i][i] = qii;

      let rawOffSum = 0;
      const offVals = Array(n).fill(0);
      for (let j = 0; j < n; j++) {
        if (i !== j && P[i][j] > 0) {
          // Formule IRW : q_{ij} ≈ (p_{ij} * ln(p_{ii})) / (p_{ii} - 1) si p_{ii} != 1
          const denom = pii - 1;
          const val = Math.abs(denom) > 1e-12 ? (P[i][j] * Math.log(Math.max(1e-12, pii))) / denom : P[i][j];
          offVals[j] = Math.max(0, val);
          rawOffSum += offVals[j];
        }
      }

      // Réajustement pour que la somme de la ligne de Q soit 0
      const targetOffSum = -qii;
      const scale = rawOffSum > 1e-12 ? targetOffSum / rawOffSum : 0;
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          Q[i][j] = offVals[j] * scale;
        }
      }
    }
    Q[n - 1] = Array(n).fill(0);
    return { Q, warnings };
  }

  function diagnoseGenerator(Q) {
    const n = Q.length;
    const issues = [];
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += Q[i][j];
        if (i !== j && Q[i][j] < -1e-9) {
          issues.push(`Q[${i + 1},${j + 1}] = ${Q[i][j].toFixed(4)} < 0 (hors-diagonale négative).`);
        }
      }
      if (i === n - 1 && Math.abs(sum) > 1e-6) {
        issues.push("La ligne du défaut absorbant doit être nulle.");
      } else if (Math.abs(sum) > 1e-4) {
        issues.push(`Ligne ${i + 1} : somme de Q = ${sum.toFixed(4)} ≠ 0.`);
      }
    }
    return issues;
  }

  function renderMatrixEditor() {
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

    const unitSuffix = state.mode === "pct" ? " %" : "";
    let html = `<table class="mk-table"><thead><tr><th>De \\ Vers${unitSuffix}</th>`;
    for (let j = 0; j < n; j++) {
      html += `<th>${stateLabel(j, n)}</th>`;
    }
    html += `<th>Somme ligne</th></tr></thead><tbody>`;

    for (let i = 0; i < n; i++) {
      const rowHasErr = validation.rowErrors[i].length > 0;
      const rowSum = state.matrix[i].reduce((a, b) => a + (Number(b) || 0), 0);
      html += `<tr class="${rowHasErr ? "row-error" : ""}">`;
      html += `<th>${stateLabel(i, n)}</th>`;
      for (let j = 0; j < n; j++) {
        const isAbsorbingFixed = i === n - 1 && j < n - 1;
        const cellErr = validation.cellErrors[i][j];
        html += `<td class="${cellErr ? "cell-error" : ""}">`;
        html += `<input class="cell-input ${cellErr ? "cell-error" : ""}" type="number" step="any" data-r="${i}" data-c="${j}" value="${state.matrix[i][j]}" ${isAbsorbingFixed ? "disabled" : ""} />`;
        html += `</td>`;
      }
      const sumDisplay = state.mode === "pct" ? `${rowSum.toFixed(2)}%` : `${rowSum}`;
      html += `<td><strong>${sumDisplay}</strong></td></tr>`;
    }

    html += `</tbody></table>`;
    els.mkMatrixWrapper.innerHTML = html;

    els.mkMatrixWrapper.querySelectorAll("input.cell-input").forEach((inp) => {
      inp.addEventListener("input", (e) => {
        const r = parseInt(e.target.dataset.r, 10);
        const c = parseInt(e.target.dataset.c, 10);
        const val = e.target.value === "" ? 0 : Number(e.target.value);
        state.matrix[r][c] = val;
        saveState();
        renderMatrixEditor();
      });
    });
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
        const txt = isPct ? `${(v * 100).toFixed(2)}%` : v.toFixed(4);
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
    const k = state.horizon;
    const Pk = matPower(P, k);

    const Q_jlt = estimateQ_JLT(P);
    const issuesJlt = diagnoseGenerator(Q_jlt);
    const expQ_jlt = expMatrix(matScale(Q_jlt, k));

    const irw = estimateQ_IRW(P);
    const issuesIrw = [...irw.warnings, ...diagnoseGenerator(irw.Q)];
    const expQ_irw = expMatrix(matScale(irw.Q, k));

    const unitLabel = state.unit === "year" ? "an(s)" : "mois";
    const lastIdx = P.length - 1;

    let pdSummary = `<table class="mk-table"><thead><tr><th>État initial</th><th>PD discret P^k</th><th>PD continu (JLT)</th><th>PD continu (IRW)</th></tr></thead><tbody>`;
    for (let i = 0; i < lastIdx; i++) {
      pdSummary += `<tr>
        <th>${stateLabel(i, P.length)}</th>
        <td><strong>${(Pk[i][lastIdx] * 100).toFixed(2)}%</strong></td>
        <td>${(expQ_jlt[i][lastIdx] * 100).toFixed(2)}%</td>
        <td>${(expQ_irw[i][lastIdx] * 100).toFixed(2)}%</td>
      </tr>`;
    }
    pdSummary += `</tbody></table>`;

    els.mkResultsContent.innerHTML = `
      <h2>Résultats — Horizon k = ${k} ${unitLabel}</h2>
      <p class="helper-text">
        Comparaison entre le modèle discret (puissance de transition) et le modèle continu (exponentielle du générateur <em>Q</em>).
      </p>
      <h3>Probabilités de défaut cumulées vers l’état absorbant</h3>
      <div class="matrix-scroll">${pdSummary}</div>
      ${formatMatrixTable(`Matrice de transition estimée P (1 ${state.unit === "year" ? "an" : "mois"})`, P, true)}
      ${formatMatrixTable(`Modèle discret : P^(${k})`, Pk, true)}
      ${formatMatrixTable(`Générateur Q — Estimateur JLT`, Q_jlt, false)}
      <p class="helper-text">Diagnostic JLT : ${issuesJlt.length === 0 ? "Générateur valide (lignes de somme nulle, hors-diagonale ≥ 0)." : issuesJlt.join(" ")}</p>
      ${formatMatrixTable(`Modèle continu (JLT) : exp(${k} · Q_JLT)`, expQ_jlt, true)}
      ${formatMatrixTable(`Générateur Q — Estimateur IRW`, irw.Q, false)}
      <p class="helper-text">Diagnostic IRW : ${issuesIrw.length === 0 ? "Générateur valide." : issuesIrw.join(" ")}</p>
      ${formatMatrixTable(`Modèle continu (IRW) : exp(${k} · Q_IRW)`, expQ_irw, true)}
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
        <h3>2. Temps discret (P^k) vs temps continu (exp(k·Q))</h3>
        <p>
          En temps discret, on enchaîne des pas de temps fixes via <em>P^k</em>. En temps continu, les migrations
          sont gouvernées par une matrice d’intensités (générateur) <em>Q</em> où chaque ligne somme à 0,
          les termes hors diagonale sont ≥ 0 et la diagonale est ≤ 0. L’évolution sur l’horizon <em>k</em>
          s’écrit alors <em>P(k) = exp(k · Q)</em>, ce qui permet d’évaluer naturellement des horizons non entiers
          (par exemple <em>k = 0,5</em> ou <em>1,25</em>) et d’observer des transitions indirectes même si une case
          était nulle sur une période courte.
        </p>
      </div>
      <div class="theory-block">
        <h3>3. Estimateurs JLT vs IRW et diagnostics</h3>
        <p>
          Passer d’une matrice empirique <em>P</em> à un générateur <em>Q</em> soulève des questions de validité
          (existence d’un logarithme matriciel générateur valide). Comparer <strong>JLT</strong> et <strong>IRW</strong>
          permet d’illustrer la sensibilité des intensités aux zéros empiriques, aux faibles effectifs et aux
          configurations limites (comme une diagonale nulle ou très faible).
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
