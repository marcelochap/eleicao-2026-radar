import fs from 'fs';
import path from 'path';
import { getDatabase } from '../rag/search.js';

const questionsPath = path.resolve('src', 'questionnaire', 'questions.json');
export const QUESTIONS = JSON.parse(fs.readFileSync(questionsPath, 'utf-8'));

/**
 * Calcula o alinhamento político com base nas respostas do usuário
 * @param {Object} userAnswers - Mapeamento { question_id: option_id (ex: 'a', 'b', 'c', 'd', 'e') }
 * @param {Object} customWeights - Pesos customizados { economic: 1.0, social: 1.0, governance: 1.0 }
 */
export function calculateAlignment(userAnswers, customWeights = {}) {
  const weights = {
    economic: customWeights.economic ?? 1.0,
    social: customWeights.social ?? 1.0,
    governance: customWeights.governance ?? 1.0
  };

  let sumEconomic = 0, countEconomic = 0;
  let sumSocial = 0, countSocial = 0;
  let sumGov = 0, countGov = 0;

  for (const q of QUESTIONS) {
    const selectedOptionId = userAnswers[q.id];
    if (!selectedOptionId) continue;

    const opt = q.opcoes.find(o => o.id === selectedOptionId);
    if (!opt) continue;

    if (q.eixo === 'economic') {
      sumEconomic += opt.valor;
      countEconomic++;
    } else if (q.eixo === 'social') {
      sumSocial += opt.valor;
      countSocial++;
    } else if (q.eixo === 'governance') {
      sumGov += opt.valor;
      countGov++;
    }
  }

  const userEconomic = countEconomic > 0 ? (sumEconomic / countEconomic) : 0;
  const userSocial = countSocial > 0 ? (sumSocial / countSocial) : 0;
  const userGov = countGov > 0 ? (sumGov / countGov) : 0;

  const userProfile = {
    economic: parseFloat(userEconomic.toFixed(2)),
    social: parseFloat(userSocial.toFixed(2)),
    governance: parseFloat(userGov.toFixed(2)),
    quadrant: determineQuadrant(userEconomic, userSocial),
    description: getQuadrantDescription(userEconomic, userSocial)
  };

  // Carrega candidatos do banco de dados
  const db = getDatabase();
  const allCandidates = db.prepare(`
    SELECT sq_candidato, nr_candidato, nm_urna_candidato, nm_candidato, ds_cargo, sg_partido, nm_coligacao,
           ds_genero, ds_cor_raca, ds_ocupacao,
           spectrum_economic, spectrum_social, spectrum_governance, tem_proposta, total_bens,
           total_receitas, total_fundo_eleitoral, qtd_certidoes
    FROM candidates
    ORDER BY CASE WHEN ds_cargo = 'GOVERNADOR' THEN 1 WHEN ds_cargo = 'PRESIDENTE' THEN 2 ELSE 3 END
  `).all();

  // Calcula distância e fit para cada candidato
  // Distância máxima possível no espaço 3D normalizado com pesos: sqrt(wE*4 + wS*4 + wG*4)
  const maxDistance = Math.sqrt(weights.economic * 4 + weights.social * 4 + weights.governance * 4);

  const candidateRankings = allCandidates.map(c => {
    const dE = userEconomic - c.spectrum_economic;
    const dS = userSocial - c.spectrum_social;
    const dG = userGov - c.spectrum_governance;

    const distSquared = weights.economic * (dE * dE) + weights.social * (dS * dS) + weights.governance * (dG * dG);
    const dist = Math.sqrt(distSquared);

    let fitPercentage = Math.round(Math.max(0, Math.min(100, (1 - (dist / maxDistance)) * 100)));

    return {
      sq_candidato: c.sq_candidato,
      numero: c.nr_candidato,
      nome_urna: c.nm_urna_candidato,
      nome_completo: c.nm_candidato,
      cargo: c.ds_cargo,
      partido: c.sg_partido,
      coligacao: c.nm_coligacao,
      genero: c.ds_genero || 'NÃO INFORMADO',
      cor_raca: c.ds_cor_raca || 'NÃO INFORMADO',
      ocupacao: c.ds_ocupacao || '',
      fit_percentage: fitPercentage,
      spectrum: {
        economic: c.spectrum_economic,
        social: c.spectrum_social
      },
      tem_proposta: Boolean(c.tem_proposta),
      patrimonio: c.total_bens,
      fundo_eleitoral: c.total_fundo_eleitoral,
      certidoes: c.qtd_certidoes
    };
  });

  candidateRankings.sort((a, b) => b.fit_percentage - a.fit_percentage);

  // Calcula Fit Partidário Agregado
  const parties = db.prepare(`SELECT * FROM parties`).all();
  const partyRankings = parties.map(p => {
    const dE = userEconomic - p.spectrum_economic;
    const dS = userSocial - p.spectrum_social;
    const dG = userGov - (p.spectrum_governance || 0);

    const dist = Math.sqrt(weights.economic * (dE * dE) + weights.social * (dS * dS) + weights.governance * (dG * dG));
    const fit = Math.round(Math.max(0, Math.min(100, (1 - (dist / maxDistance)) * 100)));

    return {
      sigla: p.sg_partido,
      nome: p.nm_partido,
      espectro: p.espectro_estimado,
      fit_percentage: fit,
      spectrum: {
        economic: p.spectrum_economic,
        social: p.spectrum_social
      },
      resumo: p.resumo_ideologico
    };
  }).sort((a, b) => b.fit_percentage - a.fit_percentage);

  // Agrupamento Top por Cargo
  const topByCargo = {
    'PRESIDENTE': candidateRankings.filter(c => c.cargo === 'PRESIDENTE').slice(0, 10),
    'GOVERNADOR': candidateRankings.filter(c => c.cargo === 'GOVERNADOR').slice(0, 10),
    'SENADOR': candidateRankings.filter(c => c.cargo === 'SENADOR').slice(0, 10),
    'DEPUTADO FEDERAL': candidateRankings.filter(c => c.cargo === 'DEPUTADO FEDERAL').slice(0, 10),
    'DEPUTADO DISTRITAL': candidateRankings.filter(c => c.cargo === 'DEPUTADO DISTRITAL').slice(0, 10)
  };

  return {
    userProfile,
    topCandidates: candidateRankings.slice(0, 15),
    topParties: partyRankings.slice(0, 8),
    topByCargo,
    allCandidatesRanked: candidateRankings
  };
}

function determineQuadrant(econ, soc) {
  if (econ >= 0.1 && soc >= 0.1) return 'Direita Conservadora';
  if (econ >= 0.1 && soc < 0.1) return 'Direita Liberal';
  if (econ < -0.1 && soc >= 0.1) return 'Esquerda Conservadora / Tradicionalista';
  if (econ < -0.1 && soc < -0.1) return 'Esquerda Progressista';
  return 'Centro Democrático';
}

function getQuadrantDescription(econ, soc) {
  if (econ >= 0.2 && soc >= 0.2) {
    return 'Defesa da livre iniciativa, desregulamentação da economia e preservação dos valores morais tradicionais da família.';
  }
  if (econ >= 0.2 && soc < -0.1) {
    return 'Liberalismo de mercado com respeito às liberdades individuais, secularismo e autonomia de escolha dos cidadãos.';
  }
  if (econ < -0.2 && soc < -0.2) {
    return 'Social-democracia ou socialismo: papel indutor e protetor do Estado na economia, distribuição de renda e vanguarda em direitos civis.';
  }
  if (econ < -0.2 && soc >= 0.1) {
    return 'Trabalhismo clássico: proteção ao trabalhador e soberania nacional, com respeito à religiosidade e costumes populares.';
  }
  return 'Equilíbrio pragmático: reformas graduais com moderação fiscal aliadas à preservação de redes essenciais de proteção social.';
}
