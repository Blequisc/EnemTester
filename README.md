# 📚 EnemTester

Site para estudar resolvendo **provas antigas do ENEM**. A cada questão respondida, o estudante vê se acertou e recebe uma **explicação completa**: por que a alternativa certa está certa, por que cada uma das outras está errada, uma mini-aula sobre o conteúdo cobrado e uma dica para a prova.

## Funcionalidades

- **Provas oficiais de vários anos** (via API pública e gratuita [enem.dev](https://enem.dev)), com filtro por área, língua estrangeira (inglês/espanhol), quantidade e ordem aleatória.
- **Modo Estudo**: correção e explicação logo após cada questão.
- **Modo Simulado**: cronômetro, navegação livre entre questões e correção só no final.
- **Explicações por IA** (Claude), geradas na hora em streaming e guardadas em cache (no servidor e no navegador). Assim, cada questão só é explicada uma vez.
- **Caderno de erros**: as questões erradas ficam salvas para revisar; quando o estudante acerta, a questão sai da lista.
- **Desempenho por área**, salvo no navegador.
- **5 questões de demonstração** com explicação pronta, que funcionam sem internet e sem chave de API.
- Layout responsivo (celular e computador), tema claro/escuro automático e atalhos de teclado (A–E, Enter, setas).

## Como rodar

Requisitos: Node.js 20 ou mais recente.

```bash
npm install
cp .env.example .env   # e coloque sua ANTHROPIC_API_KEY
npm run dev
```

Abra http://localhost:5173.

Sem `ANTHROPIC_API_KEY`, o site funciona normalmente (questões, gabarito, simulado, estatísticas), mas sem as explicações automáticas das provas oficiais.

### Produção

```bash
npm run build
npm start          # serve o site e a API em http://localhost:3001
```

## Como funciona

```
navegador (React)  →  servidor Node (Express)  →  api.enem.dev     (questões)
                                               →  API do Claude    (explicações)
```

- `server/enem.ts` busca e normaliza as provas, com cache em memória.
- `server/explain.ts` monta o prompt (texto da questão, imagens e gabarito oficial) e faz o streaming da explicação. O resultado fica em `.cache/explanations/`.
- O cliente só envia **ano, número e idioma** da questão; o servidor busca a questão sozinho. Por isso o endpoint não serve como proxy aberto para a IA. Há também um limite por IP (`EXPLAIN_LIMIT_PER_HOUR`, padrão 60).
- `src/` tem o front-end (React + Vite). O progresso do aluno fica no `localStorage`.

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `ANTHROPIC_API_KEY` | (nenhuma) | Chave da API do Claude para gerar as explicações |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Modelo usado nas explicações |
| `PORT` | `3001` | Porta do servidor |
| `ENEM_API_URL` | `https://api.enem.dev/v1` | Fonte das provas |
| `EXPLAIN_LIMIT_PER_HOUR` | `60` | Explicações novas por IP por hora |

## Créditos

Questões: provas oficiais do ENEM (INEP), disponibilizadas pela API [enem.dev](https://enem.dev). As explicações são geradas por IA; confira sempre com seu material de estudo.
