const form = document.getElementById('upload-form');
const fileInput = document.getElementById('resume-input');
const targetRoleInput = document.getElementById('target-role');
const dropzone = document.getElementById('dropzone');
const fileNameEl = document.getElementById('file-name');
const analyzeBtn = document.getElementById('analyze-btn');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');

function setStatus(message, type) {
  statusEl.hidden = !message;
  statusEl.textContent = message;
  statusEl.className = `status ${type || ''}`;
}

function renderList(listEl, items) {
  listEl.innerHTML = '';
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    listEl.appendChild(li);
  }
}

function setScore(scoreEl, fillEl, score) {
  scoreEl.textContent = score;
  fillEl.style.width = `${score}%`;
}

function showResults(data) {
  setScore(
    document.getElementById('ats-score'),
    document.getElementById('ats-fill'),
    data.atsScore,
  );
  setScore(
    document.getElementById('job-match-score'),
    document.getElementById('job-match-fill'),
    data.jobMatchScore,
  );

  const kw = data.keywordGapAnalysis;
  renderList(document.getElementById('missing-keywords'), kw.missingKeywords);
  renderList(document.getElementById('present-keywords'), kw.presentKeywords);
  renderList(document.getElementById('keyword-recommendations'), kw.recommendations);

  const skills = data.skillGapAnalysis;
  renderList(document.getElementById('current-skills'), skills.currentSkills);
  renderList(document.getElementById('missing-skills'), skills.missingSkills);
  renderList(document.getElementById('priority-skills'), skills.priorityToLearn);

  const rewriteList = document.getElementById('rewrite-list');
  rewriteList.innerHTML = '';
  for (const item of data.resumeRewriteSuggestions) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <p class="item-meta">${escapeHtml(item.section)}</p>
      <p class="item-before"><span>Before:</span> ${escapeHtml(item.before)}</p>
      <p class="item-after"><span>After:</span> ${escapeHtml(item.after)}</p>
    `;
    rewriteList.appendChild(card);
  }

  const projectList = document.getElementById('project-list');
  projectList.innerHTML = '';
  for (const item of data.projectRecommendations) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <h3 class="item-title">${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <p class="item-tags">${item.skillsBuilt.map(escapeHtml).join(' · ')}</p>
      <p class="item-why"><span>Why:</span> ${escapeHtml(item.why)}</p>
    `;
    projectList.appendChild(card);
  }

  const interviewList = document.getElementById('interview-list');
  interviewList.innerHTML = '';
  for (const item of data.interviewQuestions) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = `
      <p class="item-meta">${escapeHtml(item.topic)}</p>
      <p class="item-question">${escapeHtml(item.question)}</p>
      <p class="item-tip"><span>Tip:</span> ${escapeHtml(item.tip)}</p>
    `;
    interviewList.appendChild(card);
  }

  resultsEl.hidden = false;
  resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function hideResults() {
  resultsEl.hidden = true;
}

function updateSubmitState() {
  const hasFile = Boolean(fileInput.files[0]);
  const hasRole = Boolean(targetRoleInput.value.trim());
  analyzeBtn.disabled = !(hasFile && hasRole);
}

fileInput.addEventListener('change', () => {
  fileNameEl.textContent = fileInput.files[0]?.name ?? '';
  updateSubmitState();
});

targetRoleInput.addEventListener('input', updateSubmitState);

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    fileInput.files = e.dataTransfer.files;
    fileNameEl.textContent = file.name;
    updateSubmitState();
  } else {
    setStatus('Please drop a PDF file.', 'error');
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file || !targetRoleInput.value.trim()) return;

  hideResults();
  setStatus('Generating your intelligence report… this can take up to a minute if Gemini is busy.', 'loading');
  analyzeBtn.disabled = true;

  const body = new FormData();
  body.append('resume', file);
  body.append('targetRole', targetRoleInput.value.trim());
  body.append('jobDescription', document.getElementById('job-description').value.trim());

  try {
    const response = await fetch('/api/analyze', { method: 'POST', body });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Analysis failed');
    }

    setStatus('');
    showResults(data);
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    updateSubmitState();
  }
});
