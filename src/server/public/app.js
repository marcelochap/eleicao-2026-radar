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
  latestEvaluationResult: null,
  selectedTicket: {}
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
        updateQuizProgress();
      } else {
        const floatingBar = document.getElementById('floating-quiz-bar');
        if (floatingBar) floatingBar.classList.remove('visible');
        if (targetView === 'graph-view') {
          renderGraph();
        }
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
    populateGraphPartyDropdown();
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

  // Atualiza botão no cabeçalho do quiz
  const topCalcBtn = document.getElementById('btn-calculate-match-top');
  if (topCalcBtn) {
    topCalcBtn.style.display = answered > 0 ? 'inline-flex' : 'none';
  }

  // Atualiza barra flutuante de cálculo rápido
  const floatingBar = document.getElementById('floating-quiz-bar');
  const floatingCount = document.getElementById('floating-answered-count');
  if (floatingBar && floatingCount) {
    floatingCount.textContent = `${answered}/${total}`;
    if (answered > 0 && state.currentView === 'compass-view') {
      floatingBar.classList.add('visible');
    } else {
      floatingBar.classList.remove('visible');
    }
  }
}

function setupQuiz() {
  btnCalculateMatch.addEventListener('click', () => {
    evaluateQuizAnswers();
  });

  const topCalcBtn = document.getElementById('btn-calculate-match-top');
  if (topCalcBtn) {
    topCalcBtn.addEventListener('click', () => {
      evaluateQuizAnswers();
    });
  }

  const floatingCalcBtn = document.getElementById('btn-calculate-match-floating');
  if (floatingCalcBtn) {
    floatingCalcBtn.addEventListener('click', () => {
      evaluateQuizAnswers();
    });
  }

  btnResetQuiz.addEventListener('click', () => {
    state.userAnswers = {};
    state.latestEvaluationResult = null;
    state.selectedTicket = {};
    const ticketCard = document.getElementById('voting-ticket-card');
    if (ticketCard) ticketCard.style.display = 'none';

    const floatingBar = document.getElementById('floating-quiz-bar');
    if (floatingBar) floatingBar.classList.remove('visible');

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

  setupColinhaActions();

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

const OFFICIAL_BALLOT_ORDER = [
  { cargo: 'DEPUTADO FEDERAL', label: '1º · Deputado Federal', digits: 4 },
  { cargo: 'DEPUTADO DISTRITAL', label: '2º · Deputado Distrital', digits: 5 },
  { cargo: 'SENADOR', label: '3º · Senador', digits: 3 },
  { cargo: 'GOVERNADOR', label: '4º · Governador do DF', digits: 2 },
  { cargo: 'PRESIDENTE', label: '5º · Presidente da República', digits: 2 }
];

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

    // Auto-popula a Colinha Oficial com os candidatos #1 de cada cargo se ainda não tiverem sido selecionados
    if (result.allCandidatesRanked) {
      OFFICIAL_BALLOT_ORDER.forEach(item => {
        if (!state.selectedTicket[item.cargo]) {
          const topCand = result.allCandidatesRanked.find(c => c.cargo === item.cargo);
          if (topCand) {
            state.selectedTicket[item.cargo] = topCand;
          }
        }
      });
      const ticketCard = document.getElementById('voting-ticket-card');
      if (ticketCard) ticketCard.style.display = 'block';
      renderVotingTicket();
    }

    renderFilteredCargoMatches();
    renderPartyRankings(result.topParties);

    // Rola a tela suavemente para os resultados (Bússola e Colinha Oficial)
    setTimeout(() => {
      scrollToResults();
    }, 120);
  } catch (err) {
    console.error('Erro ao avaliar questionário:', err);
  }
}

function scrollToResults() {
  const resultsTarget = document.querySelector('.results-panel') || document.getElementById('compassCanvas');
  if (resultsTarget) {
    const yOffset = -90; // compensa a navbar fixa do topo
    const y = resultsTarget.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }
}

function renderVotingTicket() {
  const container = document.getElementById('ticket-slots');
  if (!container) return;
  container.innerHTML = '';

  OFFICIAL_BALLOT_ORDER.forEach(item => {
    const cand = state.selectedTicket[item.cargo];
    const slot = document.createElement('div');
    slot.className = 'ticket-slot-item';

    let digitsHtml = '';
    const numStr = cand && cand.numero ? String(cand.numero) : '';
    for (let i = 0; i < item.digits; i++) {
      const digit = numStr[i] !== undefined ? numStr[i] : '•';
      digitsHtml += `<div class="urna-box">${digit}</div>`;
    }

    slot.innerHTML = `
      <div style="flex: 1; min-width: 0; padding-right: 14px;">
        <div class="slot-cargo-name">${item.label} (${item.digits} DÍGITOS)</div>
        <div class="slot-cand-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${cand ? escapeHtml(cand.nome_urna) : '<span style="color: var(--text-subtle); font-weight: normal; font-size: 13px;">Nenhum candidato selecionado</span>'}
        </div>
        <div class="slot-party-info">
          ${cand ? `${cand.partido} · ${cand.fit_percentage ? cand.fit_percentage + '% Fit' : ''}` : 'Escolha um candidato no ranking abaixo'}
        </div>
      </div>
      <div class="slot-urna-display">
        ${digitsHtml}
      </div>
    `;
    container.appendChild(slot);
  });
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

          const isSelectedInColinha = state.selectedTicket[c.cargo] && String(state.selectedTicket[c.cargo].sq_candidato) === String(c.sq_candidato);

          return `
            <div class="cargo-candidate-card" data-sq="${c.sq_candidato}" title="Clique no card para abrir Dossiê 360º">
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
              <div style="text-align: right; margin-left: 12px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                <div class="match-badge ${badgeClass}">${c.fit_percentage}% Fit</div>
                <button class="btn-select-ticket ${isSelectedInColinha ? 'selected' : ''}" data-sq="${c.sq_candidato}" data-cargo="${c.cargo}">
                  ${isSelectedInColinha ? '✓ Na sua Colinha' : '★ Escolher para Colinha'}
                </button>
                <div style="font-size: 10px; color: var(--accent-secondary); margin-top: 2px; font-weight: 600;">Ver Dossiê ↗</div>
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

  // Event listener para botões de colocar na Colinha (com stopPropagation)
  container.querySelectorAll('.btn-select-ticket').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sq = btn.dataset.sq;
      const cargo = btn.dataset.cargo;
      const allCand = state.latestEvaluationResult ? state.latestEvaluationResult.allCandidatesRanked : state.candidates;
      const cand = allCand.find(c => String(c.sq_candidato) === String(sq));
      if (cand) {
        state.selectedTicket[cargo] = cand;
        renderVotingTicket();
        renderFilteredCargoMatches();
        
        // Suave destaque no card da colinha
        const ticketCard = document.getElementById('voting-ticket-card');
        if (ticketCard) {
          ticketCard.style.boxShadow = '0 0 24px rgba(251, 191, 36, 0.6)';
          setTimeout(() => {
            ticketCard.style.boxShadow = '';
          }, 800);
        }
      }
    });
  });

  // Event listener para abrir Dossiê 360º ao clicar no card
  container.querySelectorAll('.cargo-candidate-card').forEach(card => {
    card.addEventListener('click', () => {
      const sq = card.dataset.sq;
      if (sq) openCandidateDossier(sq);
    });
  });
}

function setupColinhaActions() {
  const btnPrint = document.getElementById('btn-print-colinha');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      preparePrintableColinha();
      window.print();
    });
  }

  const btnCopy = document.getElementById('btn-copy-colinha');
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      const text = buildWhatsAppColinha();
      navigator.clipboard.writeText(text).then(() => {
        const span = document.getElementById('copy-btn-text');
        if (span) {
          const oldText = span.textContent;
          span.textContent = '✓ Copiado com Sucesso!';
          setTimeout(() => { span.textContent = oldText; }, 2500);
        }
      }).catch(err => {
        console.error('Falha ao copiar:', err);
        alert('Texto da cola:\n\n' + text);
      });
    });
  }
}

function preparePrintableColinha() {
  const profileDiv = document.getElementById('print-voter-profile');
  const tableDiv = document.getElementById('print-order-table');
  if (!profileDiv || !tableDiv) return;

  const prof = state.latestEvaluationResult ? state.latestEvaluationResult.userProfile : null;
  const quadrantName = prof ? prof.quadrant : 'Cidadão Consciente';
  profileDiv.innerHTML = `
    <span><strong>Perfil Político:</strong> ${quadrantName}</span> · 
    <span>Gerado em ${new Date().toLocaleDateString('pt-BR')}</span>
  `;

  let tableHtml = '';
  OFFICIAL_BALLOT_ORDER.forEach(item => {
    const cand = state.selectedTicket[item.cargo];
    const numStr = cand && cand.numero ? String(cand.numero) : '';
    let digitsBoxes = '';
    for (let i = 0; i < item.digits; i++) {
      const d = numStr[i] !== undefined ? numStr[i] : ' ';
      digitsBoxes += `<div class="print-num-digit">${d}</div>`;
    }

    tableHtml += `
      <div class="print-row">
        <div>
          <div class="print-cargo">${item.label} (${item.digits} dígitos)</div>
          <div class="print-cand-name">${cand ? escapeHtml(cand.nome_urna) : 'NÃO ESCOLHIDO / EM BRANCO'}</div>
          <div class="print-party">${cand ? `${cand.partido} · ${escapeHtml(cand.coligacao || '')}` : '-'}</div>
        </div>
        <div class="print-num-boxes">
          ${digitsBoxes}
        </div>
      </div>
    `;
  });

  tableDiv.innerHTML = tableHtml;
}

function buildWhatsAppColinha() {
  const prof = state.latestEvaluationResult ? state.latestEvaluationResult.userProfile : null;
  const quadrantName = prof ? prof.quadrant : 'Cidadão Consciente';

  let txt = `🗳️ *MINHA COLA DE VOTAÇÃO — ELEIÇÕES 2026*\n`;
  txt += `📋 *Alinhamento Ideológico:* ${quadrantName}\n`;
  txt += `Ordem oficial de digitação na Urna Eletrônica:\n\n`;

  OFFICIAL_BALLOT_ORDER.forEach(item => {
    const cand = state.selectedTicket[item.cargo];
    if (cand) {
      txt += `${item.label} (${item.digits} dígitos):\n`;
      txt += `👉 *${cand.numero}* — ${cand.nome_urna} (${cand.partido})\n\n`;
    } else {
      txt += `${item.label} (${item.digits} dígitos):\n`;
      txt += `👉 _[Não definido / Em branco]_\n\n`;
    }
  });

  txt += `⚖️ *Dica TSE:* Na urna, digite os números e confira a foto na tela antes de teclar CONFIRMA.\n`;
  txt += `🔗 Descubra seu alinhamento com dados reais do TSE:\n`;
  txt += `https://eleicao-2026-radar.vercel.app/\n`;

  return txt;
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
// GRAPHIFY NETWORK VIEW (PARTY & TICKET HIERARCHY STANDARD)
// =========================================================
const graphState = {
  zoom: 1,
  panX: 0,
  panY: 0,
  hoveredNodeId: null,
  selectedNodeId: null,
  activePreset: 'macro', // 'macro', 'gdf', 'pres', 'party'
  activeParty: '',
  layoutMode: 'radial', // 'radial' ou 'linear'
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  positions: {},
  visibleNodes: [],
  visibleEdges: []
};

async function loadGraphData(party = '') {
  try {
    const url = party ? `/api/graph?partido=${encodeURIComponent(party)}` : '/api/graph';
    const res = await fetch(url);
    state.graphData = await res.json();
    populateGraphPartyDropdown();
  } catch (err) {
    console.error('Erro ao carregar dados do grafo:', err);
  }
}

const PARTY_NAMES = {
  'PL': 'Partido Liberal',
  'PT': 'Partido dos Trabalhadores',
  'NOVO': 'Partido Novo',
  'PP': 'Progressistas',
  'MDB': 'Movimento Democrático Brasileiro',
  'PSD': 'Partido Social Democrático',
  'UNIÃO': 'União Brasil',
  'REPUBLICANOS': 'Republicanos',
  'PSB': 'Partido Socialista Brasileiro',
  'PDT': 'Partido Democrático Trabalhista',
  'PSOL': 'Partido Socialismo e Liberdade',
  'PODEMOS': 'Podemos',
  'CIDADANIA': 'Cidadania',
  'SOLIDARIEDADE': 'Solidariedade',
  'AVANTE': 'Avante',
  'PRD': 'Partido Renovação Democrática',
  'REDE': 'Rede Sustentabilidade',
  'PSTU': 'Partido Socialista dos Trabalhadores Unificado',
  'PCB': 'Partido Comunista Brasileiro',
  'PCO': 'Partido da Causa Operária',
  'UP': 'Unidade Popular',
  'DC': 'Democracia Cristã',
  'PMB': 'Partido da Mulher Brasileira',
  'PRTB': 'Partido Renovador Trabalhista Brasileiro',
  'AGIR': 'Agir',
  'MOBILIZA': 'Mobilização Nacional'
};

function populateGraphPartyDropdown() {
  const select = document.getElementById('graph-party-select');
  if (!select) return;

  const currentVal = graphState.activeParty || select.value || '';

  let partyList = (state.parties && state.parties.length > 0) ? state.parties.map(p => ({
    sigla: p.sg_partido,
    nome: p.nm_partido || p.sg_partido,
    cands: p.total_candidatos || 0,
    espectro: p.espectro_estimado || ''
  })) : [];

  if (partyList.length === 0) {
    const defaultParties = ['PL', 'PT', 'NOVO', 'PP', 'MDB', 'PSD', 'UNIÃO', 'REPUBLICANOS', 'PSB', 'PODEMOS', 'PDT', 'PSOL', 'CIDADANIA', 'SOLIDARIEDADE', 'AVANTE', 'PRD', 'REDE', 'PSTU', 'PCB', 'PCO', 'UP', 'DC', 'PMB', 'PRTB'];
    partyList = defaultParties.map(s => ({ sigla: s, nome: s, cands: 0, espectro: '' }));
  }

  const priority = ['PL', 'PT', 'NOVO', 'PP', 'MDB', 'PSD', 'UNIÃO', 'REPUBLICANOS', 'PSB', 'PDT', 'PSOL'];
  partyList.sort((a, b) => {
    const pa = priority.indexOf(a.sigla);
    const pb = priority.indexOf(b.sigla);
    if (pa !== -1 && pb !== -1) return pa - pb;
    if (pa !== -1) return -1;
    if (pb !== -1) return 1;
    return a.sigla.localeCompare(b.sigla);
  });

  select.innerHTML = '<option value="">🏛️ Todos os Partidos (Executivo 2026)</option>';
  partyList.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.sigla;
    const fullName = PARTY_NAMES[p.sigla] || p.nome || p.sigla;
    const countInfo = p.cands > 0 ? ` (${p.cands} cands)` : '';
    opt.textContent = `${p.sigla} - ${fullName}${countInfo}`;
    select.appendChild(opt);
  });

  select.value = currentVal;
}

async function selectPartyInGraph(sigla) {
  const select = document.getElementById('graph-party-select');
  if (select) select.value = sigla;

  document.querySelectorAll('.graph-preset-btn').forEach(b => {
    b.classList.toggle('active', !sigla && b.dataset.preset === 'macro');
  });

  const layoutToggle = document.getElementById('graph-layout-toggle');
  if (layoutToggle) {
    layoutToggle.style.display = sigla ? 'flex' : 'none';
  }

  graphState.activeParty = sigla;
  graphState.activePreset = sigla ? 'party' : 'macro';

  await loadGraphData(sigla);
  resetGraphTransform();
  renderGraph();

  if (sigla && state.graphData?.nodes) {
    const partyNode = state.graphData.nodes.find(n => n.type === 'PARTY' && (n.id === `party:${sigla}` || n.metadata?.sigla === sigla));
    if (partyNode) {
      showGraphNodeDetails(partyNode);
    }
  } else {
    resetInspectorPanel();
  }
}

function setupGraphControls() {
  const canvas = document.getElementById('networkCanvas');
  if (!canvas) return;
  canvas.width = 1140;
  canvas.height = 680;

  // Layout mode buttons (Radial vs Linear)
  const btnRadial = document.getElementById('btn-layout-radial');
  const btnLinear = document.getElementById('btn-layout-linear');
  btnRadial?.addEventListener('click', () => {
    graphState.layoutMode = 'radial';
    btnRadial.classList.add('active');
    btnLinear?.classList.remove('active');
    resetGraphTransform();
    renderGraph();
  });
  btnLinear?.addEventListener('click', () => {
    graphState.layoutMode = 'linear';
    btnLinear.classList.add('active');
    btnRadial?.classList.remove('active');
    resetGraphTransform();
    renderGraph();
  });

  // Preset buttons
  document.querySelectorAll('.graph-preset-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.graph-preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const preset = btn.dataset.preset;
      graphState.activePreset = preset;

      if (preset === 'macro') {
        await selectPartyInGraph('');
        return;
      }

      // Presets GDF / Presidenciais (filter macro nodes)
      const select = document.getElementById('graph-party-select');
      if (select) select.value = '';
      graphState.activeParty = '';
      const layoutToggle = document.getElementById('graph-layout-toggle');
      if (layoutToggle) layoutToggle.style.display = 'none';

      await loadGraphData('');
      resetGraphTransform();
      renderGraph();
      resetInspectorPanel();
    });
  });

  // Party Dropdown
  const partySelect = document.getElementById('graph-party-select');
  if (partySelect) {
    partySelect.addEventListener('change', async (e) => {
      const sigla = e.target.value;
      await selectPartyInGraph(sigla);
    });
  }

  // Zoom buttons
  document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    graphState.zoom = Math.min(graphState.zoom * 1.2, 3.2);
    updateZoomDisplay();
    renderGraph();
  });
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    graphState.zoom = Math.max(graphState.zoom / 1.2, 0.35);
    updateZoomDisplay();
    renderGraph();
  });
  document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
    resetGraphTransform();
    renderGraph();
  });
  document.getElementById('btn-reset-graph')?.addEventListener('click', async () => {
    await selectPartyInGraph('');
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
    const newZoom = Math.max(0.35, Math.min(3.2, graphState.zoom * zoomFactor));

    graphState.panX = mouseX - (mouseX - graphState.panX) * (newZoom / graphState.zoom);
    graphState.panY = mouseY - (mouseY - graphState.panY) * (newZoom / graphState.zoom);
    graphState.zoom = newZoom;

    updateZoomDisplay();
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

        // If clicked on a PARTY node in macro view, drill down to that party's full hierarchy
        if (p.node.type === 'PARTY' && !graphState.activeParty) {
          const sigla = p.node.metadata?.sigla || p.node.label.split(' ')[0];
          selectPartyInGraph(sigla);
        }
        return;
      }
    }
  });
}

function updateZoomDisplay() {
  const btn = document.getElementById('btn-zoom-reset');
  if (btn) {
    btn.textContent = `${Math.round(graphState.zoom * 100)}%`;
  }
}

function resetGraphTransform() {
  const canvas = document.getElementById('networkCanvas');
  const cx = canvas ? canvas.width / 2 : 570;
  const cy = canvas ? canvas.height / 2 : 340;

  const isParty = Boolean(graphState.activeParty);
  const isRadial = isParty && (graphState.layoutMode !== 'linear');

  if (isRadial) {
    // Zoom mais afastado para ver toda a constelação espaçada
    graphState.zoom = 0.58;
    graphState.panX = cx * (1 - graphState.zoom);
    graphState.panY = cy * (1 - graphState.zoom);
  } else if (isParty) {
    // Árvore linear de 6 colunas espaçadas
    graphState.zoom = 0.68;
    graphState.panX = 30;
    graphState.panY = cy * (1 - graphState.zoom);
  } else {
    // Visão macro executiva geral
    graphState.zoom = 0.88;
    graphState.panX = cx * (1 - graphState.zoom);
    graphState.panY = cy * (1 - graphState.zoom);
  }

  graphState.hoveredNodeId = null;
  updateZoomDisplay();
}

function resetInspectorPanel() {
  const emptyEl = document.getElementById('inspector-empty');
  const activeEl = document.getElementById('inspector-active');
  if (emptyEl) emptyEl.style.display = 'flex';
  if (activeEl) activeEl.style.display = 'none';
}

function distributeInColumn(items, x, centerY, maxHeight, positionsObj, styleFn) {
  const n = items.length;
  if (n === 0) return;
  if (n === 1) {
    const s = styleFn(items[0], 0);
    positionsObj[items[0].id] = {
      x,
      y: centerY,
      node: items[0],
      ...s
    };
    return;
  }

  const step = Math.min(46, maxHeight / (n - 1));
  const totalH = step * (n - 1);
  const startY = centerY - totalH / 2;

  items.forEach((item, idx) => {
    const s = styleFn(item, idx);
    positionsObj[item.id] = {
      x,
      y: startY + idx * step,
      node: item,
      ...s
    };
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

  const isPartyHierarchy = (state.graphData.mode === 'PARTY_TICKET_HIERARCHY') || Boolean(graphState.activeParty);
  const isRadial = isPartyHierarchy && (graphState.layoutMode !== 'linear');
  const allNodes = state.graphData.nodes || [];
  const allEdges = state.graphData.edges || [];

  let nodes = allNodes;
  let edges = allEdges;

  // Filter nodes & edges for macro presets
  if (!isPartyHierarchy) {
    if (graphState.activePreset === 'gdf') {
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
    }
  }

  const positions = {};

  if (isPartyHierarchy) {
    const partyNodes = nodes.filter(n => n.type === 'PARTY');
    const presNodes = nodes.filter(n => n.type === 'CANDIDATE' && (n.metadata?.cargo === 'PRESIDENTE' || n.metadata?.cargo === 'VICE-PRESIDENTE'));
    const govNodes = nodes.filter(n => n.type === 'CANDIDATE' && (n.metadata?.cargo === 'GOVERNADOR' || n.metadata?.cargo === 'VICE-GOVERNADOR'));
    const senNodes = nodes.filter(n => n.type === 'CANDIDATE' && (n.metadata?.cargo === 'SENADOR' || (n.metadata?.cargo && n.metadata.cargo.includes('SUPLENTE'))));
    const fedNodes = nodes.filter(n => n.type === 'CANDIDATE' && n.metadata?.cargo === 'DEPUTADO FEDERAL');
    const distNodes = nodes.filter(n => n.type === 'CANDIDATE' && n.metadata?.cargo === 'DEPUTADO DISTRITAL');
    const propNodes = nodes.filter(n => n.type === 'GOVERNMENT_PLAN');
    const coalNodes = nodes.filter(n => n.type === 'COALITION');

    if (isRadial) {
      // =======================================================================
      // MODE 1A: RADIAL CONSTELLATION (ÓRBITAS DO PODER AMPLIADAS)
      // Centro (R=0): Partido
      // Órbita 1 (R=95): Presidente
      // Órbita 2 (R=190): Governador + Plano TSE (R=230)
      // Órbita 3 (R=290): Senadores
      // Órbita 4 (R=400): Deputados Federais
      // Órbita 5 (R=520-560): Deputados Distritais (CLDF - amplo espaçamento)
      // =======================================================================

      // 0. Centro: Partido
      partyNodes.forEach((p) => {
        positions[p.id] = {
          x: cx,
          y: cy,
          radius: 28,
          color: '#6366f1',
          node: p,
          tier: 0,
          tierLabel: 'LEGENDA',
          angle: 0
        };
      });

      // 1. Órbita 1: Presidência (Topo central / Noroeste)
      presNodes.forEach((p, idx) => {
        const baseAngle = -Math.PI / 2;
        const angle = presNodes.length === 1 ? baseAngle : baseAngle - 0.28 + idx * 0.56;
        positions[p.id] = {
          x: cx + 95 * Math.cos(angle),
          y: cy + 95 * Math.sin(angle),
          radius: p.metadata?.cargo === 'PRESIDENTE' ? 17 : 14,
          color: '#f59e0b',
          node: p,
          tier: 1,
          tierLabel: 'PRESIDENTE',
          angle
        };
      });

      // 2. Órbita 2: Governo do DF (Nordeste / 1h30)
      govNodes.forEach((g, idx) => {
        const baseAngle = -Math.PI * 0.25;
        const angle = govNodes.length === 1 ? baseAngle : baseAngle - 0.22 + idx * 0.44;
        positions[g.id] = {
          x: cx + 190 * Math.cos(angle),
          y: cy + 190 * Math.sin(angle),
          radius: g.metadata?.cargo === 'GOVERNADOR' ? 17 : 14,
          color: '#8b5cf6',
          node: g,
          tier: 2,
          tierLabel: 'GOVERNADOR',
          angle
        };
      });

      // Planos de Governo (satélite do governador/presidente)
      propNodes.forEach((pr) => {
        const parent = govNodes[0] || presNodes[0];
        const pPos = parent ? positions[parent.id] : null;
        if (pPos) {
          positions[pr.id] = {
            x: pPos.x + 36,
            y: pPos.y - 24,
            radius: 10,
            color: '#34d399',
            node: pr,
            tier: 2.5,
            tierLabel: 'PLANO TSE',
            angle: pPos.angle
          };
        } else {
          positions[pr.id] = {
            x: cx + 225,
            y: cy - 130,
            radius: 10,
            color: '#34d399',
            node: pr,
            tier: 2.5,
            tierLabel: 'PLANO TSE',
            angle: 0
          };
        }
      });

      // 3. Órbita 3: Senado Federal (Noroeste / 10h30)
      senNodes.forEach((s, idx) => {
        const baseAngle = -Math.PI * 0.75;
        const angle = senNodes.length === 1 ? baseAngle : baseAngle - 0.26 + idx * 0.52;
        positions[s.id] = {
          x: cx + 290 * Math.cos(angle),
          y: cy + 290 * Math.sin(angle),
          radius: s.metadata?.cargo === 'SENADOR' ? 16 : 13,
          color: '#3b82f6',
          node: s,
          tier: 3,
          tierLabel: 'SENADOR',
          angle
        };
      });

      // 4. Órbita 4: Deputados Federais (Leque amplo na órbita 4)
      fedNodes.forEach((f, idx) => {
        const angle = -Math.PI + ((idx + 0.5) / Math.max(1, fedNodes.length)) * (Math.PI * 2);
        positions[f.id] = {
          x: cx + 400 * Math.cos(angle),
          y: cy + 400 * Math.sin(angle),
          radius: 13,
          color: '#06b6d4',
          node: f,
          tier: 4,
          tierLabel: 'DEP. FEDERAL',
          angle
        };
      });

      // 5. Órbita 5: Deputados Distritais (CLDF - Órbita Externa com alternância de raio)
      distNodes.forEach((d, idx) => {
        const angle = -Math.PI / 2 + (idx / Math.max(1, distNodes.length)) * (Math.PI * 2);
        const rDist = (idx % 2 === 0) ? 520 : 560;
        positions[d.id] = {
          x: cx + rDist * Math.cos(angle),
          y: cy + rDist * Math.sin(angle),
          radius: 11,
          color: '#10b981',
          node: d,
          tier: 5,
          tierLabel: 'DEP. DISTRITAL',
          angle
        };
      });

      // Coligações
      coalNodes.forEach((cn, idx) => {
        const angle = Math.PI * 0.75 + idx * 0.35;
        positions[cn.id] = {
          x: cx + 210 * Math.cos(angle),
          y: cy + 210 * Math.sin(angle),
          radius: 12,
          color: '#ec4899',
          node: cn,
          tier: 0.5,
          tierLabel: 'COLIGAÇÃO',
          angle
        };
      });

    } else {
      // =======================================================================
      // MODE 1B: LINEAR CASCADING TREE (CORRIGIDA E ESPAÇADA)
      // 6 Colunas organizadas com espaçamento ampliado
      // =======================================================================
      const colX = {
        party: 100,
        pres: 300,
        gov: 520,
        sen: 740,
        fed: 980,
        distA: 1220,
        distB: 1350
      };

      partyNodes.forEach((p, idx) => {
        positions[p.id] = {
          x: colX.party,
          y: cy + (idx - (partyNodes.length - 1) / 2) * 100,
          radius: 24,
          color: '#6366f1',
          node: p,
          tier: 0,
          tierLabel: 'LEGENDA'
        };
      });

      distributeInColumn(presNodes, colX.pres, cy, 380, positions, (node) => ({
        radius: node.metadata?.cargo === 'PRESIDENTE' ? 17 : 14,
        color: '#f59e0b',
        tier: 1,
        tierLabel: 'PRESIDENTE'
      }));

      distributeInColumn(govNodes, colX.gov, cy, 400, positions, (node) => ({
        radius: node.metadata?.cargo === 'GOVERNADOR' ? 17 : 14,
        color: '#8b5cf6',
        tier: 2,
        tierLabel: 'GOVERNADOR'
      }));

      distributeInColumn(senNodes, colX.sen, cy, 480, positions, (node) => ({
        radius: node.metadata?.cargo === 'SENADOR' ? 16 : 12,
        color: '#3b82f6',
        tier: 3,
        tierLabel: 'SENADOR'
      }));

      distributeInColumn(fedNodes, colX.fed, cy, 560, positions, () => ({
        radius: 13,
        color: '#06b6d4',
        tier: 4,
        tierLabel: 'DEP. FEDERAL'
      }));

      const distA = distNodes.filter((_, i) => i % 2 === 0);
      const distB = distNodes.filter((_, i) => i % 2 !== 0);
      distributeInColumn(distA, colX.distA, cy, 580, positions, () => ({
        radius: 11,
        color: '#10b981',
        tier: 5,
        tierLabel: 'DEP. DISTRITAL'
      }));
      distributeInColumn(distB, colX.distB, cy + 20, 580, positions, () => ({
        radius: 11,
        color: '#10b981',
        tier: 5,
        tierLabel: 'DEP. DISTRITAL'
      }));

      propNodes.forEach((pr, i) => {
        const parentGov = govNodes.find(g => pr.id.includes(g.metadata?.sq_candidato || '###')) ||
                          presNodes.find(p => pr.id.includes(p.metadata?.sq_candidato || '###'));
        if (parentGov && positions[parentGov.id]) {
          const pPos = positions[parentGov.id];
          positions[pr.id] = {
            x: pPos.x + 40,
            y: pPos.y - 30,
            radius: 10,
            color: '#34d399',
            node: pr,
            tier: pPos.tier + 0.5,
            tierLabel: 'PLANO TSE'
          };
        } else {
          positions[pr.id] = {
            x: colX.gov + 50,
            y: 70 + i * 38,
            radius: 10,
            color: '#34d399',
            node: pr,
            tier: 2.5
          };
        }
      });

      coalNodes.forEach((cn, i) => {
        positions[cn.id] = {
          x: colX.party + 80,
          y: cy + 160 + i * 55,
          radius: 12,
          color: '#ec4899',
          node: cn,
          tier: 0.5,
          tierLabel: 'COLIGAÇÃO'
        };
      });
    }

  } else {
    // =========================================================================
    // MODE 2: MACRO_EXECUTIVE_GRAPH (Partidos -> Presidente -> Governador)
    // 3-Column Left-to-Right Cascading Flow: Zero hairball, maximum clarity
    // =========================================================================
    const partyNodes = nodes.filter(n => n.type === 'PARTY');
    const presNodes = nodes.filter(n => n.type === 'CANDIDATE' && (n.metadata?.cargo === 'PRESIDENTE' || n.metadata?.cargo === 'VICE-PRESIDENTE'));
    const govNodes = nodes.filter(n => n.type === 'CANDIDATE' && (n.metadata?.cargo === 'GOVERNADOR' || n.metadata?.cargo === 'VICE-GOVERNADOR'));
    const propNodes = nodes.filter(n => n.type === 'GOVERNMENT_PLAN');

    // Col 1: Partidos Políticos (Escalonado em 2 colunas para espaçamento perfeito)
    const pColA = partyNodes.filter((_, i) => i % 2 === 0);
    const pColB = partyNodes.filter((_, i) => i % 2 !== 0);
    distributeInColumn(pColA, 110, cy, 550, positions, () => ({
      radius: 12,
      color: '#6366f1',
      tier: 0,
      tierLabel: 'PARTIDO'
    }));
    distributeInColumn(pColB, 230, cy + 18, 550, positions, () => ({
      radius: 12,
      color: '#6366f1',
      tier: 0,
      tierLabel: 'PARTIDO'
    }));

    // Col 2: Presidenciáveis 2026 (Escalonado em 2 colunas)
    const presColA = presNodes.filter((_, i) => i % 2 === 0);
    const presColB = presNodes.filter((_, i) => i % 2 !== 0);
    distributeInColumn(presColA, 500, cy, 550, positions, (node) => ({
      radius: node.metadata?.cargo === 'PRESIDENTE' ? 16 : 13,
      color: '#f59e0b',
      tier: 1,
      tierLabel: 'PRESIDENTE'
    }));
    distributeInColumn(presColB, 630, cy + 20, 550, positions, (node) => ({
      radius: node.metadata?.cargo === 'PRESIDENTE' ? 16 : 13,
      color: '#f59e0b',
      tier: 1,
      tierLabel: 'PRESIDENTE'
    }));

    // Col 3: Governadores GDF 2026 (Coluna da Direita)
    distributeInColumn(govNodes, 940, cy, 540, positions, (node) => ({
      radius: node.metadata?.cargo === 'GOVERNADOR' ? 16 : 13,
      color: '#8b5cf6',
      tier: 2,
      tierLabel: 'GOVERNADOR'
    }));

    // Planos de Governo
    propNodes.forEach((pn) => {
      const parent = govNodes.find(g => pn.id.includes(g.metadata?.sq_candidato || '###')) ||
                     presNodes.find(p => pn.id.includes(p.metadata?.sq_candidato || '###'));
      if (parent && positions[parent.id]) {
        const pPos = positions[parent.id];
        positions[pn.id] = {
          x: pPos.x + 32,
          y: pPos.y - 20,
          radius: 9,
          color: '#34d399',
          node: pn,
          tier: 2.5,
          tierLabel: 'PLANO TSE'
        };
      }
    });
  }

  graphState.positions = positions;
  graphState.visibleNodes = nodes;
  graphState.visibleEdges = edges;

  // Active hover/selection highlighting
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
  for (let gx = -400; gx < w + 800; gx += 80) {
    for (let gy = -400; gy < h + 800; gy += 80) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Background Orbit Guides (Radial) OR Column Dividers (Linear/Macro)
  if (isRadial) {
    const orbits = [
      { r: 95, label: 'Órbita 1: Executivo Nacional' },
      { r: 190, label: 'Órbita 2: Executivo GDF' },
      { r: 290, label: 'Órbita 3: Senado Federal' },
      { r: 400, label: 'Órbita 4: Câmara Federal' },
      { r: 540, label: 'Órbita 5: CLDF' }
    ];

    ctx.setLineDash([3, 7]);
    ctx.lineWidth = 1;
    orbits.forEach(orb => {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.beginPath();
      ctx.arc(cx, cy, orb.r, 0, Math.PI * 2);
      ctx.stroke();

      // Rótulo sutil da órbita no topo
      ctx.font = '700 9px Plus Jakarta Sans, sans-serif';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.textAlign = 'center';
      ctx.fillText(orb.label, cx, cy - orb.r - 5);
    });
    ctx.setLineDash([]);
  } else if (isPartyHierarchy) {
    const colHeaders = [
      { x: 100, label: '🏛️ LEGENDA' },
      { x: 300, label: '🇧🇷 PRESIDENTE' },
      { x: 520, label: '🏛️ GOVERNADOR' },
      { x: 740, label: '⭐ SENADO (DF)' },
      { x: 980, label: '🏛️ DEP. FEDERAIS' },
      { x: 1285, label: '📍 DEP. DISTRITAIS (CLDF)' }
    ];

    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    [190, 410, 630, 860, 1100].forEach(divX => {
      ctx.beginPath();
      ctx.moveTo(divX, 40);
      ctx.lineTo(divX, h - 20);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    colHeaders.forEach(ch => {
      ctx.font = '800 11px Plus Jakarta Sans, sans-serif';
      const tw = ctx.measureText(ch.label).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(ch.x - tw / 2 - 8, 12, tw + 16, 22, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch.label, ch.x, 23);
    });
  } else {
    // Macro Column Headers
    const macroHeaders = [
      { x: 170, label: '🏛️ PARTIDOS & COLIGAÇÕES' },
      { x: 565, label: '🇧🇷 PRESIDENCIÁVEIS 2026' },
      { x: 940, label: '🏛️ DISPUTA GDF 2026' }
    ];

    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    [370, 760].forEach(divX => {
      ctx.beginPath();
      ctx.moveTo(divX, 40);
      ctx.lineTo(divX, h - 20);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    macroHeaders.forEach(ch => {
      ctx.font = '800 11px Plus Jakarta Sans, sans-serif';
      const tw = ctx.measureText(ch.label).width;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(ch.x - tw / 2 - 8, 12, tw + 16, 22, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch.label, ch.x, 23);
    });
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
      ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
      ctx.shadowBlur = 12;
    } else if (hasFocus) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = isPartyHierarchy ? 'rgba(99, 102, 241, 0.22)' : 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();

    if (isRadial) {
      // RADIAL: Feixe direto e limpo do pai para o filho (sem curvas ou laços invertidos)
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    } else if (isPartyHierarchy) {
      // LINEAR: Curva de Bézier normalizada da esquerda para a direita (sempre pStart.x <= pEnd.x)
      const pStart = p1.x <= p2.x ? p1 : p2;
      const pEnd = p1.x <= p2.x ? p2 : p1;
      const dx = pEnd.x - pStart.x;
      ctx.moveTo(pStart.x, pStart.y);
      ctx.bezierCurveTo(
        pStart.x + dx * 0.45, pStart.y,
        pEnd.x - dx * 0.45, pEnd.y,
        pEnd.x, pEnd.y
      );
    } else {
      // MACRO: Linha reta límpida
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
    }

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

    ctx.globalAlpha = isNodeActive ? 1.0 : 0.15;

    // Aura ring for hovered or party center
    if (isDirectHover || (isPartyHierarchy && p.node.type === 'PARTY')) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius + 8, 0, Math.PI * 2);
      ctx.fillStyle = (p.node.type === 'PARTY') ? 'rgba(99, 102, 241, 0.28)' : 'rgba(56, 189, 248, 0.3)';
      ctx.fill();
    }

    // Outer circle
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = isDirectHover ? '#fff' : 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = isDirectHover ? 2.5 : 1.5;
    ctx.stroke();

    // Node Label
    let rawLabel = p.node.label || '';
    if (p.node.type === 'PARTY' && isPartyHierarchy) {
      rawLabel = p.node.metadata?.sigla || rawLabel;
    }
    const cleanLabel = rawLabel.length > 26 ? rawLabel.substring(0, 24) + '..' : rawLabel;

    ctx.font = isDirectHover ? '800 11.5px Plus Jakarta Sans, sans-serif' : '700 10.5px Plus Jakarta Sans, sans-serif';
    const textW = ctx.measureText(cleanLabel).width;

    if (isRadial) {
      // Posicionamento inteligente no modo Radial (evita colisões e sobreposições)
      if (p.node.type === 'PARTY') {
        const labelY = p.y + p.radius + 16;
        ctx.fillStyle = 'rgba(9, 12, 20, 0.92)';
        ctx.beginPath();
        ctx.roundRect(p.x - textW / 2 - 8, labelY - 9, textW + 16, 18, 5);
        ctx.fill();
        ctx.strokeStyle = isDirectHover ? '#38bdf8' : 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cleanLabel, p.x, labelY);
      } else {
        const cosA = Math.cos(p.angle ?? Math.atan2(p.y - cy, p.x - cx));
        const isRight = cosA >= 0;
        const labelX = isRight ? (p.x + p.radius + 8) : (p.x - p.radius - 8);
        const rectX = isRight ? labelX - 3 : labelX - textW - 9;

        ctx.fillStyle = 'rgba(8, 11, 20, 0.92)';
        ctx.beginPath();
        ctx.roundRect(rectX, p.y - 9, textW + 12, 18, 5);
        ctx.fill();
        ctx.strokeStyle = isDirectHover ? '#38bdf8' : 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = isDirectHover ? '#38bdf8' : 'rgba(255, 255, 255, 0.95)';
        ctx.textAlign = isRight ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(cleanLabel, isRight ? labelX + 3 : labelX - 3, p.y);
      }
    } else {
      // Posicionamento padrão no modo Linear e Macro (Abaixo do nó)
      const labelY = p.y + p.radius + 12;
      ctx.fillStyle = 'rgba(9, 12, 20, 0.88)';
      ctx.beginPath();
      ctx.roundRect(p.x - textW / 2 - 5, labelY - 8, textW + 10, 16, 4);
      ctx.fill();
      ctx.strokeStyle = isDirectHover ? 'rgba(56, 189, 248, 0.6)' : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = isDirectHover ? '#38bdf8' : 'rgba(255, 255, 255, 0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cleanLabel, p.x, labelY);
    }
  });

  ctx.globalAlpha = 1.0;
  ctx.restore();
}

function formatRelationLabel(rel) {
  if (rel === 'MEMBER_OF') return 'FILIADO AO';
  if (rel === 'SUBMITTED_GOVERNMENT_PLAN') return 'PLANO TSE';
  if (rel === 'ALIGNED_IN_COALITION' || rel === 'COALITION_WITH') return 'COLIGAÇÃO';
  if (rel === 'CHAPA_PRESIDENTE') return 'CHAPA PRESIDÊNCIA';
  if (rel === 'PRESIDENTE_GOVERNADOR') return 'APOIO GDF';
  if (rel === 'GOVERNADOR_SENADOR') return 'BANCADA SENADO';
  if (rel === 'SENADOR_DEP_FEDERAL') return 'CÂMARA DOS DEPUTADOS';
  if (rel === 'DEP_FEDERAL_DEP_DISTRITAL') return 'BANCADA CLDF';
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
  } else if (node.type === 'COALITION') {
    typeBadgeClass = 'badge-party';
    typeLabel = 'Coligação Partidária';
  }

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
          <div class="insp-stat-label">Cargo Pretendido</div>
          <div class="insp-stat-val" style="color: #38bdf8;">${escapeHtml(meta.cargo || 'Candidato')}</div>
        </div>
        <div class="insp-stat-item">
          <div class="insp-stat-label">Número na Urna</div>
          <div class="insp-stat-val" style="color: #f59e0b; font-weight: 800;">${escapeHtml(String(meta.nr_candidato || '—'))}</div>
        </div>
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
            ${meta.tem_proposta ? 'Protocolado TSE' : 'Não Consta'}
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
    const sigla = meta.sigla || node.label.split(' ')[0];

    const cands = state.graphData?.nodes?.filter(n => n.type === 'CANDIDATE') || [];
    const presCount = cands.filter(c => c.metadata?.cargo === 'PRESIDENTE').length;
    const govCount = cands.filter(c => c.metadata?.cargo === 'GOVERNADOR').length;
    const senCount = cands.filter(c => c.metadata?.cargo === 'SENADOR').length;
    const fedCount = cands.filter(c => c.metadata?.cargo === 'DEPUTADO FEDERAL').length;
    const distCount = cands.filter(c => c.metadata?.cargo === 'DEPUTADO DISTRITAL').length;

    statsHtml = `
      <div class="insp-stats-grid">
        <div class="insp-stat-item" style="grid-column: span 2;">
          <div class="insp-stat-label">Espectro Ideológico</div>
          <div class="insp-stat-val" style="color: #38bdf8;">${escapeHtml(meta.espectro || 'Centro')}</div>
        </div>
        <div class="insp-stat-item">
          <div class="insp-stat-label">Majoritária (Pres / GDF)</div>
          <div class="insp-stat-val" style="color: #f59e0b;">${presCount} Pres • ${govCount} Gov</div>
        </div>
        <div class="insp-stat-item">
          <div class="insp-stat-label">Legislativo (DF / Nac.)</div>
          <div class="insp-stat-val" style="color: #10b981;">${senCount} Sen • ${fedCount} Fed • ${distCount} Dist</div>
        </div>
      </div>
      <p style="font-size: 12px; color: var(--text-muted); line-height: 1.5; margin-top: 8px;">
        ${escapeHtml(meta.resumo || '')}
      </p>
    `;

    actionsHtml = `
      <button class="insp-action-btn" style="background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; margin-bottom: 8px;" onclick="selectPartyInGraph('${sigla}')">
        <span>🌿 Ver Chapa Partidária Completa (Cascata)</span>
      </button>
      <button class="insp-action-btn" style="background: var(--bg-card); border: 1px solid var(--accent-secondary);" onclick="filterByPartyFromGraph('${sigla}')">
        <span>👥 Ver Candidatos no Radar Geral</span>
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
  } else if (node.type === 'COALITION') {
    const meta = node.metadata || {};
    statsHtml = `
      <div class="insp-stats-grid">
        <div class="insp-stat-item" style="grid-column: span 2;">
          <div class="insp-stat-label">Composição Partidária</div>
          <div class="insp-stat-val" style="color: #ec4899;">${escapeHtml(meta.partidos || node.label)}</div>
        </div>
      </div>
    `;
  }

  // Connections list
  const connItems = relatedEdges.slice(0, 6).map(e => {
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
        ${connItems || '<div style="font-size: 11px; color: var(--text-subtle);">Nenhuma conexão direta listada.</div>'}
      </div>
    </div>

    ${actionsHtml}
  `;
}

function focusGraphOnNode(nodeId) {
  const node = (state.graphData?.nodes || []).find(n => n.id === nodeId);
  if (!node) return;

  if (node.type === 'PARTY') {
    const sigla = node.metadata?.sigla || node.label.split(' ')[0];
    selectPartyInGraph(sigla);
    return;
  }

  graphState.selectedNodeId = nodeId;
  showGraphNodeDetails(node);
  renderGraph();
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
