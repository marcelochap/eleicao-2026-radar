// State
const state = {
  currentView: 'dossier-view',
  candidates: [],
  parties: [],
  stats: null,
  questions: [],
  userAnswers: {},
  activeFilterCargo: '',
  activeFilterPartido: '',
  activeFilterProposta: '',
  activeOrderBy: 'default',
  searchQuery: '',
  selectedCandidateDossier: null,
  graphData: null
};

// DOM Elements
const navBtns = document.querySelectorAll('.nav-btn');
const viewContents = document.querySelectorAll('.view-content');
const candidatesGrid = document.getElementById('candidates-grid');
const searchInput = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear-btn');
const filterCargo = document.getElementById('filter-cargo');
const filterPartido = document.getElementById('filter-partido');
const filterProposta = document.getElementById('filter-proposta');
const filterOrder = document.getElementById('filter-order');
const chipsContainer = document.getElementById('chips-container');
const resultsCount = document.getElementById('results-count');

// Modal Elements
const dossierModal = document.getElementById('dossier-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalHeaderContent = document.getElementById('modal-header-content');
const modalTabBtns = document.querySelectorAll('.modal-tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

// Quiz Elements
const questionsList = document.getElementById('questions-list');
const quizProgressBar = document.getElementById('quiz-progress-bar');
const quizProgressText = document.getElementById('quiz-progress-text');
const btnCalculateMatch = document.getElementById('btn-calculate-match');
const btnResetQuiz = document.getElementById('btn-reset-quiz');
const userQuadrantBadge = document.getElementById('user-quadrant-badge');
const userProfileDesc = document.getElementById('user-profile-desc');
const matchCandidateList = document.getElementById('match-candidate-list');
const matchPartyList = document.getElementById('match-party-list');
const compassCanvas = document.getElementById('compassCanvas');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupFilters();
  setupModal();
  setupQuiz();

  await loadStats();
  await loadParties();
  await loadCandidates();
  await loadQuestions();
  await loadGraphData();

  drawCompass(0, 0, false);
});

// View Navigation
function setupNavigation() {
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      navBtns.forEach(b => b.classList.remove('active'));
      viewContents.forEach(v => v.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(targetView).classList.add('active');
      state.currentView = targetView;

      if (targetView === 'compass-view') {
        const u = state.userAnswers;
        const count = Object.keys(u).length;
        if (count > 0) evaluateQuizAnswers();
        else drawCompass(0, 0, false);
      } else if (targetView === 'graph-view') {
        renderGraph();
      }
    });
  });
}

// Global Stats
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    state.stats = data;

    document.getElementById('stat-candidatos').textContent = data.totalCandidatos.toLocaleString('pt-BR');
    document.getElementById('stat-propostas').textContent = `${data.totalPropostas} Planos`;
    document.getElementById('stat-patrimonio').textContent = `R$ ${(data.patrimonioTotalDeclarado / 1000000).toFixed(1)}M`;
    document.getElementById('stat-certidoes').textContent = data.totalCertidoes.toLocaleString('pt-BR');
  } catch (err) {
    console.error('Erro ao carregar stats:', err);
  }
}

// Parties Dropdown
async function loadParties() {
  try {
    const res = await fetch('/api/parties');
    const parties = await res.json();
    state.parties = parties;

    parties.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.sg_partido;
      opt.textContent = `${p.sg_partido} (${p.espectro_estimado}) - ${p.total_candidatos} cands`;
      filterPartido.appendChild(opt);
    });
  } catch (err) {
    console.error('Erro ao carregar partidos:', err);
  }
}

// Candidates Loading with Debounced Search
let debounceTimer;
function setupFilters() {
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const val = e.target.value;
    searchClearBtn.style.display = val ? 'block' : 'none';
    debounceTimer = setTimeout(() => {
      state.searchQuery = val;
      loadCandidates();
    }, 280);
  });

  searchClearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchClearBtn.style.display = 'none';
    state.searchQuery = '';
    loadCandidates();
  });

  filterCargo.addEventListener('change', (e) => {
    state.activeFilterCargo = e.target.value;
    updateChipActiveState(e.target.value);
    loadCandidates();
  });

  filterPartido.addEventListener('change', (e) => {
    state.activeFilterPartido = e.target.value;
    loadCandidates();
  });

  filterProposta.addEventListener('change', (e) => {
    state.activeFilterProposta = e.target.value;
    loadCandidates();
  });

  filterOrder.addEventListener('change', (e) => {
    state.activeOrderBy = e.target.value;
    loadCandidates();
  });

  chipsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('chip-btn')) {
      const cargo = e.target.dataset.cargo;
      state.activeFilterCargo = cargo;
      filterCargo.value = cargo;
      updateChipActiveState(cargo);
      loadCandidates();
    }
  });
}

function updateChipActiveState(cargo) {
  document.querySelectorAll('.chip-btn').forEach(c => {
    c.classList.toggle('active', c.dataset.cargo === cargo);
  });
}

async function loadCandidates() {
  resultsCount.textContent = 'Buscando dados no RAG...';
  candidatesGrid.innerHTML = '';

  try {
    let url = '/api/candidates?';
    if (state.searchQuery) {
      url = `/api/search?q=${encodeURIComponent(state.searchQuery)}`;
      const res = await fetch(url);
      const data = await res.json();
      state.candidates = data.candidates || [];
    } else {
      const params = new URLSearchParams();
      if (state.activeFilterCargo) params.append('cargo', state.activeFilterCargo);
      if (state.activeFilterPartido) params.append('partido', state.activeFilterPartido);
      if (state.activeFilterProposta) params.append('temProposta', state.activeFilterProposta);
      if (state.activeOrderBy !== 'default') params.append('orderBy', state.activeOrderBy);
      params.append('limit', '80');

      const res = await fetch(`/api/candidates?${params.toString()}`);
      const data = await res.json();
      state.candidates = data.candidates || [];
    }

    resultsCount.textContent = `Mostrando ${state.candidates.length} candidato(s) encontrado(s)`;
    renderCandidatesGrid();
  } catch (err) {
    resultsCount.textContent = 'Erro ao carregar candidatos.';
    console.error(err);
  }
}

function renderCandidatesGrid() {
  candidatesGrid.innerHTML = '';

  if (state.candidates.length === 0) {
    candidatesGrid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 60px 20px;">
        <h3>Nenhum candidato encontrado</h3>
        <p>Tente ajustar os filtros ou pesquisar por outro nome / partido.</p>
      </div>
    `;
    return;
  }

  state.candidates.forEach(c => {
    const id = c.identificacao;
    const esp = c.espectro_politico;
    const pat = c.patrimonio;
    const fin = c.financiamento_campanha;
    const prop = c.plano_governo;

    let tagClass = 'centro';
    if (esp.economico < -0.2) tagClass = 'esq';
    else if (esp.economico > 0.2) tagClass = 'dir';

    const card = document.createElement('div');
    card.className = 'candidate-card';
    card.innerHTML = `
      <div>
        <div class="card-top">
          <span class="cand-party-pill">${id.partido} · ${id.numero}</span>
          <span class="cand-cargo-badge">${id.cargo} (${id.uf})</span>
        </div>

        <h3 class="cand-name-title">${id.nome_urna}</h3>
        <div class="cand-full-name" title="${id.nome_completo}">${id.nome_completo}</div>

        <div class="spectrum-tag ${tagClass}">
          <span>●</span> ${esp.posicao_geral}
        </div>

        <div class="cand-stats-grid">
          <div>
            <div class="stat-mini-label">Patrimônio</div>
            <div class="stat-mini-value">${pat.total_bens_formatado}</div>
          </div>
          <div>
            <div class="stat-mini-label">Fundo Eleitoral</div>
            <div class="stat-mini-value">${fin.percentual_fundo_eleitoral}</div>
          </div>
        </div>

        ${prop.tem_proposta ? `
          <div class="cand-proposal-highlight">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
            <span>Plano de Governo TSE (${prop.num_paginas} páginas)</span>
          </div>
        ` : ''}
      </div>

      <button class="btn-dossier" data-sq="${id.sq_candidato}">
        <span>Inspecionar Dossiê 360º</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    `;

    card.querySelector('.btn-dossier').addEventListener('click', () => {
      openCandidateDossier(id.sq_candidato);
    });

    candidatesGrid.appendChild(card);
  });
}

// Modal Dossier 360º
function setupModal() {
  modalCloseBtn.addEventListener('click', () => {
    dossierModal.classList.remove('active');
  });

  dossierModal.addEventListener('click', (e) => {
    if (e.target === dossierModal) {
      dossierModal.classList.remove('active');
    }
  });

  modalTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      modalTabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });
}

async function openCandidateDossier(sqCandidato) {
  try {
    const res = await fetch(`/api/candidates/${sqCandidato}`);
    const dossier = await res.json();
    state.selectedCandidateDossier = dossier;

    renderDossierModalContent(dossier);
    dossierModal.classList.add('active');
  } catch (err) {
    console.error('Erro ao abrir dossiê:', err);
  }
}

function renderDossierModalContent(d) {
  const id = d.identificacao;
  const esp = d.espectro_politico;
  const pat = d.patrimonio;
  const fin = d.financiamento_campanha;
  const prop = d.plano_governo;

  modalHeaderContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
      <span class="cand-party-pill" style="font-size: 13px; padding: 6px 14px;">${id.partido} - Nº ${id.numero}</span>
      <span class="cand-cargo-badge" style="font-size: 12px; padding: 6px 12px;">${id.cargo} · ${id.uf}</span>
    </div>
    <h2 style="font-size: 26px; font-weight: 800; color: #fff; margin-bottom: 4px;">${id.nome_urna}</h2>
    <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">${id.nome_completo} · ${id.ocupacao || 'Ocupação não informada'}</p>
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <span class="spectrum-tag" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.4);">
        Espectro: ${esp.posicao_geral}
      </span>
      <span class="cand-cargo-badge">Coligação: ${id.coligacao}</span>
      <span class="cand-cargo-badge">Certidões no TRE: ${d.integridade_e_judicial.total_certidoes_criminais}</span>
    </div>
  `;

  // Aba 1: Propostas
  const tabProposta = document.getElementById('tab-proposta');
  if (prop.tem_proposta && prop.pilares) {
    let pilaresHtml = '';
    for (const [pilarNome, dados] of Object.entries(prop.pilares)) {
      if (dados.mencoes > 0) {
        pilaresHtml += `
          <div class="pillar-card">
            <div class="pillar-header">
              <span class="pillar-title">${pilarNome.replace('_', ' / ')}</span>
              <span class="pillar-badge">${dados.mencoes} menções · Relevância ${dados.relevancia}</span>
            </div>
            ${dados.amostras.map(s => `<div class="pillar-sample">"...${escapeHtml(s)}..."</div>`).join('')}
          </div>
        `;
      }
    }

    tabProposta.innerHTML = `
      <div style="margin-bottom: 20px;">
        <h4 style="font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 6px;">Plano de Metas & Diretrizes (${prop.num_paginas} páginas)</h4>
        <p style="font-size: 13px; color: var(--text-muted);">${prop.resumo}</p>
      </div>

      ${prop.destaques && prop.destaques.length > 0 ? `
        <div style="background: rgba(99, 102, 241, 0.08); border-left: 3px solid var(--accent-primary); padding: 14px; border-radius: 4px; margin-bottom: 20px;">
          <h5 style="font-size: 13px; font-weight: 800; color: #a5b4fc; margin-bottom: 6px;">Destaques Programáticos Literais</h5>
          <ul style="padding-left: 20px; font-size: 13px; color: var(--text-main); line-height: 1.6;">
            ${prop.destaques.map(d => `<li>"${escapeHtml(d)}"</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <h5 style="font-size: 14px; font-weight: 800; color: #fff; margin-bottom: 12px;">Pilares Temáticos Analisados do PDF TSE:</h5>
      ${pilaresHtml}
    `;
  } else {
    tabProposta.innerHTML = `
      <div class="empty-state">
        <h4>Plano de Governo Individual Não Aplicável</h4>
        <p style="margin-top: 6px;">De acordo com a legislação eleitoral brasileira, apenas candidatos aos cargos do Poder Executivo (Governador e Presidente) registram plano de metas individual no TSE. Candidatos ao Legislativo seguem as diretrizes do programa partidário do ${id.partido}.</p>
      </div>
    `;
  }

  // Aba 2: Patrimônio & Bens
  const tabPatrimonio = document.getElementById('tab-patrimonio');
  if (pat.principais_bens && pat.principais_bens.length > 0) {
    tabPatrimonio.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <div>
          <h4 style="font-size: 18px; font-weight: 800; color: #fff;">${pat.total_bens_formatado}</h4>
          <p style="font-size: 12px; color: var(--text-muted);">${pat.qtd_itens} itens declarados na Justiça Eleitoral</p>
        </div>
      </div>
      <table class="assets-table">
        <thead>
          <tr>
            <th>Tipo do Bem</th>
            <th>Descrição Declarada</th>
            <th style="text-align: right;">Valor</th>
          </tr>
        </thead>
        <tbody>
          ${pat.principais_bens.map(b => `
            <tr>
              <td><strong>${escapeHtml(b.tipo_bem)}</strong></td>
              <td style="color: var(--text-muted);">${escapeHtml(b.descricao)}</td>
              <td style="text-align: right; font-weight: 700; color: #fff;">R$ ${b.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } else {
    tabPatrimonio.innerHTML = `<div class="empty-state">Nenhum bem patrimonial declarado pelo candidato.</div>`;
  }

  // Aba 3: Financiamento
  const tabFinanciamento = document.getElementById('tab-financiamento');
  tabFinanciamento.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 24px;">
      <div class="stat-card">
        <div class="stat-label">Total Arrecadado</div>
        <div class="stat-value" style="font-size: 18px;">R$ ${fin.total_receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Fundo Eleitoral (${fin.percentual_fundo_eleitoral})</div>
        <div class="stat-value" style="font-size: 18px; color: #a5b4fc;">R$ ${fin.total_fundo_eleitoral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Recursos Próprios (${fin.percentual_recursos_proprios})</div>
        <div class="stat-value" style="font-size: 18px; color: #34d399;">R$ ${fin.total_recursos_proprios.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
      </div>
    </div>
    <div class="stat-card" style="text-align: left; padding: 16px;">
      <h5 style="font-size: 13px; font-weight: 800; color: #fff; margin-bottom: 6px;">Total de Despesas Contratadas e Pagas</h5>
      <p style="font-size: 16px; font-weight: 700; color: #fb7185;">R$ ${fin.total_despesas_pagas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
    </div>
  `;

  // Aba 4: Integridade & Histórico
  const tabIntegridade = document.getElementById('tab-integridade');
  const hist = d.historico_eleitoral || [];
  const certs = d.integridade_e_judicial?.certidoes || [];

  tabIntegridade.innerHTML = `
    <div style="margin-bottom: 24px;">
      <h4 style="font-size: 15px; font-weight: 800; color: #fff; margin-bottom: 12px;">Histórico Eleitoral (Eleições Anteriores)</h4>
      ${hist.length > 0 ? `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${hist.map(h => `
            <div style="background: var(--bg-card); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); display: flex; justify-content: space-between;">
              <span><strong>Ano ${h.ano}</strong> - Concorreu a <strong>${h.cargo}</strong></span>
              <span style="color: var(--text-muted); font-size: 12px;">${h.eleicao}</span>
            </div>
          `).join('')}
        </div>
      ` : `<div class="empty-state">Primeira candidatura registrada ou histórico anterior limpo.</div>`}
    </div>

    <div>
      <h4 style="font-size: 15px; font-weight: 800; color: #fff; margin-bottom: 8px;">Certidões Criminais Apresentadas (${certs.length})</h4>
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Certidões expedidas pelas Varas de Execuções Penais, Justiça Federal (TRF1) e Justiça Militar anexadas aos autos do registro no TRE-DF.</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        ${certs.map(c => `
          <div style="background: rgba(255, 255, 255, 0.03); padding: 8px 12px; border-radius: var(--radius-sm); font-size: 12px; color: var(--text-muted);">
            📄 ${escapeHtml(c.arquivo)} (${c.tamanho_kb} KB)
          </div>
        `).join('')}
      </div>
    </div>
  `;

  // Aba 5: Redes
  const tabRedes = document.getElementById('tab-redes');
  const redes = d.redes_sociais || [];
  if (redes.length > 0) {
    tabRedes.innerHTML = `
      <h4 style="font-size: 15px; font-weight: 800; color: #fff; margin-bottom: 14px;">Canais Oficiais e Redes Sociais Declaradas</h4>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${redes.map(r => `
          <a href="${escapeHtml(r)}" target="_blank" rel="noopener noreferrer" style="background: var(--bg-card); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); color: var(--accent-secondary); text-decoration: none; display: flex; align-items: center; justify-content: space-between;">
            <span>${escapeHtml(r)}</span>
            <span>↗</span>
          </a>
        `).join('')}
      </div>
    `;
  } else {
    tabRedes.innerHTML = `<div class="empty-state">Nenhum link de rede social oficial informado no registro do TSE.</div>`;
  }
}

// =========================================================
// QUESTIONÁRIO & BÚSSOLA ELEITORAL
// =========================================================
async function loadQuestions() {
  try {
    const res = await fetch('/api/questionnaire/questions');
    state.questions = await res.json();
    renderQuestions();
  } catch (err) {
    console.error('Erro ao carregar perguntas:', err);
  }
}

function renderQuestions() {
  questionsList.innerHTML = '';
  state.questions.forEach((q, idx) => {
    const block = document.createElement('div');
    block.className = 'question-block';
    block.innerHTML = `
      <div class="q-meta">
        <span class="q-tema">${q.tema}</span>
        <span class="q-num">Questão ${idx + 1} de ${state.questions.length}</span>
      </div>
      <h4 class="q-title">${q.titulo}</h4>
      <p class="q-text">${q.pergunta}</p>

      <div class="options-group">
        ${q.opcoes.map(opt => `
          <label class="quiz-option" data-qid="${q.id}" data-optid="${opt.id}">
            <input type="radio" name="${q.id}" value="${opt.id}">
            <span>${opt.texto}</span>
          </label>
        `).join('')}
      </div>
    `;

    block.querySelectorAll('.quiz-option').forEach(label => {
      label.addEventListener('click', () => {
        const qid = label.dataset.qid;
        const optid = label.dataset.optid;
        state.userAnswers[qid] = optid;

        // Visual selection
        block.querySelectorAll('.quiz-option').forEach(l => l.classList.remove('selected'));
        label.classList.add('selected');

        updateQuizProgress();
      });
    });

    questionsList.appendChild(block);
  });
}

function updateQuizProgress() {
  const total = state.questions.length;
  const answered = Object.keys(state.userAnswers).length;
  const pct = Math.round((answered / total) * 100);

  quizProgressBar.style.width = `${pct}%`;
  quizProgressText.textContent = `${answered} de ${total} respondidas (${pct}%)`;
}

function setupQuiz() {
  btnCalculateMatch.addEventListener('click', () => {
    evaluateQuizAnswers();
  });

  btnResetQuiz.addEventListener('click', () => {
    state.userAnswers = {};
    document.querySelectorAll('.quiz-option').forEach(l => {
      l.classList.remove('selected');
      const input = l.querySelector('input');
      if (input) input.checked = false;
    });
    updateQuizProgress();
    userQuadrantBadge.textContent = 'Responda ao questionário para ver sua posição';
    userProfileDesc.textContent = 'Seus pontos serão plotados em tempo real no plano cartesiano ao lado dos candidatos e partidos das Eleições 2026.';
    matchCandidateList.innerHTML = `<div class="empty-state">Responda ao questionário para desbloquear o ranking de aderência.</div>`;
    matchPartyList.innerHTML = `<div class="empty-state">...</div>`;
    drawCompass(0, 0, false);
  });
}

async function evaluateQuizAnswers() {
  const answeredCount = Object.keys(state.userAnswers).length;
  if (answeredCount === 0) {
    alert('Por favor, responda ao menos algumas questões para calcularmos sua coordenada!');
    return;
  }

  try {
    const res = await fetch('/api/questionnaire/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: state.userAnswers })
    });

    const result = await res.json();
    const prof = result.userProfile;

    userQuadrantBadge.textContent = `${prof.quadrant} (Econ: ${prof.economic > 0 ? '+' : ''}${prof.economic}, Social: ${prof.social > 0 ? '+' : ''}${prof.social})`;
    userProfileDesc.textContent = prof.description;

    drawCompass(prof.economic, prof.social, true);
    renderMatchRankings(result.topCandidates, result.topParties);
  } catch (err) {
    console.error('Erro ao avaliar questionário:', err);
  }
}

function renderMatchRankings(topCandidates, topParties) {
  matchCandidateList.innerHTML = '';
  topCandidates.slice(0, 6).forEach(c => {
    let badgeClass = 'match-high';
    if (c.fit_percentage < 65) badgeClass = 'match-low';
    else if (c.fit_percentage < 80) badgeClass = 'match-med';

    const card = document.createElement('div');
    card.className = 'match-card';
    card.innerHTML = `
      <div class="match-info">
        <h5>${c.nome_urna} (${c.partido})</h5>
        <p>${c.cargo} · ${c.tem_proposta ? 'Com Plano TSE' : 'Sem Plano Individual'}</p>
      </div>
      <div class="match-badge ${badgeClass}">${c.fit_percentage}% Fit</div>
    `;

    card.addEventListener('click', () => {
      openCandidateDossier(c.sq_candidato);
    });

    matchCandidateList.appendChild(card);
  });

  matchPartyList.innerHTML = '';
  topParties.slice(0, 5).forEach(p => {
    let badgeClass = 'match-high';
    if (p.fit_percentage < 65) badgeClass = 'match-low';
    else if (p.fit_percentage < 80) badgeClass = 'match-med';

    const card = document.createElement('div');
    card.className = 'match-card';
    card.innerHTML = `
      <div class="match-info">
        <h5>${p.sigla} (${p.espectro})</h5>
        <p>${p.resumo.substring(0, 55)}...</p>
      </div>
      <div class="match-badge ${badgeClass}">${p.fit_percentage}% Fit</div>
    `;
    matchPartyList.appendChild(card);
  });
}

// 2D Compass Canvas Drawing
function drawCompass(userX, userY, hasUser = false) {
  const canvas = compassCanvas;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  // Background Quadrants
  // Top-Left: Esquerda Conservadora
  ctx.fillStyle = 'rgba(244, 63, 94, 0.04)';
  ctx.fillRect(0, 0, cx, cy);
  // Bottom-Left: Esquerda Progressista
  ctx.fillStyle = 'rgba(236, 72, 153, 0.06)';
  ctx.fillRect(0, cy, cx, cy);
  // Top-Right: Direita Conservadora
  ctx.fillStyle = 'rgba(59, 130, 246, 0.06)';
  ctx.fillRect(cx, 0, cx, cy);
  // Bottom-Right: Direita Liberal
  ctx.fillStyle = 'rgba(6, 182, 212, 0.05)';
  ctx.fillRect(cx, cy, cx, cy);

  // Grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  const step = 46;
  for (let x = step; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = step; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Main Cartesian Axes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 2;
  // X axis
  ctx.beginPath();
  ctx.moveTo(10, cy);
  ctx.lineTo(w - 10, cy);
  ctx.stroke();
  // Y axis
  ctx.beginPath();
  ctx.moveTo(cx, 10);
  ctx.lineTo(cx, h - 10);
  ctx.stroke();

  // Quadrant Labels
  ctx.font = '700 10px Plus Jakarta Sans, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.textAlign = 'left';
  ctx.fillText('ESQUERDA TRADICIONAL', 16, 24);
  ctx.fillText('ESQUERDA PROGRESSISTA', 16, h - 16);
  ctx.textAlign = 'right';
  ctx.fillText('DIREITA CONSERVADORA', w - 16, 24);
  ctx.fillText('DIREITA LIBERAL', w - 16, h - 16);

  // Axis Labels
  ctx.font = '800 11px Plus Jakarta Sans, sans-serif';
  ctx.fillStyle = '#60a5fa';
  ctx.textAlign = 'right';
  ctx.fillText('MERCADO LIVRE (+1.0) →', w - 16, cy - 8);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fb7185';
  ctx.fillText('← ESTATIZAÇÃO (-1.0)', 16, cy - 8);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText('▲ CONSERVADORISMO (+1.0)', cx, 20);
  ctx.fillStyle = '#f472b6';
  ctx.fillText('▼ PROGRESSISMO (-1.0)', cx, h - 10);

  // Plot Reference Candidate Anchors
  const anchors = [
    { name: 'Kiko Caputo (NOVO)', x: 0.97, y: 0.0, color: '#38bdf8' },
    { name: 'Zema (NOVO)', x: 0.95, y: 0.3, color: '#38bdf8' },
    { name: 'Celina Leão (PP)', x: 0.50, y: 0.40, color: '#60a5fa' },
    { name: 'Paula Belmonte (PSDB)', x: 0.40, y: -0.10, color: '#fbbf24' },
    { name: 'Arruda (PSD)', x: 0.25, y: 0.10, color: '#fbbf24' },
    { name: 'Ricardo Cappelli (PSB)', x: -0.45, y: -0.60, color: '#f472b6' },
    { name: 'Leandro Grass (PT)', x: -0.57, y: -1.0, color: '#fb7185' },
    { name: 'Lula (PT)', x: -0.65, y: -0.70, color: '#fb7185' },
    { name: 'Prof. Robson (PSTU)', x: -0.96, y: -0.70, color: '#e11d48' },
    { name: 'Samara (UP)', x: -0.90, y: -0.85, color: '#e11d48' }
  ];

  anchors.forEach(a => {
    // Map -1..1 to canvas space with padding
    const pad = 36;
    const px = cx + a.x * (cx - pad);
    const py = cy - a.y * (cy - pad); // Y inverted in screen coords

    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fillStyle = a.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '600 10px Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.textAlign = px > cx ? 'right' : 'left';
    ctx.fillText(a.name, px + (px > cx ? -8 : 8), py - 4);
  });

  // Plot User Position
  if (hasUser) {
    const pad = 36;
    const ux = cx + userX * (cx - pad);
    const uy = cy - userY * (cy - pad);

    // Glowing outer ring
    ctx.beginPath();
    ctx.arc(ux, uy, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.25)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ux, uy, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.5)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ux, uy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#6366f1';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '800 12px Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('VOCÊ', ux, uy - 18);
  }
}

// =========================================================
// GRAPHIFY NETWORK VIEW
// =========================================================
async function loadGraphData() {
  try {
    const res = await fetch('/api/graph');
    state.graphData = await res.json();
  } catch (err) {
    console.error('Erro ao carregar dados do grafo:', err);
  }
}

function renderGraph() {
  if (!state.graphData) return;
  const canvas = document.getElementById('networkCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  const nodes = state.graphData.nodes || [];
  const edges = state.graphData.edges || [];

  // Arrange nodes in concentric rings for beautiful visualization
  // Center: Parties
  const partyNodes = nodes.filter(n => n.type === 'PARTY');
  const candNodes = nodes.filter(n => n.type === 'CANDIDATE');
  const propNodes = nodes.filter(n => n.type === 'GOVERNMENT_PLAN');

  const positions = {};

  // Parties inner ring
  const rInner = 140;
  partyNodes.forEach((p, i) => {
    const angle = (i / partyNodes.length) * Math.PI * 2;
    positions[p.id] = {
      x: cx + Math.cos(angle) * rInner,
      y: cy + Math.sin(angle) * rInner,
      color: '#06b6d4',
      radius: 9,
      node: p
    };
  });

  // Candidates outer ring
  const rOuter = 260;
  candNodes.forEach((c, i) => {
    const angle = (i / candNodes.length) * Math.PI * 2;
    positions[c.id] = {
      x: cx + Math.cos(angle) * rOuter,
      y: cy + Math.sin(angle) * rOuter,
      color: '#6366f1',
      radius: 7,
      node: c
    };
  });

  // Proposals outer far ring
  const rFar = 310;
  propNodes.forEach((pr, i) => {
    const angle = (i / propNodes.length) * Math.PI * 2 + 0.2;
    positions[pr.id] = {
      x: cx + Math.cos(angle) * rFar,
      y: cy + Math.sin(angle) * rFar,
      color: '#10b981',
      radius: 6,
      node: pr
    };
  });

  // Draw Edges
  ctx.lineWidth = 1;
  edges.forEach(e => {
    const p1 = positions[e.source];
    const p2 = positions[e.target];
    if (p1 && p2) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  });

  // Draw Nodes
  Object.values(positions).forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.stroke();

    // Node label
    ctx.font = '600 9px Plus Jakarta Sans, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'center';
    const label = p.node.label.length > 18 ? p.node.label.substring(0, 16) + '..' : p.node.label;
    ctx.fillText(label, p.x, p.y + p.radius + 11);
  });

  // Canvas Click Detection
  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    for (const p of Object.values(positions)) {
      const dist = Math.hypot(mx - p.x, my - p.y);
      if (dist <= p.radius + 6) {
        showGraphNodeDetails(p.node);
        return;
      }
    }
  };
}

function showGraphNodeDetails(node) {
  const detailsEl = document.getElementById('graph-details-text');
  let text = `<strong>${node.label}</strong> [Tipo: ${node.type}]<br>`;

  if (node.type === 'CANDIDATE') {
    text += `Cargo: ${node.metadata.cargo} | Patrimônio: R$ ${node.metadata.patrimonio.toLocaleString('pt-BR')} | Partido: ${node.metadata.partido}<br>`;
    text += `Certidões Criminais anexadas: ${node.metadata.certidoes_qtd} | Plano TSE: ${node.metadata.tem_proposta ? 'SIM' : 'NÃO'}`;
  } else if (node.type === 'PARTY') {
    text += `Espectro: ${node.metadata.espectro}<br>${node.metadata.resumo}`;
  } else if (node.type === 'GOVERNMENT_PLAN') {
    text += `Total de Páginas: ${node.metadata.paginas} | Caracteres: ${node.metadata.caracteres.toLocaleString('pt-BR')}<br>`;
    text += `Pilares Relevantes: ${node.metadata.pilares_principais.join(', ')}`;
  }

  detailsEl.innerHTML = text;
}

// Utility
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
