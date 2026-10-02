import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'eleicoes_2026.db');

let _dbInstance = null;

export function getDatabase() {
  if (!_dbInstance) {
    _dbInstance = new DatabaseSync(DB_PATH, { readOnly: true });
  }
  return _dbInstance;
}

export function searchPolitician(query, options = {}) {
  const db = getDatabase();
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) return { candidates: [], parties: [] };

  // 1. Busca direta por nome ou número
  const directCandidates = db.prepare(`
    SELECT * FROM candidates 
    WHERE nm_urna_candidato LIKE ? 
       OR nm_candidato LIKE ? 
       OR nr_candidato = ?
       OR sq_candidato = ?
    ORDER BY CASE WHEN ds_cargo = 'GOVERNADOR' THEN 1 WHEN ds_cargo = 'PRESIDENTE' THEN 2 WHEN ds_cargo = 'SENADOR' THEN 3 ELSE 4 END
    LIMIT 10
  `).all(`%${cleanQuery}%`, `%${cleanQuery}%`, cleanQuery, cleanQuery);

  // 2. Se não encontrar, tenta via FTS5
  let candidates = directCandidates;
  if (candidates.length === 0) {
    try {
      const ftsResults = db.prepare(`
        SELECT c.* FROM candidates_fts fts
        JOIN candidates c ON c.sq_candidato = fts.sq_candidato
        WHERE candidates_fts MATCH ?
        LIMIT 10
      `).all(`${cleanQuery}*`);
      candidates = ftsResults;
    } catch {
      // fallback
    }
  }

  // 3. Busca por Partido
  const parties = db.prepare(`
    SELECT p.*, count(c.sq_candidato) as total_candidatos_base
    FROM parties p
    LEFT JOIN candidates c ON c.sg_partido = p.sg_partido
    WHERE p.sg_partido LIKE ? OR p.nm_partido LIKE ?
    GROUP BY p.sg_partido
    LIMIT 5
  `).all(`%${cleanQuery}%`, `%${cleanQuery}%`);

  return {
    query: cleanQuery,
    candidates: candidates.map(c => enrichCandidateDossier(c, db)),
    parties
  };
}

export function getCandidateById(sqCandidato) {
  const db = getDatabase();
  const candidate = db.prepare(`SELECT * FROM candidates WHERE sq_candidato = ?`).get(sqCandidato);
  if (!candidate) return null;
  return enrichCandidateDossier(candidate, db);
}

export function getAllCandidates(filters = {}) {
  const db = getDatabase();
  let sql = `SELECT * FROM candidates WHERE 1=1`;
  const params = [];

  if (filters.cargo) {
    sql += ` AND ds_cargo = ?`;
    params.push(filters.cargo);
  }
  if (filters.partido) {
    sql += ` AND sg_partido = ?`;
    params.push(filters.partido.toUpperCase());
  }
  if (filters.uf) {
    sql += ` AND sg_uf = ?`;
    params.push(filters.uf.toUpperCase());
  }
  if (filters.temProposta === true) {
    sql += ` AND tem_proposta = 1`;
  }
  if (filters.minPatrimonio !== undefined) {
    sql += ` AND total_bens >= ?`;
    params.push(Number(filters.minPatrimonio));
  }
  if (filters.maxPatrimonio !== undefined) {
    sql += ` AND total_bens <= ?`;
    params.push(Number(filters.maxPatrimonio));
  }

  // Ordenação
  if (filters.orderBy === 'patrimonio') {
    sql += ` ORDER BY total_bens DESC`;
  } else if (filters.orderBy === 'receitas') {
    sql += ` ORDER BY total_receitas DESC`;
  } else {
    sql += ` ORDER BY CASE WHEN ds_cargo = 'PRESIDENTE' THEN 1 WHEN ds_cargo = 'GOVERNADOR' THEN 2 WHEN ds_cargo = 'SENADOR' THEN 3 WHEN ds_cargo = 'DEPUTADO FEDERAL' THEN 4 ELSE 5 END, nm_urna_candidato ASC`;
  }

  const limit = Math.min(filters.limit || 50, 200);
  sql += ` LIMIT ${limit}`;

  const candidates = db.prepare(sql).all(...params);
  return candidates.map(c => enrichCandidateDossier(c, db, false));
}

function enrichCandidateDossier(c, db, includeFullAssets = true) {
  const sq = c.sq_candidato;

  // Bens detalhados
  const assets = includeFullAssets ? db.prepare(`
    SELECT tipo_bem, descricao, valor 
    FROM candidate_assets 
    WHERE sq_candidato = ? 
    ORDER BY valor DESC
  `).all(sq) : [];

  // Proposta estruturada
  const proposta = db.prepare(`
    SELECT file_name, num_paginas, num_caracteres, pilares, destaques 
    FROM candidate_proposals 
    WHERE sq_candidato = ?
  `).get(sq);

  let pilares = null;
  let destaques = [];
  if (proposta) {
    try { pilares = JSON.parse(proposta.pilares); } catch {}
    try { destaques = JSON.parse(proposta.destaques); } catch {}
  }

  // Certidões criminais
  const certidoes = db.prepare(`
    SELECT file_name, file_size_bytes 
    FROM candidate_certidoes 
    WHERE sq_candidato = ?
  `).all(sq);

  // Redes sociais
  let redes = [];
  try { redes = JSON.parse(c.social_links || '[]'); } catch {}

  // Histórico eleitoral
  let historico = [];
  try { historico = JSON.parse(c.historico_candidaturas || '[]'); } catch {}

  const percentFundoEleitoral = c.total_receitas > 0 ? (c.total_fundo_eleitoral / c.total_receitas) * 100 : 0;
  const percentRecursosProprios = c.total_receitas > 0 ? (c.total_doacao_propria / c.total_receitas) * 100 : 0;

  return {
    identificacao: {
      sq_candidato: c.sq_candidato,
      numero: c.nr_candidato,
      nome_urna: c.nm_urna_candidato,
      nome_completo: c.nm_candidato,
      cargo: c.ds_cargo,
      uf: c.sg_uf,
      partido: c.sg_partido,
      nome_partido: c.nm_partido,
      federacao: c.sg_federacao,
      coligacao: c.nm_coligacao,
      situacao_candidatura: c.ds_situacao_candidatura,
      ocupacao: c.ds_ocupacao,
      grau_instrucao: c.ds_grau_instrucao,
      genero: c.ds_genero,
      raca_cor: c.ds_cor_raca,
      data_nascimento: c.dt_nascimento,
      uf_nascimento: c.sg_uf_nascimento
    },
    espectro_politico: {
      economico: c.spectrum_economic,
      social: c.spectrum_social,
      governanca: c.spectrum_governance,
      meio_ambiente: c.spectrum_environment,
      reforma_estado: c.spectrum_state_reform,
      posicao_geral: inferSpectrumLabel(c.spectrum_economic, c.spectrum_social)
    },
    plano_governo: {
      tem_proposta: Boolean(c.tem_proposta),
      num_paginas: proposta?.num_paginas || 0,
      resumo: c.proposta_resumo,
      pilares: pilares,
      destaques: destaques
    },
    patrimonio: {
      total_bens: c.total_bens,
      total_bens_formatado: `R$ ${c.total_bens.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      qtd_itens: c.qtd_bens,
      principais_bens: assets.slice(0, 5)
    },
    financiamento_campanha: {
      total_receitas: c.total_receitas,
      total_fundo_eleitoral: c.total_fundo_eleitoral,
      percentual_fundo_eleitoral: `${percentFundoEleitoral.toFixed(1)}%`,
      total_recursos_proprios: c.total_doacao_propria,
      percentual_recursos_proprios: `${percentRecursosProprios.toFixed(1)}%`,
      total_despesas_pagas: c.total_despesas
    },
    integridade_e_judicial: {
      total_certidoes_criminais: c.qtd_certidoes,
      certidoes: certidoes.map(cert => ({
        arquivo: cert.file_name,
        tamanho_kb: (cert.file_size_bytes / 1024).toFixed(1)
      }))
    },
    historico_eleitoral: historico,
    redes_sociais: redes
  };
}

function inferSpectrumLabel(econ, soc) {
  let econLabel = 'Centro';
  if (econ <= -0.4) econLabel = 'Esquerda';
  else if (econ < -0.15) econLabel = 'Centro-Esquerda';
  else if (econ >= 0.4) econLabel = 'Direita';
  else if (econ > 0.15) econLabel = 'Centro-Direita';

  let socLabel = 'Moderado';
  if (soc <= -0.3) socLabel = 'Progressista';
  else if (soc >= 0.3) socLabel = 'Conservador';

  return `${econLabel} (${socLabel})`;
}
