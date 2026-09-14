// Configuration & State
const DEFAULT_WEBHOOK_URL = '/api/optimize';
const STORAGE_KEY_CV = 'cv_optimizer_saved_cv';
const STORAGE_KEY_ENDPOINT = 'cv_optimizer_webhook_url';

let state = {
  cvText: '',
  cvFileName: '',
  jobDescription: '',
  targetRole: '',
  webhookUrl: localStorage.getItem(STORAGE_KEY_ENDPOINT) || DEFAULT_WEBHOOK_URL,
  resultData: null,
  originalHtml: '',
  isEditing: false
};

// DOM Elements
const settingsToggleBtn = document.getElementById('settingsToggleBtn');
const settingsPanel = document.getElementById('settingsPanel');
const webhookUrlInput = document.getElementById('webhookUrlInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const dropzone = document.getElementById('dropzone');
const cvFileInput = document.getElementById('cvFileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const removeFileBtn = document.getElementById('removeFileBtn');
const cvTextarea = document.getElementById('cvTextarea');
const rememberCvCheckbox = document.getElementById('rememberCvCheckbox');

const targetRoleInput = document.getElementById('targetRoleInput');
const jdTextarea = document.getElementById('jdTextarea');
const generateBtn = document.getElementById('generateBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');

const inputSection = document.getElementById('inputSection');
const processingSection = document.getElementById('processingSection');
const processingStepTitle = document.getElementById('processingStepTitle');
const processingStepDesc = document.getElementById('processingStepDesc');

const resultsSection = document.getElementById('resultsSection');
const scoreValue = document.getElementById('scoreValue');
const resultRoleTitle = document.getElementById('resultRoleTitle');
const resultMetrics = document.getElementById('resultMetrics');

const downloadDropdownBtn = document.getElementById('downloadDropdownBtn');
const downloadMenu = document.getElementById('downloadMenu');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const downloadDocxBtn = document.getElementById('downloadDocxBtn');
const downloadMdBtn = document.getElementById('downloadMdBtn');
const downloadTxtBtn = document.getElementById('downloadTxtBtn');
const copyClipboardBtn = document.getElementById('copyClipboardBtn');
const newCvBtn = document.getElementById('newCvBtn');

const editToggleBtn = document.getElementById('editToggleBtn');
const editNoticeBanner = document.getElementById('editNoticeBanner');
const discardEditsBtn = document.getElementById('discardEditsBtn');
const saveEditsBtn = document.getElementById('saveEditsBtn');

const resTabs = document.querySelectorAll('.res-tab');
const resPanels = document.querySelectorAll('.res-panel');
const documentPaper = document.getElementById('documentPaper');
const changesList = document.getElementById('changesList');
const keywordsTags = document.getElementById('keywordsTags');
const changesCount = document.getElementById('changesCount');
const keywordsCount = document.getElementById('keywordsCount');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  webhookUrlInput.value = state.webhookUrl;

  const savedCv = localStorage.getItem(STORAGE_KEY_CV);
  if (savedCv) {
    state.cvText = savedCv;
    cvTextarea.value = savedCv;
    switchTab('pasteTab');
    statusText.textContent = 'Saved CV loaded from storage';
  }

  setupEventListeners();
});

function setupEventListeners() {
  // Settings
  settingsToggleBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
  });

  saveSettingsBtn.addEventListener('click', () => {
    const val = webhookUrlInput.value.trim();
    if (val) {
      state.webhookUrl = val;
      localStorage.setItem(STORAGE_KEY_ENDPOINT, val);
      settingsPanel.classList.add('hidden');
      statusText.textContent = 'Endpoint updated';
    }
  });

  // Source CV Tabs
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // File Upload Handlers
  cvFileInput.addEventListener('change', handleFileSelect);

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
      cvFileInput.files = e.dataTransfer.files;
      handleFileSelect();
    }
  });

  removeFileBtn.addEventListener('click', () => {
    cvFileInput.value = '';
    state.cvText = '';
    state.cvFileName = '';
    fileInfo.classList.add('hidden');
    dropzone.classList.remove('hidden');
    statusText.textContent = 'File removed';
  });

  cvTextarea.addEventListener('input', () => {
    state.cvText = cvTextarea.value;
    if (rememberCvCheckbox.checked) {
      localStorage.setItem(STORAGE_KEY_CV, state.cvText);
    }
  });

  rememberCvCheckbox.addEventListener('change', () => {
    if (rememberCvCheckbox.checked && state.cvText) {
      localStorage.setItem(STORAGE_KEY_CV, state.cvText);
    } else {
      localStorage.removeItem(STORAGE_KEY_CV);
    }
  });

  // Action Submit
  generateBtn.addEventListener('click', handleGenerate);

  // Results View Tabs
  resTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      resTabs.forEach(t => t.classList.remove('active'));
      resPanels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.resTab).classList.add('active');
    });
  });

  // Download Dropdown Toggle
  downloadDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    downloadMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    downloadMenu.classList.add('hidden');
  });

  // Download Actions
  downloadPdfBtn.addEventListener('click', exportAsPdf);
  downloadDocxBtn.addEventListener('click', exportAsDocx);
  downloadMdBtn.addEventListener('click', exportAsMarkdown);
  downloadTxtBtn.addEventListener('click', exportAsPlainText);

  copyClipboardBtn.addEventListener('click', copyToClipboard);

  // Edit Mode Actions
  editToggleBtn.addEventListener('click', () => {
    toggleEditMode(!state.isEditing);
  });

  saveEditsBtn.addEventListener('click', () => {
    toggleEditMode(false);
  });

  discardEditsBtn.addEventListener('click', () => {
    if (confirm('Discard all your edits and restore the original AI generation?')) {
      documentPaper.innerHTML = state.originalHtml;
      toggleEditMode(false);
    }
  });

  newCvBtn.addEventListener('click', () => {
    resultsSection.classList.add('hidden');
    inputSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function switchTab(tabId) {
  tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
  tabContents.forEach(c => c.classList.toggle('active', c.id === tabId));
}

// File Text Extraction (.pdf, .docx, .txt, .md)
async function handleFileSelect() {
  const file = cvFileInput.files[0];
  if (!file) return;

  state.cvFileName = file.name;
  fileName.textContent = file.name;
  dropzone.classList.add('hidden');
  fileInfo.classList.remove('hidden');
  statusText.textContent = `Extracting text from ${file.name}...`;

  try {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'txt' || ext === 'md') {
      state.cvText = await file.text();
    } else if (ext === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await window.mammoth.extractRawText({ arrayBuffer });
      state.cvText = result.value;
    } else if (ext === 'pdf') {
      state.cvText = await extractPdfText(file);
    } else {
      throw new Error('Unsupported format. Please upload PDF, DOCX, TXT, or MD.');
    }

    if (rememberCvCheckbox.checked && state.cvText) {
      localStorage.setItem(STORAGE_KEY_CV, state.cvText);
    }
    statusText.textContent = `Extracted ${state.cvText.length} characters`;
  } catch (err) {
    statusText.textContent = `Error reading file: ${err.message}`;
    alert(`File extraction failed: ${err.message}`);
  }
}

async function extractPdfText(file) {
  if (!window.pdfjsLib) {
    throw new Error('PDF library failed to load.');
  }
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    fullText += strings.join(' ') + '\n\n';
  }

  return fullText.trim();
}

// Optimization Execution
async function handleGenerate() {
  const cvText = state.cvText || cvTextarea.value.trim();
  const jdText = jdTextarea.value.trim();
  const targetRole = targetRoleInput.value.trim();

  if (!cvText || cvText.length < 30) {
    alert('Please upload a CV or paste your CV text (minimum 30 characters).');
    return;
  }
  if (!jdText || jdText.length < 30) {
    alert('Please paste the target job description (minimum 30 characters).');
    return;
  }

  state.cvText = cvText;
  state.jobDescription = jdText;
  state.targetRole = targetRole;

  // Show processing animation
  inputSection.classList.add('hidden');
  resultsSection.classList.add('hidden');
  processingSection.classList.remove('hidden');

  let progressInterval = startProgressStages();

  try {
    const payload = {
      cvText: state.cvText,
      jobDescription: state.jobDescription,
      targetRole: state.targetRole
    };

    const response = await fetch(state.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    clearInterval(progressInterval);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Server error: ${response.status}`);
    }

    const data = await response.json();
    if (data.status === 'error' || !data.data) {
      throw new Error(data.message || data.error || 'Optimization returned an error.');
    }

    state.resultData = data.data;
    renderResults(data.data);

    processingSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    clearInterval(progressInterval);
    processingSection.classList.add('hidden');
    inputSection.classList.remove('hidden');
    alert(`Generation failed: ${err.message}`);
    statusText.textContent = `Failed: ${err.message}`;
  }
}

function startProgressStages() {
  const stages = [
    { title: 'Analyzing Job Description', desc: 'Extracting key competencies and missing ATS keywords...' },
    { title: 'Evaluating Candidate Profile', desc: 'Cross-referencing CV experience against target qualifications...' },
    { title: 'Re-writing Experience Bullets', desc: 'Applying Google XYZ formula with high-impact action verbs...' },
    { title: 'Compiling Multi-Format Exports', desc: 'Generating ATS-compliant printable layouts...' }
  ];

  let current = 0;
  return setInterval(() => {
    current = (current + 1) % stages.length;
    processingStepTitle.textContent = stages[current].title;
    processingStepDesc.textContent = stages[current].desc;
  }, 3500);
}

// Render Results View
function renderResults(data) {
  resultRoleTitle.textContent = data.targetTitle || 'Optimized CV';
  scoreValue.textContent = `${data.stats.projectedAtsScore || 92}%`;

  const keywordsLen = (data.keywordsInjected || []).length;
  const changesLen = (data.changes || []).length;
  resultMetrics.textContent = `${keywordsLen} keywords integrated • ${changesLen} bullets enhanced`;

  changesCount.textContent = changesLen;
  keywordsCount.textContent = keywordsLen;

  // Tab 1: Formatted Document
  documentPaper.innerHTML = data.optimizedHtml || '<p>No preview available.</p>';

  // Tab 2: Enhancements Diff
  changesList.innerHTML = '';
  if (data.changes && data.changes.length) {
    data.changes.forEach(c => {
      const item = document.createElement('div');
      item.className = 'change-item';
      item.innerHTML = `
        <div class="change-section">${escapeHtml(c.section || 'Experience')}</div>
        <div class="change-diff">
          <div class="diff-original">${escapeHtml(c.original || '')}</div>
          <div class="diff-updated">${escapeHtml(c.updated || '')}</div>
        </div>
        ${c.keywords_added && c.keywords_added.length ? `
          <div class="change-keywords-row">
            <span>Keywords:</span>
            ${c.keywords_added.map(k => `<span class="kw-badge">${escapeHtml(k)}</span>`).join('')}
          </div>
        ` : ''}
      `;
      changesList.appendChild(item);
    });
  } else {
    changesList.innerHTML = '<p class="hint">No specific bullet diffs recorded.</p>';
  }

  // Tab 3: Keywords Chips
  keywordsTags.innerHTML = '';
  if (data.keywordsInjected && data.keywordsInjected.length) {
    data.keywordsInjected.forEach(k => {
      const chip = document.createElement('span');
      chip.className = 'keyword-chip';
      chip.textContent = k;
      keywordsTags.appendChild(chip);
    });
  }
}

// Export Handlers
function exportAsPdf() {
  if (!state.resultData) return;
  const element = document.getElementById('documentPaper');
  if (window.html2pdf) {
    const originalText = downloadPdfBtn.textContent;
    downloadPdfBtn.textContent = 'Generating PDF...';
    const opt = {
      margin: [10, 10, 10, 10],
      filename: getExportFileName('pdf'),
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    window.html2pdf()
      .set(opt)
      .from(element)
      .save()
      .then(() => {
        downloadPdfBtn.textContent = originalText;
      })
      .catch((err) => {
        console.error('html2pdf error, fallback to print:', err);
        downloadPdfBtn.textContent = originalText;
        window.print();
      });
  } else {
    window.print();
  }
}

function exportAsDocx() {
  if (!state.resultData) return;

  if (state.resultData.docxBase64) {
    const binaryStr = atob(state.resultData.docxBase64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes.buffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
    triggerDownload(blob, getExportFileName('docx'));
    return;
  }

  // Fallback if docxBase64 is unavailable
  const htmlContent = `
    <!DOCTYPE html>
    <html><head><meta charset='utf-8'></head><body>
      ${state.resultData.optimizedHtml}
    </body></html>
  `;
  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword'
  });
  triggerDownload(blob, getExportFileName('doc'));
}

function exportAsMarkdown() {
  if (!state.resultData) return;
  const blob = new Blob([state.resultData.optimizedMarkdown], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, getExportFileName('md'));
}

function exportAsPlainText() {
  if (!state.resultData) return;
  const blob = new Blob([state.resultData.optimizedText], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, getExportFileName('txt'));
}

function copyToClipboard() {
  if (!state.resultData) return;
  const text = state.resultData.optimizedText || state.resultData.optimizedMarkdown;
  navigator.clipboard.writeText(text).then(() => {
    const original = copyClipboardBtn.textContent;
    copyClipboardBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyClipboardBtn.textContent = original;
    }, 2000);
  });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function getExportFileName(ext) {
  const role = (state.resultData && state.resultData.targetTitle)
    ? state.resultData.targetTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
    : 'optimized';
  const date = new Date().toISOString().split('T')[0];
  return `cv_${role}_${date}.${ext}`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
