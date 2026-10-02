import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { getDatabase, searchPolitician, getCandidateById, getAllCandidates } from '../rag/search.js';
import { QUESTIONS, calculateAlignment } from '../questionnaire/engine.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.resolve('public')));
app.use(express.static(path.resolve('src', 'server', 'public')));

// Estatísticas globais
app.get('/api/stats', (req, res) => {
  try {
    const db = getDatabase();
    const totalCand = db.prepare(`SELECT count(*) as c FROM candidates`).get().c;
    const totalGov = db.prepare(`SELECT count(*) as c FROM candidates WHERE ds_cargo = 'GOVERNADOR'`).get().c;
    const totalPres = db.prepare(`SELECT count(*) as c FROM candidates WHERE ds_cargo = 'PRESIDENTE'`).get().c;
    const totalParties = db.prepare(`SELECT count(*) as c FROM parties`).get().c;
    const totalPropostas = db.prepare(`SELECT count(*) as c FROM candidate_proposals`).get().c;
    const totalBens = db.prepare(`SELECT sum(total_bens) as s FROM candidates`).get().s;
    const totalProcessos = db.prepare(`SELECT count(*) as c FROM electoral_lawsuits`).get().c;
    const totalCertidoes = db.prepare(`SELECT count(*) as c FROM candidate_certidoes`).get().c;

    res.json({
      totalCandidatos: totalCand,
      totalGovernadores: totalGov,
      totalPresidentes: totalPres,
      totalPartidos: totalParties,
      totalPropostas: totalPropostas,
      patrimonioTotalDeclarado: totalBens,
      totalProcessos: totalProcessos,
      totalCertidoes: totalCertidoes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Listagem com Filtros Avançados
app.get('/api/candidates', (req, res) => {
  try {
    const filters = {
      cargo: req.query.cargo || undefined,
      partido: req.query.partido || undefined,
      uf: req.query.uf || undefined,
      temProposta: req.query.temProposta === 'true' ? true : undefined,
      minPatrimonio: req.query.minPatrimonio ? Number(req.query.minPatrimonio) : undefined,
      maxPatrimonio: req.query.maxPatrimonio ? Number(req.query.maxPatrimonio) : undefined,
      orderBy: req.query.orderBy || undefined,
      limit: req.query.limit ? Number(req.query.limit) : 60
    };

    const candidates = getAllCandidates(filters);
    res.json({ count: candidates.length, candidates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dossiê Individual 360º
app.get('/api/candidates/:id', (req, res) => {
  try {
    const dossier = getCandidateById(req.params.id);
    if (!dossier) {
      return res.status(404).json({ error: 'Candidato não encontrado' });
    }
    res.json(dossier);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// RAG Search
app.get('/api/search', (req, res) => {
  try {
    const query = req.query.q || '';
    const results = searchPolitician(query);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Partidos
app.get('/api/parties', (req, res) => {
  try {
    const db = getDatabase();
    const parties = db.prepare(`SELECT * FROM parties ORDER BY total_candidatos DESC`).all();
    res.json(parties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Questionário - Perguntas
app.get('/api/questionnaire/questions', (req, res) => {
  res.json(QUESTIONS);
});

// Questionário - Avaliação e Fit
app.post('/api/questionnaire/evaluate', (req, res) => {
  try {
    const { answers, weights } = req.body;
    if (!answers || Object.keys(answers).length === 0) {
      return res.status(400).json({ error: 'Nenhuma resposta enviada.' });
    }

    const result = calculateAlignment(answers, weights);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Knowledge Graph (Graphify Standard)
let cachedGraphData = null;

app.get('/api/graph', (req, res) => {
  try {
    const graphPath = path.join(process.cwd(), 'data', 'graphify_knowledge_graph.json');
    if (!cachedGraphData) {
      if (!fs.existsSync(graphPath)) {
        return res.status(404).json({ error: 'Grafo ainda não gerado' });
      }
      cachedGraphData = JSON.parse(fs.readFileSync(graphPath, 'utf-8'));
    }

    const candId = req.query.candidato;
    const partySigla = req.query.partido ? req.query.partido.toUpperCase().trim() : null;
    const rawData = cachedGraphData;

    // 1. Subgrafo de um candidato específico (Constelação Individual)
    if (candId) {
      const targetNodeId = `candidate:${candId}`;
      const relevantEdges = rawData.edges.filter(e => e.source === targetNodeId || e.target === targetNodeId);
      const connectedNodeIds = new Set([targetNodeId]);
      relevantEdges.forEach(e => {
        connectedNodeIds.add(e.source);
        connectedNodeIds.add(e.target);
      });
      const relevantNodes = rawData.nodes.filter(n => connectedNodeIds.has(n.id));

      return res.json({
        mode: 'CANDIDATE_CONSTELLATION',
        stats: { totalNodes: relevantNodes.length, totalEdges: relevantEdges.length },
        nodes: relevantNodes,
        edges: relevantEdges
      });
    }

    // 2. Subgrafo Completo de uma Legenda / Partido (Hierarquia até Deputado Distrital)
    if (partySigla) {
      const partyNode = rawData.nodes.find(n => n.id === `party:${partySigla}` || (n.type === 'PARTY' && (n.label.startsWith(`${partySigla} `) || n.label.startsWith(`${partySigla} -`))));
      if (!partyNode) {
        return res.status(404).json({ error: `Partido ${partySigla} não encontrado no grafo.` });
      }

      // Candidatos membros deste partido
      const memberEdges = rawData.edges.filter(e => e.relation === 'MEMBER_OF' && e.target === partyNode.id);
      const candIds = new Set(memberEdges.map(e => e.source));
      let partyCands = rawData.nodes.filter(n => candIds.has(n.id));

      // Coligações
      const coalitionEdges = rawData.edges.filter(e => candIds.has(e.source) && e.relation === 'ALIGNED_IN_COALITION');
      const coalitionIds = new Set(coalitionEdges.map(e => e.target));
      const coalitionNodes = rawData.nodes.filter(n => coalitionIds.has(n.id));

      // Se o partido não tiver candidato próprio a Governador, busca se apoia algum candidato em coligação registrada
      const hasGov = partyCands.some(c => c.metadata?.cargo === 'GOVERNADOR');
      if (!hasGov && coalitionIds.size > 0) {
        const alliedGovEdges = rawData.edges.filter(e => coalitionIds.has(e.target) && e.relation === 'ALIGNED_IN_COALITION');
        alliedGovEdges.forEach(e => {
          const ally = rawData.nodes.find(n => n.id === e.source && n.metadata?.cargo === 'GOVERNADOR');
          if (ally && !candIds.has(ally.id)) {
            candIds.add(ally.id);
            partyCands.push({
              ...ally,
              isAllied: true,
              allianceInfo: `Apoiado via Coligação Majoritária`
            });
          }
        });
      }

      // Propostas dos candidatos incluídos
      const propEdges = rawData.edges.filter(e => candIds.has(e.source) && e.relation === 'SUBMITTED_GOVERNMENT_PLAN');
      const propIds = new Set(propEdges.map(e => e.target));
      const propNodes = rawData.nodes.filter(n => propIds.has(n.id));

      const finalNodes = [partyNode, ...partyCands, ...coalitionNodes, ...propNodes];
      const finalNodeIds = new Set(finalNodes.map(n => n.id));
      const relevantEdges = rawData.edges.filter(e => finalNodeIds.has(e.source) && finalNodeIds.has(e.target));

      // Conexões de fluxo hierárquico da chapa partidária:
      // Partido -> Presidente -> Governador -> Senador -> Deputado Federal -> Deputado Distrital
      const hierarchicalEdges = [];
      const presCands = partyCands.filter(c => (c.metadata?.cargo || '').includes('PRESIDENTE'));
      const govCands = partyCands.filter(c => (c.metadata?.cargo || '').includes('GOVERNADOR'));
      const senCands = partyCands.filter(c => (c.metadata?.cargo || '').includes('SENADOR') || (c.metadata?.cargo || '').includes('SUPLENTE'));
      const fedCands = partyCands.filter(c => c.metadata?.cargo === 'DEPUTADO FEDERAL');
      const distCands = partyCands.filter(c => c.metadata?.cargo === 'DEPUTADO DISTRITAL');

      // 1. Partido -> Presidente
      presCands.forEach(p => {
        hierarchicalEdges.push({
          id: `hier:${partyNode.id}->${p.id}`,
          source: partyNode.id,
          target: p.id,
          relation: 'CHAPA_PRESIDENTE',
          explanation: `${partySigla} concorre ao Planalto com ${p.label}`
        });
      });

      // 2. Presidente -> Governador (ou Partido -> Governador)
      govCands.forEach(g => {
        if (presCands.length > 0) {
          presCands.forEach(p => {
            hierarchicalEdges.push({
              id: `hier:${p.id}->${g.id}`,
              source: p.id,
              target: g.id,
              relation: 'PRESIDENTE_GOVERNADOR',
              explanation: `Aliança Executiva: ${p.label} com ${g.label}`
            });
          });
        } else {
          hierarchicalEdges.push({
            id: `hier:${partyNode.id}->${g.id}`,
            source: partyNode.id,
            target: g.id,
            relation: 'CHAPA_GOVERNADOR',
            explanation: `${partySigla} disputa o Buriti com ${g.label}`
          });
        }
      });

      // 3. Governador -> Senador (ou Partido -> Senador)
      senCands.forEach(s => {
        if (govCands.length > 0) {
          govCands.forEach(g => {
            hierarchicalEdges.push({
              id: `hier:${g.id}->${s.id}`,
              source: g.id,
              target: s.id,
              relation: 'GOVERNADOR_SENADOR',
              explanation: `Chapa Majoritária no DF: ${g.label} e ${s.label}`
            });
          });
        } else {
          hierarchicalEdges.push({
            id: `hier:${partyNode.id}->${s.id}`,
            source: partyNode.id,
            target: s.id,
            relation: 'CHAPA_SENADOR',
            explanation: `${partySigla} concorre ao Senado no DF com ${s.label}`
          });
        }
      });

      // 4. Senador -> Deputados Federais (ou Partido -> Deputados Federais)
      fedCands.forEach((f, idx) => {
        const parentSen = senCands.length > 0 ? senCands[idx % senCands.length] : null;
        if (parentSen) {
          hierarchicalEdges.push({
            id: `hier:${parentSen.id}->${f.id}`,
            source: parentSen.id,
            target: f.id,
            relation: 'SENADOR_DEP_FEDERAL',
            explanation: `Bancada Federal DF: ${f.label}`
          });
        } else {
          hierarchicalEdges.push({
            id: `hier:${partyNode.id}->${f.id}`,
            source: partyNode.id,
            target: f.id,
            relation: 'CHAPA_DEP_FEDERAL',
            explanation: `${partySigla} para Deputado Federal: ${f.label}`
          });
        }
      });

      // 5. Deputados Federais -> Deputados Distritais (ou Partido -> Deputados Distritais)
      distCands.forEach((d, idx) => {
        const parentFed = fedCands.length > 0 ? fedCands[idx % fedCands.length] : null;
        if (parentFed) {
          hierarchicalEdges.push({
            id: `hier:${parentFed.id}->${d.id}`,
            source: parentFed.id,
            target: d.id,
            relation: 'DEP_FEDERAL_DEP_DISTRITAL',
            explanation: `Bancada Distrital CLDF: ${d.label}`
          });
        } else {
          hierarchicalEdges.push({
            id: `hier:${partyNode.id}->${d.id}`,
            source: partyNode.id,
            target: d.id,
            relation: 'CHAPA_DEP_DISTRITAL',
            explanation: `${partySigla} para Deputado Distrital: ${d.label}`
          });
        }
      });

      return res.json({
        mode: 'PARTY_TICKET_HIERARCHY',
        party: partyNode,
        stats: {
          totalNodes: finalNodes.length,
          totalEdges: relevantEdges.length + hierarchicalEdges.length,
          breakdown: {
            pres: presCands.length,
            gov: govCands.length,
            sen: senCands.length,
            depFed: fedCands.length,
            depDist: distCands.length
          }
        },
        nodes: finalNodes,
        edges: [...relevantEdges, ...hierarchicalEdges]
      });
    }

    // 3. Grafo Inicial: Vários Partidos -> Presidente -> Governador
    const partyNodes = rawData.nodes.filter(n => n.type === 'PARTY');
    const execCands = rawData.nodes.filter(n => 
      n.type === 'CANDIDATE' && 
      ((n.metadata?.cargo === 'PRESIDENTE' || n.metadata?.cargo === 'VICE-PRESIDENTE') ||
       (n.metadata?.cargo === 'GOVERNADOR' || n.metadata?.cargo === 'VICE-GOVERNADOR'))
    );
    const coalitionNodes = rawData.nodes.filter(n => n.type === 'COALITION');
    const planNodes = rawData.nodes.filter(n => n.type === 'GOVERNMENT_PLAN');

    const initialNodes = [...partyNodes, ...execCands, ...coalitionNodes, ...planNodes];
    const initialNodeIds = new Set(initialNodes.map(n => n.id));
    const initialEdges = rawData.edges.filter(e => initialNodeIds.has(e.source) && initialNodeIds.has(e.target));

    // Adiciona arestas diretas de suporte Executivo (Partido -> Presidente e Partido -> Governador)
    const macroEdges = [];
    partyNodes.forEach(p => {
      const sigla = p.metadata?.sigla || p.label.split(' ')[0];
      execCands.filter(c => c.metadata?.partido === sigla && c.metadata?.cargo === 'PRESIDENTE').forEach(c => {
        macroEdges.push({
          id: `macro:${p.id}->${c.id}`,
          source: p.id,
          target: c.id,
          relation: 'LEGENDA_PRESIDENTE',
          explanation: `${sigla} apoia ${c.label} para Presidente`
        });
      });
      execCands.filter(c => c.metadata?.partido === sigla && c.metadata?.cargo === 'GOVERNADOR').forEach(c => {
        macroEdges.push({
          id: `macro:${p.id}->${c.id}`,
          source: p.id,
          target: c.id,
          relation: 'LEGENDA_GOVERNADOR',
          explanation: `${sigla} apoia ${c.label} para Governador do DF`
        });
      });
    });

    res.json({
      mode: 'MACRO_EXECUTIVE_GRAPH',
      stats: { totalNodes: initialNodes.length, totalEdges: initialEdges.length + macroEdges.length },
      nodes: initialNodes,
      edges: [...initialEdges, ...macroEdges]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback para SPA
app.use((req, res) => {
  const indexPath = path.resolve('src', 'server', 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not Found');
  }
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 SERVIDOR ELEIÇÕES 2026 ATIVO EM http://localhost:${PORT}`);
    console.log(`📊 Acesse o painel de inspeção e alinhamento político`);
    console.log(`======================================================\n`);
  });
}

export default app;
