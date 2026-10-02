import AdmZip from 'adm-zip';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const dbPath = path.resolve('data', 'eleicoes_2026.db');
const db = new DatabaseSync(dbPath);

console.log('=================================================================');
console.log('🚀 ATUALIZANDO STATUS DE CANDIDATURA, CASSAÇÕES E HISTÓRICO BR');
console.log('=================================================================');

// 1. Adicionar colunas se não existirem
try {
  db.exec('ALTER TABLE candidates ADD COLUMN situacao_julgamento TEXT;');
  console.log('Coluna situacao_julgamento criada.');
} catch (e) {
  // já existe
}

try {
  db.exec('ALTER TABLE candidates ADD COLUMN motivo_cassacao TEXT;');
  console.log('Coluna motivo_cassacao criada.');
} catch (e) {
  // já existe
}

try {
  db.exec('ALTER TABLE candidates ADD COLUMN st_substituido TEXT;');
  console.log('Coluna st_substituido criada.');
} catch (e) {
  // já existe
}

try {
  db.exec('ALTER TABLE candidates ADD COLUMN sq_substituido TEXT;');
  console.log('Coluna sq_substituido criada.');
} catch (e) {
  // já existe
}

// 2. Mapear Motivos de Cassação / Inelegibilidade
console.log('\n[1/3] Lendo motivos de cassação e inelegibilidade (motivo_cassacao_2026.zip)...');
const zipCassacao = new AdmZip('docs/motivo_cassacao_2026.zip');
const motivosBySq = {};

for (const entry of zipCassacao.getEntries()) {
  if (entry.isDirectory || !entry.entryName.endsWith('.csv')) continue;
  const text = entry.getData().toString('latin1');
  const lines = text.split('\n').filter(l => l.trim().length > 0);

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.replace(/"/g, '').trim());
    const sq = cols[10];
    const motivo = cols[13];
    if (sq && motivo && motivo !== '#NULO#') {
      if (!motivosBySq[sq]) motivosBySq[sq] = [];
      if (!motivosBySq[sq].includes(motivo)) {
        motivosBySq[sq].push(motivo);
      }
    }
  }
}
console.log(`Mapeados motivos para ${Object.keys(motivosBySq).length} registros.`);

// 3. Mapear Situação de Julgamento (consulta_cand_complementar_2026.zip)
console.log('\n[2/3] Lendo situações de julgamento (consulta_cand_complementar_2026.zip)...');
const zipComp = new AdmZip('docs/consulta_cand_complementar_2026.zip');
const compBySq = {};

for (const name of ['consulta_cand_complementar_2026_BR.csv', 'consulta_cand_complementar_2026_DF.csv']) {
  const entry = zipComp.getEntry(name);
  if (!entry) continue;
  const text = entry.getData().toString('latin1');
  const lines = text.split('\n').filter(l => l.trim().length > 0);

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';').map(c => c.replace(/"/g, '').trim());
    const sq = cols[4];
    if (!sq) continue;
    compBySq[sq] = {
      julgamento: cols[34] || cols[27] || '#NE',
      stSubstituido: cols[29] || 'N',
      sqSubstituido: cols[30] || '-1'
    };
  }
}
console.log(`Mapeadas situações complementares para ${Object.keys(compBySq).length} registros.`);

// Atualizar candidates na base
db.exec('BEGIN TRANSACTION;');
const updateStatusStmt = db.prepare(`
  UPDATE candidates
  SET ds_situacao_candidatura = ?,
      situacao_julgamento = ?,
      motivo_cassacao = ?,
      st_substituido = ?,
      sq_substituido = ?
  WHERE sq_candidato = ?
`);

const allCands = db.prepare('SELECT sq_candidato, nm_urna_candidato, ds_cargo, sg_partido FROM candidates').all();
let cassaCount = 0;
let renunciaCount = 0;
let deferidoCount = 0;
let indeferidoRecursoCount = 0;

for (const c of allCands) {
  const sq = c.sq_candidato;
  const comp = compBySq[sq];
  const motivos = motivosBySq[sq] || [];
  const motivoTexto = motivos.length > 0 ? motivos.join(' · ') : null;

  let situacao = comp?.julgamento || '#NE';
  if (situacao === '#NE' && motivoTexto) {
    situacao = 'INDEFERIDO';
  }

  if (situacao === 'INDEFERIDO') cassaCount++;
  else if (situacao === 'RENÚNCIA') renunciaCount++;
  else if (situacao === 'DEFERIDO') deferidoCount++;
  else if (situacao.includes('RECURSO')) indeferidoRecursoCount++;

  updateStatusStmt.run(
    situacao,
    situacao,
    motivoTexto,
    comp?.stSubstituido || 'N',
    comp?.sqSubstituido || '-1',
    sq
  );
}
db.exec('COMMIT;');

console.log(`\nAtualização de status concluída:`);
console.log(`  ✓ Deferidos: ${deferidoCount}`);
console.log(`  ⚠️ Indeferidos / Cassados: ${cassaCount}`);
console.log(`  ⚠️ Renúncias / Abandonaram: ${renunciaCount}`);
console.log(`  ⚠️ Em Recurso: ${indeferidoRecursoCount}`);

// 4. Ingestão de Histórico Eleitoral Nacional (historico_candidatura_2026_BRASIL.csv)
console.log('\n[3/3] Lendo histórico eleitoral de candidaturas passadas (historico_candidatura_2026_BRASIL.csv)...');
const zipHist = new AdmZip('docs/historico_candidatura_2026.zip');
const brHistEntry = zipHist.getEntry('historico_candidatura_2026_BRASIL.csv');

if (brHistEntry) {
  const text = brHistEntry.getData().toString('latin1');
  const lines = text.split('\n');
  const histBySq = {};

  const sqSet = new Set(allCands.map(c => c.sq_candidato));

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // Checagem rápida para evitar split desnecessário
    let matchesCandidate = false;
    for (const sq of sqSet) {
      if (line.includes(sq)) {
        matchesCandidate = true;
        break;
      }
    }
    if (!matchesCandidate) continue;

    const cols = line.split(';').map(c => c.replace(/"/g, ''));
    const sqAtual = cols[3];
    if (sqSet.has(sqAtual)) {
      if (!histBySq[sqAtual]) histBySq[sqAtual] = [];
      histBySq[sqAtual].push({
        ano: cols[5],
        cargo: cols[17],
        eleicao: cols[10],
        resultado: cols[30] || 'Disputou'
      });
    }
  }

  console.log(`Histórico encontrado para ${Object.keys(histBySq).length} candidatos no banco.`);

  db.exec('BEGIN TRANSACTION;');
  const updateHistStmt = db.prepare(`UPDATE candidates SET historico_candidaturas = ? WHERE sq_candidato = ?`);
  for (const [sq, history] of Object.entries(histBySq)) {
    // Ordenar histórico decrescente por ano
    history.sort((a, b) => (parseInt(b.ano, 10) || 0) - (parseInt(a.ano, 10) || 0));
    updateHistStmt.run(JSON.stringify(history), sq);
  }
  db.exec('COMMIT;');
  console.log('Histórico eleitoral consolidado atualizado com sucesso no banco de dados.');
}

console.log('\n=================================================================');
console.log('✅ MIGRAÇÃO E ENRIQUECIMENTO CONCLUÍDOS COM SUCESSO!');
console.log('=================================================================');
