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
  graphData: null,
  matchFilterGender: '',
  matchFilterRace: '',
  matchFilterParty: '',
  latestEvaluationResult: null
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
  setupGraphControls();

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

    const matchFilterPartido = document.getElementById('match-filter-partido');

    parties.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.sg_partido;
      opt.textContent = `${p.sg_partido} (${p.espectro_estimado}) - ${p.total_candidatos} cands`;
      filterPartido.appendChild(opt);

      if (matchFilterPartido) {
        const mOpt = document.createElement('option');
        mOpt.value = p.sg_partido;
        mOpt.textContent = `${p.sg_partido} - ${p.nm_partido || p.sg_partido}`;
        matchFilterPartido.appendChild(mOpt);
      }
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
    state.latestEvaluationResult = null;
    document.querySelectorAll('.quiz-option').forEach(l => {
      l.classList.remove('selected');
      const input = l.querySelector('input');
      if (input) input.checked = false;
    });
    updateQuizProgress();
    userQuadrantBadge.textContent = 'Responda ao questionário para ver sua posição';
    userProfileDesc.textContent = 'Seus pontos serão plotados em tempo real no plano cartesiano ao lado dos candidatos e partidos das Eleições 2026.';
    
    const cargoContainer = document.getElementById('cargo-results-container');
    if (cargoContainer) {
      cargoContainer.innerHTML = `<div class="empty-state">Responda ao questionário e clique em 'Calcular Meu Alinhamento' para ver os Top 3 por cargo.</div>`;
    }
    matchPartyList.innerHTML = `<div class="empty-state">...</div>`;
    drawCompass(0, 0, false);
  });

  // Eventos de Filtro de Afinidade
  const genderPills = document.querySelectorAll('#match-gender-pills .pill-btn');
  genderPills.forEach(btn => {
    btn.addEventListener('click', () => {
      genderPills.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.matchFilterGender = btn.dataset.gender;
      renderFilteredCargoMatches();
    });
  });

  const racePills = document.querySelectorAll('#match-race-pills .pill-btn');
  racePills.forEach(btn => {
    btn.addEventListener('click', () => {
      racePills.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.matchFilterRace = btn.dataset.race;
      renderFilteredCargoMatches();
    });
  });

  const matchPartySelect = document.getElementById('match-filter-partido');
  if (matchPartySelect) {
    matchPartySelect.addEventListener('change', (e) => {
      state.matchFilterParty = e.target.value;
      renderFilteredCargoMatches();
    });
  }

  // Compass Canvas Click Interaction (Open candidate dossier by clicking their anchor)
  if (compassCanvas) {
    const anchors = [
      { name: 'Kiko Caputo', sq: '70002547775', x: 0.97, y: 0.0 },
      { name: 'Zema', sq: '280002539826', x: 0.95, y: 0.3 },
      { name: 'Celina Leão', sq: '70002553055', x: 0.50, y: 0.40 },
      { name: 'Paula Belmonte', sq: '70002552965', x: 0.40, y: -0.10 },
      { name: 'Arruda', sq: '70002552586', x: 0.25, y: 0.10 },
      { name: 'Ricardo Cappelli', sq: '70002551557', x: -0.45, y: -0.60 },
      { name: 'Leandro Grass', sq: '70002552496', x: -0.57, y: -1.0 },
      { name: 'Lula', sq: '280002542548', x: -0.65, y: -0.70 },
      { name: 'Prof. Robson', sq: '70002535930', x: -0.96, y: -0.70 },
      { name: 'Samara', sq: '70002537111', x: -0.90, y: -0.85 }
    ];

    compassCanvas.addEventListener('click', (e) => {
      const rect = compassCanvas.getBoundingClientRect();
      const scaleX = compassCanvas.width / rect.width;
      const scaleY = compassCanvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;

      const cx = compassCanvas.width / 2;
      const cy = compassCanvas.height / 2;
      const pad = 36;

      for (const a of anchors) {
        const px = cx + a.x * (cx - pad);
        const py = cy - a.y * (cy - pad);
        if (Math.hypot(mx - px, my - py) <= 14) {
          openCandidateDossier(a.sq);
          return;
        }
      }
    });

    compassCanvas.addEventListener('mousemove', (e) => {
      const rect = compassCanvas.getBoundingClientRect();
      const scaleX = compassCanvas.width / rect.width;
      const scaleY = compassCanvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      const cx = compassCanvas.width / 2;
      const cy = compassCanvas.height / 2;
      const pad = 36;

      let isOver = false;
      for (const a of anchors) {
        const px = cx + a.x * (cx - pad);
        const py = cy - a.y * (cy - pad);
        if (Math.hypot(mx - px, my - py) <= 14) {
          isOver = true;
          break;
        }
      }
      compassCanvas.style.cursor = isOver ? 'pointer' : 'default';
    });
  }
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
    state.latestEvaluationResult = result;
    const prof = result.userProfile;

    userQuadrantBadge.textContent = `${prof.quadrant} (Econ: ${prof.economic > 0 ? '+' : ''}${prof.economic}, Social: ${prof.social > 0 ? '+' : ''}${prof.social})`;
    userProfileDesc.textContent = prof.description;

    drawCompass(prof.economic, prof.social, true);
    renderFilteredCargoMatches();
    renderPartyRankings(result.topParties);
  } catch (err) {
    console.error('Erro ao avaliar questionário:', err);
  }
}

function renderFilteredCargoMatches() {
  const container = document.getElementById('cargo-results-container');
  if (!container) return;

  if (!state.latestEvaluationResult || !state.latestEvaluationResult.allCandidatesRanked) {
    container.innerHTML = `<div class="empty-state">Responda ao questionário e clique em 'Calcular Meu Alinhamento' para ver os Top 3 por cargo.</div>`;
    return;
  }

  let candidates = state.latestEvaluationResult.allCandidatesRanked;

  // Aplica Filtros de Gênero, Raça e Partido
  if (state.matchFilterGender) {
    candidates = candidates.filter(c => (c.genero || '').toUpperCase() === state.matchFilterGender);
  }
  if (state.matchFilterRace) {
    candidates = candidates.filter(c => (c.cor_raca || '').toUpperCase().includes(state.matchFilterRace));
  }
  if (state.matchFilterParty) {
    candidates = candidates.filter(c => (c.partido || '').toUpperCase() === state.matchFilterParty);
  }

  const CARGOS = [
    { key: 'PRESIDENTE', label: '🇧🇷 Presidente da República' },
    { key: 'GOVERNADOR', label: '🏛️ Governador do Distrito Federal' },
    { key: 'SENADOR', label: '🏛️ Senador' },
    { key: 'DEPUTADO FEDERAL', label: '🏛️ Deputado Federal' },
    { key: 'DEPUTADO DISTRITAL', label: '🏛️ Deputado Distrital' }
  ];

  let html = '';
  let totalFound = 0;

  CARGOS.forEach(cargo => {
    const top3 = candidates.filter(c => c.cargo === cargo.key).slice(0, 3);
    totalFound += top3.length;

    html += `
      <div class="cargo-group">
        <div class="cargo-group-header">
          <div class="cargo-group-title">
            <span>${cargo.label}</span>
          </div>
          <span style="font-size: 11px; font-weight: 700; color: var(--text-subtle);">Top 3 com Maior Fit</span>
        </div>
        ${top3.length > 0 ? top3.map(c => {
          let badgeClass = 'match-high';
          if (c.fit_percentage < 65) badgeClass = 'match-low';
          else if (c.fit_percentage < 80) badgeClass = 'match-med';

          const isWoman = (c.genero || '').toUpperCase() === 'FEMININO';
          const genderBadge = isWoman ? '<span class="tag-mini tag-female">♀ Mulher</span>' : '<span class="tag-mini tag-male">♂ Homem</span>';
          const raceBadge = c.cor_raca && c.cor_raca !== 'NÃO INFORMADO' ? `<span class="tag-mini">${c.cor_raca}</span>` : '';
          const propBadge = c.tem_proposta ? '<span class="tag-mini" style="color: #34d399; border-color: rgba(52, 211, 153, 0.3);">📄 Plano TSE</span>' : '';

          return `
            <div class="cargo-candidate-card" data-sq="${c.sq_candidato}" title="Clique para abrir Dossiê 360º">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <strong style="color: #fff; font-size: 14px;">${escapeHtml(c.nome_urna)}</strong>
                  <span style="font-size: 11px; color: var(--text-muted); font-weight: 700;">${c.partido} · Nº ${c.numero}</span>
                </div>
                <div style="font-size: 11px; color: var(--text-subtle); margin-top: 2px;">${escapeHtml(c.nome_completo || c.nome_urna)}</div>
                <div class="cand-meta-tags">
                  ${genderBadge}
                  ${raceBadge}
                  ${propBadge}
                </div>
              </div>
              <div style="text-align: right; margin-left: 12px;">
                <div class="match-badge ${badgeClass}">${c.fit_percentage}% Fit</div>
                <div style="font-size: 10px; color: var(--accent-secondary); margin-top: 4px; font-weight: 600;">Ver Dossiê 360º ↗</div>
              </div>
            </div>
          `;
        }).join('') : `
          <div style="font-size: 12px; color: var(--text-subtle); padding: 12px; background: rgba(255,255,255,0.02); border-radius: var(--radius-sm); border: 1px dashed var(--border-color);">
            Nenhuma candidata/candidato encontrado para este cargo com os filtros selecionados.
          </div>
        `}
      </div>
    `;
  });

  if (totalFound === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h5>Nenhum candidato encontrado com os filtros atuais</h5>
        <p style="margin-top: 4px;">Tente alterar os filtros de gênero (${state.matchFilterGender || 'Todos'}), etnia (${state.matchFilterRace || 'Todas'}) ou partido.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = html;

  // Event listener para abrir Dossiê 360º ao clicar no card ou nome
  container.querySelectorAll('.cargo-candidate-card').forEach(card => {
    card.addEventListener('click', () => {
      const sq = card.dataset.sq;
      if (sq) openCandidateDossier(sq);
    });
  });
}

function renderPartyRankings(topParties) {
  const matchPartyList = document.getElementById('match-party-list');
  if (!matchPartyList) return;
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
        <p>${p.resumo ? p.resumo.substring(0, 55) + '...' : ''}</p>
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
// GRAPHIFY NETWORK VIEW (REDESIGNED FOR MAXIMUM CLARITY)
// =========================================================
const graphState = {
  zoom: 1,
  panX: 0,
  panY: 0,
  hoveredNodeId: null,
  selectedNodeId: null,
  activePreset: 'all',
  focusCandId: '',
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  positions: {},
  visibleNodes: [],
  visibleEdges: []
};

async function loadGraphData() {
  try {
    const res = await fetch('/api/graph');
    state.graphData = await res.json();
    populateGraphFocusDropdown();
  } catch (err) {
    console.error('Erro ao carregar dados do grafo:', err);
  }
}

function setupGraphControls() {
  const canvas = document.getElementById('networkCanvas');
  if (!canvas) return;

  // Preset buttons
  document.querySelectorAll('.graph-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.graph-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      graphState.activePreset = btn.dataset.preset;
      graphState.focusCandId = '';
      const select = document.getElementById('graph-focus-select');
      if (select) select.value = '';
      resetGraphTransform();
      renderGraph();
    });
  });

  // Focus Dropdown
  const select = document.getElementById('graph-focus-select');
  if (select) {
    select.addEventListener('change', (e) => {
      const val = e.target.value;
      graphState.focusCandId = val;
      if (val) {
        document.querySelectorAll('.graph-preset-btn').forEach(b => b.classList.remove('active'));
      }
      resetGraphTransform();
      renderGraph();
      if (val && graphState.positions[val]) {
        showGraphNodeDetails(graphState.positions[val].node);
      }
    });
  }

  // Zoom buttons
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    graphState.zoom = Math.min(graphState.zoom * 1.25, 2.8);
    renderGraph();
  });
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    graphState.zoom = Math.max(graphState.zoom / 1.25, 0.45);
    renderGraph();
  });
  document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
    resetGraphTransform();
    renderGraph();
  });
  document.getElementById('btn-reset-graph')?.addEventListener('click', () => {
    graphState.activePreset = 'all';
    graphState.focusCandId = '';
    if (select) select.value = '';
    document.querySelectorAll('.graph-preset-btn').forEach(b => b.classList.toggle('active', b.dataset.preset === 'all'));
    resetGraphTransform();
    renderGraph();
    resetInspectorPanel();
  });

  // Canvas Mouse Interactions
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
    const newZoom = Math.max(0.45, Math.min(2.8, graphState.zoom * zoomFactor));

    graphState.panX = mouseX - (mouseX - graphState.panX) * (newZoom / graphState.zoom);
    graphState.panY = mouseY - (mouseY - graphState.panY) * (newZoom / graphState.zoom);
    graphState.zoom = newZoom;

    renderGraph();
  }, { passive: false });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    graphState.isDragging = true;
    graphState.dragStartX = e.clientX - graphState.panX;
    graphState.dragStartY = e.clientY - graphState.panY;
    canvas.style.cursor = 'grabbing';
  });

  window.addEventListener('mouseup', () => {
    if (graphState.isDragging) {
      graphState.isDragging = false;
      canvas.style.cursor = 'grab';
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const screenX = (e.clientX - rect.left) * scaleX;
    const screenY = (e.clientY - rect.top) * scaleY;

    if (graphState.isDragging) {
      graphState.panX = (e.clientX - graphState.dragStartX);
      graphState.panY = (e.clientY - graphState.dragStartY);
      renderGraph();
      return;
    }

    const worldX = (screenX - graphState.panX) / graphState.zoom;
    const worldY = (screenY - graphState.panY) / graphState.zoom;

    let hovered = null;
    for (const [id, p] of Object.entries(graphState.positions)) {
      const dist = Math.hypot(worldX - p.x, worldY - p.y);
      if (dist <= p.radius + 8) {
        hovered = id;
        break;
      }
    }

    if (graphState.hoveredNodeId !== hovered) {
      graphState.hoveredNodeId = hovered;
      canvas.style.cursor = hovered ? 'pointer' : 'grab';
      renderGraph();
      if (hovered && graphState.positions[hovered]) {
        showGraphNodeDetails(graphState.positions[hovered].node);
      }
    }
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const screenX = (e.clientX - rect.left) * scaleX;
    const screenY = (e.clientY - rect.top) * scaleY;

    const worldX = (screenX - graphState.panX) / graphState.zoom;
    const worldY = (screenY - graphState.panY) / graphState.zoom;

    for (const [id, p] of Object.entries(graphState.positions)) {
      const dist = Math.hypot(worldX - p.x, worldY - p.y);
      if (dist <= p.radius + 8) {
        graphState.selectedNodeId = id;
        showGraphNodeDetails(p.node);
        renderGraph();
        return;
      }
    }
  });
}

function resetGraphTransform() {
  graphState.zoom = 1;
  graphState.panX = 0;
  graphState.panY = 0;
  graphState.hoveredNodeId = null;
}

function resetInspectorPanel() {
  const emptyEl = document.getElementById('inspector-empty');
  const activeEl = document.getElementById('inspector-active');
  if (emptyEl) emptyEl.style.display = 'flex';
  if (activeEl) activeEl.style.display = 'none';
}

function populateGraphFocusDropdown() {
  const select = document.getElementById('graph-focus-select');
  if (!select || !state.graphData) return;

  const candNodes = (state.graphData.nodes || []).filter(n => n.type === 'CANDIDATE');
  candNodes.sort((a, b) => a.label.localeCompare(b.label));

  select.innerHTML = '<option value="">🎯 Selecione um Político para Isolar a Constelação...</option>';
  candNodes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.label} (${c.metadata?.cargo || ''})`;
    select.appendChild(opt);
  });
}

function renderGraph() {
  if (!state.graphData) return;
  const canvas = document.getElementById('networkCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  const allNodes = state.graphData.nodes || [];
  const allEdges = state.graphData.edges || [];

  // Filter nodes & edges based on active preset or focus
  let nodes = [];
  let edges = [];

  if (graphState.focusCandId) {
    // Mode: EGO-NETWORK CONSTELLATION
    const targetId = graphState.focusCandId;
    const targetNode = allNodes.find(n => n.id === targetId);
    if (targetNode) {
      const relEdges = allEdges.filter(e => e.source === targetId || e.target === targetId);
      const neighborIds = new Set([targetId]);
      relEdges.forEach(e => {
        neighborIds.add(e.source);
        neighborIds.add(e.target);
      });
      nodes = allNodes.filter(n => neighborIds.has(n.id));
      edges = relEdges;
    }
  } else if (graphState.activePreset === 'gdf') {
    nodes = allNodes.filter(n => 
      (n.type === 'CANDIDATE' && n.metadata?.cargo === 'GOVERNADOR') ||
      n.type === 'GOVERNMENT_PLAN' ||
      (n.type === 'PARTY' && allEdges.some(e => e.target === n.id && allNodes.find(x => x.id === e.source)?.metadata?.cargo === 'GOVERNADOR'))
    );
    const nodeIds = new Set(nodes.map(n => n.id));
    edges = allEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  } else if (graphState.activePreset === 'pres') {
    nodes = allNodes.filter(n => 
      (n.type === 'CANDIDATE' && n.metadata?.cargo === 'PRESIDENTE') ||
      n.type === 'GOVERNMENT_PLAN' ||
      (n.type === 'PARTY' && allEdges.some(e => e.target === n.id && allNodes.find(x => x.id === e.source)?.metadata?.cargo === 'PRESIDENTE'))
    );
    const nodeIds = new Set(nodes.map(n => n.id));
    edges = allEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  } else if (graphState.activePreset === 'parties') {
    nodes = allNodes.filter(n => n.type === 'PARTY' || (n.type === 'CANDIDATE' && (n.metadata?.tem_proposta || n.metadata?.cargo === 'PRESIDENTE')));
    const nodeIds = new Set(nodes.map(n => n.id));
    edges = allEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  } else {
    // Preset: 'all'
    nodes = allNodes;
    edges = allEdges;
  }

  // Calculate Positions
  const positions = {};

  if (graphState.focusCandId && nodes.length > 0) {
    // --- Layout: Constelação Focada ---
    const targetNode = nodes.find(n => n.id === graphState.focusCandId);
    if (targetNode) {
      positions[targetNode.id] = {
        x: cx,
        y: cy,
        radius: 20,
        color: '#6366f1',
        node: targetNode,
        isCenter: true
      };

      const neighbors = nodes.filter(n => n.id !== targetNode.id);
      neighbors.forEach((nbr, idx) => {
        let angle = 0;
        let dist = 180;

        if (nbr.type === 'PARTY') {
          angle = Math.PI; // Esquerda
          dist = 200;
        } else if (nbr.type === 'GOVERNMENT_PLAN') {
          angle = 0; // Direita
          dist = 210;
        } else {
          angle = ((idx + 1) / (neighbors.length + 1)) * Math.PI * 2;
          dist = 175;
        }

        let col = '#6366f1';
        if (nbr.type === 'PARTY') col = '#06b6d4';
        if (nbr.type === 'GOVERNMENT_PLAN') col = '#10b981';

        positions[nbr.id] = {
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          radius: nbr.type === 'PARTY' ? 14 : 12,
          color: col,
          node: nbr
        };
      });
    }
  } else {
    // --- Layout: Clusters Ideológicos & Orgânicos ---
    // Agrupa candidatos por espectro político (Esquerda -> Centro -> Direita)
    const partyNodes = nodes.filter(n => n.type === 'PARTY');
    const candNodes = nodes.filter(n => n.type === 'CANDIDATE');
    const propNodes = nodes.filter(n => n.type === 'GOVERNMENT_PLAN');

    // Partidos organizados em arco central
    const pCount = partyNodes.length;
    partyNodes.forEach((p, i) => {
      const angle = (i / pCount) * Math.PI * 2;
      const rx = 210;
      const ry = 140;
      positions[p.id] = {
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
        radius: 11,
        color: '#06b6d4',
        node: p
      };
    });

    // Candidatos distribuídos em órbita externa com base no espectro ou cargo
    const cCount = candNodes.length;
    candNodes.forEach((c, i) => {
      // Posicionamento orientado ao espectro econômico do candidato (-1..+1)
      const econ = c.metadata?.spectrum?.economic ?? (Math.sin(i) * 0.8);
      const angle = ((econ + 1) / 2) * Math.PI * 1.6 + 0.2 * Math.PI;
      const rx = 340;
      const ry = 220;

      positions[c.id] = {
        x: cx + Math.cos(angle) * rx + (Math.sin(i * 1.5) * 20),
        y: cy + Math.sin(angle) * ry + (Math.cos(i * 1.5) * 20),
        radius: c.metadata?.tem_proposta ? 13 : 9,
        color: '#6366f1',
        node: c
      };
    });

    // Planos de Governo orbitando logo ao lado do seu candidato
    propNodes.forEach((pr, i) => {
      // Encontra o candidato dono do plano
      const parentCand = candNodes.find(c => pr.id.includes(c.metadata?.sq_candidato || '###'));
      if (parentCand && positions[parentCand.id]) {
        const pPos = positions[parentCand.id];
        const offsetAngle = 0.5 + (i * 0.1);
        positions[pr.id] = {
          x: pPos.x + Math.cos(offsetAngle) * 52,
          y: pPos.y + Math.sin(offsetAngle) * 52,
          radius: 9,
          color: '#10b981',
          node: pr
        };
      } else {
        const angle = (i / propNodes.length) * Math.PI * 2;
        positions[pr.id] = {
          x: cx + Math.cos(angle) * 390,
          y: cy + Math.sin(angle) * 250,
          radius: 8,
          color: '#10b981',
          node: pr
        };
      }
    });
  }

  graphState.positions = positions;
  graphState.visibleNodes = nodes;
  graphState.visibleEdges = edges;

  // Determine connected set for dimming if a node is hovered or selected
  const activeId = graphState.hoveredNodeId || graphState.selectedNodeId;
  const connectedIds = new Set();
  const activeEdges = new Set();

  if (activeId) {
    connectedIds.add(activeId);
    edges.forEach((e, idx) => {
      if (e.source === activeId) {
        connectedIds.add(e.target);
        activeEdges.add(idx);
      } else if (e.target === activeId) {
        connectedIds.add(e.source);
        activeEdges.add(idx);
      }
    });
  }

  // --- DRAWING WITH ZOOM & PAN ---
  ctx.save();
  ctx.translate(graphState.panX, graphState.panY);
  ctx.scale(graphState.zoom, graphState.zoom);

  // Background subtle starfield / grid
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  for (let gx = -200; gx < w + 400; gx += 80) {
    for (let gy = -200; gy < h + 400; gy += 80) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw Edges
  edges.forEach((e, idx) => {
    const p1 = positions[e.source];
    const p2 = positions[e.target];
    if (!p1 || !p2) return;

    const isActive = activeEdges.has(idx);
    const hasFocus = Boolean(activeId);

    if (isActive) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(56, 189, 248, 0.6)';
      ctx.shadowBlur = 8;
    } else if (hasFocus) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw relation badge if active
    if (isActive && e.relation) {
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const relLabel = formatRelationLabel(e.relation);

      ctx.font = '700 9px Plus Jakarta Sans, sans-serif';
      const tw = ctx.measureText(relLabel).width;

      ctx.fillStyle = 'rgba(8, 12, 22, 0.9)';
      ctx.beginPath();
      ctx.roundRect(midX - tw / 2 - 6, midY - 8, tw + 12, 16, 8);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(relLabel, midX, midY);
    }
  });

  // Draw Nodes
  Object.values(positions).forEach(p => {
    const isNodeActive = !activeId || connectedIds.has(p.node.id);
    const isDirectHover = p.node.id === activeId;

    ctx.globalAlpha = isNodeActive ? 1.0 : 0.14;

    // Aura ring for hovered or central node
    if (isDirectHover || p.isCenter) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 8, 0, Math.PI * 2);
      ctx.fillStyle = p.isCenter ? 'rgba(99, 102, 241, 0.25)' : 'rgba(56, 189, 248, 0.3)';
      ctx.fill();
    }

    // Outer circle
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = isDirectHover ? '#fff' : 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = isDirectHover ? 2.5 : 1.5;
    ctx.stroke();

    // Node Label inside readable pill
    const rawLabel = p.node.label || '';
    const cleanLabel = rawLabel.length > 20 ? rawLabel.substring(0, 18) + '..' : rawLabel;

    ctx.font = isDirectHover ? '800 11px Plus Jakarta Sans, sans-serif' : '700 10px Plus Jakarta Sans, sans-serif';
    const textW = ctx.measureText(cleanLabel).width;
    const labelY = p.y + p.radius + 12;

    // Pill background for crisp legibility
    ctx.fillStyle = 'rgba(9, 12, 20, 0.85)';
    ctx.beginPath();
    ctx.roundRect(p.x - textW / 2 - 5, labelY - 8, textW + 10, 16, 4);
    ctx.fill();
    ctx.strokeStyle = isDirectHover ? 'rgba(56, 189, 248, 0.6)' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Text
    ctx.fillStyle = isDirectHover ? '#38bdf8' : 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cleanLabel, p.x, labelY);
  });

  ctx.globalAlpha = 1.0;
  ctx.restore();
}

function formatRelationLabel(rel) {
  if (rel === 'MEMBER_OF') return 'FILIADO AO';
  if (rel === 'SUBMITTED_GOVERNMENT_PLAN') return 'PLANO TSE';
  if (rel === 'COALITION_WITH') return 'COLIGAÇÃO';
  return rel.replace(/_/g, ' ');
}

function showGraphNodeDetails(node) {
  const emptyEl = document.getElementById('inspector-empty');
  const activeEl = document.getElementById('inspector-active');
  if (!activeEl) return;

  if (emptyEl) emptyEl.style.display = 'none';
  activeEl.style.display = 'flex';

  let typeBadgeClass = 'badge-cand';
  let typeLabel = 'Candidato Oficial';
  if (node.type === 'PARTY') {
    typeBadgeClass = 'badge-party';
    typeLabel = 'Partido Político';
  } else if (node.type === 'GOVERNMENT_PLAN') {
    typeBadgeClass = 'badge-prop';
    typeLabel = 'Plano de Governo Registrado';
  }

  // Find related edges in the graph
  const allEdges = state.graphData?.edges || [];
  const relatedEdges = allEdges.filter(e => e.source === node.id || e.target === node.id);

  let statsHtml = '';
  let actionsHtml = '';

  if (node.type === 'CANDIDATE') {
    const meta = node.metadata || {};
    const pat = Number(meta.patrimonio || 0);
    const patStr = pat > 0 ? `R$ ${(pat / 1000000).toFixed(2)}M` : 'R$ 0,00';
    const rec = Number(meta.receitas_campanha || 0);
    const recStr = rec > 0 ? `R$ ${(rec / 1000000).toFixed(2)}M` : 'R$ 0,00';

    statsHtml = `
      <div class="insp-stats-grid">
        <div class="insp-stat-item">
          <div class="insp-stat-label">Patrimônio Declarado</div>
          <div class="insp-stat-val" style="color: #fbbf24;">${patStr}</div>
        </div>
        <div class="insp-stat-item">
          <div class="insp-stat-label">Receitas / Fundo</div>
          <div class="insp-stat-val" style="color: #34d399;">${recStr}</div>
        </div>
        <div class="insp-stat-item">
          <div class="insp-stat-label">Certidões Criminais</div>
          <div class="insp-stat-val" style="color: #60a5fa;">${meta.certidoes_qtd || 0} Anexadas</div>
        </div>
        <div class="insp-stat-item">
          <div class="insp-stat-label">Plano de Governo</div>
          <div class="insp-stat-val" style="color: ${meta.tem_proposta ? '#34d399' : '#fb7185'};">
            ${meta.tem_proposta ? 'Protocolado' : 'Não Consta'}
          </div>
        </div>
      </div>
    `;

    actionsHtml = `
      <button class="insp-action-btn" onclick="openCandidateDossier('${meta.sq_candidato}')">
        <span>🔍 Abrir Dossiê 360º Completo</span>
      </button>
    `;
  } else if (node.type === 'PARTY') {
    const meta = node.metadata || {};
    statsHtml = `
      <div class="insp-stats-grid">
        <div class="insp-stat-item" style="grid-column: span 2;">
          <div class="insp-stat-label">Espectro Ideológico</div>
          <div class="insp-stat-val" style="color: #38bdf8;">${meta.espectro || 'Centro'}</div>
        </div>
      </div>
      <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-top: 4px;">${escapeHtml(meta.resumo || '')}</p>
    `;

    actionsHtml = `
      <button class="insp-action-btn" style="background: var(--bg-card); border: 1px solid var(--accent-secondary);" onclick="filterByPartyFromGraph('${meta.sigla}')">
        <span>👥 Ver Candidatos do ${meta.sigla}</span>
      </button>
    `;
  } else if (node.type === 'GOVERNMENT_PLAN') {
    const meta = node.metadata || {};
    statsHtml = `
      <div class="insp-stats-grid">
        <div class="insp-stat-item">
          <div class="insp-stat-label">Total de Páginas</div>
          <div class="insp-stat-val" style="color: #34d399;">${meta.paginas || 0} pgs</div>
        </div>
        <div class="insp-stat-item">
          <div class="insp-stat-label">Volume Textual</div>
          <div class="insp-stat-val">${Number(meta.caracteres || 0).toLocaleString('pt-BR')} chars</div>
        </div>
      </div>
      <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
        <strong>Pilares em Destaque:</strong><br>
        <span style="color: var(--text-main);">${(meta.pilares_principais || []).join(', ') || 'Geral'}</span>
      </div>
    `;
  }

  // Connections list
  const connItems = relatedEdges.slice(0, 5).map(e => {
    const isTarget = e.source === node.id;
    const neighborId = isTarget ? e.target : e.source;
    const neighborNode = (state.graphData?.nodes || []).find(n => n.id === neighborId);
    if (!neighborNode) return '';

    return `
      <div class="insp-conn-item" onclick="focusGraphOnNode('${neighborNode.id}')">
        <div>
          <span style="color: var(--accent-secondary); font-weight: 700;">${formatRelationLabel(e.relation)}</span>
          <div style="color: #fff; font-weight: 600; margin-top: 2px;">${escapeHtml(neighborNode.label)}</div>
        </div>
        <span style="color: var(--text-subtle); font-size: 14px;">→</span>
      </div>
    `;
  }).join('');

  activeEl.innerHTML = `
    <div class="insp-header">
      <span class="insp-type-badge ${typeBadgeClass}">${typeLabel}</span>
      <h3 class="insp-title">${escapeHtml(node.label)}</h3>
      <p class="insp-subtitle">${escapeHtml(node.metadata?.nome_completo || node.metadata?.nome || '')}</p>
    </div>

    ${statsHtml}

    <div class="insp-connections-section">
      <div class="insp-connections-title">Conexões Mapeadas (${relatedEdges.length})</div>
      <div class="insp-conn-list">
        ${connItems || '<div style="font-size: 11px; color: var(--text-subtle);">Nenhuma conexão listada.</div>'}
      </div>
    </div>

    ${actionsHtml}
  `;
}

function focusGraphOnNode(nodeId) {
  const node = (state.graphData?.nodes || []).find(n => n.id === nodeId);
  if (!node) return;

  if (node.type === 'CANDIDATE') {
    graphState.focusCandId = nodeId;
    const select = document.getElementById('graph-focus-select');
    if (select) select.value = nodeId;
    document.querySelectorAll('.graph-preset-btn').forEach(b => b.classList.remove('active'));
    resetGraphTransform();
    renderGraph();
  }

  showGraphNodeDetails(node);
}

function filterByPartyFromGraph(sigla) {
  if (!sigla) return;
  // Switch to dossier view and apply party filter
  const btn = document.getElementById('nav-dossier-btn');
  if (btn) btn.click();
  const filterPart = document.getElementById('filter-partido');
  if (filterPart) {
    filterPart.value = sigla;
    state.activeFilterPartido = sigla;
    loadCandidates();
  }
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
