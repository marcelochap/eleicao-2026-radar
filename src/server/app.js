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
    const rawData = cachedGraphData;

    // Se solicitar subgrafo de um candidato específico
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
        stats: { totalNodes: relevantNodes.length, totalEdges: relevantEdges.length },
        nodes: relevantNodes,
        edges: relevantEdges
      });
    }

    // Retorna grafo amostral principal (governadores, partidos, propostas) para renderização rápida
    const priorityNodes = rawData.nodes.filter(n => 
      n.type === 'PARTY' || 
      n.type === 'GOVERNMENT_PLAN' || 
      (n.type === 'CANDIDATE' && (n.metadata.cargo === 'GOVERNADOR' || n.metadata.cargo === 'PRESIDENTE'))
    );
    const nodeIds = new Set(priorityNodes.map(n => n.id));
    const priorityEdges = rawData.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    res.json({
      stats: { totalNodes: priorityNodes.length, totalEdges: priorityEdges.length },
      nodes: priorityNodes,
      edges: priorityEdges
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
