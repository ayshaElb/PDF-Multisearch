// ============================================================
//  WVTA Compliance Analyser – v3.0
//  Pipeline 4 étapes :
//   Étape 1 → Lecture CSIAM
//   Étape 2 → Construction du dictionnaire réglementaire (RAG)
//   Étape 3 → Extraction du tableau PART III de la WVTA
//   Étape 4 → Évaluation : acte WVTA vs CSIAM vs Échéances
// ============================================================

// PDF.js worker
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// ============================================================
//  RÉFÉRENTIEL RÉGLEMENTAIRE LOCAL (RAG)
// ============================================================
const REGULATORY_DB = {
    "13H": {
        _default: { min_series: "01", deadline: "2024-07-07", subject: "Freinage – Véhicules tourisme (R13H)" }
    },
    "13": {
        _default: { min_series: "11", deadline: "2024-07-07", subject: "Freinage – Véhicules lourds M2/M3/N/O (R13)" }
    },
    "79": {
        _default: { min_series: "03", deadline: "2024-07-07", subject: "Équipement de direction (R79)" }
    },
    "145": {
        _default: { min_series: "00", deadline: "2024-07-07", subject: "Ancrages ISOFIX et top tether (R145)" }
    },
    "151": {
        _default: { min_series: "00", deadline: "2024-07-07", subject: "Surveillance angle mort – BSIS (R151)" }
    },
    "152": {
        M1: { min_series: "01", deadline: "2024-07-07", subject: "Freinage d'urgence autonome – AEBS VL (R152)" },
        N1: { min_series: "01", deadline: "2024-07-07", subject: "Freinage d'urgence autonome – AEBS VL (R152)" },
        _default: { min_series: "00", deadline: "2024-07-07", subject: "Freinage d'urgence autonome – AEBS (R152)" }
    },
    "159": {
        _default: { min_series: "00", deadline: "2024-07-07", subject: "Système alerte démarrage – MOIS (R159)" }
    },
    "2019/2144": {
        _default: { min_series: "GSR2", deadline: "2024-07-07", subject: "Règlement sécurité générale – GSR II (2019/2144)" }
    },
    "2023/2590": {
        _default: { min_series: "ADDW", deadline: "2026-07-07", subject: "Avertisseur distraction conducteur – ADDW (2023/2590)" }
    }
};

// ============================================================
//  ÉTAT GLOBAL
// ============================================================
const state = {
    csiamText: "",
    wvtaPagesData: [],   // [{ pageNum, text }]
    detectedCategory: null,
    detectedRegulations: [],
    validationDict: {},
    complianceReport: [],
    simulationDate: null, // null = date système
    sortColumn: null,
    sortAsc: true,
    filterText: "",
    currentPage: 1,
    rowsPerPage: 25
};

// ============================================================
//  ÉLÉMENTS DOM
// ============================================================
const wvtaDropzone    = document.getElementById('wvta-dropzone');
const wvtaFileInput   = document.getElementById('wvta-file-input');
const wvtaFileDetails = document.getElementById('wvta-file-details');
const wvtaFilename    = document.getElementById('wvta-filename');
const wvtaFilesize    = document.getElementById('wvta-filesize');
const wvtaRemoveBtn   = document.getElementById('wvta-remove-btn');
const wvtaProgressBar    = document.getElementById('wvta-progress-bar');
const wvtaProgressStatus = document.getElementById('wvta-progress-status');
const wvtaProgressPct    = document.getElementById('wvta-progress-pct');
const wvtaParseProgress  = document.getElementById('wvta-parse-progress');

const csiamDropzone    = document.getElementById('csiam-dropzone');
const csiamFileInput   = document.getElementById('csiam-file-input');
const csiamFileDetails = document.getElementById('csiam-file-details');
const csiamFilename    = document.getElementById('csiam-filename');
const csiamFilesize    = document.getElementById('csiam-filesize');
const csiamRemoveBtn   = document.getElementById('csiam-remove-btn');
const csiamProgressBar    = document.getElementById('csiam-progress-bar');
const csiamProgressStatus = document.getElementById('csiam-progress-status');
const csiamProgressPct    = document.getElementById('csiam-progress-pct');
const csiamParseProgress  = document.getElementById('csiam-parse-progress');

const vehicleCategoryBadge = document.getElementById('vehicle-category-badge');
const vehicleCategoryText  = document.getElementById('vehicle-category-text');

const searchBtn   = document.getElementById('search-btn');
const resetBtn    = document.getElementById('reset-btn');
const simDateSel  = document.getElementById('simulation-date-select');

const emptyState      = document.getElementById('empty-state');
const dashboardContent = document.getElementById('dashboard-content');

const statTotalActs   = document.getElementById('stat-total-acts');
const statBlockers    = document.getElementById('stat-blockers');
const statCompliance  = document.getElementById('stat-compliance');
const statNextDeadline = document.getElementById('stat-next-deadline');

const termDistList    = document.getElementById('term-distribution-list');
const riskMatrix      = document.getElementById('risk-matrix-container');

const tableBody       = document.getElementById('results-table-body');
const tableFilter     = document.getElementById('table-filter');
const resultsCountBadge = document.getElementById('results-count-badge');
const exportCsvBtn    = document.getElementById('export-csv-btn');
const exportJsonBtn   = document.getElementById('export-json-btn');
const tableFooter     = document.getElementById('table-footer');
const paginationInfo  = document.getElementById('pagination-info');
const prevPageBtn     = document.getElementById('prev-page-btn');
const nextPageBtn     = document.getElementById('next-page-btn');
const rowsPerPageSel  = document.getElementById('rows-per-page-select');

const jsonOutputPanel = document.getElementById('json-output-panel');
const jsonOutputPre   = document.getElementById('json-output-pre');
const copyJsonBtn     = document.getElementById('copy-json-btn');
const downloadJsonBtn = document.getElementById('download-json-btn');

const resultModal     = document.getElementById('result-modal');
const modalCloseBtn   = document.getElementById('modal-close-btn');
const modalOkBtn      = document.getElementById('modal-ok-btn');
const modalCopyBtn    = document.getElementById('modal-copy-btn');
const modalSubject    = document.getElementById('modal-subject');
const modalAct        = document.getElementById('modal-act');
const modalApprovalNum = document.getElementById('modal-approval-num');
const modalStatusBadge = document.getElementById('modal-status-badge');
const modalCountry    = document.getElementById('modal-country');
const modalIdentifiedReg = document.getElementById('modal-identified-reg');
const modalCurrentVersion = document.getElementById('modal-current-version');
const modalRequiredVersion = document.getElementById('modal-required-version');
const modalDeadline   = document.getElementById('modal-deadline');
const modalAlertBox   = document.getElementById('modal-alert-box');
const modalAlertExplanation = document.getElementById('modal-alert-explanation');
const modalContextText = document.getElementById('modal-context-text');

// Pipeline steps
const pipelineSteps = {
    1: document.getElementById('pipeline-step-1'),
    2: document.getElementById('pipeline-step-2'),
    3: document.getElementById('pipeline-step-3'),
    4: document.getElementById('pipeline-step-4')
};

// ============================================================
//  DRAG & DROP — WVTA
// ============================================================
setupDropzone(wvtaDropzone, wvtaFileInput, async (pages, file) => {
    state.wvtaPagesData = pages;
    showFileDetails(wvtaFileDetails, wvtaDropzone, wvtaFilename, wvtaFilesize, file);
    checkReady();
});

setupDropzone(csiamDropzone, csiamFileInput, async (pages, file) => {
    state.csiamText = pages.map(p => p.text).join('\n');
    showFileDetails(csiamFileDetails, csiamDropzone, csiamFilename, csiamFilesize, file);
    // Détecter la catégorie pour afficher le badge immédiatement
    const cat = detectCategory(state.csiamText);
    state.detectedCategory = cat;
    if (vehicleCategoryBadge && vehicleCategoryText) {
        vehicleCategoryText.textContent = cat;
        vehicleCategoryBadge.classList.remove('hidden');
    }
    checkReady();
});

function checkReady() {
    if (state.wvtaPagesData.length > 0) {
        if (searchBtn) {
            searchBtn.removeAttribute('disabled');
            searchBtn.classList.add('pulse-btn');
        }
    }
}

function showFileDetails(detailsEl, dropzoneEl, nameEl, sizeEl, file) {
    if (dropzoneEl) dropzoneEl.classList.add('hidden');
    if (detailsEl) detailsEl.classList.remove('hidden');
    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = formatBytes(file.size);
}

function setupDropzone(dropzone, input, callback) {
    if (!dropzone || !input) return;
    dropzone.addEventListener('click', () => input.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', e => {
        e.preventDefault(); dropzone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0], dropzone, input, callback);
    });
    input.addEventListener('change', e => {
        if (e.target.files[0]) processFile(e.target.files[0], dropzone, input, callback);
    });
}

async function processFile(file, dropzone, input, callback) {
    const isWvta = (input === wvtaFileInput);
    const progressEl = isWvta ? wvtaParseProgress : csiamParseProgress;
    const barEl      = isWvta ? wvtaProgressBar   : csiamProgressBar;
    const statusEl   = isWvta ? wvtaProgressStatus : csiamProgressStatus;
    const pctEl      = isWvta ? wvtaProgressPct   : csiamProgressPct;

    if (progressEl) progressEl.classList.remove('hidden');
    if (statusEl) statusEl.textContent = 'Lecture du PDF...';
    if (pctEl) pctEl.textContent = '0%';

    try {
        const arrayBuffer = await file.arrayBuffer();
        const typedArray  = new Uint8Array(arrayBuffer);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        const pages = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            // Reconstruction ligne par ligne en préservant les retours à la ligne
            const items = content.items;
            let lineText = '';
            let lastY = null;
            let pageLines = [];
            for (const item of items) {
                const y = item.transform ? item.transform[5] : null;
                if (lastY !== null && Math.abs(y - lastY) > 3) {
                    pageLines.push(lineText.trim());
                    lineText = '';
                }
                lineText += (item.str || '') + ' ';
                lastY = y;
            }
            if (lineText.trim()) pageLines.push(lineText.trim());
            pages.push({ pageNum: i, text: pageLines.join('\n') });

            const pct = Math.round((i / pdf.numPages) * 100);
            if (barEl) barEl.style.width = pct + '%';
            if (pctEl) pctEl.textContent = pct + '%';
            if (statusEl) statusEl.textContent = `Page ${i} / ${pdf.numPages}`;
        }

        if (progressEl) progressEl.classList.add('hidden');
        await callback(pages, file);
    } catch (err) {
        console.error('Erreur PDF:', err);
        if (statusEl) statusEl.textContent = 'Erreur lecture PDF';
    }
}

// Bouton retirer WVTA
if (wvtaRemoveBtn) wvtaRemoveBtn.addEventListener('click', () => {
    state.wvtaPagesData = [];
    if (wvtaFileDetails) wvtaFileDetails.classList.add('hidden');
    if (wvtaDropzone) wvtaDropzone.classList.remove('hidden');
    if (wvtaFileInput) wvtaFileInput.value = '';
    if (searchBtn) searchBtn.setAttribute('disabled', 'true');
});

if (csiamRemoveBtn) csiamRemoveBtn.addEventListener('click', () => {
    state.csiamText = '';
    state.detectedCategory = null;
    if (csiamFileDetails) csiamFileDetails.classList.add('hidden');
    if (csiamDropzone) csiamDropzone.classList.remove('hidden');
    if (csiamFileInput) csiamFileInput.value = '';
    if (vehicleCategoryBadge) vehicleCategoryBadge.classList.add('hidden');
});

// ============================================================
//  PIPELINE ÉTAPES – INDICATEURS VISUELS
// ============================================================
function setStep(num, status) {
    const el = pipelineSteps[num];
    if (!el) return;
    el.className = 'pipeline-step';
    if (status === 'running') el.classList.add('pipeline-running');
    else if (status === 'done') el.classList.add('pipeline-done');
    else el.classList.add('pipeline-idle');
}

// ============================================================
//  LANCEMENT DE L'ANALYSE
// ============================================================
if (searchBtn) searchBtn.addEventListener('click', runAnalysis);
if (resetBtn)  resetBtn.addEventListener('click', resetAll);

async function runAnalysis() {
    if (state.wvtaPagesData.length === 0) return;

    searchBtn.setAttribute('disabled', 'true');
    searchBtn.innerHTML = '<i class="fa-solid fa-gears fa-spin"></i> Analyse en cours...';

    // Date de simulation
    const simVal = simDateSel ? simDateSel.value : 'current';
    state.simulationDate = (simVal && simVal !== 'current') ? new Date(simVal + 'T00:00:00') : new Date();

    setStep(1, 'running'); setStep(2, 'pending'); setStep(3, 'pending'); setStep(4, 'pending');
    await tick(200);

    // ── ÉTAPE 1 : LECTURE CSIAM ──────────────────────────────
    parseCSIAM();
    setStep(1, 'done'); setStep(2, 'running');
    await tick(200);

    // ── ÉTAPE 2 : DICTIONNAIRE RAG ───────────────────────────
    buildValidationDictionary();
    setStep(2, 'done'); setStep(3, 'running');
    await tick(200);

    // ── ÉTAPE 3 : EXTRACTION PART III WVTA ───────────────────
    const extractedActs = extractWVTAPartIII();
    setStep(3, 'done'); setStep(4, 'running');
    await tick(200);

    // ── ÉTAPE 4 : ÉVALUATION ─────────────────────────────────
    evaluateActs(extractedActs);
    setStep(4, 'done');

    // Rendu
    renderDashboard();

    searchBtn.removeAttribute('disabled');
    searchBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Analyse terminée';
}

function resetAll() {
    state.complianceReport = [];
    state.csiamText = '';
    state.wvtaPagesData = [];
    state.detectedCategory = null;
    state.detectedRegulations = [];
    state.validationDict = {};
    state.currentPage = 1;

    [1,2,3,4].forEach(n => setStep(n, 'idle'));

    if (wvtaFileDetails) wvtaFileDetails.classList.add('hidden');
    if (wvtaDropzone)    wvtaDropzone.classList.remove('hidden');
    if (wvtaFileInput)   wvtaFileInput.value = '';
    if (csiamFileDetails) csiamFileDetails.classList.add('hidden');
    if (csiamDropzone)    csiamDropzone.classList.remove('hidden');
    if (csiamFileInput)   csiamFileInput.value = '';
    if (vehicleCategoryBadge) vehicleCategoryBadge.classList.add('hidden');
    if (searchBtn) { searchBtn.setAttribute('disabled','true'); searchBtn.innerHTML = '<i class="fa-solid fa-microchip"></i> Lancer l\'analyse'; }
    if (emptyState) emptyState.classList.remove('hidden');
    if (dashboardContent) dashboardContent.classList.add('hidden');
    if (jsonOutputPanel) jsonOutputPanel.classList.add('hidden');
    if (exportCsvBtn) exportCsvBtn.setAttribute('disabled','true');
    if (exportJsonBtn) exportJsonBtn.setAttribute('disabled','true');
    if (tableFooter) tableFooter.classList.add('hidden');
    if (resultsCountBadge) resultsCountBadge.classList.add('hidden');
}

// ============================================================
//  ÉTAPE 1 : PARSE CSIAM
// ============================================================
function detectCategory(txt) {
    if (/\bM1\b/i.test(txt)) return 'M1';
    if (/\bN1\b/i.test(txt)) return 'N1';
    if (/\bM2\b/i.test(txt)) return 'M2';
    if (/\bM3\b/i.test(txt)) return 'M3';
    if (/\bN2\b/i.test(txt)) return 'N2';
    if (/\bN3\b/i.test(txt)) return 'N3';
    return 'M1';
}

function parseCSIAM() {
    const txt = state.csiamText;
    state.detectedCategory = detectCategory(txt);
    if (vehicleCategoryText) vehicleCategoryText.textContent = state.detectedCategory;
    if (vehicleCategoryBadge) vehicleCategoryBadge.classList.remove('hidden');

    // Les numéros d'actes à détecter dans le CSIAM
    const tokens = Object.keys(REGULATORY_DB);
    state.detectedRegulations = tokens.filter(tok => {
        try {
            return new RegExp(`\\b${tok.replace('/', '\\/')}\\b`, 'i').test(txt);
        } catch { return txt.includes(tok); }
    });
}

// ============================================================
//  ÉTAPE 2 : DICTIONNAIRE RAG
// ============================================================
function buildValidationDictionary() {
    state.validationDict = {};
    const cat = state.detectedCategory || '_default';

    Object.keys(REGULATORY_DB).forEach(reg => {
        const entry = REGULATORY_DB[reg];
        if (entry[cat]) state.validationDict[reg] = entry[cat];
        else if (entry['_default']) state.validationDict[reg] = entry['_default'];
    });
}

// ============================================================
//  ÉTAPE 3 : EXTRACTION DU TABLEAU PART III WVTA
//
//  Algorithme :
//  1. Parcourir les pages de la WVTA
//  2. Détecter la page contenant le titre "List of Regulatory Acts which the type of vehicle complies"
//  3. Collecter le texte de cette page et des pages suivantes jusqu'à trouver une nouvelle section majeure
//  4. Parser les lignes du tableau pour extraire chaque acte réglementaire
// ============================================================
function extractWVTAPartIII() {
    const TRIGGER = 'List of Regulatory Acts which the type of vehicle complies';
    // Motifs de fin de section (nouvelle partie ou annexe)
    const STOP_RE = /\b(PART\s+IV|PART\s+V\b|ANNEX\s+[IVX]|APPENDIX)/i;

    let inSection = false;
    let sectionLines = [];

    for (const pageData of state.wvtaPagesData) {
        const pageText = pageData.text;

        if (!inSection) {
            if (pageText.includes(TRIGGER)) {
                inSection = true;
                // Ne garder que ce qui est APRÈS le titre déclencheur
                const idx = pageText.indexOf(TRIGGER);
                const afterTrigger = pageText.substring(idx + TRIGGER.length);
                sectionLines.push(...afterTrigger.split('\n'));
            }
        } else {
            // Stop si on tombe sur une nouvelle section majeure
            // (mais continuer si la page contient encore le déclencheur, ex: en-têtes répétées)
            if (STOP_RE.test(pageText) && !pageText.includes(TRIGGER)) {
                break;
            }
            sectionLines.push(...pageText.split('\n'));
        }
    }

    if (sectionLines.length === 0) {
        console.warn('Section "List of Regulatory Acts" introuvable dans la WVTA.');
        return [];
    }

    return parseRegActLines(sectionLines);
}

// ============================================================
//  PARSER LES LIGNES DU TABLEAU WVTA
//  Chaque ligne du tableau a typiquement la forme :
//    [ItemNo] [Description acte]   [N° homologation]   [Supplément]  [Pays]
//
//  Stratégie multi-passe :
//   A) Regex EU Regulation : \b(\d{4}\/\d{4})\b
//   B) Regex UN Regulation (nom explicite) : UN Regulation No\.?\s*(\d+H?)
//   C) Regex depuis le N° homologation : e\d*\*(\d+H?)\/
//   D) Regex variante courte : R\s*(\d+H?) en début de token
// ============================================================
function parseRegActLines(lines) {
    const fullText = lines.join('\n');
    const acts = [];
    const seen = new Set();

    function addAct(cleanKey, rawName, approvalNum, series, country, contextLine) {
        if (seen.has(cleanKey)) return;
        // Filtrer les faux positifs évidents : années seules (ex: 2022 sans slash), items < 2 chiffres
        if (/^\d{1,2}$/.test(cleanKey)) return; // item numbers
        if (/^\d{4}$/.test(cleanKey)) return;   // années seules
        seen.add(cleanKey);
        acts.push({ cleanKey, rawName, approvalNum: approvalNum || '-', series: series || '-', country: country || '-', contextLine: contextLine || '' });
    }

    // ── A) Règlements UE : ex 2019/2144, 2023/2590 ──────────
    const euRe = /\b(\d{4}\/\d{4})\b/g;
    let m;
    while ((m = euRe.exec(fullText)) !== null) {
        const key = m[1];
        if (parseInt(key.split('/')[0]) >= 2000) {
            addAct(key, `Règlement (UE) n° ${key}`, null, null, null, getContextLine(lines, key));
        }
    }

    // ── B) UN Regulation No. XX  (et variantes) ─────────────
    // Forme : "UN Regulation No 13H", "Regulation No. 79", "UN R 152"
    const unNameRe = /(?:UN\s+)?Regulation\s+No\.?\s*(\d{1,3}H?)(?!\d)/gi;
    while ((m = unNameRe.exec(fullText)) !== null) {
        const key = m[1].toUpperCase();
        addAct(key, `UN Regulation No. ${key}`, null, null, null, getContextLine(lines, m[1]));
    }

    // ── C) Depuis le N° homologation : e1*13H/... ───────────
    // Format standard WVTA : e<pays>*<règlement>/<série>-<amend>*<num>
    const approvalRe = /\be(\d{1,2})\*(\d{1,3}H?)\/(\d{2})-(\d{2})/gi;
    while ((m = approvalRe.exec(fullText)) !== null) {
        const country  = 'e' + m[1];
        const key      = m[2].toUpperCase();
        const series   = m[3];
        const approval = m[0];
        addAct(key, `UN Regulation No. ${key}`, approval, series, country, getContextLine(lines, m[0]));
    }

    // ── D) Variante courte : "R13H", "R 79", "R152" ─────────
    const shortRe = /\bR\s*(\d{1,3}H?)\b/gi;
    while ((m = shortRe.exec(fullText)) !== null) {
        const key = m[1].toUpperCase();
        if (parseInt(key) > 0) {
            addAct(key, `UN Regulation R${key}`, null, null, null, getContextLine(lines, m[0]));
        }
    }

    console.log(`[WVTA Parser] ${acts.length} acte(s) extrait(s) :`, acts.map(a => a.cleanKey));
    return acts;
}

// Retourne la ligne brute du texte contenant un motif
function getContextLine(lines, pattern) {
    const pat = pattern.toString().toLowerCase();
    const found = lines.find(l => l.toLowerCase().includes(pat));
    return found ? found.trim() : '';
}

// ============================================================
//  ÉTAPE 4 : ÉVALUATION CROISÉE WVTA ↔ CSIAM ↔ ÉCHÉANCES
//
//  Règle :
//  • L'acte est dans la CSIAM ?
//    → OUI : conforme (le texte de réception le mentionne)
//    → NON :
//       - Il existe une date d'échéance dans le RAG ?
//         · Échéance DÉPASSÉE → bloquant (obligation non couverte)
//         · Échéance À VENIR  → alerte   (surveillance requise)
//         · Pas d'échéance    → info     (acte hors périmètre CSIAM)
// ============================================================
function evaluateActs(extractedActs) {
    state.complianceReport = [];
    const today = state.simulationDate || new Date();

    extractedActs.forEach((act, idx) => {
        const rule = state.validationDict[act.cleanKey];
        const inCSIAM = isInCSIAM(act.cleanKey);

        let status, justification, deadline, subject, minSeries;

        if (rule) {
            deadline  = rule.deadline;
            subject   = rule.subject;
            minSeries = rule.min_series;
        } else {
            deadline  = null;
            subject   = 'Acte optionnel / hors périmètre réglementaire connu';
            minSeries = '-';
        }

        if (inCSIAM) {
            // Présent dans CSIAM → conforme de base
            if (rule && rule.deadline) {
                const dlDate = new Date(rule.deadline + 'T00:00:00');
                if (today > dlDate) {
                    status = 'bloquant';
                    justification = `Mentionné dans la CSIAM mais l'échéance obligatoire ${formatDateFr(rule.deadline)} est DÉPASSÉE. Mise à jour de l'homologation requise.`;
                } else {
                    status = 'conforme';
                    justification = `Mentionné dans la CSIAM. Échéance ${formatDateFr(rule.deadline)} non encore atteinte. Conformité confirmée.`;
                }
            } else {
                status = 'conforme';
                justification = `L'acte ${act.rawName} est référencé dans la fiche CSIAM. Aucune échéance critique connue.`;
            }
        } else {
            // Absent de la CSIAM → vérifier les échéances
            if (rule && rule.deadline) {
                const dlDate = new Date(rule.deadline + 'T00:00:00');
                if (today > dlDate) {
                    status = 'bloquant';
                    justification = `NON MENTIONNÉ DANS LA CSIAM. L'échéance obligatoire était le ${formatDateFr(rule.deadline)} — date dépassée. Cet acte doit impérativement figurer dans la fiche de réception.`;
                } else {
                    status = 'alerte';
                    justification = `NON MENTIONNÉ DANS LA CSIAM. Une échéance réglementaire est prévue le ${formatDateFr(rule.deadline)}. Vérification et intégration dans la CSIAM recommandées avant cette date.`;
                }
            } else {
                status = 'info';
                justification = `L'acte ${act.rawName} n'est pas mentionné dans la CSIAM et n'a pas d'échéance critique répertoriée. Acte hors périmètre ou optionnel.`;
            }
        }

        state.complianceReport.push({
            id:                 idx + 1,
            item:               String(idx + 1).padStart(2, '0'),
            regulation_act:     act.rawName,
            regNum:             act.cleanKey,
            subject:            subject,
            approvalNum:        act.approvalNum,
            series:             act.series,
            country:            act.country,
            minSeries:          minSeries,
            deadline:           deadline || '-',
            inCSIAM:            inCSIAM,
            contextLine:        act.contextLine,
            compliance: { status, justification }
        });
    });
}

// Vérifie si un identifiant réglementaire est mentionné dans le texte CSIAM
function isInCSIAM(cleanKey) {
    if (!state.csiamText) return false;
    try {
        const re = new RegExp(`\\b${cleanKey.replace('/', '\\/')}\\b`, 'i');
        return re.test(state.csiamText);
    } catch {
        return state.csiamText.includes(cleanKey);
    }
}

// ============================================================
//  RENDU DU DASHBOARD
// ============================================================
function renderDashboard() {
    if (emptyState) emptyState.classList.add('hidden');
    if (dashboardContent) dashboardContent.classList.remove('hidden');

    const report = state.complianceReport;
    const total      = report.length;
    const bloquant   = report.filter(r => r.compliance.status === 'bloquant').length;
    const alerte     = report.filter(r => r.compliance.status === 'alerte').length;
    const conforme   = report.filter(r => r.compliance.status === 'conforme').length;
    const info       = report.filter(r => r.compliance.status === 'info').length;

    if (statTotalActs)  statTotalActs.textContent  = total;
    if (statBlockers)   statBlockers.textContent   = bloquant + alerte;

    const pct = total > 0 ? Math.round((conforme / total) * 100) : 0;
    if (statCompliance) statCompliance.textContent = pct + '%';

    // Prochaine échéance
    const futureDLs = report
        .filter(r => r.deadline && r.deadline !== '-')
        .map(r => ({ act: r.regNum, date: new Date(r.deadline + 'T00:00:00') }))
        .filter(x => x.date > (state.simulationDate || new Date()))
        .sort((a, b) => a.date - b.date);
    if (statNextDeadline) {
        statNextDeadline.textContent = futureDLs.length > 0
            ? formatDateFr(futureDLs[0].date.toISOString().split('T')[0]) + ` (${futureDLs[0].act})`
            : 'Aucune';
    }

    // Distribution
    renderTermDistribution(conforme, alerte, bloquant, info, total);

    // Matrice des risques
    renderRiskMatrix(report);

    // Tableau
    renderTable();

    // JSON
    renderJSON(report);

    // Exports
    if (exportCsvBtn) exportCsvBtn.removeAttribute('disabled');
    if (exportJsonBtn) exportJsonBtn.removeAttribute('disabled');
    if (tableFooter) tableFooter.classList.remove('hidden');
    if (resultsCountBadge) {
        resultsCountBadge.textContent = total + ' acte(s)';
        resultsCountBadge.classList.remove('hidden');
    }
}

function renderTermDistribution(conforme, alerte, bloquant, info, total) {
    if (!termDistList) return;
    const statuses = [
        { label: 'Conforme',     count: conforme, cls: 'dist-conforme',  icon: 'fa-circle-check' },
        { label: 'Alerte',       count: alerte,   cls: 'dist-alerte',    icon: 'fa-triangle-exclamation' },
        { label: 'Bloquant',     count: bloquant, cls: 'dist-bloquant',  icon: 'fa-circle-xmark' },
        { label: 'Information',  count: info,     cls: 'dist-info',      icon: 'fa-circle-info' },
    ];
    termDistList.innerHTML = statuses.map(s => {
        const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
        return `<div class="dist-item">
            <div class="dist-header">
                <span class="dist-label ${s.cls}"><i class="fa-solid ${s.icon}"></i> ${s.label}</span>
                <span class="dist-count">${s.count} (${pct}%)</span>
            </div>
            <div class="dist-bar-track"><div class="dist-bar ${s.cls}" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');
}

function renderRiskMatrix(report) {
    if (!riskMatrix) return;
    if (report.length === 0) {
        riskMatrix.innerHTML = '<p class="placeholder-text">Lancez l\'analyse pour visualiser la matrice des risques.</p>';
        return;
    }
    const items = report.map(r => {
        const cls = r.compliance.status === 'bloquant' ? 'risk-high' :
                    r.compliance.status === 'alerte'   ? 'risk-medium' :
                    r.compliance.status === 'conforme' ? 'risk-low' : 'risk-info';
        const csiam = r.inCSIAM
            ? '<span class="csiam-yes" title="Présent dans CSIAM"><i class="fa-solid fa-check"></i></span>'
            : '<span class="csiam-no"  title="Absent de la CSIAM"><i class="fa-solid fa-xmark"></i></span>';
        return `<div class="risk-chip ${cls}" title="${r.compliance.justification}" data-id="${r.id}">
            ${csiam}
            <span class="risk-act">${r.regNum}</span>
        </div>`;
    }).join('');
    riskMatrix.innerHTML = `<div class="risk-grid">${items}</div>
        <div class="risk-legend">
            <span class="risk-high risk-leg">Bloquant</span>
            <span class="risk-medium risk-leg">Alerte</span>
            <span class="risk-low risk-leg">Conforme</span>
            <span class="risk-info risk-leg">Info</span>
            <span class="csiam-yes risk-leg"><i class="fa-solid fa-check"></i> Dans CSIAM</span>
            <span class="csiam-no risk-leg"><i class="fa-solid fa-xmark"></i> Absent CSIAM</span>
        </div>`;
    riskMatrix.querySelectorAll('.risk-chip[data-id]').forEach(chip => {
        chip.addEventListener('click', () => openModal(parseInt(chip.dataset.id)));
    });
}

// ============================================================
//  TABLEAU DES RÉSULTATS
// ============================================================
function getFilteredSorted() {
    const q = state.filterText.toLowerCase();
    let rows = state.complianceReport.filter(r =>
        r.regulation_act.toLowerCase().includes(q) ||
        r.regNum.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.compliance.status.toLowerCase().includes(q)
    );

    if (state.sortColumn) {
        rows = rows.sort((a, b) => {
            let va, vb;
            if (state.sortColumn === 'item')   { va = a.id; vb = b.id; }
            else if (state.sortColumn === 'act')    { va = a.regNum; vb = b.regNum; }
            else if (state.sortColumn === 'status') { va = a.compliance.status; vb = b.compliance.status; }
            else return 0;
            if (va < vb) return state.sortAsc ? -1 : 1;
            if (va > vb) return state.sortAsc ?  1 : -1;
            return 0;
        });
    }
    return rows;
}

function renderTable() {
    if (!tableBody) return;
    const filtered = getFilteredSorted();
    const total    = filtered.length;
    const rpp      = state.rowsPerPage;
    const maxPage  = Math.max(1, Math.ceil(total / rpp));
    if (state.currentPage > maxPage) state.currentPage = maxPage;

    const pageRows = filtered.slice((state.currentPage - 1) * rpp, state.currentPage * rpp);

    if (paginationInfo) paginationInfo.textContent =
        `${Math.min((state.currentPage - 1) * rpp + 1, total)}–${Math.min(state.currentPage * rpp, total)} sur ${total}`;

    tableBody.innerHTML = '';

    if (pageRows.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="empty-table-message">
            <i class="fa-solid fa-folder-open"></i> Aucun résultat correspondant.
        </td></tr>`;
        return;
    }

    pageRows.forEach(row => {
        const { cls: statusCls, label: statusLabel } = statusInfo(row.compliance.status);
        const csiamBadge = row.inCSIAM
            ? '<span class="badge badge-csiam-yes" title="Mentionné dans la CSIAM"><i class="fa-solid fa-check"></i> CSIAM</span>'
            : '<span class="badge badge-csiam-no"  title="Absent de la CSIAM"><i class="fa-solid fa-xmark"></i> Absent</span>';

        const tr = document.createElement('tr');
        tr.className = 'result-row';
        tr.dataset.id = row.id;
        tr.innerHTML = `
            <td class="td-item"><span class="mono-chip">${row.item}</span></td>
            <td class="td-subject" title="${row.subject}">${truncate(row.subject, 45)}</td>
            <td class="td-act"><strong>${row.regulation_act}</strong></td>
            <td class="td-approval"><span class="mono-tiny">${truncate(row.approvalNum, 22)}</span></td>
            <td class="td-series"><span class="mono-tiny">${row.series} / ${row.minSeries}</span></td>
            <td class="td-country"><span class="country-tag">${row.country}</span></td>
            <td class="td-status">
                <span class="badge ${statusCls}">${statusLabel}</span>
                ${csiamBadge}
            </td>
            <td class="td-action text-right">
                <button class="btn-icon-sm view-btn" title="Voir le détail"><i class="fa-solid fa-eye"></i></button>
            </td>`;
        tr.querySelector('.view-btn').addEventListener('click', e => { e.stopPropagation(); openModal(row.id); });
        tr.addEventListener('click', () => openModal(row.id));
        tableBody.appendChild(tr);
    });
}

function statusInfo(status) {
    if (status === 'conforme') return { cls: 'badge-success',  label: 'Conforme' };
    if (status === 'alerte')   return { cls: 'badge-warning',  label: 'Alerte' };
    if (status === 'bloquant') return { cls: 'badge-danger',   label: 'Bloquant' };
    return                            { cls: 'badge-info',     label: 'Information' };
}

// Tri par en-tête de colonne
document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (state.sortColumn === col) state.sortAsc = !state.sortAsc;
        else { state.sortColumn = col; state.sortAsc = true; }
        state.currentPage = 1;
        renderTable();
    });
});

// Filtre texte
if (tableFilter) tableFilter.addEventListener('input', () => {
    state.filterText = tableFilter.value;
    state.currentPage = 1;
    renderTable();
});

// Pagination
if (prevPageBtn) prevPageBtn.addEventListener('click', () => { if (state.currentPage > 1) { state.currentPage--; renderTable(); } });
if (nextPageBtn) nextPageBtn.addEventListener('click', () => {
    const max = Math.ceil(getFilteredSorted().length / state.rowsPerPage);
    if (state.currentPage < max) { state.currentPage++; renderTable(); }
});
if (rowsPerPageSel) rowsPerPageSel.addEventListener('change', () => {
    state.rowsPerPage = parseInt(rowsPerPageSel.value);
    state.currentPage = 1;
    renderTable();
});

// ============================================================
//  MODAL DÉTAIL
// ============================================================
function openModal(id) {
    const row = state.complianceReport.find(r => r.id === id);
    if (!row || !resultModal) return;

    if (modalSubject)    modalSubject.textContent    = row.subject;
    if (modalAct)        modalAct.textContent        = row.regulation_act;
    if (modalApprovalNum) modalApprovalNum.textContent = row.approvalNum;
    if (modalCountry)    modalCountry.textContent    = row.country;
    if (modalIdentifiedReg) modalIdentifiedReg.textContent = row.regNum;
    if (modalCurrentVersion)  modalCurrentVersion.textContent  = row.series;
    if (modalRequiredVersion) modalRequiredVersion.textContent = row.minSeries !== '-' ? `${row.minSeries} (ou ultérieur)` : '-';
    if (modalDeadline)   modalDeadline.textContent   = row.deadline !== '-' ? formatDateFr(row.deadline) : 'Aucune échéance critique';
    if (modalAlertExplanation) modalAlertExplanation.textContent = row.compliance.justification;
    if (modalContextText) modalContextText.textContent = row.contextLine || '(ligne brute non disponible)';

    // Badge de statut dans le modal
    if (modalStatusBadge) {
        const { cls, label } = statusInfo(row.compliance.status);
        modalStatusBadge.className = `meta-val badge ${cls}`;
        modalStatusBadge.textContent = label;
    }

    // Alerte colorée
    if (modalAlertBox) {
        modalAlertBox.className = 'alert-action-box';
        const iconEl  = modalAlertBox.querySelector('.alert-icon-wrapper');
        const titleEl = modalAlertBox.querySelector('h5');
        if (row.compliance.status === 'conforme') {
            modalAlertBox.classList.add('alert-compliant');
            if (iconEl)  iconEl.innerHTML  = '<i class="fa-solid fa-circle-check"></i>';
            if (titleEl) titleEl.textContent = row.inCSIAM ? 'Conformité Validée – Présent dans la CSIAM' : 'Conformité Confirmée';
        } else if (row.compliance.status === 'alerte') {
            modalAlertBox.classList.add('alert-warning-box');
            if (iconEl)  iconEl.innerHTML  = '<i class="fa-solid fa-triangle-exclamation"></i>';
            if (titleEl) titleEl.textContent = 'Alerte – Acte absent de la CSIAM, échéance à surveiller';
        } else if (row.compliance.status === 'bloquant') {
            modalAlertBox.classList.add('alert-danger-box');
            if (iconEl)  iconEl.innerHTML  = '<i class="fa-solid fa-circle-xmark"></i>';
            if (titleEl) titleEl.textContent = 'Non-Conformité Critique';
        } else {
            modalAlertBox.classList.add('alert-info-box');
            if (iconEl)  iconEl.innerHTML  = '<i class="fa-solid fa-circle-info"></i>';
            if (titleEl) titleEl.textContent = 'Information – Hors périmètre CSIAM';
        }
    }

    resultModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    if (resultModal) resultModal.classList.add('hidden');
    document.body.style.overflow = '';
}

if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
if (modalOkBtn)    modalOkBtn.addEventListener('click', closeModal);
if (resultModal)   resultModal.querySelector('.modal-overlay')?.addEventListener('click', closeModal);

if (modalCopyBtn) modalCopyBtn.addEventListener('click', () => {
    const actName = modalAct?.textContent;
    const item = state.complianceReport.find(r => r.regulation_act === actName);
    if (item) navigator.clipboard.writeText(JSON.stringify(item, null, 2)).catch(() => {});
});

// ============================================================
//  JSON OUTPUT
// ============================================================
function renderJSON(report) {
    if (!jsonOutputPre || !jsonOutputPanel) return;
    const output = {
        generated_at: new Date().toISOString(),
        simulation_date: (state.simulationDate || new Date()).toISOString().split('T')[0],
        vehicle_category: state.detectedCategory,
        csiam_loaded: !!state.csiamText,
        total_acts: report.length,
        summary: {
            conforme: report.filter(r => r.compliance.status === 'conforme').length,
            alerte:   report.filter(r => r.compliance.status === 'alerte').length,
            bloquant: report.filter(r => r.compliance.status === 'bloquant').length,
            info:     report.filter(r => r.compliance.status === 'info').length
        },
        acts: report.map(r => ({
            item:            r.item,
            regulation_act:  r.regulation_act,
            reg_num:         r.regNum,
            subject:         r.subject,
            approval_num:    r.approvalNum,
            series:          r.series,
            country:         r.country,
            in_csiam:        r.inCSIAM,
            deadline:        r.deadline,
            status:          r.compliance.status,
            justification:   r.compliance.justification
        }))
    };
    jsonOutputPre.textContent = JSON.stringify(output, null, 2);
    jsonOutputPanel.classList.remove('hidden');
}

if (copyJsonBtn) copyJsonBtn.addEventListener('click', () => {
    if (jsonOutputPre) navigator.clipboard.writeText(jsonOutputPre.textContent).catch(() => {});
});

if (downloadJsonBtn) downloadJsonBtn.addEventListener('click', () => {
    const blob = new Blob([jsonOutputPre?.textContent || ''], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'rapport_wvta_compliance.json';
    a.click(); URL.revokeObjectURL(url);
});

// ============================================================
//  EXPORT CSV
// ============================================================
if (exportCsvBtn) exportCsvBtn.addEventListener('click', () => {
    const rows = getFilteredSorted();
    const header = 'Item;Règlement;Sujet;N° Homologation;Série Act.;Série Req.;Pays;Dans CSIAM;Statut;Échéance;Justification\n';
    const body = rows.map(r =>
        `"${r.item}";"${r.regulation_act}";"${r.subject}";"${r.approvalNum}";"${r.series}";"${r.minSeries}";"${r.country}";"${r.inCSIAM ? 'OUI' : 'NON'}";"${r.compliance.status}";"${r.deadline}";"${r.compliance.justification.replace(/"/g, '""')}"`
    ).join('\n');
    const blob = new Blob(['\uFEFF' + header + body], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'Rapport_Conformite_WVTA.csv';
    a.click(); URL.revokeObjectURL(url);
});

if (exportJsonBtn) exportJsonBtn.addEventListener('click', () => {
    if (downloadJsonBtn) downloadJsonBtn.click();
});

// ============================================================
//  UTILITAIRES
// ============================================================
function tick(ms) { return new Promise(r => setTimeout(r, ms)); }

function formatDateFr(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    const [y, mo, d] = dateStr.split('-');
    if (!y || !mo || !d) return dateStr;
    return `${d}/${mo}/${y}`;
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function truncate(str, n) {
    if (!str) return '-';
    return str.length > n ? str.substring(0, n) + '…' : str;
}