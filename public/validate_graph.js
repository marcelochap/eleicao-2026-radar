/**
 * scripts/validate_graph.js
 * Script de validação da skill Graphify
 * Executa testes matemáticos de colisão, direcionamento e enquadramento nos grafos do projeto.
 */

function validateGraphLayout(positions, edges, canvasWidth = 1140, canvasHeight = 680) {
  const report = {
    valid: true,
    totalNodes: Object.keys(positions).length,
    totalEdges: edges.length,
    collisions: [],
    backwardEdges: [],
    outOfBounds: [],
    minDistance: Infinity
  };

  const nodeIds = Object.keys(positions);
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  // 1. Teste de Colisão
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      const a = positions[nodeIds[i]];
      const b = positions[nodeIds[j]];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const reqDist = (a.radius || 12) + (b.radius || 12) + 12;

      if (dist < report.minDistance) report.minDistance = dist;
      if (dist < reqDist) {
        report.collisions.push({
          nodeA: a.node?.label || nodeIds[i],
          nodeB: b.node?.label || nodeIds[j],
          dist: Math.round(dist),
          required: reqDist
        });
      }
    }
  }

  // 2. Teste de Enquadramento
  for (const id of nodeIds) {
    const p = positions[id];
    const r = p.radius || 12;
    if (p.x - r < 20 || p.x + r > canvasWidth - 20 || p.y - r < 20 || p.y + r > canvasHeight - 20) {
      report.outOfBounds.push({ id, label: p.node?.label, x: Math.round(p.x), y: Math.round(p.y) });
    }
  }

  // 3. Teste de Direção Vetorial Centrífuga (Sem contrafluxo para dentro da esfera)
  for (const edge of edges) {
    const src = positions[edge.source];
    const tgt = positions[edge.target];
    if (src && tgt) {
      const rSrc = Math.hypot(src.x - cx, src.y - cy);
      const rTgt = Math.hypot(tgt.x - cx, tgt.y - cy);
      // Se a aresta aponta mais de 25px em direção ao centro em vez de para fora
      if (rTgt < rSrc - 25) {
        report.backwardEdges.push({
          source: src.node?.label || edge.source,
          target: tgt.node?.label || edge.target,
          rSrc: Math.round(rSrc),
          rTgt: Math.round(rTgt)
        });
      }
    }
  }

  if (report.collisions.length > 0 || report.outOfBounds.length > 0) {
    report.valid = false;
  }

  return report;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validateGraphLayout };
}
