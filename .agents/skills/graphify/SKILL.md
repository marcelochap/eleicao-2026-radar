---
name: graphify
description: "Metodologia, algoritmos e validação automatizada de grafos de conhecimento, redes relacionais e visualizações em esfera/radial (constelação orbital). Previne sobreposição de nós, garante fluxo direcional sem contrafluxo e valida geometria espacial em Canvas/SVG."
---

# Skill: Graphify — Construção e Validação de Grafos Radiais e Esféricos

Esta skill orienta o agente na construção, posicionamento matemático e validação de qualidade de grafos relacionais interativos, adotando o paradigma **Radial / Esfera / Constelação Orbital** inspirado nas melhores práticas de síntese de conhecimento do ecossistema Graphify.

---

## 1. Princípios Fundamentais do Graphify

Grafos densos falham quando se transformam em "hairballs" (emaranhados ilegíveis) ou pirâmides lineares monótonas quando o usuário deseja visualizar um ecossistema. O modelo Graphify resolve isso através de:

1. **Constelação Esférica / Órbitas Concéntricas**:
   - As entidades são distribuídas em camadas orbitais concêntricas ($R_0, R_1, R_2, \dots, R_n$) a partir de um epicentro gravitacional.
   - Cada órbita representa um nível hierárquico, comunitário ou de relevância institucional.
2. **Vetores Direcionais Centrífugos (Sem Contrafluxo)**:
   - Arestas de subordinação ou dependência partem do centro para fora ($R_{\text{origem}} \le R_{\text{destino}}$).
   - As linhas nunca devem cruzar na contramão de volta pelo centro sem um caminho em arco dedicado.
3. **Imunidade a Colisão (Anti-Collision Guarantee)**:
   - A distância euclidiana entre dois nós quaisquer $u$ e $v$ deve obrigatoriamente satisfazer:
     $$\text{dist}(u, v) \ge \text{radius}_u + \text{radius}_v + \text{gap}_{\min}$$ (onde $\text{gap}_{\min} \ge 14\text{px}$).
4. **Projeção Radial de Rótulos**:
   - Os textos e crachás de identificação não ficam sobrepostos às linhas. São projetados no sentido do vetor unitário radial $\hat{u} = (\cos\theta, \sin\theta)$.
5. **Zoom Panorâmico Inicial**:
   - O grafo deve inicializar enquadrando 100% dos nós visíveis com margem de segurança ($\ge 40\text{px}$ dos limites do Canvas/Viewport).

---

## 2. Modelo Matemático do Layout Radial (Constelação)

Para um conjunto de nós particionados em camadas $k \in \{0, 1, \dots, K\}$:

### A. Raio Orbital por Camada:
$$R_k = R_{\text{base}} + k \cdot \Delta R$$
- **Nível 0 (Centro)**: $R_0 = 0$ (ex: Partido ou Nó Central do Sistema)
- **Nível 1 (Cúpula Executiva)**: $R_1 \approx 75\text{px}$
- **Nível 2 (Governo / Liderança Regional)**: $R_2 \approx 140\text{px}$
- **Nível 3 (Senado / Alta Câmara)**: $R_3 \approx 205\text{px}$
- **Nível 4 (Câmara Federal / Médio Escalão)**: $R_4 \approx 275\text{px}$
- **Nível 5 (Deputados Distritais / Base Ampla)**: $R_5 \approx 345\text{px}$ com raio alternado ($\pm 20\text{px}$) para evitar aglomeração.

### B. Distribuição Angular Uniforme com Offset Anti-Alinhamento:
Para $N_k$ nós na camada $k$:
$$\theta_{k, i} = \theta_{\text{start}} + \frac{2\pi \cdot i}{N_k} + \phi_k$$
onde $\phi_k = \frac{\pi}{N_k \cdot 2}$ é uma fase de defasagem entre anéis consecutivos para que os nós não fiquem exatamente em fila radial reta, maximizando o espaço entre linhas.

### C. Arestas e Curvatura:
- Se $u$ está no anel $k_1$ e $v$ no anel $k_2$ com $k_2 > k_1$:
  - Traçar curva de Bézier quadrática ou linha reta limpa com gradiente direcional da cor da fonte à cor do destino.
  - A seta aponta para $v$ no sentido centrífugo.
- A espessura da linha reflete a intensidade da conexão (ex: 2.5px para cargos maiores, 1px para nominais).

---

## 3. Critérios de Validação Automatizada (Checklist Graphify)

Todo grafo gerado ou atualizado deve ser aprovado nas seguintes 5 regras de qualidade:

| ID | Regra | Critério de Aceitação |
|---|---|---|
| **V1** | **Zero Colisões** | Nenhum par de nós tem $\text{dist}(u,v) < r_u + r_v + 12\text{px}$. |
| **V2** | **Orientação Centrífuga** | 100% das arestas hierárquicas têm $R_{\text{destino}} \ge R_{\text{origem}}$. |
| **V3** | **Enquadramento no Canvas** | Todos os nós estão dentro de $[X_{\min}, X_{\max}] \times [Y_{\min}, Y_{\max}]$ com margem $\ge 30\text{px}$. |
| **V4** | **Legibilidade dos Rótulos** | Rótulos têm fundo/badge contrastante ou offset radial sem cruzamento com nós vizinhos. |
| **V5** | **Responsividade de Zoom** | Em zoom reset ($z=1$), todo o grafo é imediatamente visível sem necessidade de pan imediato. |

---

## 4. Script de Validação Automatizada (`validate_graph.js`)

O script inspeciona os nós e arestas computados na memória do navegador ou exportados do Canvas:

```javascript
/**
 * Graphify Layout Validator
 * Executa testes matemáticos de colisão, direcionamento e enquadramento.
 */
function validateGraphLayout(positions, edges, canvasWidth, canvasHeight) {
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
      report.outOfBounds.push({ id, label: p.node?.label, x: p.x, y: p.y });
    }
  }

  // 3. Teste de Direção Vetorial Centrífuga
  for (const edge of edges) {
    const src = positions[edge.source];
    const tgt = positions[edge.target];
    if (src && tgt) {
      const rSrc = Math.hypot(src.x - cx, src.y - cy);
      const rTgt = Math.hypot(tgt.x - cx, tgt.y - cy);
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
```
