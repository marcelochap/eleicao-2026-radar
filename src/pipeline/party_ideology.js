/**
 * Referência ideológica e programática dos partidos políticos brasileiros (Eleições 2026)
 * Baseado em estudos de ciência política (DIAP, V-Dem, CESOP/Unicamp, Oxford Handbook of Brazilian Politics)
 * Escalas de -1.0 (Esquerda / Intervencionismo / Progressismo) a +1.0 (Direita / Mercado Livre / Conservadorismo)
 */

export const PARTY_IDEOLOGY = {
  // Esquerda e Extrema-Esquerda
  'PSTU': {
    espectro: 'Extrema-Esquerda',
    economic: -1.0,   // Estatização total, controle operário, anti-imperialismo
    social: -0.7,     // Defesa das liberdades e direitos da classe trabalhadora
    governance: -0.8, // Ruptura revolucionária com o sistema burguês
    environment: -0.5,
    state_reform: -0.9,
    resumo: 'Socialismo revolucionário, estatização de grandes empresas, não pagamento da dívida pública.'
  },
  'PCO': {
    espectro: 'Extrema-Esquerda',
    economic: -1.0,
    social: -0.5,
    governance: -0.9,
    environment: -0.4,
    state_reform: -0.9,
    resumo: 'Comunismo trotskista, defesa do armamento popular, soberania nacional contra o capital financeiro.'
  },
  'PCB': {
    espectro: 'Extrema-Esquerda',
    economic: -0.95,
    social: -0.8,
    governance: -0.8,
    environment: -0.6,
    state_reform: -0.9,
    resumo: 'Comunismo marxista-leninista, controle estatal dos meios de produção, reforma agrária radical.'
  },
  'UP': {
    espectro: 'Esquerda Socialista',
    economic: -0.9,
    social: -0.85,
    governance: -0.7,
    environment: -0.7,
    state_reform: -0.8,
    resumo: 'Poder popular, estatização de setores estratégicos, auditoria da dívida, moradia digna.'
  },
  'PSOL': {
    espectro: 'Esquerda',
    economic: -0.8,
    social: -0.95, // Vanguarda progressista em pautas de costumes, direitos reprodutivos, LGBTQIA+
    governance: -0.5,
    environment: -0.9, // Ecossocialismo
    state_reform: -0.7,
    resumo: 'Socialismo democrático, combate às desigualdades, direitos civis progressistas e justiça climática.'
  },
  'PT': {
    espectro: 'Centro-Esquerda à Esquerda',
    economic: -0.65, // Desenvolvimentismo, fortalecimento de estatais (Petrobras, BNDES), programas de transferência de renda
    social: -0.7,
    governance: -0.3,
    environment: -0.7,
    state_reform: -0.5,
    resumo: 'Social-democracia / Desenvolvimentismo, combate à fome, valorização do salário mínimo e fortalecimento do SUS.'
  },
  'PCdoB': {
    espectro: 'Esquerda',
    economic: -0.75,
    social: -0.7,
    governance: -0.4,
    environment: -0.6,
    state_reform: -0.6,
    resumo: 'Soberania nacional, desenvolvimento liderado pelo Estado, aliança com movimentos sindicais.'
  },
  'PSB': {
    espectro: 'Centro-Esquerda',
    economic: -0.45,
    social: -0.6,
    governance: -0.1,
    environment: -0.6,
    state_reform: -0.3,
    resumo: 'Socialismo democrático moderno, incentivo à inovação e tecnologia com forte rede de proteção social.'
  },
  'PDT': {
    espectro: 'Centro-Esquerda',
    economic: -0.55, // Trabalhismo, nacional-desenvolvimentismo getulista/brizolista
    social: -0.5,
    governance: -0.2,
    environment: -0.5,
    state_reform: -0.4,
    resumo: 'Trabalhismo, educação integral como motor de desenvolvimento, soberania nacional e proteção da indústria.'
  },
  'REDE': {
    espectro: 'Centro-Esquerda Sustentável',
    economic: -0.3,
    social: -0.7,
    governance: -0.3,
    environment: -1.0, // Prioridade máxima ambiental
    state_reform: -0.2,
    resumo: 'Sustentabilidade ambiental radical, economia verde, transparência e defesa intransigente do meio ambiente.'
  },
  'PV': {
    espectro: 'Centro-Esquerda Verde',
    economic: -0.3,
    social: -0.6,
    governance: -0.2,
    environment: -0.9,
    state_reform: -0.2,
    resumo: 'Ecologismo, descarbonização da economia, qualidade de vida urbana e direitos humanos.'
  },

  // Centro e Centro Pragmatista (Centrão e Tradicionais)
  'MDB': {
    espectro: 'Centro',
    economic: 0.1,  // Pragmático, oscila entre reformas fiscais e manutenção de emendas
    social: 0.0,
    governance: 0.1,
    environment: 0.0,
    state_reform: 0.1,
    resumo: 'Partido tradicional de centro, municipalista, governista e pragmático nas negociações federativas.'
  },
  'PSD': {
    espectro: 'Centro à Centro-Direita',
    economic: 0.25, // Apoio ao agronegócio e ao equilíbrio fiscal, gestão pública técnica
    social: 0.1,
    governance: 0.1,
    environment: 0.1,
    state_reform: 0.2,
    resumo: 'Centro pragmático, foco em gestão de resultados, apoio ao setor produtivo e equilíbrio institucional.'
  },
  'PSDB': {
    espectro: 'Centro à Centro-Direita',
    economic: 0.4,  // Social-democracia originária migrada para ortodoxia fiscal e desestatização
    social: -0.1,   // Mais liberal nos costumes que a direita conservadora
    governance: 0.2,
    environment: 0.0,
    state_reform: 0.4,
    resumo: 'Reformismo econômico liberal, equilíbrio fiscal, responsabilidade da gestão pública e modernização do Estado.'
  },
  'CIDADANIA': {
    espectro: 'Centro',
    economic: 0.2,
    social: -0.3,
    governance: 0.2,
    environment: -0.2,
    state_reform: 0.3,
    resumo: 'Centro democrático e modernizante, transparência, reformas estruturais e respeito às liberdades individuais.'
  },
  'SOLIDARIEDADE': {
    espectro: 'Centro',
    economic: -0.1,
    social: 0.0,
    governance: 0.0,
    environment: 0.0,
    state_reform: 0.0,
    resumo: 'Centro pragmático com raízes no sindicalismo da Força Sindical, focado em empregabilidade e acordos federativos.'
  },
  'AVANTE': {
    espectro: 'Centro',
    economic: 0.15,
    social: 0.1,
    governance: 0.0,
    environment: 0.0,
    state_reform: 0.1,
    resumo: 'Pragmatismo político, apoio ao empreendedorismo popular e diálogo entre forças governistas.'
  },
  'PODEMOS': {
    espectro: 'Centro-Direita',
    economic: 0.4,
    social: 0.2,
    governance: 0.5, // Pauta lavajatista histórica e anticorrupção
    environment: 0.1,
    state_reform: 0.4,
    resumo: 'Transparência, combate à corrupção, enxugamento do Estado e defesa da democracia direta.'
  },
  'UNIÃO': { // União Brasil
    espectro: 'Centro-Direita',
    economic: 0.5,
    social: 0.3,
    governance: 0.2,
    environment: 0.3,
    state_reform: 0.4,
    resumo: 'Fusão de DEM e PSL: liberalismo econômico, defesa do agro, desburocratização e força parlamentar.'
  },
  'PP': {
    espectro: 'Centro-Direita à Direita',
    economic: 0.5,
    social: 0.4,
    governance: 0.2,
    environment: 0.3,
    state_reform: 0.3,
    resumo: 'Conservadorismo moderado, defesa enérgica do agronegócio e forte pragmatismo parlamentar (Centrão).'
  },
  'REPUBLICANOS': {
    espectro: 'Direita Conservadora',
    economic: 0.45,
    social: 0.7, // Forte base evangélica e de valores morais tradicionais
    governance: 0.3,
    environment: 0.2,
    state_reform: 0.4,
    resumo: 'Conservadorismo nos costumes, defesa da família tradicional, livre iniciativa e ordem pública.'
  },
  'PRD': { // Fusão PTB e Patriota
    espectro: 'Direita',
    economic: 0.5,
    social: 0.65,
    governance: 0.3,
    environment: 0.2,
    state_reform: 0.4,
    resumo: 'Direita patriótica, livre mercado, segurança pública ostensiva e princípios conservadores.'
  },
  'NOVO': {
    espectro: 'Direita Liberal',
    economic: 0.95, // Liberalismo econômico irrestrito, privatizações totais, corte drástico de impostos e gastos
    social: 0.3,    // Foco primordial na liberdade de mercado
    governance: 0.8, // Contra uso do Fundo Eleitoral, meritocracia estatal
    environment: 0.3,
    state_reform: 0.95,
    resumo: 'Liberalismo econômico puro, Estado mínimo, privatização de estatais, corte de privilégios e combate ao fundão partidário.'
  },
  'PL': {
    espectro: 'Direita à Extrema-Direita',
    economic: 0.6,
    social: 0.85, // Pauta bolsonarista: Deus, Pátria, Família e Liberdade
    governance: 0.4,
    environment: 0.5, // Favorável à exploração agro e flexibilização de licenças
    state_reform: 0.5,
    resumo: 'Conservadorismo bolsonarista, armamento do cidadão de bem, valores tradicionais, oposição ao socialismo e apoio ao agro.'
  },
  'PRTB': {
    espectro: 'Direita Populista / Conservadora',
    economic: 0.6,
    social: 0.75,
    governance: 0.3,
    environment: 0.3,
    state_reform: 0.6,
    resumo: 'Nacionalismo conservador, empreendedorismo desregulamentado e discurso antissistema.'
  },
  'DC': {
    espectro: 'Centro-Direita Cristã',
    economic: 0.3,
    social: 0.6,
    governance: 0.2,
    environment: 0.1,
    state_reform: 0.2,
    resumo: 'Democracia cristã, valorização da família e princípios bíblicos na gestão da coisa pública.'
  },
  'AGIR': {
    espectro: 'Centro',
    economic: 0.1,
    social: 0.1,
    governance: 0.1,
    environment: 0.0,
    state_reform: 0.1,
    resumo: 'Centro pragmático com foco em causas de inclusão (autismo e acessibilidade) e equilíbrio social.'
  },
  'PMB': {
    espectro: 'Centro',
    economic: 0.0,
    social: 0.1,
    governance: 0.0,
    environment: 0.0,
    state_reform: 0.1,
    resumo: 'Foco na representação feminina na política e defesa de direitos sociais fundamentais.'
  },
  'MOBILIZA': {
    espectro: 'Centro',
    economic: 0.1,
    social: 0.1,
    governance: 0.1,
    environment: 0.0,
    state_reform: 0.1,
    resumo: 'Mobilização popular e desenvolvimento econômico comunitário.'
  }
};

export function getPartyIdeology(sigla) {
  const cleanSigla = (sigla || '').trim().toUpperCase();
  return PARTY_IDEOLOGY[cleanSigla] || {
    espectro: 'Centro',
    economic: 0.0,
    social: 0.0,
    governance: 0.0,
    environment: 0.0,
    state_reform: 0.0,
    resumo: 'Posicionamento pragmático de centro.'
  };
}
