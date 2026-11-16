# 📚 EnemTester

Site para estudar resolvendo **provas antigas do ENEM**. A cada questão respondida, o estudante vê se acertou e recebe uma **explicação completa**: por que a alternativa certa está certa, por que cada uma das outras está errada, uma mini-aula sobre o conteúdo cobrado e uma dica para a prova.

## Funcionalidades

- **Provas oficiais de 2009 a 2025**: até 2023 pela API pública [enem.dev](https://enem.dev); 2024 e 2025 extraídas dos PDFs oficiais do INEP. Filtro por área, língua estrangeira (inglês/espanhol), quantidade e ordem aleatória.
- **Modo Estudo**: correção e explicação logo após cada questão.
- **Modo Simulado**: cronômetro, navegação livre entre questões e correção só no final.
- **Explicações por IA** (Claude), geradas uma vez só e salvas no projeto (`npm run gerar`), ou na hora, se houver chave da API. Cada questão só é paga uma vez.
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

Sem `ANTHROPIC_API_KEY`, o site funciona normalmente (questões, gabarito, simulado, estatísticas) e mostra as explicações que já estiverem prontas em `data/explanations/` (veja abaixo).

## Explicações prontas (recomendado)

Em vez de gerar cada explicação na hora, você pode gerar todas **uma vez só** e deixar salvas no projeto, em `data/explanations/`. Depois disso o site mostra as explicações na hora, **sem precisar de chave da API e sem custo nenhum** para quem usa.

Com a `ANTHROPIC_API_KEY` no `.env`:

```bash
# 1) Teste rápido: 5 questões, na hora
npm run gerar -- --anos 2023 --modelo claude-haiku-5-5 --agora --limite 5

# 2) Uma prova inteira, em lote (metade do preço)
npm run gerar -- --anos 2023 --modelo claude-haiku-5-5

# 3) Várias provas
npm run gerar -- --anos 2019-2023 --modelo claude-haiku-5-5
```

- O script mostra o **custo estimado** e pede confirmação antes de gastar.
- Questões que já têm explicação são **puladas**: rodar de novo só gera as que faltam (ou as que falharam).
- No modo em lote (o padrão), o resultado costuma sair em menos de 1 hora. Se fechar o terminal, rode `npm run gerar` de novo para continuar de onde parou.
- As explicações são arquivos Markdown: dá para revisar e corrigir à mão. Use `--refazer` para gerar de novo (por exemplo, com um modelo melhor).

Custo aproximado por prova inteira (~185 questões) no modo em lote: Haiku 5.5 ~US$ 0,15 · Sonnet 5.5 ~US$ 3 · Opus 5.5 ~US$ 6.

O site procura primeiro a explicação pronta. Se ela não existir e houver chave da API configurada, gera na hora (e salva). Sem chave, mostra só o gabarito.

### Produção

```bash
npm run build
npm start          # serve o site e a API em http://localhost:3001
```

## Provas de 2024 em diante

A base enem.dev só vai até 2023. As provas mais novas ficam guardadas no próprio projeto, extraídas dos PDFs oficiais do INEP:

- `data/questions/<ano>.json`: questões (enunciado, alternativas e gabarito oficial);
- `public/enem-assets/<ano>/`: figuras, gráficos e alternativas em forma de imagem, recortados da prova;
- `data/questions/exams.json`: lista dessas provas. Uma prova marcada com `"unofficial": true` aparece no site como **demo, não oficial**.

Para importar uma prova nova (por exemplo, quando o INEP publicar a de 2026):

```bash
pip install pymupdf pillow
python3 scripts/importar-prova-inep.py 2026 2026_PV_impresso_D1_CD1.pdf 2026_PV_impresso_D2_CD7.pdf 2026_GB_impresso_D1_CD1.pdf 2026_GB_impresso_D2_CD7.pdf
```

Depois, adicione o ano em `data/questions/exams.json` e confira as questões no site. Questões anuladas ficam de fora.

## Como funciona

```
navegador (React)  →  servidor Node (Express)  →  api.enem.dev     (questões)
                                               →  API do Claude    (explicações)
```

- `server/enem.ts` busca e normaliza as provas, com cache em memória.
- `server/explain.ts` monta o prompt (texto da questão, imagens e gabarito oficial) e faz o streaming da explicação. O resultado fica em `data/explanations/`.
- `scripts/generate-explanations.ts` gera as explicações em lote (Message Batches API, metade do preço).
- O cliente só envia **ano, número e idioma** da questão; o servidor busca a questão sozinho. Por isso o endpoint não serve como proxy aberto para a IA. Há também um limite por IP (`EXPLAIN_LIMIT_PER_HOUR`, padrão 60).
- `src/` tem o front-end (React + Vite). O progresso do aluno fica no `localStorage`.

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `ANTHROPIC_API_KEY` | (nenhuma) | Chave da API do Claude para gerar as explicações |
| `CLAUDE_MODEL` | `claude-opus-5-5` | Modelo usado nas explicações (ao vivo e padrão do `npm run gerar`) |
| `PORT` | `3001` | Porta do servidor |
| `ENEM_API_URL` | `https://api.enem.dev/v1` | Fonte das provas |
| `EXPLAIN_LIMIT_PER_HOUR` | `60` | Explicações novas por IP por hora |

## Créditos

Questões: provas oficiais do ENEM (INEP), disponibilizadas pela API [enem.dev](https://enem.dev). As explicações são geradas por IA; confira sempre com seu material de estudo.
