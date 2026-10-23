const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../public/analytic');

// Gera todas as combinações de 5 notas entre 0 e 5 (6^5 = 7776).
function* allScoreLists() {
  for (let n = 0; n < 6 ** 5; n++) {
    const scores = [];
    let rest = n;
    for (let i = 0; i < 5; i++) {
      scores.push(rest % 6);
      rest = Math.floor(rest / 6);
    }
    yield scores;
  }
}

test('critérios: cinco critérios com legenda de 0 a 5', () => {
  assert.equal(A.CRITERIA.length, 5);
  assert.deepEqual(A.CRITERIA.map((c) => c.key), ['complexity', 'effort', 'uncertainty', 'dependencies', 'risk']);
  A.CRITERIA.forEach((c) => {
    assert.equal(c.legend.length, 6);
    assert.ok(c.question.endsWith('?'));
  });
  assert.match(A.CRITERIA[1].note, /horas/);
});

test('média arredondada: exemplo do enunciado (4, 3, 5, 4, 4) = 4', () => {
  assert.equal(A.roundedAverage([4, 3, 5, 4, 4]), 4);
});

test('média arredondada: todas as combinações de notas entre 0 e 5', () => {
  let count = 0;
  for (const scores of allScoreLists()) {
    const total = scores.reduce((sum, score) => sum + score, 0);
    const m = A.roundedAverage(scores);
    assert.ok(Math.abs(m - total / 5) < 0.5);
    assert.ok(Number.isInteger(m) && m >= 0 && m <= 5);
    count++;
  }
  assert.equal(count, 7776);
});

test('média arredondada: não muda a ordem original das notas', () => {
  const scores = [5, 0, 3, 1, 4];
  A.roundedAverage(scores);
  assert.deepEqual(scores, [5, 0, 3, 1, 4]);
});

test('média arredondada: avaliação incompleta ou inválida retorna null', () => {
  assert.equal(A.roundedAverage([1, 2, null, 4, 5]), null);
  assert.equal(A.roundedAverage([1, 2, 3, 4]), null);
  assert.equal(A.roundedAverage([1, 2, 3, 4, 6]), null);
  assert.equal(A.roundedAverage([1, 2, 3, 4, 2.5]), null);
  assert.equal(A.roundedAverage(null), null);
});

test('fibonacci: faixas e limites exatos em múltiplos de 5/6', () => {
  const cases = [
    [0, 1], [0.5, 1], [0.8333, 1], [5 / 6, 2], [0.8334, 2],
    [1.6666, 2], [10 / 6, 3], [1.6667, 3],
    [2.4999, 3], [2.5, 5],
    [3.3333, 5], [20 / 6, 8], [3.3334, 8], [3.8, 8],
    [4.1666, 8], [25 / 6, 13], [4.1667, 13], [5, 13],
  ];
  for (const [average, expected] of cases) {
    assert.equal(A.fibonacciFromAverage(average), expected, `média ${average}`);
  }
});

test('fibonacci a partir da fração: limites exatos sem arredondar a média', () => {
  // 5/6, 10/6, 15/6, 20/6, 25/6 exatamente nos limites (6 participantes)
  assert.equal(A.fibonacciFromRatio(4, 6), 1);
  assert.equal(A.fibonacciFromRatio(5, 6), 2);
  assert.equal(A.fibonacciFromRatio(9, 6), 2);
  assert.equal(A.fibonacciFromRatio(10, 6), 3);
  assert.equal(A.fibonacciFromRatio(14, 6), 3);
  assert.equal(A.fibonacciFromRatio(15, 6), 5);
  assert.equal(A.fibonacciFromRatio(19, 6), 5);
  assert.equal(A.fibonacciFromRatio(20, 6), 8);
  assert.equal(A.fibonacciFromRatio(24, 6), 8);
  assert.equal(A.fibonacciFromRatio(25, 6), 13);
  assert.equal(A.fibonacciFromRatio(30, 6), 13);
  assert.equal(A.fibonacciFromRatio(0, 0), null);
});

test('fibonacci: fração e média concordam com a definição para até 12 participantes', () => {
  for (let count = 1; count <= 12; count++) {
    for (let sum = 0; sum <= 5 * count; sum++) {
      const exact = A.fibonacciFromRatio(sum, count);
      // compara com a definição: maior k tal que sum/count >= k*5/6, i.e. 6*sum >= 5*k*count
      const k = Math.min(5, Math.floor((6 * sum) / (5 * count)));
      assert.equal(exact, A.FIBONACCI_POINTS[k], `${sum}/${count}`);
      assert.equal(A.fibonacciFromAverage(sum / count), exact, `média ${sum}/${count}`);
    }
  }
});

test('summarize: exemplo do enunciado (médias arredondadas 4, 4, 4, 4, 4 → 4 → 8 SP)', () => {
  const lists = [
    [4, 3, 5, 4, 4],
    [4, 4, 4, 3, 5],
    [5, 4, 4, 4, 4],
    [3, 4, 3, 3, 5],
    [3, 4, 3, 4, 5],
  ];
  const result = A.summarize(lists);
  assert.deepEqual(result.averages, [4, 4, 4, 4, 4]);
  assert.equal(result.count, 5);
  assert.ok(Math.abs(result.average - 4) < 1e-12);
  assert.equal(result.fibonacci, 8);
});

test('summarize: média aritmética de cada critério (não a média das médias arredondadas)', () => {
  const lists = [
    [4, 3, 5, 4, 4],
    [4, 4, 4, 3, 5],
    [5, 4, 4, 4, 4],
    [3, 4, 3, 3, 5],
    [3, 4, 3, 4, 5],
  ];
  const result = A.summarize(lists);
  const averages = result.criteria.map((c) => c.average);
  const expected = [3.8, 3.8, 3.8, 3.6, 4.6];
  averages.forEach((avg, i) => assert.ok(Math.abs(avg - expected[i]) < 1e-12, `${i}: ${avg}`));
  assert.deepEqual(result.criteria.map((c) => c.highest), [false, false, false, false, true]);
  assert.deepEqual(result.criteria.map((c) => [c.min, c.max]), [[3, 5], [3, 4], [3, 5], [3, 4], [4, 5]]);
});

test('summarize: divergência quando a amplitude é de 3 ou mais pontos', () => {
  const result = A.summarize([
    [0, 2, 1, 1, 1],
    [3, 4, 1, 1, 1],
  ]);
  assert.deepEqual(result.criteria.map((c) => c.divergent), [true, false, false, false, false]);
  assert.equal(A.summarize([[0, 0, 0, 0, 0]]).criteria[0].divergent, false);
});

test('summarize: empate no maior valor destaca todos os empatados', () => {
  const result = A.summarize([[5, 5, 1, 1, 1]]);
  assert.deepEqual(result.criteria.map((c) => c.highest), [true, true, false, false, false]);
});

test('summarize: ignora avaliações incompletas e trata sala sem votos', () => {
  const empty = A.summarize([]);
  assert.equal(empty.count, 0);
  assert.equal(empty.average, null);
  assert.equal(empty.fibonacci, null);
  assert.ok(empty.criteria.every((c) => c.average === null && !c.highest && !c.divergent));

  const partial = A.summarize([[1, 1, 1, 1, 1], [5, 5, null, 5, 5], null]);
  assert.equal(partial.count, 1);
  assert.equal(partial.average, 1);
  assert.equal(partial.fibonacci, 2);
});

test('roomResult: o resultado (e o gráfico) só existe depois da revelação', () => {
  const players = [
    { id: 'a', scores: [1, 2, 3, 4, 5] },
    { id: 'b', scores: [2, 2, 2, 2, 2] },
  ];
  assert.equal(A.roomResult({ mode: 'analytic', revealed: false, players }), null);
  assert.equal(A.roomResult({ mode: 'classic', revealed: true, players }), null);
  const result = A.roomResult({ mode: 'analytic', revealed: true, players });
  assert.equal(result.count, 2);
  assert.equal(result.average, 2.5);
  assert.equal(result.fibonacci, 5);
  // jogador revelado sem avaliação completa (ex.: entrou depois) não entra no cálculo
  const withLate = A.roomResult({ mode: 'analytic', revealed: true, players: [...players, { id: 'c', scores: [null, null, null, null, null] }] });
  assert.equal(withLate.count, 2);
});

test('formatNumber usa vírgula decimal', () => {
  assert.equal(A.formatNumber(3.8), '3,8');
  assert.equal(A.formatNumber(3.8, 2), '3,80');
  assert.equal(A.formatNumber(null), '—');
  assert.equal(A.formatAverage(3.8), '3,8');
  assert.equal(A.formatAverage(3.75), '3,75');
  assert.equal(A.formatAverage(11 / 3), '3,67');
  assert.equal(A.formatAverage(4), '4');
});


test('média arredondada: exemplo do usuário e arredondamento nos dois sentidos', () => {
  assert.equal(A.roundedAverage([5, 4, 1, 1, 2]), 3);
  assert.equal(A.roundedAverage([5, 3, 1, 1, 2]), 2);
  const result = A.summarize([[5, 4, 1, 1, 2]]);
  assert.deepEqual(result.averages, [3]);
  assert.equal(result.average, 3);
  assert.equal(result.fibonacci, 5);
});
