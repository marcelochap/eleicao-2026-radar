import AdmZip from 'adm-zip';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { PARTY_IDEOLOGY, getPartyIdeology } from './party_ideology.js';
import { extractAndAnalyzeProposals } from './analyze_proposals.js';

const DOCS_DIR = path.resolve('docs');
const DB_PATH = path.resolve('data', 'eleicoes_2026.db');
const GRAPH_JSON_PATH = path.resolve('data', 'graphify_knowledge_graph.json');

export async function runPipeline() {
  console.log('====================================================');
  console.log('🚀 INICIANDO PIPELINE TSE 2026 + GRAPHIFY + RAG');
  console.log('====================================================');

  if (fs.existsSync(DB_PATH)) {
    console.log('[DB] Removendo banco anterior para recriação limpa...');
    fs.unlinkSync(DB_PATH);
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA synchronous = OFF;');
  db.exec('PRAGMA journal_mode = MEMORY;');

  // Inicializa Schemas Relacionais e FTS5
  initDatabaseSchema(db);

  // 1. Processa Propostas de Governo (PDFs)
  const propostasZip = path.join(DOCS_DIR, 'proposta_governo_2026_DF.zip');
  const propostasMap = await extractAndAnalyzeProposals(propostasZip);

  // 2. Extrai Contagem de Certidões Criminais por SQ_CANDIDATO
  console.log('[Certidões] Mapeando certidões criminais do DF...');
  const certidoesMap = mapCertidoesCriminais(path.join(DOCS_DIR, 'certidao_criminal_2026_DF.zip'));
  console.log(`[Certidões] Total de candidatos com certidões mapeadas: ${Object.keys(certidoesMap).length}`);

  // 3. Extrai Redes Sociais
  console.log('[Redes Sociais] Mapeando perfis sociais...');
  const redesMap = mapRedesSociais(path.join(DOCS_DIR, 'rede_social_candidato_2026.zip'));

  // 4. Extrai Bens Declarados
  console.log('[Patrimônio] Mapeando declarações de bens...');
  db.exec('BEGIN TRANSACTION;');
  const bensMap = mapBens(path.join(DOCS_DIR, 'bem_candidato_2026.zip'), db);
  db.exec('COMMIT;');

  // 5. Extrai Prestação de Contas (Receitas e Despesas de Campanha)
  console.log('[Contas] Mapeando receitas e despesas eleitorais...');
  const contasMap = mapContas(path.join(DOCS_DIR, 'prestacao_de_contas_eleitorais_candidatos_2026.zip'));

  // 6. Extrai Histórico de Candidaturas Passadas
  console.log('[Histórico] Mapeando eleições anteriores disputadas...');
  const historicoMap = mapHistorico(path.join(DOCS_DIR, 'historico_candidatura_2026.zip'));

  // 7. Extrai Dados Complementares
  console.log('[Complementar] Mapeando dados complementares...');
  const complementarMap = mapComplementar(path.join(DOCS_DIR, 'consulta_cand_complementar_2026.zip'));

  // 8. Ingestão de Candidatos (DF + Presidente BR)
  console.log('[Candidatos] Processando registros de candidaturas...');
  const candidates = loadCandidates(path.join(DOCS_DIR, 'consulta_cand_2026.zip'));

  console.log(`[Candidatos] Inserindo ${candidates.length} candidatos no banco relacional...`);
  db.exec('BEGIN TRANSACTION;');
  const insertCandStmt = db.prepare(`
    INSERT INTO candidates (
      sq_candidato, nr_candidato, nm_candidato, nm_urna_candidato, ds_cargo,
      sg_uf, sg_partido, nm_partido, nr_partido, sg_federacao, nm_coligacao,
      dt_nascimento, ds_genero, ds_grau_instrucao, ds_estado_civil, ds_cor_raca,
      ds_ocupacao, sg_uf_nascimento, ds_situacao_candidatura,
      total_bens, qtd_bens, total_receitas, total_fundo_eleitoral, total_doacao_propria,
      total_despesas, qtd_certidoes, tem_proposta, proposta_resumo, proposta_texto_completo,
      social_links, historico_candidaturas,
      spectrum_economic, spectrum_social, spectrum_governance, spectrum_environment, spectrum_state_reform
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  const insertFtsStmt = db.prepare(`
    INSERT INTO candidates_fts (
      sq_candidato, nm_candidato, nm_urna_candidato, ds_cargo, sg_partido, nm_partido, ds_ocupacao, proposta_texto
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const graphNodes = [];
  const graphEdges = [];
  const registeredParties = new Set();
  const registeredCoalitions = new Set();

  for (const c of candidates) {
    const sq = c.SQ_CANDIDATO;
    const partidoSigla = (c.SG_PARTIDO || '').toUpperCase();
    const partyInfo = getPartyIdeology(partidoSigla);

    const candBens = bensMap[sq] || { total: 0, items: [] };
    const candContas = contasMap[sq] || { totalReceitas: 0, fundoEleitoral: 0, doacaoPropria: 0, totalDespesas: 0 };
    const candCertidoes = certidoesMap[sq] || [];
    const candRedes = redesMap[sq] || [];
    const candHist = historicoMap[sq] || [];
    const candCompl = complementarMap[sq] || {};
    const candProposta = propostasMap[sq] || null;

    // Cálculo do espectro político: base partidária + refinamento da proposta
    let specEconomic = partyInfo.economic;
    let specSocial = partyInfo.social;
    let specGov = partyInfo.governance;
    let specEnv = partyInfo.environment;
    let specReform = partyInfo.state_reform;

    if (candProposta && candProposta.stanceAdjustments) {
      specEconomic += candProposta.stanceAdjustments.deltaEconomic;
      specSocial += candProposta.stanceAdjustments.deltaSocial;
      specEconomic = Math.max(-1.0, Math.min(1.0, specEconomic));
      specSocial = Math.max(-1.0, Math.min(1.0, specSocial));
    }

    const resumoProposta = candProposta
      ? `Plano com ${candProposta.total_pages} páginas e ${candProposta.total_chars} caracteres. Pilares centrais: ${Object.entries(candProposta.pilares).filter(([_, v]) => v.mencoes > 10).map(([k]) => k).join(', ')}.`
      : null;

    insertCandStmt.run(
      sq,
      c.NR_CANDIDATO || '',
      c.NM_CANDIDATO || '',
      c.NM_URNA_CANDIDATO || '',
      c.DS_CARGO || '',
      c.SG_UF || '',
      partidoSigla,
      c.NM_PARTIDO || '',
      c.NR_PARTIDO || '',
      c.SG_FEDERACAO || '#NULO',
      c.NM_COLIGACAO || 'PARTIDO ISOLADO',
      c.DT_NASCIMENTO || '',
      c.DS_GENERO || '',
      c.DS_GRAU_INSTRUCAO || '',
      c.DS_ESTADO_CIVIL || '',
      c.DS_COR_RACA || '',
      c.DS_OCUPACAO || '',
      c.SG_UF_NASCIMENTO || '',
      c.DS_SITUACAO_CANDIDATURA || '#NE',
      candBens.total,
      candBens.items.length,
      candContas.totalReceitas,
      candContas.fundoEleitoral,
      candContas.doacaoPropria,
      candContas.totalDespesas,
      candCertidoes.length,
      candProposta ? 1 : 0,
      resumoProposta,
      candProposta ? candProposta.full_text : null,
      JSON.stringify(candRedes),
      JSON.stringify(candHist),
      specEconomic,
      specSocial,
      specGov,
      specEnv,
      specReform
    );

    insertFtsStmt.run(
      sq,
      c.NM_CANDIDATO || '',
      c.NM_URNA_CANDIDATO || '',
      c.DS_CARGO || '',
      partidoSigla,
      c.NM_PARTIDO || '',
      c.DS_OCUPACAO || '',
      candProposta ? candProposta.text_snippet : ''
    );

    // Grava Proposta detalhada na tabela dedicada
    if (candProposta) {
      db.prepare(`
        INSERT INTO candidate_proposals (
          sq_candidato, nm_urna, cargo, partido, file_name, num_paginas, num_caracteres, texto, pilares, destaques
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sq,
        c.NM_URNA_CANDIDATO,
        c.DS_CARGO,
        partidoSigla,
        candProposta.file_names.join(','),
        candProposta.total_pages,
        candProposta.total_chars,
        candProposta.full_text,
        JSON.stringify(candProposta.pilares),
        JSON.stringify(candProposta.highlights)
      );
    }

    // Grava certidões
    if (candCertidoes.length > 0) {
      const insCert = db.prepare(`INSERT INTO candidate_certidoes (sq_candidato, file_name, file_size_bytes) VALUES (?, ?, ?)`);
      for (const cert of candCertidoes) {
        insCert.run(sq, cert.fileName, cert.size);
      }
    }

    // ==========================================
    // Construção do Knowledge Graph (Graphify Standard)
    // ==========================================
    const candNodeId = `candidate:${sq}`;
    graphNodes.push({
      id: candNodeId,
      type: 'CANDIDATE',
      label: `${c.NM_URNA_CANDIDATO} (${partidoSigla})`,
      metadata: {
        sq_candidato: sq,
        nome_completo: c.NM_CANDIDATO,
        cargo: c.DS_CARGO,
        numero: c.NR_CANDIDATO,
        partido: partidoSigla,
        patrimonio: candBens.total,
        receitas_campanha: candContas.totalReceitas,
        certidoes_qtd: candCertidoes.length,
        tem_proposta: Boolean(candProposta),
        spectrum: {
          economic: specEconomic,
          social: specSocial
        }
      }
    });

    // Partido Node & Edge
    const partyNodeId = `party:${partidoSigla}`;
    if (!registeredParties.has(partidoSigla) && partidoSigla) {
      registeredParties.add(partidoSigla);
      graphNodes.push({
        id: partyNodeId,
        type: 'PARTY',
        label: `${partidoSigla} - ${c.NM_PARTIDO || partidoSigla}`,
        metadata: {
          sigla: partidoSigla,
          nome: c.NM_PARTIDO,
          espectro: partyInfo.espectro,
          resumo: partyInfo.resumo
        }
      });
    }

    graphEdges.push({
      id: `edge:${sq}_member_of_${partidoSigla}`,
      source: candNodeId,
      target: partyNodeId,
      relation: 'MEMBER_OF',
      explanation: `O candidato ${c.NM_URNA_CANDIDATO} disputa o cargo de ${c.DS_CARGO} formalmente filiado ao ${partidoSigla}.`,
      weight: 1.0
    });

    // Coligação Node & Edge
    const coligacao = c.NM_COLIGACAO || 'PARTIDO ISOLADO';
    if (coligacao !== 'PARTIDO ISOLADO' && coligacao !== '#NULO') {
      const coligacaoNodeId = `coalition:${coligacao}`;
      if (!registeredCoalitions.has(coligacao)) {
        registeredCoalitions.add(coligacao);
        graphNodes.push({
          id: coligacaoNodeId,
          type: 'COALITION',
          label: `Coligação: ${coligacao}`,
          metadata: { nome: coligacao }
        });
      }
      graphEdges.push({
        id: `edge:${sq}_coalition_${coligacao}`,
        source: candNodeId,
        target: coligacaoNodeId,
        relation: 'ALIGNED_IN_COALITION',
        explanation: `${c.NM_URNA_CANDIDATO} concorre compondo a coligação majoritária '${coligacao}'.`,
        weight: 0.8
      });
    }

    // Proposta Node & Edge
    if (candProposta) {
      const propNodeId = `proposal:${sq}`;
      graphNodes.push({
        id: propNodeId,
        type: 'GOVERNMENT_PLAN',
        label: `Plano de Governo: ${c.NM_URNA_CANDIDATO}`,
        metadata: {
          paginas: candProposta.total_pages,
          caracteres: candProposta.total_chars,
          pilares_principais: Object.keys(candProposta.pilares).filter(k => candProposta.pilares[k].mencoes > 10)
        }
      });
      graphEdges.push({
        id: `edge:${sq}_proposes_${propNodeId}`,
        source: candNodeId,
        target: propNodeId,
        relation: 'SUBMITTED_GOVERNMENT_PLAN',
        explanation: `${c.NM_URNA_CANDIDATO} protocolou no TSE plano de governo oficial para mandato 2027-2030.`,
        weight: 1.0
      });
    }

    // Bens Relevantes Node & Edge (se > R$ 500k)
    if (candBens.total > 500000) {
      const assetNodeId = `assets:${sq}`;
      graphNodes.push({
        id: assetNodeId,
        type: 'DECLARED_ASSETS',
        label: `Patrimônio R$ ${(candBens.total / 1000000).toFixed(2)}M`,
        metadata: { total: candBens.total, itens: candBens.items.length }
      });
      graphEdges.push({
        id: `edge:${sq}_owns_${assetNodeId}`,
        source: candNodeId,
        target: assetNodeId,
        relation: 'DECLARED_ASSETS',
        explanation: `${c.NM_URNA_CANDIDATO} declarou à Justiça Eleitoral R$ ${candBens.total.toLocaleString('pt-BR')} em ${candBens.items.length} bens.`,
        weight: 0.9
      });
    }

    // Certidões Criminais Edge
    if (candCertidoes.length > 0) {
      const certNodeId = `certidoes:${sq}`;
      graphNodes.push({
        id: certNodeId,
        type: 'CRIMINAL_CERTIFICATES',
        label: `${candCertidoes.length} Certidões Criminais`,
        metadata: { quantidade: candCertidoes.length }
      });
      graphEdges.push({
        id: `edge:${sq}_cert_${certNodeId}`,
        source: candNodeId,
        target: certNodeId,
        relation: 'SUBMITTED_CRIMINAL_RECORDS',
        explanation: `${c.NM_URNA_CANDIDATO} anexou ${candCertidoes.length} certidões judiciais de antecedentes criminais ao TRE-DF.`,
        weight: 0.7
      });
    }
  }
  db.exec('COMMIT;');

  // 9. Ingestão de Processos Eleitorais
  console.log('[Processos] Ingerindo processos eleitorais registrados...');
  loadProcessosEleitorais(path.join(DOCS_DIR, 'processo_eleitoral_2026.zip'), db);

  // 10. Persistência do Grafo Graphify
  console.log(`[Graphify] Gravando grafo com ${graphNodes.length} nós e ${graphEdges.length} arestas explicadas...`);
  const graphData = {
    schemaVersion: '1.0.0',
    description: 'Knowledge Graph determinístico das Eleições 2026 - Conexões entre Candidatos, Partidos, Propostas e Registros Públicos',
    generatedAt: new Date().toISOString(),
    stats: {
      totalNodes: graphNodes.length,
      totalEdges: graphEdges.length,
      totalCandidates: candidates.length,
      totalParties: registeredParties.size
    },
    nodes: graphNodes,
    edges: graphEdges
  };

  fs.writeFileSync(GRAPH_JSON_PATH, JSON.stringify(graphData, null, 2), 'utf-8');

  // Grava tabela de Partidos com resumo consolidado
  const insertPartyStmt = db.prepare(`
    INSERT INTO parties (nr_partido, sg_partido, nm_partido, espectro_estimado, spectrum_economic, spectrum_social, spectrum_governance, resumo_ideologico, total_candidatos)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const sigla of registeredParties) {
    const info = getPartyIdeology(sigla);
    const countRow = db.prepare(`SELECT count(*) as c FROM candidates WHERE sg_partido = ?`).get(sigla);
    insertPartyStmt.run(
      sigla,
      sigla,
      sigla,
      info.espectro,
      info.economic,
      info.social,
      info.governance,
      info.resumo,
      countRow?.c || 0
    );
  }

  console.log('====================================================');
  console.log('✅ BASE DE DADOS E GRAFO GERADOS COM SUCESSO!');
  console.log(`📁 Banco SQLite: ${DB_PATH}`);
  console.log(`📁 Grafo Graphify: ${GRAPH_JSON_PATH}`);
  console.log(`📊 Candidatos inseridos: ${candidates.length}`);
  console.log('====================================================');
}

function initDatabaseSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS candidates (
      sq_candidato TEXT PRIMARY KEY,
      nr_candidato TEXT,
      nm_candidato TEXT,
      nm_urna_candidato TEXT,
      ds_cargo TEXT,
      sg_uf TEXT,
      sg_partido TEXT,
      nm_partido TEXT,
      nr_partido TEXT,
      sg_federacao TEXT,
      nm_coligacao TEXT,
      dt_nascimento TEXT,
      ds_genero TEXT,
      ds_grau_instrucao TEXT,
      ds_estado_civil TEXT,
      ds_cor_raca TEXT,
      ds_ocupacao TEXT,
      sg_uf_nascimento TEXT,
      ds_situacao_candidatura TEXT,
      total_bens REAL DEFAULT 0,
      qtd_bens INTEGER DEFAULT 0,
      total_receitas REAL DEFAULT 0,
      total_fundo_eleitoral REAL DEFAULT 0,
      total_doacao_propria REAL DEFAULT 0,
      total_despesas REAL DEFAULT 0,
      qtd_certidoes INTEGER DEFAULT 0,
      tem_proposta INTEGER DEFAULT 0,
      proposta_resumo TEXT,
      proposta_texto_completo TEXT,
      social_links TEXT,
      historico_candidaturas TEXT,
      spectrum_economic REAL DEFAULT 0,
      spectrum_social REAL DEFAULT 0,
      spectrum_governance REAL DEFAULT 0,
      spectrum_environment REAL DEFAULT 0,
      spectrum_state_reform REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS candidate_assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sq_candidato TEXT,
      nr_ordem INTEGER,
      tipo_bem TEXT,
      descricao TEXT,
      valor REAL
    );

    CREATE TABLE IF NOT EXISTS candidate_proposals (
      sq_candidato TEXT PRIMARY KEY,
      nm_urna TEXT,
      cargo TEXT,
      partido TEXT,
      file_name TEXT,
      num_paginas INTEGER,
      num_caracteres INTEGER,
      texto TEXT,
      pilares TEXT,
      destaques TEXT
    );

    CREATE TABLE IF NOT EXISTS candidate_certidoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sq_candidato TEXT,
      file_name TEXT,
      file_size_bytes INTEGER
    );

    CREATE TABLE IF NOT EXISTS parties (
      nr_partido TEXT PRIMARY KEY,
      sg_partido TEXT,
      nm_partido TEXT,
      espectro_estimado TEXT,
      spectrum_economic REAL,
      spectrum_social REAL,
      spectrum_governance REAL,
      resumo_ideologico TEXT,
      total_candidatos INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS electoral_lawsuits (
      nr_processo TEXT PRIMARY KEY,
      sg_uf TEXT,
      nr_instancia INTEGER,
      dt_autuacao TEXT,
      ds_classe TEXT,
      ds_assunto TEXT,
      nm_relator TEXT,
      tp_ultima_decisao TEXT,
      url_processo TEXT
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS candidates_fts USING fts5(
      sq_candidato, nm_candidato, nm_urna_candidato, ds_cargo, sg_partido, nm_partido, ds_ocupacao, proposta_texto
    );
  `);
}

function loadCandidates(zipPath) {
  const zip = new AdmZip(zipPath);
  const candidates = [];

  // Carrega DF e BR (Presidente)
  const targetFiles = ['consulta_cand_2026_DF.csv', 'consulta_cand_2026_BR.csv'];
  for (const fn of targetFiles) {
    const entry = zip.getEntry(fn);
    if (!entry) continue;
    const text = entry.getData().toString('latin1');
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    const headers = lines[0].split(';').map(h => h.replace(/^"|"$/g, ''));

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(';').map(p => p.replace(/^"|"$/g, ''));
      const row = {};
      headers.forEach((h, idx) => { row[h] = parts[idx]; });
      candidates.push(row);
    }
  }

  return candidates;
}

function mapCertidoesCriminais(zipPath) {
  const map = {};
  if (!fs.existsSync(zipPath)) return map;

  const zip = new AdmZip(zipPath);
  for (const entry of zip.getEntries()) {
    if (!entry.entryName.endsWith('.pdf')) continue;
    const match = entry.entryName.match(/7000\d+/);
    if (match) {
      const sq = match[0];
      if (!map[sq]) map[sq] = [];
      map[sq].push({
        fileName: path.basename(entry.entryName),
        size: entry.header.size
      });
    }
  }
  return map;
}

function mapRedesSociais(zipPath) {
  const map = {};
  if (!fs.existsSync(zipPath)) return map;

  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry('rede_social_candidato_2026_DF.csv');
  if (!entry) return map;

  const lines = entry.getData().toString('latin1').split('\n').filter(l => l.trim().length > 0);
  const headers = lines[0].split(';').map(h => h.replace(/^"|"$/g, ''));
  const sqIdx = headers.indexOf('SQ_CANDIDATO');
  const urlIdx = headers.indexOf('DS_URL');

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';').map(p => p.replace(/^"|"$/g, ''));
    const sq = parts[sqIdx];
    const url = parts[urlIdx];
    if (sq && url && !url.includes('#NULO')) {
      if (!map[sq]) map[sq] = [];
      map[sq].push(url);
    }
  }
  return map;
}

function mapBens(zipPath, db) {
  const map = {};
  if (!fs.existsSync(zipPath)) return map;

  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry('bem_candidato_2026_DF.csv');
  if (!entry) return map;

  const lines = entry.getData().toString('latin1').split('\n').filter(l => l.trim().length > 0);
  const headers = lines[0].split(';').map(h => h.replace(/^"|"$/g, ''));
  const sqIdx = headers.indexOf('SQ_CANDIDATO');
  const tipoIdx = headers.indexOf('DS_TIPO_BEM_CANDIDATO');
  const descIdx = headers.indexOf('DS_BEM_CANDIDATO');
  const valorIdx = headers.indexOf('VR_BEM_CANDIDATO');
  const ordemIdx = headers.indexOf('NR_ORDEM_BEM_CANDIDATO');

  const insertAssetStmt = db.prepare(`
    INSERT INTO candidate_assets (sq_candidato, nr_ordem, tipo_bem, descricao, valor)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';').map(p => p.replace(/^"|"$/g, ''));
    const sq = parts[sqIdx];
    if (!sq) continue;

    const tipo = parts[tipoIdx] || '';
    const desc = parts[descIdx] || '';
    const valorStr = (parts[valorIdx] || '0').replace(',', '.');
    const valor = parseFloat(valorStr) || 0;
    const ordem = parseInt(parts[ordemIdx] || '1', 10);

    if (!map[sq]) map[sq] = { total: 0, items: [] };
    map[sq].total += valor;
    map[sq].items.push({ tipo, desc, valor });

    insertAssetStmt.run(sq, ordem, tipo, desc, valor);
  }

  return map;
}

function mapContas(zipPath) {
  const map = {};
  if (!fs.existsSync(zipPath)) return map;

  const zip = new AdmZip(zipPath);
  const recEntry = zip.getEntries().find(e => e.entryName.includes('receitas_candidatos_2026_DF.csv'));

  if (recEntry) {
    const lines = recEntry.getData().toString('latin1').split('\n').filter(l => l.trim().length > 0);
    const headers = lines[0].split(';').map(h => h.replace(/^"|"$/g, ''));
    const sqIdx = headers.indexOf('SQ_CANDIDATO');
    const valorIdx = headers.indexOf('VR_RECEITA');
    const fonteIdx = headers.indexOf('DS_FONTE_RECEITA');
    const origemIdx = headers.indexOf('DS_ORIGEM_RECEITA');

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(';').map(p => p.replace(/^"|"$/g, ''));
      const sq = parts[sqIdx];
      if (!sq) continue;

      const valor = parseFloat((parts[valorIdx] || '0').replace(',', '.')) || 0;
      const fonte = parts[fonteIdx] || '';
      const origem = parts[origemIdx] || '';

      if (!map[sq]) {
        map[sq] = { totalReceitas: 0, fundoEleitoral: 0, doacaoPropria: 0, totalDespesas: 0 };
      }

      map[sq].totalReceitas += valor;
      if (fonte.includes('FUNDO ESPECIAL') || fonte.includes('FUNDO PARTIDÁRIO') || origem.includes('partido')) {
        map[sq].fundoEleitoral += valor;
      }
      if (origem.includes('Recursos próprios')) {
        map[sq].doacaoPropria += valor;
      }
    }
  }

  return map;
}

function mapHistorico(zipPath) {
  const map = {};
  if (!fs.existsSync(zipPath)) return map;

  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry('historico_candidatura_2026_DF.csv');
  if (!entry) return map;

  const lines = entry.getData().toString('latin1').split('\n').filter(l => l.trim().length > 0);
  const headers = lines[0].split(';').map(h => h.replace(/^"|"$/g, ''));
  const sqAtualIdx = headers.indexOf('SQ_CANDIDATO_ATUAL');
  const anoIdx = headers.indexOf('ANO_ELEICAO');
  const cargoIdx = headers.indexOf('DS_CARGO');
  const eleicaoIdx = headers.indexOf('DS_ELEICAO');

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';').map(p => p.replace(/^"|"$/g, ''));
    const sqAtual = parts[sqAtualIdx];
    if (!sqAtual) continue;

    if (!map[sqAtual]) map[sqAtual] = [];
    map[sqAtual].push({
      ano: parts[anoIdx],
      cargo: parts[cargoIdx],
      eleicao: parts[eleicaoIdx]
    });
  }

  return map;
}

function mapComplementar(zipPath) {
  const map = {};
  if (!fs.existsSync(zipPath)) return map;

  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry('consulta_cand_complementar_2026_DF.csv');
  if (!entry) return map;

  const lines = entry.getData().toString('latin1').split('\n').filter(l => l.trim().length > 0);
  const headers = lines[0].split(';').map(h => h.replace(/^"|"$/g, ''));
  const sqIdx = headers.indexOf('SQ_CANDIDATO');
  const reeleicaoIdx = headers.indexOf('ST_REELEICAO');
  const processoIdx = headers.indexOf('NR_PROCESSO');
  const julgamentoIdx = headers.indexOf('DS_SITUACAO_JULGAMENTO');

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';').map(p => p.replace(/^"|"$/g, ''));
    const sq = parts[sqIdx];
    if (!sq) continue;

    map[sq] = {
      reeleicao: parts[reeleicaoIdx] === 'S',
      processoJudicial: parts[processoIdx],
      situacaoJulgamento: parts[julgamentoIdx]
    };
  }

  return map;
}

function loadProcessosEleitorais(zipPath, db) {
  if (!fs.existsSync(zipPath)) return;

  const zip = new AdmZip(zipPath);
  const entry = zip.getEntry('processo_eleitoral_2026.csv');
  if (!entry) return;

  const lines = entry.getData().toString('latin1').split('\n').filter(l => l.trim().length > 0);
  const headers = lines[0].split(';').map(h => h.replace(/^"|"$/g, ''));
  const nrIdx = headers.indexOf('NR_PROCESSO');
  const ufIdx = headers.indexOf('SG_UF_TRIBUNAL');
  const instIdx = headers.indexOf('NR_INSTANCIA');
  const autIdx = headers.indexOf('DT_AUTUACAO');
  const classeIdx = headers.indexOf('DS_CLASSE');
  const assuntoIdx = headers.indexOf('DS_ASSUNTO_PRINCIPAL');
  const relatorIdx = headers.indexOf('NM_RELATOR');
  const decIdx = headers.indexOf('TP_ULTIMA_DECISAO');
  const urlIdx = headers.indexOf('DS_URL_PROCESSO');

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO electoral_lawsuits (
      nr_processo, sg_uf, nr_instancia, dt_autuacao, ds_classe, ds_assunto, nm_relator, tp_ultima_decisao, url_processo
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  db.exec('BEGIN TRANSACTION;');
  // Processa DF e processos relevantes
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';').map(p => p.replace(/^"|"$/g, ''));
    const nr = parts[nrIdx];
    if (!nr) continue;

    insertStmt.run(
      nr,
      parts[ufIdx] || '',
      parseInt(parts[instIdx] || '1', 10),
      parts[autIdx] || '',
      parts[classeIdx] || '',
      parts[assuntoIdx] || '',
      parts[relatorIdx] || '',
      parts[decIdx] || '',
      parts[urlIdx] || ''
    );
    count++;
  }
  db.exec('COMMIT;');

  console.log(`[Processos] ${count} processos eleitorais carregados.`);
}

// Execução direta
if (process.argv[1].endsWith('extract_tse.js')) {
  runPipeline().catch(console.error);
}
