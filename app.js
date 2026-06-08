// Setup PDF.js worker
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Embedded Regulatory Knowledge Base (GSR2 & UN-R Reference Dates)
const REGULATORY_DEADLINES = {
    "13H": { 
        min_version_required: "01", 
        deadline_date: "2024-07-07", 
        must_not_be_na: true, 
        name: "Freinage des véhicules de tourisme (UN-R 13H)", 
        subject: "Braking / Freinage" 
    },
    "79": { 
        min_version_required: "03", 
        deadline_date: "2024-07-07", 
        must_not_be_na: true, 
        name: "Équipement de direction (UN-R 79)", 
        subject: "Steering Equipment / Direction" 
    },
    "127": { 
        min_version_required: "02", 
        deadline_date: "2026-07-07", 
        must_not_be_na: true, 
        name: "Protection des piétons (UN-R 127)", 
        subject: "Pedestrian Protection / Protection Piétons" 
    },
    "152": { 
        min_version_required: "01", 
        deadline_date: "2026-07-07", 
        must_not_be_na: true, 
        name: "Système de freinage d'urgence AEBS (UN-R 152)", 
        subject: "Advanced Emergency Braking / Freinage d'Urgence" 
    },
    "155": { 
        min_version_required: "00", 
        deadline_date: "2024-07-07", 
        must_not_be_na: true, 
        name: "Cybersécurité & Système de Gestion (UN-R 155)", 
        subject: "Cyber Security / Cybersécurité" 
    },
    "156": { 
        min_version_required: "00", 
        deadline_date: "2024-07-07", 
        must_not_be_na: true, 
        name: "Mises à jour logicielles SUMS (UN-R 156)", 
        subject: "Software Updates / Mises à Jour Logiciel" 
    },
    "151": { 
        min_version_required: "00", 
        deadline_date: "2024-07-07", 
        must_not_be_na: true, 
        name: "Système d'information d'angle mort BSIS (UN-R 151)", 
        subject: "Blind Spot Detection / Détection Angle Mort" 
    },
    "159": { 
        min_version_required: "00", 
        deadline_date: "2024-07-07", 
        must_not_be_na: true, 
        name: "Système de détection au démarrage MOIS (UN-R 159)", 
        subject: "Moving Off Detection / Détection au Démarrage" 
    },
    "166": { 
        min_version_required: "00", 
        deadline_date: "2026-07-07", 
        must_not_be_na: true, 
        name: "Détection en marche arrière VRU (UN-R 166)", 
        subject: "Reversing Detection / Détection Recul" 
    },
    "167": { 
        min_version_required: "00", 
        deadline_date: "2026-07-07", 
        must_not_be_na: true, 
        name: "Vision directe pour poids lourds (UN-R 167)", 
        subject: "Direct Vision / Vision Directe" 
    },
    "51": { 
        min_version_required: "03", 
        deadline_date: "2026-07-01", 
        must_not_be_na: true, 
        name: "Niveau sonore des véhicules Phase 3 (UN-R 51)", 
        subject: "Sound Levels / Niveau Sonore (Phase 3)" 
    },
    "145": { 
        min_version_required: "00", 
        deadline_date: "2022-07-07", 
        must_not_be_na: true, 
        name: "Ancrages de sécurité ISOFIX (UN-R 145)", 
        subject: "ISOFIX Anchorages / Ancrages ISOFIX" 
    }
};

// Map UN country codes to names
const COUNTRY_CODES = {
    "1": "Allemagne", "2": "France", "3": "Italie", "4": "Pays-Bas", "5": "Suède", 
    "6": "Belgique", "7": "Hongrie", "8": "Tchéquie", "9": "Espagne", "10": "Serbie",
    "11": "Royaume-Uni", "12": "Autriche", "13": "Luxembourg", "14": "Suisse", 
    "16": "Norvège", "17": "Finlande", "18": "Danemark", "19": "Roumanie", "20": "Pologne",
    "21": "Portugal", "22": "Fédération de Russie", "23": "Grèce", "24": "Irlande",
    "25": "Croatie", "26": "Slovénie", "27": "Slovaquie", "28": "Bélarus", "29": "Estonie",
    "30": "République de Moldova", "31": "Bosnie-Herzégovine", "32": "Lettonie",
    "34": "Bulgarie", "36": "Lituanie", "37": "Turquie", "39": "Azerbaïdjan", 
    "40": "Macédoine du Nord", "42": "Union Européenne", "43": "Japon", "45": "Australie", 
    "46": "Ukraine", "47": "Afrique du Sud", "48": "Nouvelle-Zélande", "49": "Chypre", 
    "50": "Malte", "51": "République de Corée", "52": "Malaisie", "53": "Thaïlande"
};

// Application State
const state = {
    pdfDocument: null,
    pdfFilename: '',
    pdfFilesize: '',
    pagesData: [], 
    searchResults: [], // Will hold parsed WVTA rows { id, item, subject, regulation_act, regNum, current_version, type_approval_number, country, issue_date, status, rawLine, compliance: { status, reason, required_version, deadline_date } }
    
    // UI Filter & Simulations
    simulationDate: 'current', // 'current' or 'YYYY-MM-DD'
    selectedRiskFilter: null, // 'Bloquant', 'Vigilance', 'Conforme' or null
    filterText: '',
    
    // Pagination
    pagination: {
        currentPage: 1,
        rowsPerPage: 25,
    },
    sort: {
        column: 'item', 
        direction: 'asc', 
    }
};

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const fileDetails = document.getElementById('file-details');
const pdfFilenameEl = document.getElementById('pdf-filename');
const pdfFilesizeEl = document.getElementById('pdf-filesize');
const removeFileBtn = document.getElementById('remove-file-btn');
const parseProgressContainer = document.getElementById('parse-progress-container');
const parseProgressBar = document.getElementById('parse-progress-bar');
const parseStatusEl = document.getElementById('parse-status');
const parsePercentageEl = document.getElementById('parse-percentage');

const simulationDateSelect = document.getElementById('simulation-date-select');
const searchBtn = document.getElementById('search-btn');
const resetBtn = document.getElementById('reset-btn');

const emptyState = document.getElementById('empty-state');
const dashboardContent = document.getElementById('dashboard-content');

// Stat Cards
const statTotalPages = document.getElementById('stat-total-pages'); // Total Reception Acts
const statTotalMatches = document.getElementById('stat-total-matches'); // Total critical gaps
const statTopTerm = document.getElementById('stat-top-term'); // Compliance Rate
const statSearchTime = document.getElementById('stat-search-time'); // Next Deadline
const cardTotalGaps = document.getElementById('card-total-gaps');

// Panels
const termDistributionList = document.getElementById('term-distribution-list');
const riskMatrixContainer = document.getElementById('risk-matrix-container');

// Results Table
const resultsCountBadge = document.getElementById('results-count-badge');
const tableFilter = document.getElementById('table-filter');
const exportCsvBtn = document.getElementById('export-csv-btn');
const resultsTableBody = document.getElementById('results-table-body');
const tableFooter = document.getElementById('table-footer');
const rowsPerPageSelect = document.getElementById('rows-per-page-select');
const paginationInfo = document.getElementById('pagination-info');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');

// Modal
const resultModal = document.getElementById('result-modal');
const modalSubject = document.getElementById('modal-subject');
const modalAct = document.getElementById('modal-act');
const modalApprovalNum = document.getElementById('modal-approval-num');
const modalStatusBadge = document.getElementById('modal-status-badge');
const modalCountry = document.getElementById('modal-country');
const modalIdentifiedReg = document.getElementById('modal-identified-reg');
const modalCurrentVersion = document.getElementById('modal-current-version');
const modalRequiredVersion = document.getElementById('modal-required-version');
const modalDeadline = document.getElementById('modal-deadline');
const modalAlertBox = document.getElementById('modal-alert-box');
const modalAlertExplanation = document.getElementById('modal-alert-explanation');
const modalContextText = document.getElementById('modal-context-text');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCopyBtn = document.getElementById('modal-copy-btn');
const modalOkBtn = document.getElementById('modal-ok-btn');
const modalOverlay = document.querySelector('.modal-overlay');

// --- FILE UPLOAD & READ ---

['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    }, false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
    }, false);
});

dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

dropzone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resetApp();
});

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

async function handleFileSelect(file) {
    if (file.type !== 'application/pdf') {
        alert("Veuillez sélectionner un fichier PDF valide.");
        return;
    }
    
    state.pdfFilename = file.name;
    state.pdfFilesize = formatBytes(file.size);
    
    pdfFilenameEl.textContent = state.pdfFilename;
    pdfFilesizeEl.textContent = state.pdfFilesize;
    dropzone.classList.add('hidden');
    fileDetails.classList.remove('hidden');
    parseProgressContainer.classList.remove('hidden');
    
    const reader = new FileReader();
    reader.onload = async function() {
        try {
            await parsePDF(this.result);
        } catch (error) {
            console.error("PDF Parsing Error: ", error);
            alert("Erreur lors de la lecture du fichier PDF : " + error.message);
            resetApp();
        }
    };
    reader.readAsArrayBuffer(file);
}

async function parsePDF(arrayBuffer) {
    updateProgress(0, "Chargement du document...");
    
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    state.pdfDocument = await loadingTask.promise;
    
    const totalPages = state.pdfDocument.numPages;
    state.pagesData = [];
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        updateProgress(
            Math.round((pageNum / totalPages) * 100), 
            `Extraction de la fiche - Page ${pageNum}/${totalPages}`
        );
        
        const page = await state.pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Reconstruct line layouts
        let text = "";
        let lastItem = null;
        for (let item of textContent.items) {
            if (lastItem && Math.abs(item.transform[5] - lastItem.transform[5]) > 2) {
                text += "\n";
            } else if (lastItem && item.transform[4] - (lastItem.transform[4] + lastItem.width) > 5) {
                text += " ";
            }
            text += item.str;
            lastItem = item;
        }
        
        state.pagesData.push({
            pageNum: pageNum,
            text: text
        });
    }
    
    parseProgressContainer.classList.add('hidden');
    searchBtn.disabled = false;
    
    // Automatically trigger analysis on load
    runAnalysis();
}

function updateProgress(percentage, statusText) {
    parseProgressBar.style.width = percentage + '%';
    parsePercentageEl.textContent = percentage + '%';
    parseStatusEl.textContent = statusText;
}

// --- WVTA STRUCTURAL PARSER & ANALYSIS ---

simulationDateSelect.addEventListener('change', (e) => {
    state.simulationDate = e.target.value;
    if (state.searchResults.length > 0) {
        evaluateAllCompliance();
        updateDashboardUI();
    }
});

searchBtn.addEventListener('click', runAnalysis);

function runAnalysis() {
    if (state.pagesData.length === 0) return;
    
    const parsedWVTA = [];
    let idCounter = 0;
    
    // Read and parse line by line
    state.pagesData.forEach(page => {
        const lines = page.text.split('\n');
        
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine.length < 10) return; // Skip short/blank lines
            
            // Regex 1: Detect EU/UN Homologation approval numbers
            // Matches formats like: E9*127R02/00*1155*01 or e1*2018/858*00001*00 or e4*79R03/01*0123*00
            const approvalMatch = trimmedLine.match(/\b(([Ee])(\d+))\*([A-Za-z0-9/_-]+)\*([0-9]+)\*([0-9]+)/);
            
            // Regex 2: Detect Regulation Numbers (like R127, UN-R 152, 127R, Directive 2018/858)
            const regMatch = trimmedLine.match(/\b(?:UN[- ]?R\s*|R\s*|Directive\s*)(\d+[A-Z]?)\b/i);
            
            if (approvalMatch) {
                const fullApprovalNum = approvalMatch[0];
                const countryCode = approvalMatch[1]; // E9, e1, etc.
                const countryId = approvalMatch[3]; // 9, 1, etc.
                const actCode = approvalMatch[4]; // 127R02/00, 2018/858, etc.
                
                // Extract regulation number and series of modifications from approval actCode
                let regNum = "";
                let series = "00";
                
                // Try matching standard "127R02/00" format where 127 is the regulation and 02 is series of modifications
                const actParts = actCode.match(/^(\d+)[R_]?(\d+)?/i);
                if (actParts) {
                    regNum = actParts[1];
                    series = actParts[2] || "00";
                }
                
                // Fallback to regMatch if regNum parsing from actCode is empty
                if (!regNum && regMatch) {
                    regNum = regMatch[1];
                }
                
                if (regNum) {
                    // Extract subject heuristically from text before approval number
                    const approvalIndex = trimmedLine.indexOf(fullApprovalNum);
                    let subjectStr = trimmedLine.substring(0, approvalIndex);
                    
                    if (regMatch) {
                        const regIndex = subjectStr.indexOf(regMatch[0]);
                        if (regIndex > 0) {
                            subjectStr = subjectStr.substring(0, regIndex);
                        }
                    }
                    
                    // Clean digits/item numbers at start of line
                    let subject = subjectStr.replace(/^[0-9.-]+\s*/, '').trim();
                    
                    // Cleanup trailing columns/characters
                    subject = subject.replace(/[|;:\s]+$/, '').trim();
                    
                    if (subject.length < 3) {
                        subject = REGULATORY_DEADLINES[regNum]?.subject || `Homologation Acte ${regNum}`;
                    }
                    
                    // Item number
                    const itemMatch = trimmedLine.match(/^([0-9a-zA-Z.-]+)/);
                    const itemNum = itemMatch ? itemMatch[1] : "-";
                    
                    // Date
                    const dateMatch = trimmedLine.match(/\b(19|20)\d{2}[-/]\d{2}[-/]\d{2}\b/);
                    const issueDate = dateMatch ? dateMatch[0] : "-";
                    
                    const countryName = COUNTRY_CODES[countryId] || "Inconnu";
                    
                    parsedWVTA.push({
                        id: ++idCounter,
                        item: itemNum,
                        subject: subject,
                        regulation_act: `UN-R ${regNum}`,
                        regNum: regNum,
                        current_version: series,
                        type_approval_number: fullApprovalNum,
                        country: `${countryCode} (${countryName})`,
                        issue_date: issueDate,
                        status: "Active",
                        rawLine: trimmedLine
                    });
                }
            } else if (regMatch) {
                // Check if it's marked as NA / Non Applicable
                if (trimmedLine.match(/\b(N[/\s]?A|Non[\s-]applicable)\b/i)) {
                    const regNum = regMatch[1];
                    
                    // Get item
                    const itemMatch = trimmedLine.match(/^([0-9a-zA-Z.-]+)/);
                    const itemNum = itemMatch ? itemMatch[1] : "-";
                    
                    let subject = REGULATORY_DEADLINES[regNum]?.subject || `Homologation Acte ${regNum}`;
                    
                    parsedWVTA.push({
                        id: ++idCounter,
                        item: itemNum,
                        subject: subject,
                        regulation_act: `UN-R ${regNum}`,
                        regNum: regNum,
                        current_version: "NA",
                        type_approval_number: "NA",
                        country: "-",
                        issue_date: "-",
                        status: "NA",
                        rawLine: trimmedLine
                    });
                }
            }
        });
    });
    
    // Save to state
    state.searchResults = parsedWVTA;
    state.selectedRiskFilter = null;
    state.pagination.currentPage = 1;
    
    // Evaluate compliance
    evaluateAllCompliance();
    
    // Show UI
    emptyState.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    
    updateDashboardUI();
}

// Evaluate compliance for all items
function evaluateAllCompliance() {
    // Resolve target simulation date
    let targetDateStr = '';
    if (state.simulationDate === 'current') {
        const today = new Date();
        targetDateStr = today.toISOString().split('T')[0];
    } else {
        targetDateStr = state.simulationDate;
    }
    
    state.searchResults.forEach(item => {
        item.compliance = evaluateComplianceItem(item, targetDateStr);
    });
}

function formatDateFrench(dateStr) {
    if (!dateStr || dateStr === "-") return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Compliance Decision Logic
function evaluateComplianceItem(item, targetDateStr) {
    const ref = REGULATORY_DEADLINES[item.regNum];
    if (!ref) {
        return { 
            status: "Conforme", 
            reason: "Aucune exigence ou échéance GSR2 répertoriée dans la base de référence pour ce règlement.",
            required_version: "-",
            deadline_date: "-"
        };
    }
    
    const deadline = new Date(ref.deadline_date);
    const targetDate = new Date(targetDateStr);
    
    const isPastDeadline = targetDate >= deadline;
    
    // Case 1: NA in PDF
    if (item.status === "NA" || item.current_version === "NA") {
        if (ref.must_not_be_na && isPastDeadline) {
            return {
                status: "Bloquant",
                reason: `La mention "NA" est obsolète. La réglementation européenne (GSR2) impose une homologation active obligatoire pour le règlement [UN-R ${item.regNum}] depuis le ${formatDateFrench(ref.deadline_date)}.`,
                required_version: ref.min_version_required,
                deadline_date: ref.deadline_date
            };
        }
        return { 
            status: "Conforme", 
            reason: "L'état Non Applicable (NA) est valide et autorisé pour cette échéance.",
            required_version: "-",
            deadline_date: ref.deadline_date
        };
    }
    
    const currentVer = parseInt(item.current_version, 10) || 0;
    const requiredVer = parseInt(ref.min_version_required, 10) || 0;
    
    // Case 2: Version strictly lower than required after deadline
    if (isPastDeadline) {
        if (currentVer < requiredVer) {
            return {
                status: "Bloquant",
                reason: `Série de modifications obsolète [${item.current_version}]. La série minimale [${ref.min_version_required}] est obligatoire depuis le ${formatDateFrench(ref.deadline_date)}.`,
                required_version: ref.min_version_required,
                deadline_date: ref.deadline_date
            };
        }
    }
    
    // Case 3: Approaching deadline (Vigilance)
    if (!isPastDeadline) {
        const timeDiff = deadline.getTime() - targetDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        // Flag warning if within 180 days (6 months) and version is insufficient
        if (daysDiff <= 180 && currentVer < requiredVer) {
            return {
                status: "Vigilance",
                reason: `Échéance critique dans ${daysDiff} jours. La série [${ref.min_version_required}] deviendra obligatoire le ${formatDateFrench(ref.deadline_date)} (actuellement en série [${item.current_version}]).`,
                required_version: ref.min_version_required,
                deadline_date: ref.deadline_date
            };
        }
    }
    
    // Case 4: Special Rule for UN-R 51 (Niveau Sonore - Phase 3)
    // Sound limit Phase 3 applies on 2026-07-01. Version is still 03, but test limits are tighter.
    if (item.regNum === "51" && currentVer === 3 && targetDate >= new Date("2026-07-01")) {
        return {
            status: "Vigilance",
            reason: "La série de modifications 03 est active, mais attention : les limites strictes de la Phase 3 (Directive Acoustique) s'appliquent à partir du 1er Juillet 2026. Une vérification des PV d'essais acoustiques est obligatoire.",
            required_version: "03 (Limites Phase 3)",
            deadline_date: "2026-07-01"
        };
    }
    
    // Case 5: Conforme
    return {
        status: "Conforme",
        reason: "Le certificat répond pleinement aux exigences de la réglementation européenne applicable pour cette échéance.",
        required_version: ref.min_version_required,
        deadline_date: ref.deadline_date
    };
}

// --- DASHBOARD RENDERERS ---

function updateDashboardUI() {
    const totalActs = state.searchResults.length;
    
    const blockers = state.searchResults.filter(res => res.compliance.status === "Bloquant");
    const vigilances = state.searchResults.filter(res => res.compliance.status === "Vigilance");
    const conformes = state.searchResults.filter(res => res.compliance.status === "Conforme");
    
    // 1. Stats Cards
    statTotalPages.textContent = totalActs;
    statTotalMatches.textContent = blockers.length;
    
    // Blinking card alert if blockers > 0
    if (blockers.length > 0) {
        cardTotalGaps.classList.add('critical-alert-active');
    } else {
        cardTotalGaps.classList.remove('critical-alert-active');
    }
    
    // Compliance Rate
    const complianceRate = totalActs > 0 ? Math.round(((conformes.length + vigilances.length) / totalActs) * 100) : 100;
    statTopTerm.textContent = `${complianceRate}%`;
    
    // Find closest upcoming deadline
    let targetDateStr = '';
    if (state.simulationDate === 'current') {
        targetDateStr = new Date().toISOString().split('T')[0];
    } else {
        targetDateStr = state.simulationDate;
    }
    const targetDate = new Date(targetDateStr);
    
    let closestDeadline = null;
    let minDiff = Infinity;
    
    Object.keys(REGULATORY_DEADLINES).forEach(key => {
        const deadDate = new Date(REGULATORY_DEADLINES[key].deadline_date);
        if (deadDate >= targetDate) {
            const diff = deadDate.getTime() - targetDate.getTime();
            if (diff < minDiff) {
                minDiff = diff;
                closestDeadline = REGULATORY_DEADLINES[key].deadline_date;
            }
        }
    });
    
    statSearchTime.textContent = closestDeadline ? formatDateFrench(closestDeadline) : "Aucune échéance future";
    
    // 2. Compliance status progress bar
    renderComplianceBars(conformes.length, vigilances.length, blockers.length, totalActs);
    
    // 3. Risk Matrix Panels
    renderRiskMatrix(conformes.length, vigilances.length, blockers.length);
    
    // 4. Update table
    resultsCountBadge.classList.remove('hidden');
    resultsCountBadge.textContent = `${state.searchResults.length} acte(s)`;
    exportCsvBtn.disabled = totalActs === 0;
    
    renderResultsTable();
}

function renderComplianceBars(conf, vig, block, total) {
    termDistributionList.innerHTML = '';
    
    if (total === 0) {
        termDistributionList.innerHTML = '<p class="placeholder-text">Aucun acte chargé.</p>';
        return;
    }
    
    const statuses = [
        { label: "Conformes", count: conf, percentage: Math.round((conf / total) * 100), class: "bar-compliant" },
        { label: "Vigilances", count: vig, percentage: Math.round((vig / total) * 100), class: "bar-vigilance" },
        { label: "Bloquants (Gaps)", count: block, percentage: Math.round((block / total) * 100), class: "bar-blocker" }
    ];
    
    statuses.forEach(status => {
        const distItem = document.createElement('div');
        distItem.className = 'distribution-item';
        distItem.innerHTML = `
            <div class="dist-meta">
                <span class="dist-tag">${status.label}</span>
                <span class="dist-count">${status.count} (${status.percentage}%)</span>
            </div>
            <div class="dist-bar-bg">
                <div class="dist-bar ${status.class}" style="width: 0%"></div>
            </div>
        `;
        termDistributionList.appendChild(distItem);
        
        setTimeout(() => {
            distItem.querySelector('.dist-bar').style.width = `${status.percentage}%`;
        }, 50);
    });
}

function renderRiskMatrix(conf, vig, block) {
    riskMatrixContainer.innerHTML = '';
    
    const groups = [
        { key: 'Bloquant', label: '🔴 Gaps Bloquants détectés', count: block, class: 'risk-danger' },
        { key: 'Vigilance', label: '🟡 Vigilances réglementaires', count: vig, class: 'risk-warning' },
        { key: 'Conforme', label: '🟢 Règlements Conformes', count: conf, class: 'risk-safe' }
    ];
    
    groups.forEach(g => {
        const activeClass = state.selectedRiskFilter === g.key ? 'active-filter' : '';
        const groupEl = document.createElement('div');
        groupEl.className = `risk-group ${g.class} ${activeClass}`;
        groupEl.innerHTML = `
            <div class="risk-group-left">
                <i class="fa-solid ${g.key === 'Bloquant' ? 'fa-circle-xmark' : g.key === 'Vigilance' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i>
                <span>${g.label}</span>
            </div>
            <div class="risk-group-right">
                <span class="risk-group-badge">${g.count}</span>
                <i class="fa-solid fa-chevron-right"></i>
            </div>
        `;
        
        // Filter table on click
        groupEl.addEventListener('click', () => {
            if (state.selectedRiskFilter === g.key) {
                state.selectedRiskFilter = null; // deactivate
            } else {
                state.selectedRiskFilter = g.key; // activate
            }
            state.pagination.currentPage = 1;
            renderRiskMatrix(conf, vig, block); // re-render risk levels to update active highlights
            renderResultsTable();
        });
        
        riskMatrixContainer.appendChild(groupEl);
    });
}

// --- RESULTS TABLE ---

tableFilter.addEventListener('input', (e) => {
    state.filterText = e.target.value.toLowerCase();
    state.pagination.currentPage = 1;
    renderResultsTable();
});

rowsPerPageSelect.addEventListener('change', (e) => {
    state.pagination.rowsPerPage = parseInt(e.target.value);
    state.pagination.currentPage = 1;
    renderResultsTable();
});

prevPageBtn.addEventListener('click', () => {
    if (state.pagination.currentPage > 1) {
        state.pagination.currentPage--;
        renderResultsTable();
    }
});

nextPageBtn.addEventListener('click', () => {
    const totalPages = Math.ceil(getFilteredResults().length / state.pagination.rowsPerPage);
    if (state.pagination.currentPage < totalPages) {
        state.pagination.currentPage++;
        renderResultsTable();
    }
});

// Setup Table sorting headers
document.querySelectorAll('th.sortable').forEach(header => {
    header.addEventListener('click', () => {
        const sortCol = header.getAttribute('data-sort');
        
        if (state.sort.column === sortCol) {
            state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            state.sort.column = sortCol;
            state.sort.direction = 'asc';
        }
        
        document.querySelectorAll('th.sortable i').forEach(icon => {
            icon.className = 'fa-solid fa-sort';
        });
        
        const activeIcon = header.querySelector('i');
        activeIcon.className = state.sort.direction === 'asc' ? 'fa-solid fa-sort-up' : 'fa-solid fa-sort-down';
        
        renderResultsTable();
    });
});

function getFilteredResults() {
    let filtered = [...state.searchResults];
    
    // 1. Risk Filter (from risk matrix clicks)
    if (state.selectedRiskFilter) {
        filtered = filtered.filter(res => res.compliance.status === state.selectedRiskFilter);
    }
    
    // 2. Text input filter
    if (state.filterText) {
        filtered = filtered.filter(res => 
            res.subject.toLowerCase().includes(state.filterText) ||
            res.regulation_act.toLowerCase().includes(state.filterText) ||
            res.compliance.status.toLowerCase().includes(state.filterText) ||
            res.type_approval_number.toLowerCase().includes(state.filterText)
        );
    }
    
    // 3. Sort
    filtered.sort((a, b) => {
        let valA, valB;
        if (state.sort.column === 'item') {
            // Compare items (e.g. numeric sort if possible, fallback to string)
            valA = a.item;
            valB = b.item;
            return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
        } else if (state.sort.column === 'act') {
            valA = a.regulation_act.toLowerCase();
            valB = b.regulation_act.toLowerCase();
        } else { // status
            valA = a.compliance.status.toLowerCase();
            valB = b.compliance.status.toLowerCase();
        }
        
        if (valA < valB) return state.sort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return state.sort.direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    return filtered;
}

function renderResultsTable() {
    resultsTableBody.innerHTML = '';
    
    const filtered = getFilteredResults();
    const totalItems = filtered.length;
    
    if (totalItems === 0) {
        resultsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-table-message">
                    <i class="fa-solid fa-folder-open"></i>
                    Aucun acte ne correspond aux critères sélectionnés.
                </td>
            </tr>
        `;
        tableFooter.classList.add('hidden');
        return;
    }
    
    tableFooter.classList.remove('hidden');
    
    const limit = state.pagination.rowsPerPage;
    const maxPage = Math.ceil(totalItems / limit);
    
    if (state.pagination.currentPage > maxPage) {
        state.pagination.currentPage = maxPage;
    }
    if (state.pagination.currentPage < 1) {
        state.pagination.currentPage = 1;
    }
    
    const startIndex = (state.pagination.currentPage - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalItems);
    const paginatedItems = filtered.slice(startIndex, endIndex);
    
    paginatedItems.forEach(item => {
        const row = document.createElement('tr');
        
        let badgeClass = 'badge-compliant';
        let badgeIcon = 'fa-check';
        if (item.compliance.status === 'Bloquant') {
            badgeClass = 'badge-blocker';
            badgeIcon = 'fa-circle-xmark';
        } else if (item.compliance.status === 'Vigilance') {
            badgeClass = 'badge-vigilance';
            badgeIcon = 'fa-triangle-exclamation';
        }
        
        // Highlight critical version text if blocker
        const verColor = item.compliance.status === 'Bloquant' ? 'style="color: var(--danger); font-weight: 700;"' : '';
        const cleanApprovalNum = item.type_approval_number === "NA" ? `<span style="color: var(--text-muted);">Non Applicable (NA)</span>` : item.type_approval_number;
        
        row.innerHTML = `
            <td><strong>${escapeHTML(item.item)}</strong></td>
            <td>${escapeHTML(item.subject)}</td>
            <td><span class="badge" style="background-color: var(--bg-app); border-color: var(--border);">${escapeHTML(item.regulation_act)}</span></td>
            <td style="font-family: var(--font-mono); font-size: 11px;">${cleanApprovalNum}</td>
            <td>
                <span class="status-badge ${badgeClass}">
                    <i class="fa-solid ${badgeIcon}"></i> ${item.compliance.status}
                </span>
            </td>
            <td class="text-right">
                <button class="btn btn-secondary view-details-btn" style="padding: 6px 12px; font-size: 11px;">
                    <i class="fa-solid fa-clipboard-check"></i> Audit
                </button>
            </td>
        `;
        
        row.querySelector('.view-details-btn').addEventListener('click', () => {
            openDetailsModal(item);
        });
        
        resultsTableBody.appendChild(row);
    });
    
    paginationInfo.textContent = `${startIndex + 1}-${endIndex} sur ${totalItems}`;
    prevPageBtn.disabled = state.pagination.currentPage === 1;
    nextPageBtn.disabled = state.pagination.currentPage === maxPage;
}

// --- COMPLIANCE MODAL DETAILS ---

function openDetailsModal(item) {
    modalSubject.textContent = item.subject;
    modalAct.textContent = item.regulation_act;
    modalApprovalNum.textContent = item.type_approval_number;
    
    // Status Badge inside modal
    let badgeClass = 'badge-compliant';
    if (item.compliance.status === 'Bloquant') badgeClass = 'badge-blocker';
    else if (item.compliance.status === 'Vigilance') badgeClass = 'badge-vigilance';
    
    modalStatusBadge.className = `status-badge ${badgeClass}`;
    modalStatusBadge.textContent = item.compliance.status;
    
    // Parse values or fallback
    const ref = REGULATORY_DEADLINES[item.regNum];
    modalCountry.textContent = item.country !== "-" ? item.country : "N/A";
    modalIdentifiedReg.textContent = ref ? ref.name : `Règlement ONU N° ${item.regNum}`;
    
    // Current modification series version
    modalCurrentVersion.textContent = item.current_version !== "NA" ? `Série ${item.current_version}` : "Non Applicable (NA)";
    
    // Requirements
    modalRequiredVersion.textContent = ref ? `Série ${ref.min_version_required} minimale` : "Aucune restriction";
    modalDeadline.textContent = ref ? formatDateFrench(ref.deadline_date) : "N/A";
    
    // Alert explanation styling & text
    modalAlertBox.className = "alert-action-box";
    if (item.compliance.status === 'Bloquant') {
        modalAlertBox.classList.add('alert-blocker');
        modalAlertExplanation.innerHTML = `<strong>Alerte Bloquante :</strong> ${item.compliance.reason}<br><br><strong>Action requise :</strong> Réaliser les essais de mise aux normes, obtenir un certificat d'homologation de série <strong>${ref.min_version_required}</strong> et déposer une demande d'extension de fiche WVTA avant la commercialisation.`;
    } else if (item.compliance.status === 'Vigilance') {
        modalAlertBox.classList.add('alert-vigilance');
        modalAlertExplanation.innerHTML = `<strong>Alerte de Vigilance :</strong> ${item.compliance.reason}<br><br><strong>Action requise :</strong> Planifier le basculement vers la série supérieure et vérifier les dates de fabrication des stocks véhicules pour éviter des blocages d'immatriculation.`;
    } else {
        modalAlertBox.classList.add('alert-compliant');
        modalAlertExplanation.innerHTML = `<strong>Conforme :</strong> ${item.compliance.reason}<br><br><strong>Action requise :</strong> Aucune action requise. L'homologation du véhicule pour ce sujet est à jour.`;
    }
    
    // Raw PDF line
    modalContextText.textContent = item.rawLine;
    
    resultModal.classList.remove('hidden');
}

function closeModal() {
    resultModal.classList.add('hidden');
}

modalCloseBtn.addEventListener('click', closeModal);
modalOkBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);

modalCopyBtn.addEventListener('click', () => {
    const actRef = modalAct.textContent;
    const subj = modalSubject.textContent;
    const status = modalStatusBadge.textContent;
    const rawLine = modalContextText.textContent;
    
    const textToCopy = `=== RAPPORT D'AUDIT HOMOLOGATION ===\nActe réglementaire : ${actRef}\nSujet : ${subj}\nStatut : ${status}\nHomologation véhicule : ${modalCurrentVersion.textContent}\nExigence minimale : ${modalRequiredVersion.textContent}\nÉchéance légale : ${modalDeadline.textContent}\n\nLigne WVTA d'origine : \n${rawLine}\n====================================`;
    
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            const originalText = modalCopyBtn.innerHTML;
            modalCopyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copié !';
            modalCopyBtn.classList.add('btn-primary');
            modalCopyBtn.classList.remove('btn-secondary');
            
            setTimeout(() => {
                modalCopyBtn.innerHTML = originalText;
                modalCopyBtn.classList.add('btn-secondary');
                modalCopyBtn.classList.remove('btn-primary');
            }, 2000);
        })
        .catch(err => {
            console.error("Copy failed: ", err);
        });
});

// --- ENRICHED CSV EXPORT ---

exportCsvBtn.addEventListener('click', () => {
    if (state.searchResults.length === 0) return;
    
    const filtered = getFilteredResults();
    
    // CSV Header (semicolon delimited)
    let csvContent = "Item;Sujet Reglementaire;Reference Acte;Numero d'homologation;Version Vehicule;Statut de Conformite;Version Minimale Requise;Date Limite d'Immatriculation;Explication de l'Audit\n";
    
    filtered.forEach(item => {
        const ref = REGULATORY_DEADLINES[item.regNum];
        const minVer = ref ? ref.min_version_required : "-";
        const deadDate = ref ? ref.deadline_date : "-";
        
        const escapedSubj = item.subject.replace(/"/g, '""');
        const escapedAct = item.regulation_act.replace(/"/g, '""');
        const escapedApproval = item.type_approval_number.replace(/"/g, '""');
        const escapedVer = item.current_version.replace(/"/g, '""');
        const escapedReason = item.compliance.reason.replace(/\r?\n|\r/g, " ").replace(/"/g, '""').trim();
        
        csvContent += `"${item.item}";"${escapedSubj}";"${escapedAct}";"${escapedApproval}";"${escapedVer}";"${item.compliance.status}";"${minVer}";"${deadDate}";"${escapedReason}"\n`;
    });
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const cleanFilename = state.pdfFilename.replace(/\.[^/.]+$/, "");
    link.setAttribute("download", `audit_conformite_wvta_${cleanFilename}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// --- RESET APPLICATION ---

function resetApp() {
    state.pdfDocument = null;
    state.pdfFilename = '';
    state.pdfFilesize = '';
    state.pagesData = [];
    state.searchResults = [];
    state.selectedRiskFilter = null;
    state.filterText = '';
    state.simulationDate = 'current';
    
    fileInput.value = '';
    simulationDateSelect.value = 'current';
    dropzone.classList.remove('hidden');
    fileDetails.classList.add('hidden');
    parseProgressContainer.classList.add('hidden');
    
    tableFilter.value = '';
    searchBtn.disabled = true;
    
    emptyState.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
}

resetBtn.addEventListener('click', () => {
    if (state.pdfDocument) {
        if (confirm("Voulez-vous vraiment réinitialiser l'analyseur de conformité réglementaire ?")) {
            resetApp();
        }
    } else {
        resetApp();
    }
});
