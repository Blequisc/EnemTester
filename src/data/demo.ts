// Questões de demonstração no estilo ENEM (escritas para este projeto, não são de provas oficiais).
// Já vêm com explicação pronta, então funcionam sem internet e sem chave da API.
import type { Question } from "../../shared/types";

const base = { year: 0, files: [] as string[], language: null };

export const DEMO_QUESTIONS: Question[] = [
  {
    ...base,
    id: "demo-1",
    index: 1,
    title: "Demonstração 1",
    discipline: "matematica",
    context:
      "Uma loja anunciou uma promoção em duas etapas: primeiro, todos os produtos receberam **20% de desconto**. Uma semana depois, a loja aplicou **mais 10% de desconto** sobre o preço já reduzido.\n\nUm cliente que comprou um produto depois da segunda etapa recebeu, em relação ao preço original, um desconto total de",
    alternativesIntroduction: "",
    alternatives: [
      { letter: "A", text: "18%.", file: null },
      { letter: "B", text: "25%.", file: null },
      { letter: "C", text: "28%.", file: null },
      { letter: "D", text: "30%.", file: null },
      { letter: "E", text: "32%.", file: null },
    ],
    correctAlternative: "C",
    explanation: `## ✅ Resposta: letra C
A questão pede o desconto **total equivalente** a dois descontos aplicados em sequência.

### Por que a alternativa C está correta
Descontos sucessivos se **multiplicam**, não se somam. Pense num produto de R$ 100:
1. Com 20% de desconto: 100 × 0,80 = **R$ 80**.
2. Com mais 10% sobre R$ 80: 80 × 0,90 = **R$ 72**.

O cliente paga R$ 72, ou seja, 72% do preço original. O desconto total é 100% − 72% = **28%**.

Em uma única conta: 0,80 × 0,90 = 0,72 → desconto de 1 − 0,72 = 0,28.

### Por que as outras estão erradas
**A)** 18% não corresponde a nenhuma operação correta com os dados.
**B)** 25% pode vir de uma estimativa "no olho", sem fazer a conta.
**D)** 30% é a pegadinha clássica: somar 20% + 10%. O segundo desconto incide sobre um valor menor, então vale menos que 10% do original.
**E)** 32% erra para o lado oposto, como se o segundo desconto fosse maior que o primeiro.

### 📚 O conteúdo por trás da questão
**Porcentagem e fator multiplicativo.** Todo aumento ou desconto de p% pode ser escrito como uma multiplicação:
- aumento de p% → multiplicar por (1 + p/100). Ex.: +15% → × 1,15
- desconto de p% → multiplicar por (1 − p/100). Ex.: −20% → × 0,80

Variações sucessivas são o **produto** dos fatores. Por isso, um aumento de 10% seguido de um desconto de 10% **não** volta ao preço original: 1,10 × 0,90 = 0,99 (perda de 1%).

### 💡 Dica para a prova
Sempre que aparecerem porcentagens em sequência (juros, inflação, descontos), troque cada uma pelo fator multiplicativo e multiplique. Usar R$ 100 como preço de teste torna a conta imediata.`,
  },
  {
    ...base,
    id: "demo-2",
    index: 2,
    title: "Demonstração 2",
    discipline: "linguagens",
    context:
      "— E aí, cê vai na festa hoje?\n\n— Vô não, tô cansadão. Amanhã cedo tem treino.\n\n— Ah, para! Bora, rapidinho só.\n\nNo diálogo entre dois amigos, as formas \"cê\", \"vô\", \"tô\" e \"bora\" revelam",
    alternativesIntroduction: "",
    alternatives: [
      { letter: "A", text: "erros gramaticais que comprometem a compreensão da mensagem.", file: null },
      { letter: "B", text: "um registro informal, adequado à situação de interação entre os falantes.", file: null },
      { letter: "C", text: "uma variedade regional restrita a uma única região do país.", file: null },
      { letter: "D", text: "o uso de termos técnicos próprios do vocabulário esportivo.", file: null },
      { letter: "E", text: "a intenção de ironizar a linguagem utilizada pelos jovens.", file: null },
    ],
    correctAlternative: "B",
    explanation: `## ✅ Resposta: letra B
A questão pede que você identifique o que as formas reduzidas da fala revelam sobre o uso da língua.

### Por que a alternativa B está correta
"Cê" (você), "vô" (vou), "tô" (estou) e "bora" (vamos embora) são reduções típicas da **oralidade informal**. Os falantes são amigos conversando sobre uma festa: é uma situação descontraída, em que esse registro é **adequado**. A comunicação acontece sem nenhum problema.

### Por que as outras estão erradas
**A)** O ENEM não trata variação linguística como "erro". Além disso, a mensagem é perfeitamente compreendida.
**C)** Essas formas são usadas em praticamente todo o Brasil; não há marca de uma região específica.
**D)** "Treino" aparece no texto, mas as formas destacadas não são termos técnicos do esporte.
**E)** Não há ironia: o diálogo apenas reproduz uma conversa natural.

### 📚 O conteúdo por trás da questão
**Variação linguística** é um dos temas mais cobrados em Linguagens. A língua varia conforme:
- **a região** (variação diatópica): "mandioca", "aipim", "macaxeira";
- **o grupo social** e a idade (diastrática): gírias de jovens, jargões profissionais;
- **a situação de uso** (diafásica): formal × informal;
- **o tempo** (diacrônica): "vossa mercê" → "vosmecê" → "você" → "cê".

A ideia central é a de **adequação**: não existe forma "certa" ou "errada" em absoluto, e sim forma adequada ou inadequada ao contexto. O ENEM costuma combater o **preconceito linguístico**.

### 💡 Dica para a prova
Desconfie de alternativas que chamam variações de "erro", "vício" ou "linguagem pobre". Em questões de variação, a resposta costuma falar em adequação ao contexto, identidade do grupo ou situação comunicativa.`,
  },
  {
    ...base,
    id: "demo-3",
    index: 3,
    title: "Demonstração 3",
    discipline: "ciencias-natureza",
    context:
      "Em um ecossistema de campo, uma cadeia alimentar é formada por capim → gafanhoto → sapo → cobra. Medições mostram que a quantidade de energia disponível diminui a cada nível trófico, de modo que a cobra recebe apenas uma pequena fração da energia captada pelo capim.\n\nEssa redução de energia ao longo da cadeia ocorre porque",
    alternativesIntroduction: "",
    alternatives: [
      { letter: "A", text: "a energia é reciclada pelos decompositores e retorna aos produtores.", file: null },
      { letter: "B", text: "os consumidores de níveis mais altos têm metabolismo mais lento.", file: null },
      { letter: "C", text: "parte da energia de cada nível é liberada como calor nos processos metabólicos, como a respiração celular.", file: null },
      { letter: "D", text: "os produtores armazenam a maior parte da energia em forma de água.", file: null },
      { letter: "E", text: "a matéria orgânica é destruída ao passar de um organismo para outro.", file: null },
    ],
    correctAlternative: "C",
    explanation: `## ✅ Resposta: letra C
A questão pergunta por que a energia diminui de um nível trófico para o seguinte.

### Por que a alternativa C está correta
Cada organismo usa a maior parte da energia que obtém para **se manter vivo**: respirar, se movimentar, manter a temperatura do corpo, crescer. Na respiração celular, boa parte dessa energia é **dissipada como calor**, que não pode ser reaproveitado pelo próximo nível. Além disso, nem tudo é comido ou digerido. Em média, só cerca de **10%** da energia passa adiante.

### Por que as outras estão erradas
**A)** Quem é reciclada é a **matéria** (nutrientes). A energia tem fluxo **unidirecional**: não volta aos produtores.
**B)** A taxa de metabolismo não explica a perda; a perda acontece em todos os níveis.
**D)** Os produtores armazenam energia em **moléculas orgânicas** (como a glicose), não em água.
**E)** A matéria não é "destruída": ela é transformada e reaproveitada (lei de conservação da massa).

### 📚 O conteúdo por trás da questão
**Fluxo de energia nos ecossistemas:**
- Os **produtores** captam energia luminosa na fotossíntese e a guardam em compostos orgânicos.
- A energia passa aos **consumidores** pela alimentação, sempre diminuindo.
- Por isso a **pirâmide de energia** nunca é invertida, e cadeias alimentares raramente têm mais de 4 ou 5 níveis.

Guarde a diferença: **matéria circula** (ciclos do carbono, nitrogênio, água) e **energia flui** em um só sentido, saindo do sistema como calor.

### 💡 Dica para a prova
Se uma alternativa disser que a energia "é reciclada" ou "volta" para os produtores, ela está errada. Esse é um dos distratores mais usados em Ecologia.`,
  },
  {
    ...base,
    id: "demo-4",
    index: 4,
    title: "Demonstração 4",
    discipline: "ciencias-humanas",
    context:
      "Promulgada em 5 de outubro de 1988, a atual Constituição brasileira ficou conhecida como \"Constituição Cidadã\", expressão usada por Ulysses Guimarães, presidente da Assembleia Nacional Constituinte.\n\nEssa denominação está relacionada ao fato de o texto constitucional",
    alternativesIntroduction: "",
    alternatives: [
      { letter: "A", text: "ter mantido os atos institucionais criados durante o regime militar.", file: null },
      { letter: "B", text: "ter sido redigido exclusivamente por representantes do Poder Executivo.", file: null },
      { letter: "C", text: "ter restringido o direito de voto aos cidadãos alfabetizados.", file: null },
      { letter: "D", text: "ter ampliado os direitos e garantias fundamentais após o fim da ditadura.", file: null },
      { letter: "E", text: "ter instituído o parlamentarismo como sistema de governo.", file: null },
    ],
    correctAlternative: "D",
    explanation: `## ✅ Resposta: letra D
A questão pede o motivo de a Constituição de 1988 ser chamada de "Cidadã".

### Por que a alternativa D está correta
A Constituição de 1988 foi elaborada logo após o fim da **ditadura militar (1964–1985)** e marcou a **redemocratização**. Ela ampliou muito os direitos: voto facultativo para analfabetos e jovens de 16 e 17 anos, proibição da tortura e da censura, criação do **SUS**, direitos trabalhistas e sociais, proteção a povos indígenas e ao meio ambiente. Essa ampliação da cidadania explica o apelido.

### Por que as outras estão erradas
**A)** Ao contrário: ela rompeu com o autoritarismo; os atos institucionais (como o AI-5) já haviam sido revogados.
**B)** Ela foi escrita por uma **Assembleia Constituinte** eleita, com intensa participação popular por meio de emendas.
**C)** Ela **estendeu** o voto aos analfabetos (de forma facultativa).
**E)** O sistema parlamentarista foi rejeitado no plebiscito de 1993; o Brasil seguiu presidencialista.

### 📚 O conteúdo por trás da questão
**Redemocratização brasileira**, em ordem:
1. **Lei da Anistia** (1979) e abertura "lenta, gradual e segura".
2. **Diretas Já** (1983–1984): grandes manifestações por eleições diretas para presidente.
3. **Eleição indireta de Tancredo Neves** (1985) e posse de José Sarney.
4. **Constituição de 1988**: direitos fundamentais (art. 5º), direitos sociais (art. 6º), cláusulas pétreas.
5. **Primeira eleição direta** para presidente após o regime: 1989.

### 💡 Dica para a prova
Questões sobre 1988 quase sempre giram em torno de **cidadania, direitos sociais e participação popular**. Alternativas que falam em restringir direitos ou manter instrumentos da ditadura podem ser eliminadas de cara.`,
  },
  {
    ...base,
    id: "demo-5",
    index: 5,
    title: "Demonstração 5",
    discipline: "matematica",
    context:
      "Em um jogo de tabuleiro, o jogador lança dois dados comuns, de seis faces numeradas de 1 a 6, e só pode sair da casa inicial se a **soma** dos resultados for igual a 7.\n\nA probabilidade de o jogador sair da casa inicial na primeira jogada é",
    alternativesIntroduction: "",
    alternatives: [
      { letter: "A", text: "1/12", file: null },
      { letter: "B", text: "1/11", file: null },
      { letter: "C", text: "1/6", file: null },
      { letter: "D", text: "7/36", file: null },
      { letter: "E", text: "1/2", file: null },
    ],
    correctAlternative: "C",
    explanation: `## ✅ Resposta: letra C
A questão pede a probabilidade de a soma de dois dados ser 7.

### Por que a alternativa C está correta
Com dois dados há **6 × 6 = 36** resultados possíveis, todos igualmente prováveis. Os que somam 7 são:
(1,6), (2,5), (3,4), (4,3), (5,2), (6,1) → **6 casos favoráveis**.

P = 6/36 = **1/6**.

### Por que as outras estão erradas
**A)** 1/12 aparece quando se contam só 3 pares, esquecendo que (1,6) e (6,1) são resultados diferentes.
**B)** 1/11 vem de considerar as 11 somas possíveis (2 a 12) como igualmente prováveis, o que não é verdade.
**D)** 7/36 confunde o valor da soma (7) com o número de casos favoráveis (6).
**E)** 1/2 não tem relação com a contagem de casos.

### 📚 O conteúdo por trás da questão
**Probabilidade clássica:** P = casos favoráveis ÷ casos possíveis, desde que todos os casos tenham a mesma chance.

Com dois dados, a ordem importa: (2,5) e (5,2) são resultados distintos. Por isso as somas **não** são igualmente prováveis:
- soma 2 ou 12: 1 caso cada;
- soma 7: 6 casos (a mais provável).

Montar uma **tabela 6 × 6** é a forma mais segura de resolver esse tipo de questão.

### 💡 Dica para a prova
Em problemas com dados, moedas ou sorteios, pergunte-se: "a ordem importa?" e "os casos são igualmente prováveis?". Isso evita as duas pegadinhas mais comuns.`,
  },
];
