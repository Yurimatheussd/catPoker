// Modo Analítico: critérios e cálculos compartilhados entre navegador, servidor e testes.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CatAnalytic = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const MIN_SCORE = 0;
  const MAX_SCORE = 5;
  const FIBONACCI_POINTS = [1, 2, 3, 5, 8, 13];
  // Amplitude (maior nota - menor nota) a partir da qual um critério é considerado divergente.
  const DIVERGENCE_RANGE = 3;

  const CRITERIA = [
    {
      key: 'complexity',
      name: 'Complexidade técnica',
      icon: '🧩',
      question: 'Quão difícil é implementar essa solução?',
      short: 'Dificuldade técnica da implementação: algoritmos, regras, arquitetura.',
      legend: [
        'Nenhuma dificuldade técnica relevante.',
        'Alteração trivial, totalmente conhecida.',
        'Implementação simples com padrões existentes.',
        'Complexidade moderada, exigindo alguma análise.',
        'Implementação complexa com múltiplas regras ou componentes.',
        'Complexidade extrema, envolvendo arquitetura ou desafios técnicos significativos.',
      ],
    },
    {
      key: 'effort',
      name: 'Esforço',
      icon: '💪',
      question: 'Quanto trabalho será necessário para concluir essa tarefa?',
      short: 'Volume de trabalho: alterações, atividades e validações.',
      note: 'Esforço não significa diretamente uma quantidade fixa de horas: avalie o volume de trabalho relativo.',
      legend: [
        'Esforço praticamente inexistente.',
        'Trabalho muito pequeno e pontual.',
        'Poucas atividades, execução simples.',
        'Trabalho moderado, com várias atividades.',
        'Trabalho extenso, envolvendo muitas alterações e validações.',
        'Volume de trabalho muito elevado.',
      ],
    },
    {
      key: 'uncertainty',
      name: 'Incerteza',
      icon: '🔍',
      question: 'Quanto ainda precisamos descobrir para implementar essa solução?',
      short: 'O que ainda é desconhecido. Quanto maior a incerteza, maior a nota.',
      note: 'Quanto maior a incerteza, maior a nota.',
      legend: [
        'Solução totalmente conhecida, sem dúvidas.',
        'Quase tudo está definido.',
        'Pequenas dúvidas técnicas ou funcionais.',
        'Existem questões importantes a investigar.',
        'Muitas informações ou decisões estão indefinidas.',
        'Solução altamente incerta, exigindo investigação significativa.',
      ],
    },
    {
      key: 'dependencies',
      name: 'Dependências',
      icon: '🔗',
      question: 'Quantos sistemas, serviços, equipes ou componentes externos estão envolvidos?',
      short: 'Sistemas, serviços, equipes ou componentes externos envolvidos.',
      note: 'Considere também o impacto das dependências, não apenas sua quantidade.',
      legend: [
        'Nenhuma dependência relevante.',
        'Dependências internas simples, já disponíveis.',
        'Poucas dependências conhecidas.',
        'Algumas dependências que exigem coordenação.',
        'Várias integrações ou equipes envolvidas.',
        'Dependências numerosas, críticas ou difíceis de controlar.',
      ],
    },
    {
      key: 'risk',
      name: 'Risco',
      icon: '⚠️',
      question: 'Qual a possibilidade e o impacto de alguma coisa dar errado?',
      short: 'Chance e impacto de algo dar errado.',
      note: 'Considere possíveis regressões, falhas, problemas de integração e impacto no negócio.',
      legend: [
        'Risco praticamente inexistente.',
        'Risco mínimo, com impacto insignificante.',
        'Risco baixo, facilmente controlável.',
        'Risco moderado, exigindo atenção e testes.',
        'Risco alto, com possíveis impactos importantes.',
        'Risco crítico, podendo afetar funcionalidades essenciais.',
      ],
    },
  ];

  const CRITERIA_COUNT = CRITERIA.length;

  function isValidScore(value) {
    return Number.isInteger(value) && value >= MIN_SCORE && value <= MAX_SCORE;
  }

  function emptyScores() {
    return new Array(CRITERIA_COUNT).fill(null);
  }

  function answeredCount(scores) {
    if (!Array.isArray(scores)) return 0;
    return scores.filter(isValidScore).length;
  }

  function isComplete(scores) {
    return Array.isArray(scores) && scores.length === CRITERIA_COUNT && scores.every(isValidScore);
  }

  // Média das cinco notas de um participante, arredondada para o inteiro mais próximo.
  function roundedAverage(scores) {
    if (!isComplete(scores)) return null;
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / CRITERIA_COUNT);
  }

  // Converte uma média (0 a 5) em Fibonacci. Faixas com limites exatos em múltiplos de 5/6:
  // a faixa é floor(média / (5/6)) = floor(6 * média / 5), limitada a 13.
  function fibonacciFromAverage(average) {
    if (typeof average !== 'number' || Number.isNaN(average)) return null;
    let index = 0;
    while (index < FIBONACCI_POINTS.length - 1 && average * 6 >= 5 * (index + 1)) index++;
    return FIBONACCI_POINTS[index];
  }

  // Mesma conversão, mas a partir da fração soma/quantidade em aritmética inteira,
  // sem nenhum arredondamento da média (as médias individuais arredondadas são sempre inteiras).
  function fibonacciFromRatio(sum, count) {
    if (!count) return null;
    let index = 0;
    while (index < FIBONACCI_POINTS.length - 1 && sum * 6 >= 5 * (index + 1) * count) index++;
    return FIBONACCI_POINTS[index];
  }

  // Resultado coletivo a partir da lista de avaliações (arrays de 5 notas). Avaliações incompletas são ignoradas.
  function summarize(scoreLists) {
    const valid = (scoreLists || []).filter(isComplete);
    const averages = valid.map(roundedAverage);
    const count = valid.length;
    const sum = averages.reduce((a, b) => a + b, 0);
    const criteria = CRITERIA.map((criterion, i) => {
      const values = valid.map((scores) => scores[i]);
      const total = values.reduce((a, b) => a + b, 0);
      const min = count ? Math.min(...values) : null;
      const max = count ? Math.max(...values) : null;
      return {
        key: criterion.key,
        name: criterion.name,
        average: count ? total / count : null,
        min,
        max,
        divergent: count > 1 && max - min >= DIVERGENCE_RANGE,
      };
    });
    const topAverage = count ? Math.max(...criteria.map((c) => c.average)) : null;
    criteria.forEach((c) => {
      c.highest = count > 0 && c.average === topAverage;
    });
    return {
      count,
      averages,
      average: count ? sum / count : null,
      fibonacci: fibonacciFromRatio(sum, count),
      criteria,
    };
  }

  // Resultado de uma rodada a partir do estado público da sala. Só existe depois da revelação,
  // pois antes disso o servidor não envia as notas.
  function roomResult(state) {
    if (!state || state.mode !== 'analytic' || !state.revealed) return null;
    const players = (state.players || []).filter((p) => isComplete(p.scores));
    return summarize(players.map((p) => p.scores));
  }

  function formatNumber(value, digits) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return value.toFixed(digits === undefined ? 1 : digits).replace('.', ',');
  }

  // Até `digits` casas, sem zeros à direita (3,8 / 3,75 / 3,67).
  function formatAverage(value, digits) {
    if (value === null || value === undefined || Number.isNaN(value)) return '—';
    return String(Number(value.toFixed(digits === undefined ? 2 : digits))).replace('.', ',');
  }

  return {
    CRITERIA,
    CRITERIA_COUNT,
    MIN_SCORE,
    MAX_SCORE,
    FIBONACCI_POINTS,
    DIVERGENCE_RANGE,
    isValidScore,
    emptyScores,
    answeredCount,
    isComplete,
    roundedAverage,
    fibonacciFromAverage,
    fibonacciFromRatio,
    summarize,
    roomResult,
    formatNumber,
    formatAverage,
  };
});
