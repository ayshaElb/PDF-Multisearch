// Setup PDF.js worker
const pdfjsLib = window['pdfjs-dist/build/pdf'];
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Application State
const state = {
    pdfDocument: null,
    pdfFilename: '',
    pdfFilesize: '',
    pagesData: [], // Array of { pageNum, text }
    keywords: new Set(),
    searchResults: [], // Array of { id, term, pageNum, context, index, length }
    searchTime: 0,
    
    // Pagination & Table State
    pagination: {
        currentPage: 1,
        rowsPerPage: 25,
    },
    sort: {
        column: 'page', // 'term' or 'page'
        direction: 'asc', // 'asc' or 'desc'
    },
    filterText: '',
    selectedPageFilter: null // For filtering by page density click
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

const keywordInput = document.getElementById('keyword-input');
const tagsInputContainer = document.getElementById('tags-input-container');
const searchBtn = document.getElementById('search-btn');
const resetBtn = document.getElementById('reset-btn');

const optCaseSensitive = document.getElementById('opt-case-sensitive');
const optWholeWord = document.getElementById('opt-whole-word');
const optRegex = document.getElementById('opt-regex');

const emptyState = document.getElementById('empty-state');
const dashboardContent = document.getElementById('dashboard-content');

// Stat Elements
const statTotalPages = document.getElementById('stat-total-pages');
const statTotalMatches = document.getElementById('stat-total-matches');
const statTopTerm = document.getElementById('stat-top-term');
const statSearchTime = document.getElementById('stat-search-time');

// Distribution & Density Elements
const termDistributionList = document.getElementById('term-distribution-list');
const pageDensityContainer = document.getElementById('page-density-container');

// Results Table Elements
const resultsCountBadge = document.getElementById('results-count-badge');
const tableFilter = document.getElementById('table-filter');
const exportCsvBtn = document.getElementById('export-csv-btn');
const resultsTableBody = document.getElementById('results-table-body');
const resultsTable = document.getElementById('results-table');
const tableFooter = document.getElementById('table-footer');
const rowsPerPageSelect = document.getElementById('rows-per-page-select');
const paginationInfo = document.getElementById('pagination-info');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');

// Modal Elements
const resultModal = document.getElementById('result-modal');
const modalKeywordBadge = document.getElementById('modal-keyword-badge');
const modalPageNum = document.getElementById('modal-page-num');
const modalContextText = document.getElementById('modal-context-text');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalCopyBtn = document.getElementById('modal-copy-btn');
const modalOkBtn = document.getElementById('modal-ok-btn');
const modalOverlay = document.querySelector('.modal-overlay');

// --- FILE UPLOAD & PARSING ---

// Drag and drop events
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

// Remove file action
removeFileBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent trigger dropzone click
    resetApp();
});

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function handleFileSelect(file) {
    if (file.type !== 'application/pdf') {
        alert("Veuillez sélectionner un fichier PDF valide.");
        return;
    }
    
    // Store metadata
    state.pdfFilename = file.name;
    state.pdfFilesize = formatBytes(file.size);
    
    // UI Update
    pdfFilenameEl.textContent = state.pdfFilename;
    pdfFilesizeEl.textContent = state.pdfFilesize;
    dropzone.classList.add('hidden');
    fileDetails.classList.remove('hidden');
    parseProgressContainer.classList.remove('hidden');
    
    // Read ArrayBuffer
    const reader = new FileReader();
    reader.onload = async function() {
        try {
            await parsePDF(this.result);
        } catch (error) {
            console.error("PDF Parsing Error: ", error);
            alert("Erreur lors du chargement ou de l'analyse du PDF : " + error.message);
            resetApp();
        }
    };
    reader.readAsArrayBuffer(file);
}

async function parsePDF(arrayBuffer) {
    updateProgress(0, "Ouverture du document...");
    
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    state.pdfDocument = await loadingTask.promise;
    
    const totalPages = state.pdfDocument.numPages;
    state.pagesData = [];
    
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        updateProgress(
            Math.round((pageNum / totalPages) * 100), 
            `Extraction du texte - Page ${pageNum}/${totalPages}`
        );
        
        const page = await state.pdfDocument.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Reconstruct line-based text structure to maintain spacing
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
    
    // Parsing Completed
    parseProgressContainer.classList.add('hidden');
    statTotalPages.textContent = totalPages;
    updateSearchButtonState();
    
    // Show Dashboard with empty welcome state initially
    emptyState.classList.add('hidden');
    dashboardContent.classList.remove('hidden');
    
    // Setup Page density visualization grid skeleton
    renderPageDensitySkeleton();
}

function updateProgress(percentage, statusText) {
    parseProgressBar.style.width = percentage + '%';
    parsePercentageEl.textContent = percentage + '%';
    parseStatusEl.textContent = statusText;
}

// --- KEYWORD TAGS SYSTEM ---

// Event handler to add tags on Enter or comma
keywordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const value = keywordInput.value.trim().replace(/,$/, ''); // Remove trailing comma if present
        
        if (value) {
            addKeyword(value);
            keywordInput.value = '';
        }
    }
});

// Clicking container focuses input
tagsInputContainer.addEventListener('click', (e) => {
    if (e.target === tagsInputContainer) {
        keywordInput.focus();
    }
});

function addKeyword(word) {
    if (!state.keywords.has(word)) {
        state.keywords.add(word);
        renderTags();
        updateSearchButtonState();
    }
}

function removeKeyword(word) {
    state.keywords.delete(word);
    renderTags();
    updateSearchButtonState();
}

function renderTags() {
    // Remove existing tags
    const existingTags = tagsInputContainer.querySelectorAll('.keyword-tag');
    existingTags.forEach(tag => tag.remove());
    
    // Create and append new tags before input
    state.keywords.forEach(word => {
        const tag = document.createElement('span');
        tag.className = 'keyword-tag';
        tag.innerHTML = `${escapeHTML(word)} <i class="fa-solid fa-xmark"></i>`;
        
        // Remove click event
        tag.querySelector('i').addEventListener('click', (e) => {
            e.stopPropagation();
            removeKeyword(word);
        });
        
        tagsInputContainer.insertBefore(tag, keywordInput);
    });
}

function updateSearchButtonState() {
    const hasPDF = state.pdfDocument !== null;
    const hasKeywords = state.keywords.size > 0;
    searchBtn.disabled = !(hasPDF && hasKeywords);
}

// --- SEARCH ENGINE ---

searchBtn.addEventListener('click', runSearch);

// Helper to escape regex special characters
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper to escape HTML characters
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function runSearch() {
    if (!state.pdfDocument || state.keywords.size === 0) return;
    
    const startTime = performance.now();
    state.searchResults = [];
    state.selectedPageFilter = null; // Clear page filter if search runs again
    
    // Compile search expressions
    const searchPatterns = [];
    let hasInvalidRegex = false;
    
    state.keywords.forEach(term => {
        let patternStr = '';
        let flags = 'g';
        
        if (!optCaseSensitive.checked) {
            flags += 'i';
        }
        
        if (optRegex.checked) {
            patternStr = term;
            // Validate regex
            try {
                new RegExp(patternStr, flags);
            } catch (err) {
                alert(`Expression régulière invalide pour "${term}": ${err.message}`);
                hasInvalidRegex = true;
                return;
            }
        } else {
            const escapedTerm = escapeRegExp(term);
            patternStr = optWholeWord.checked ? `\\b${escapedTerm}\\b` : escapedTerm;
        }
        
        searchPatterns.push({
            originalTerm: term,
            regex: new RegExp(patternStr, flags)
        });
    });
    
    if (hasInvalidRegex) return;
    
    let resultId = 0;
    
    // Perform search on each page's extracted text
    state.pagesData.forEach(page => {
        searchPatterns.forEach(pattern => {
            // Reset regex lastIndex
            pattern.regex.lastIndex = 0;
            let match;
            
            while ((match = pattern.regex.exec(page.text)) !== null) {
                // Find index and match length
                const matchIndex = match.index;
                const matchText = match[0];
                const matchLength = matchText.length;
                
                // Get context (approx 60 chars before and 60 chars after)
                const contextRadius = 60;
                let startIdx = Math.max(0, matchIndex - contextRadius);
                let endIdx = Math.min(page.text.length, matchIndex + matchLength + contextRadius);
                
                // Construct clean snippet (prevent cutting words if possible, simple approach)
                let context = page.text.substring(startIdx, endIdx);
                
                // Adjust index coordinates relative to the context snippet
                const relativeIndex = matchIndex - startIdx;
                
                state.searchResults.push({
                    id: ++resultId,
                    term: pattern.originalTerm,
                    pageNum: page.pageNum,
                    fullPageText: page.text,
                    context: context,
                    matchIndex: relativeIndex,
                    matchLength: matchLength,
                    globalIndex: matchIndex
                });
                
                // Safety break for infinite regex loops
                if (pattern.regex.lastIndex === matchIndex) {
                    pattern.regex.lastIndex++;
                }
            }
        });
    });
    
    state.searchTime = Math.round(performance.now() - startTime);
    
    // Reset pagination to first page
    state.pagination.currentPage = 1;
    
    // Update Stats and Visuals
    updateDashboardUI();
}

// --- DASHBOARD UI UPDATES ---

function updateDashboardUI() {
    // 1. Stat Cards
    statTotalMatches.textContent = state.searchResults.length;
    statSearchTime.textContent = `${state.searchTime} ms`;
    
    // Compute frequency of each term
    const termCounts = {};
    state.keywords.forEach(word => termCounts[word] = 0);
    state.searchResults.forEach(res => {
        termCounts[res.term] = (termCounts[res.term] || 0) + 1;
    });
    
    let topTerm = '-';
    let topCount = -1;
    
    Object.keys(termCounts).forEach(term => {
        if (termCounts[term] > topCount) {
            topCount = termCounts[term];
            topTerm = term;
        }
    });
    
    statTopTerm.textContent = topCount > 0 ? `${topTerm} (${topCount})` : '-';
    
    // 2. Keyword distribution list (bar chart)
    renderTermDistribution(termCounts);
    
    // 3. Density heatmap page grid
    renderPageDensityGrid();
    
    // 4. Results Table with pagination
    resultsCountBadge.classList.remove('hidden');
    resultsCountBadge.textContent = `${state.searchResults.length} résultat(s)`;
    exportCsvBtn.disabled = state.searchResults.length === 0;
    
    renderResultsTable();
}

// Render term frequencies bar chart
function renderTermDistribution(termCounts) {
    termDistributionList.innerHTML = '';
    
    const sortedTerms = Object.keys(termCounts).sort((a, b) => termCounts[b] - termCounts[a]);
    const maxCount = Math.max(...Object.values(termCounts), 1);
    
    sortedTerms.forEach(term => {
        const count = termCounts[term];
        const percentage = Math.round((count / maxCount) * 100);
        
        const distItem = document.createElement('div');
        distItem.className = 'distribution-item';
        distItem.innerHTML = `
            <div class="dist-meta">
                <span class="dist-tag">${escapeHTML(term)}</span>
                <span class="dist-count">${count} occ.</span>
            </div>
            <div class="dist-bar-bg">
                <div class="dist-bar" style="width: 0%"></div>
            </div>
        `;
        
        termDistributionList.appendChild(distItem);
        
        // Trigger CSS animation delay
        setTimeout(() => {
            distItem.querySelector('.dist-bar').style.width = `${percentage}%`;
        }, 50);
    });
    
    if (sortedTerms.length === 0) {
        termDistributionList.innerHTML = '<p class="placeholder-text">Aucune correspondance trouvée.</p>';
    }
}

// Setup empty pages on load
function renderPageDensitySkeleton() {
    pageDensityContainer.innerHTML = '';
    const totalPages = state.pdfDocument.numPages;
    
    for (let i = 1; i <= totalPages; i++) {
        const pageItem = document.createElement('div');
        pageItem.className = 'page-density-item intensity-0';
        pageItem.innerHTML = `<span class="page-num-label">${i}</span>`;
        pageDensityContainer.appendChild(pageItem);
    }
}

// Update page background intensities after search
function renderPageDensityGrid() {
    pageDensityContainer.innerHTML = '';
    const totalPages = state.pdfDocument.numPages;
    
    // Compute occurrences per page
    const pageCounts = Array(totalPages + 1).fill(0);
    state.searchResults.forEach(res => {
        pageCounts[res.pageNum]++;
    });
    
    const maxPageCount = Math.max(...pageCounts, 1);
    
    for (let i = 1; i <= totalPages; i++) {
        const count = pageCounts[i];
        const pageItem = document.createElement('div');
        
        let intensityClass = 'intensity-0';
        if (count > 0) {
            const ratio = count / maxPageCount;
            if (ratio < 0.25) intensityClass = 'intensity-low';
            else if (ratio < 0.5) intensityClass = 'intensity-med';
            else if (ratio < 0.75) intensityClass = 'intensity-high';
            else intensityClass = 'intensity-extreme';
        }
        
        // Selected highlight
        const isSelected = state.selectedPageFilter === i;
        const selectedStyle = isSelected ? 'border: 2px solid var(--secondary); transform: scale(1.08); z-index: 2;' : '';
        
        pageItem.className = `page-density-item ${intensityClass}`;
        if (selectedStyle) pageItem.setAttribute('style', selectedStyle);
        
        let badgeHtml = count > 0 ? `<span class="match-density-badge">${count}</span>` : '';
        pageItem.innerHTML = `
            <span class="page-num-label">${i}</span>
            ${badgeHtml}
        `;
        
        // Event: Click on page card filters the table by this page
        pageItem.addEventListener('click', () => {
            if (state.selectedPageFilter === i) {
                state.selectedPageFilter = null; // Toggle off
            } else {
                state.selectedPageFilter = i; // Toggle on
            }
            state.pagination.currentPage = 1; // reset page
            renderPageDensityGrid(); // Re-render self to update selected borders
            renderResultsTable(); // Re-render results table
        });
        
        pageDensityContainer.appendChild(pageItem);
    }
}

// --- RESULTS TABLE & INTERACTIVITY ---

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
        
        // Update sorting indicators
        document.querySelectorAll('th.sortable i').forEach(icon => {
            icon.className = 'fa-solid fa-sort';
        });
        
        const activeIcon = header.querySelector('i');
        if (state.sort.direction === 'asc') {
            activeIcon.className = 'fa-solid fa-sort-up';
        } else {
            activeIcon.className = 'fa-solid fa-sort-down';
        }
        
        renderResultsTable();
    });
});

function getFilteredResults() {
    let filtered = [...state.searchResults];
    
    // Page filter (from density grid click)
    if (state.selectedPageFilter !== null) {
        filtered = filtered.filter(res => res.pageNum === state.selectedPageFilter);
    }
    
    // Text filter (from table text filter input)
    if (state.filterText) {
        filtered = filtered.filter(res => 
            res.term.toLowerCase().includes(state.filterText) ||
            res.context.toLowerCase().includes(state.filterText)
        );
    }
    
    // Sorting
    filtered.sort((a, b) => {
        let valA, valB;
        if (state.sort.column === 'term') {
            valA = a.term.toLowerCase();
            valB = b.term.toLowerCase();
        } else { // page
            valA = a.pageNum;
            valB = b.pageNum;
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
                <td colspan="4" class="empty-table-message">
                    <i class="fa-solid fa-magnifying-glass-minus"></i>
                    Aucun résultat ne correspond à vos filtres.
                </td>
            </tr>
        `;
        tableFooter.classList.add('hidden');
        return;
    }
    
    tableFooter.classList.remove('hidden');
    
    // Pagination slicing
    const limit = state.pagination.rowsPerPage;
    const maxPage = Math.ceil(totalItems / limit);
    
    // Correct currentPage if out of bounds
    if (state.pagination.currentPage > maxPage) {
        state.pagination.currentPage = maxPage;
    }
    if (state.pagination.currentPage < 1) {
        state.pagination.currentPage = 1;
    }
    
    const startIndex = (state.pagination.currentPage - 1) * limit;
    const endIndex = Math.min(startIndex + limit, totalItems);
    const paginatedItems = filtered.slice(startIndex, endIndex);
    
    // Render Rows
    paginatedItems.forEach(item => {
        const row = document.createElement('tr');
        
        // Highlight logic in context
        const escapedSnippet = escapeHTML(item.context);
        const termInContext = item.context.substr(item.matchIndex, item.matchLength);
        const escapedTermInContext = escapeHTML(termInContext);
        
        // Reconstruct highlighted context text using simple replace or indexing
        let highlightedContext = escapedSnippet;
        
        if (escapedTermInContext) {
            // Find target inside escaped text and highlight
            // Note: Since matchIndex relates to raw string, HTML escaping could offset lengths.
            // A safer HTML snippet highlight is to escape the chunks individually:
            const before = escapeHTML(item.context.substring(0, item.matchIndex));
            const match = escapeHTML(item.context.substring(item.matchIndex, item.matchIndex + item.matchLength));
            const after = escapeHTML(item.context.substring(item.matchIndex + item.matchLength));
            highlightedContext = `${before}<mark>${match}</mark>${after}`;
        }
        
        row.innerHTML = `
            <td><span class="result-tag-badge">${escapeHTML(item.term)}</span></td>
            <td><strong>Page ${item.pageNum}</strong></td>
            <td class="context-cell">${highlightedContext}</td>
            <td class="text-right">
                <button class="btn btn-secondary view-details-btn" data-id="${item.id}" style="padding: 6px 12px; font-size: 11px;">
                    <i class="fa-solid fa-eye"></i> Détails
                </button>
            </td>
        `;
        
        row.querySelector('.view-details-btn').addEventListener('click', () => {
            openDetailsModal(item);
        });
        
        resultsTableBody.appendChild(row);
    });
    
    // Update Pagination UI info & buttons
    paginationInfo.textContent = `${startIndex + 1}-${endIndex} sur ${totalItems}`;
    prevPageBtn.disabled = state.pagination.currentPage === 1;
    nextPageBtn.disabled = state.pagination.currentPage === maxPage;
}

// --- MODAL VIEWS ---

let currentModalItem = null;

function openDetailsModal(item) {
    currentModalItem = item;
    
    modalKeywordBadge.textContent = item.term;
    modalPageNum.textContent = `Page ${item.pageNum}`;
    
    // Highlight matched string inside complete sentence preview
    // We want to reconstruct the display context nicely.
    // For the modal preview, we can retrieve a wider context block from the page if we want,
    // or just display the exact item context with mark tags.
    // Let's grab the snippet and format it.
    const before = escapeHTML(item.context.substring(0, item.matchIndex));
    const match = escapeHTML(item.context.substring(item.matchIndex, item.matchIndex + item.matchLength));
    const after = escapeHTML(item.context.substring(item.matchIndex + item.matchLength));
    
    modalContextText.innerHTML = `... ${before}<mark>${match}</mark>${after} ...`;
    
    resultModal.classList.remove('hidden');
}

function closeModal() {
    resultModal.classList.add('hidden');
    currentModalItem = null;
}

modalCloseBtn.addEventListener('click', closeModal);
modalOkBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);

modalCopyBtn.addEventListener('click', () => {
    if (currentModalItem) {
        navigator.clipboard.writeText(currentModalItem.context)
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
                console.error("Clipboard copy failed: ", err);
            });
    }
});

// --- CSV EXPORTER ---

exportCsvBtn.addEventListener('click', () => {
    if (state.searchResults.length === 0) return;
    
    const filtered = getFilteredResults();
    
    // CSV Header
    let csvContent = "Mot-cle;Page;Contexte textuel\n";
    
    // Populate rows (Excel default delimiter in Europe is semicolon ';')
    filtered.forEach(item => {
        const escapedTerm = item.term.replace(/"/g, '""');
        // Clean formatting and replace line breaks in context for clean csv lines
        const cleanedContext = item.context.replace(/\r?\n|\r/g, " ").replace(/"/g, '""').trim();
        
        csvContent += `"${escapedTerm}";${item.pageNum};"${cleanedContext}"\n`;
    });
    
    // Setup download link with UTF-8 BOM for French accents display in Excel
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    // Clean filename (replace space/special chars)
    const cleanFilename = state.pdfFilename.replace(/\.[^/.]+$/, "");
    link.setAttribute("download", `resultats_recherche_${cleanFilename}.csv`);
    
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
    state.searchTime = 0;
    state.selectedPageFilter = null;
    state.filterText = '';
    
    // Reset keywords tags
    state.keywords.clear();
    renderTags();
    keywordInput.value = '';
    
    // Reset options
    optCaseSensitive.checked = false;
    optWholeWord.checked = false;
    optRegex.checked = false;
    
    // Reset file selectors UI
    fileInput.value = '';
    dropzone.classList.remove('hidden');
    fileDetails.classList.add('hidden');
    parseProgressContainer.classList.add('hidden');
    
    // Reset Search Filter input
    tableFilter.value = '';
    
    // Disable Search button
    updateSearchButtonState();
    
    // View back to empty state
    emptyState.classList.remove('hidden');
    dashboardContent.classList.add('hidden');
}

// Global reset btn listener
resetBtn.addEventListener('click', () => {
    if (state.pdfDocument) {
        if (confirm("Voulez-vous vraiment réinitialiser la recherche et supprimer le document en cours ?")) {
            resetApp();
        }
    } else {
        resetApp();
    }
});
