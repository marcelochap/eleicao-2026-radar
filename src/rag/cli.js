import { searchPolitician } from './search.js';

const term = process.argv.slice(2).join(' ') || 'Celina Leão';

console.log(`\n======================================================`);
console.log(`🔍 CONSULTA RAG - CANDIDATO / PARTIDO: "${term}"`);
console.log(`======================================================`);

const results = searchPolitician(term);

if (results.parties.length > 0) {
  console.log(`\n🏛️  PARTIDO(S) ENCONTRADO(S):`);
  results.parties.forEach(p => {
    console.log(`- ${p.sg_partido} (${p.nm_partido || p.sg_partido}) | Espectro: ${p.espectro_estimado}`);
    console.log(`  Resumo: ${p.resumo_ideologico}`);
    console.log(`  Candidatos na base: ${p.total_candidatos_base}`);
  });
}

if (results.candidates.length === 0) {
  console.log(`\nNenhum candidato encontrado para o termo especificado.`);
} else {
  console.log(`\n👤 CANDIDATOS ENCONTRADOS (${results.candidates.length}):\n`);
  results.candidates.forEach((cand, idx) => {
    const id = cand.identificacao;
    const esp = cand.espectro_politico;
    const pat = cand.patrimonio;
    const fin = cand.financiamento_campanha;
    const prop = cand.plano_governo;

    console.log(`------------------------------------------------------`);
    console.log(`[#${idx + 1}] ${id.nome_urna} (${id.partido} - Nº ${id.numero}) - ${id.cargo} (${id.uf})`);
    console.log(`Nome Completo: ${id.nome_completo} | Situação: ${id.situacao_candidatura}`);
    console.log(`Coligação: ${id.coligacao} | Ocupação: ${id.ocupacao}`);
    console.log(`Espectro Político Estimado: ${esp.posicao_geral} (Econômico: ${esp.economico > 0 ? '+' : ''}${esp.economico.toFixed(2)}, Social: ${esp.social > 0 ? '+' : ''}${esp.social.toFixed(2)})`);
    console.log(`Patrimônio Total Declarado: ${pat.total_bens_formatado} (${pat.qtd_itens} itens declarados)`);
    if (pat.principais_bens.length > 0) {
      console.log(`  Top Bens:`);
      pat.principais_bens.slice(0, 3).forEach(b => {
        console.log(`   * ${b.tipo_bem}: ${b.descricao} (R$ ${b.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
      });
    }

    console.log(`Financiamento de Campanha:`);
    console.log(`  Total Arrecadado: R$ ${fin.total_receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Fundo Eleitoral: R$ ${fin.total_fundo_eleitoral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${fin.percentual_fundo_eleitoral})`);
    console.log(`  Recursos Próprios: R$ ${fin.total_recursos_proprios.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${fin.percentual_recursos_proprios})`);

    console.log(`Integridade & Judicial:`);
    console.log(`  Certidões Criminais anexadas ao TRE: ${cand.integridade_e_judicial.total_certidoes_criminais}`);

    if (prop.tem_proposta) {
      console.log(`Plano de Governo Registrado no TSE (${prop.num_paginas} páginas):`);
      console.log(`  ${prop.resumo}`);
      if (prop.destaques && prop.destaques.length > 0) {
        console.log(`  Destaques Programáticos:`);
        prop.destaques.slice(0, 3).forEach(d => console.log(`   > "${d}"`));
      }
    } else {
      console.log(`Plano de Governo: Não registrado individualmente (candidato ao legislativo/proporcional).`);
    }

    if (cand.historico_eleitoral && cand.historico_eleitoral.length > 0) {
      console.log(`Histórico Eleitoral Passado:`);
      cand.historico_eleitoral.slice(0, 3).forEach(h => {
        console.log(`  - Ano ${h.ano}: Concorreu a ${h.cargo} (${h.eleicao})`);
      });
    }

    if (cand.redes_sociais && cand.redes_sociais.length > 0) {
      console.log(`Canais e Redes Oficiais: ${cand.redes_sociais.slice(0, 3).join(' | ')}`);
    }
  });
}
console.log(`\n======================================================\n`);
