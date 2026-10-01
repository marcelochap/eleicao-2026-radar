# 🏛️ Radar Eleições 2026

> **Inteligência Cívica, Grafo de Conhecimento e Alinhamento Político para as Eleições 2026**  
> *Cruzamento determinístico de dados abertos do TSE: Planos de Metas em PDF, Patrimônio Declarado, Certidões Criminais, Processos Judiciais e Financiamento Eleitoral.*

[![Node.js](https://img.shields.io/badge/Node.js-v24%2B-green.svg)](https://nodejs.org)
[![SQLite](https://img.shields.io/badge/SQLite-FTS5%20Native-blue.svg)](https://sqlite.org)
[![Graphify](https://img.shields.io/badge/Knowledge%20Graph-Graphify%20Standard-purple.svg)](https://github.com/Graphify-Labs/graphify)
[![TSE Dados Abertos](https://img.shields.io/badge/Dados%20Oficiais-TSE%202026-yellow.svg)](https://dadosabertos.tse.jus.br)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)

---

## 🌟 Visão Geral

O **Radar Eleições 2026** é uma plataforma completa e autônoma de inteligência eleitoral criada para ajudar o cidadão a fazer uma **escolha consciente de voto**. O sistema desempacota as bases brutas do Tribunal Superior Eleitoral (TSE), organiza os dados em um **Knowledge Graph determinístico (padrão Graphify)** e disponibiliza um **motor RAG** de contexto com uma **Bússola de Alinhamento Político** e um **Painel Web Moderno de Inspeção**.

O projeto é dividido em **3 partes fundamentais**:

1. **RAG & Knowledge Graph (Graphify):** Ingestão e relacionamento de candidatos, partidos, coligações, declarações de bens, planos de governo em PDF, certidões judiciais e gastos de campanha.
2. **Bússola & Questionário de Alinhamento:** Questionário estratégico de 15 perguntas calibradas em 5 eixos políticos, calculando em tempo real a coordenada 2D e o percentual de afinidade (*Fit %*) com candidatos e legendas.
3. **Site de Inspeção Consciente:** Interface web moderna e de alta estética, com busca instantânea, filtros avançados (*"o que fez e como fez"*), modal de Dossiê 360º e visualizador interativo de grafos.

---

## 📊 Estatísticas da Base de Dados

* 👥 **696 Candidatos Catalogados**: 668 no Distrito Federal (Governador, Senador, Deputado Federal, Deputado Distrital) e 28 nacionais (Presidente e Vice-Presidente da República).
* 📑 **11 Planos de Governo Integrais**: 100% dos PDFs dos candidatos majoritários do DF extraídos e indexados por pilares temáticos (*Saúde, Educação, Segurança, Economia, Mobilidade, Moradia, Meio Ambiente e Gestão*).
* 💰 **R$ 960,6 Milhões em Patrimônio Declarado**: Mais de 2.000 itens discriminados (imóveis, cotas empresariais, investimentos e veículos).
* ⚖️ **2.471 Certidões Criminais Mapeadas**: Documentos judiciais de 1ª e 2ª instâncias (TJDFT, TRF-1, STM) protocolados no registro de candidatura do TRE-DF.
* ⚖️ **84.112 Processos Eleitorais**: Ações judiciais, impugnações de candidatura e representações de propaganda com links diretos para o PJe.
* 🕸️ **1.613 Nós e 1.779 Arestas no Grafo Graphify**: Toda conexão possui justificativa e explicação formal.

---

## 🏗️ Arquitetura do Sistema

```
                      ┌────────────────────────────────────────┐
                      │      13 Arquivos Zip Oficiais TSE      │
                      │  (docs/*.zip - DivulgaCandContas 2026) │
                      └───────────────────┬────────────────────┘
                                          │
                        [ Pipeline de Extração & Parsing ]
                         (src/pipeline/extract_tse.js)
                                          │
            ┌─────────────────────────────┴─────────────────────────────┐
            ▼                                                           ▼
┌───────────────────────────────┐                       ┌───────────────────────────────┐
│      SQLite Relacional        │                       │    Knowledge Graph Graphify   │
│   (data/eleicoes_2026.db)     │                       │  (data/graphify_knowledge...  │
│  - Tabelas de Candidatos      │                       │  - 1.613 Nós Tipados          │
│  - Bens, Contas e Certidões   │                       │  - 1.779 Arestas Explicadas   │
│  - FTS5 Full-Text Search      │                       │  - Padrão Graphify-Labs       │
└───────────────┬───────────────┘                       └───────────────┬───────────────┘
                │                                                       │
                ├───────────────────────────────┬───────────────────────┘
                ▼                               ▼
┌───────────────────────────────┐   ┌───────────────────────────────┐
│     Motor RAG 360º            │   │   Bússola & Engine de Match   │
│   (src/rag/search.js)         │   │ (src/questionnaire/engine.js) │
│  - Consultas CLI e API        │   │  - 15 Questões / 5 Eixos      │
│  - Dossiê 360º de Candidato   │   │  - Distância Euclidiana 3D    │
│  - Pesquisa Textual e Filtros │   │  - Plano Cartesiano 2D        │
└───────────────┬───────────────┘   └───────────────┬───────────────┘
                │                                   │
                └─────────────────┬─────────────────┘
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                 Painel Web de Inspeção Consciente                 │
│              Express Backend (src/server/app.js) :3000            │
│               Frontend Moderno (src/server/public/)               │
│                                                                   │
│   [ Dossiê dos Políticos ]  [ Bússola & Quiz ]  [ Grafo Graphify ]│
└───────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Como Começar

### Pré-requisitos
* **Node.js**: v22 ou superior (recomendado **Node.js v24** que possui `node:sqlite` integrado nativamente).
* **Git**: Para clonar o repositório.

### 1. Clonar e Instalar Dependências
```bash
git clone https://github.com/marcelochap/eleicao-2026-radar.git
cd eleicao-2026-radar
npm install
```

### 2. Iniciar o Painel Web
O banco de dados SQLite já vem gerado e pronto para uso:
```bash
npm start
```
Abra o navegador em: **[http://localhost:3000](http://localhost:3000)**

---

## 🔍 Consultas Rápidas via RAG (Terminal / CLI)

Você pode inspecionar o dossiê de qualquer político ou partido diretamente pela linha de comando:

```bash
# Consultar candidato a Governador
node src/rag/cli.js "Celina Leão"
node src/rag/cli.js "Leandro Grass"
node src/rag/cli.js "Kiko Caputo"
node src/rag/cli.js "Arruda"

# Consultar candidato à Presidência
node src/rag/cli.js "Lula"
node src/rag/cli.js "Zema"

# Consultar partido político
node src/rag/cli.js "NOVO"
node src/rag/cli.js "PT"
node src/rag/cli.js "PSD"
```

### Exemplo de Retorno do RAG:
```
======================================================
🔍 CONSULTA RAG - CANDIDATO / PARTIDO: "Kiko Caputo"
======================================================
[#1] KIKO CAPUTO (NOVO - Nº 30) - GOVERNADOR (DF)
Nome Completo: FRANCISCO QUEIROZ CAPUTO NETO | Situação: #NE
Coligação: PARTIDO ISOLADO | Ocupação: ADVOGADO
Espectro Político Estimado: Direita (Moderado) (Econômico: +0.97, Social: 0.00)
Patrimônio Total Declarado: R$ 47.383.036,13 (25 itens declarados)
  Top Bens:
   * Outras aplicações e Investimentos: R$ 20.203.788,95
   * Atividade autônoma: R$ 10.558.591,66
Financiamento de Campanha:
  Total Arrecadado: R$ 1.935.500,00
  Fundo Eleitoral: R$ 0,00 (0.0%)
  Recursos Próprios: R$ 705.500,00 (36.5%)
Integridade & Judicial:
  Certidões Criminais anexadas ao TRE: 3
Plano de Governo Registrado no TSE (165 páginas):
  Pilares centrais: saude, educacao, seguranca, economia, mobilidade, gestao.
```

---

## 🧭 Metodologia da Bússola Eleitoral

O questionário avalia 5 dimensões estratégicas da política brasileira:

1. **Economia & Estado (Eixo Econômico: -1.0 a +1.0)**: Privatizações de empresas públicas, teto de gastos/rigor fiscal, reforma tributária sobre grandes fortunas vs desoneração de empresas, flexibilização das leis trabalhistas da CLT.
2. **Saúde & Educação**: Gestão do SUS (100% estatal vs Organizações Sociais/Vouchers) e modelo pedagógico (escola integral e laica vs escolas cívico-militares).
3. **Segurança Pública (Eixo Social: -1.0 a +1.0)**: Facilitação do porte e posse de armas para civis, rigor penal (fim de saídas temporárias e redução da maioridade) e uso obrigatório de câmeras corporais em policiais.
4. **Meio Ambiente & Agro**: Licenciamento ambiental e obras no Cerrado/Amazônia vs rigor de proteção ecológica e transição energética.
5. **Governança & Valores**: Extinção imediata do Fundo Eleitoral (Fundão de bilhões de reais), estabilidade do funcionalismo público e pautas morais/direitos civis.

### Fórmula de Afinidade (*Fit Score*)
Para cada candidato $C$ e usuário $U$, a distância euclidiana ponderada é calculada por:
$$d = \sqrt{w_{econ}(E_U - E_C)^2 + w_{soc}(S_U - S_C)^2 + w_{gov}(G_U - G_C)^2}$$
$$\text{Fit (\%)} = \max\left(0, \min\left(100, \left(1 - \frac{d}{d_{max}}\right) \times 100\right)\right)$$

---

## 🛠️ Reexecução do Pipeline TSE (Opcional)

Caso adicione novos arquivos do TSE na pasta `docs/` e deseje recriar o banco e o grafo do zero:
```bash
npm run extract
```
O script lê os arquivos compactados, extrai os PDFs com `pdf-parse`, processa os CSVs com *transactions* no SQLite e reconstrói o arquivo `data/graphify_knowledge_graph.json`.

---

## 📁 Estrutura do Repositório

```
eleicao-2026-radar/
├── data/
│   ├── eleicoes_2026.db               # Banco SQLite completo (candidatos, bens, certidões, FTS5)
│   ├── graphify_knowledge_graph.json  # Grafo Graphify com nós e arestas explicadas
│   └── proposals_text/                # Textos integrais dos 11 Planos de Governo em PDF
├── docs/                              # Arquivos de dados do TSE
├── src/
│   ├── pipeline/
│   │   ├── extract_tse.js             # Pipeline ETL dos arquivos do TSE
│   │   ├── analyze_proposals.js       # Extrator de textos e NLP de pilares em PDFs
│   │   └── party_ideology.js          # Calibração ideológica partidária de referência
│   ├── questionnaire/
│   │   ├── questions.json             # Banco de 15 questões e opções calibradas
│   │   └── engine.js                  # Algoritmo de cálculo de coordenada e Match
│   ├── rag/
│   │   ├── search.js                  # Motor de busca RAG e geração de Dossiê 360º
│   │   └── cli.js                     # Interface CLI para busca no terminal
│   └── server/
│       ├── app.js                     # Servidor Express com APIs REST e rotas
│       └── public/
│           ├── index.html             # Interface web responsiva
│           ├── style.css              # Design system moderno (dark mode, glassmorphism)
│           └── app.js                 # Lógica do cliente, Canvas 2D da Bússola e Grafo
├── package.json
└── README.md
```

---

## 📚 Referências & Créditos

* **[TSE Dados Abertos](https://dadosabertos.tse.jus.br/)**: Fonte primária e pública de todos os dados oficiais utilizados.
* **[garrytan/gstack](https://github.com/garrytan/gstack)**: Filosofia de fluxo de engenharia estruturado (Think → Plan → Build → Review → Test → Ship).
* **[Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify)**: Conceito de Knowledge Graph determinístico com nós tipados e arestas com explicação semântica explícita.
* **[olhoneles/politicos](https://github.com/olhoneles/politicos)**: Inspiração para modelagem e consumo aberto de dados eleitorais brasileiros.

---

## ⚖️ Licença e Isenção de Responsabilidade

Este projeto é disponibilizado sob a licença [MIT](LICENSE).  
Todos os dados foram obtidos legalmente a partir do portal oficial de Dados Abertos do Tribunal Superior Eleitoral (TSE). O projeto possui caráter estritamente educacional, cívico e informativo, sem qualquer vinculação ou preferência partidária.
