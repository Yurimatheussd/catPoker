const test = require('node:test');
const assert = require('node:assert/strict');
const { io: ioClient } = require('socket.io-client');
const { server, io, rooms } = require('../server');

let url;

test.before(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  io.close();
});

test.afterEach(() => {
  rooms.clear();
});

function connect() {
  const socket = ioClient(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  socket.states = [];
  socket.on('state', (state) => socket.states.push(state));
  return new Promise((resolve) => socket.on('connect', () => resolve(socket)));
}

function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

// Espera o próximo estado que satisfaça a condição.
function waitState(socket, predicate) {
  const last = socket.states[socket.states.length - 1];
  if (last && predicate(last)) return Promise.resolve(last);
  return new Promise((resolve) => {
    const handler = (state) => {
      if (predicate(state)) {
        socket.off('state', handler);
        resolve(state);
      }
    };
    socket.on('state', handler);
  });
}

async function createRoom(mode, name = 'Ana', extra = {}) {
  const socket = await connect();
  const joined = once(socket, 'joined');
  socket.emit('create-room', { roomName: 'Sala', password: 'x', name, mode, clientId: `c-${name}`, ...extra });
  return { socket, joined: await joined };
}

async function joinRoom(roomId, name, extra = {}) {
  const socket = await connect();
  const joined = once(socket, 'joined');
  socket.emit('join-room', { roomId, password: 'x', name, clientId: `c-${name}`, ...extra });
  return { socket, joined: await joined };
}

function score(socket, values) {
  values.forEach((value, index) => socket.emit('analytic-score', { index, value }));
}

test('sala clássica continua igual: modo padrão e votos Fibonacci', async () => {
  const { socket, joined } = await createRoom(undefined);
  assert.equal(joined.mode, 'classic');
  socket.emit('analytic-score', { index: 0, value: 3 });
  socket.emit('vote', '8');
  const state = await waitState(socket, (s) => s.allVoted);
  assert.equal(state.mode, 'classic');
  assert.equal(state.players[0].progress, undefined);
  assert.equal(state.players[0].vote, null);
  socket.emit('reveal');
  const revealed = await waitState(socket, (s) => s.revealed);
  assert.equal(revealed.players[0].vote, '8');
  socket.close();
});

test('modo analítico: progresso visível, notas ocultas até revelar, cálculo e nova rodada', async () => {
  const { socket: ana, joined } = await createRoom('analytic', 'Ana');
  assert.equal(joined.mode, 'analytic');
  const { socket: bia } = await joinRoom(joined.roomId, 'Bia');
  const { socket: spec } = await joinRoom(joined.roomId, 'Espectador', { spectator: true });

  // voto clássico é ignorado no modo analítico
  ana.emit('vote', '8');
  score(ana, [4, 3, 5]);
  let state = await waitState(bia, (s) => s.players.some((p) => p.name === 'Ana' && p.progress === 3));
  let anaPublic = state.players.find((p) => p.name === 'Ana');
  assert.equal(anaPublic.voted, false);
  assert.equal(anaPublic.scores, null);
  assert.equal(anaPublic.vote, null);

  // não dá para revelar com avaliação incompleta
  ana.emit('reveal');
  score(ana, [4, 3, 5, 4, 4]);
  score(bia, [3, 4, 3, 3, 5]);
  state = await waitState(spec, (s) => s.allVoted);
  assert.equal(state.revealed, false);
  assert.ok(state.players.every((p) => p.scores === null && p.vote === null && p.progress === 5));
  assert.equal(state.spectators.length, 1);
  assert.equal(state.players.length, 2);

  // espectador não vota nem revela
  spec.emit('analytic-score', { index: 0, value: 5 });
  spec.emit('reveal');
  bia.emit('reveal');
  state = await waitState(spec, (s) => s.revealed);
  anaPublic = state.players.find((p) => p.name === 'Ana');
  assert.deepEqual(anaPublic.scores, [4, 3, 5, 4, 4]);
  assert.equal(anaPublic.vote, '4');
  assert.equal(state.players.find((p) => p.name === 'Bia').vote, '3');

  // notas não mudam depois de revelar
  ana.emit('analytic-score', { index: 0, value: 0 });

  // estimativa final confirmada pela equipe
  spec.emit('set-final', '13');
  bia.emit('set-final', '7');
  bia.emit('set-final', '5');
  state = await waitState(ana, (s) => s.finalEstimate === '5');
  assert.deepEqual(state.players.find((p) => p.name === 'Ana').scores, [4, 3, 5, 4, 4]);

  const round = state.round;
  ana.emit('reset');
  state = await waitState(bia, (s) => s.round === round + 1);
  assert.equal(state.revealed, false);
  assert.equal(state.finalEstimate, null);
  assert.ok(state.players.every((p) => p.progress === 0 && !p.voted && p.scores === null));

  [ana, bia, spec].forEach((s) => s.close());
});

test('reconexão: restaura avaliação sem duplicar a cadeira', async () => {
  const { socket: ana, joined } = await createRoom('analytic', 'Ana');
  const { socket: bia } = await joinRoom(joined.roomId, 'Bia');
  score(bia, [1, 2, 3]);
  await waitState(ana, (s) => s.players.some((p) => p.name === 'Bia' && p.progress === 3));

  // Bia cai e volta com o mesmo clientId
  bia.close();
  await waitState(ana, (s) => s.players.length === 1);
  const { socket: bia2, joined: rejoined } = await joinRoom(joined.roomId, 'Bia');
  assert.deepEqual(rejoined.scores, [1, 2, 3, null, null]);
  let state = await waitState(ana, (s) => s.players.length === 2);
  assert.equal(state.players.find((p) => p.name === 'Bia').progress, 3);

  // mesmo clientId entrando de novo com o socket antigo ainda ativo: substitui, não duplica
  const { socket: bia3, joined: again } = await joinRoom(joined.roomId, 'Bia');
  assert.deepEqual(again.scores, [1, 2, 3, null, null]);
  state = await waitState(ana, (s) => s.players.filter((p) => p.name === 'Bia').length === 1 && s.players.length === 2);
  assert.equal(state.players.length, 2);

  // saída voluntária não guarda o voto
  bia3.emit('leave-room');
  await waitState(ana, (s) => s.players.length === 1);
  const { socket: bia4, joined: fresh } = await joinRoom(joined.roomId, 'Bia');
  assert.deepEqual(fresh.scores, [null, null, null, null, null]);

  [ana, bia2, bia3, bia4].forEach((s) => s.close());
});

test('reconexão após nova rodada não restaura votos antigos', async () => {
  const { socket: ana, joined } = await createRoom('classic', 'Ana');
  const { socket: bia } = await joinRoom(joined.roomId, 'Bia');
  bia.emit('vote', '5');
  await waitState(ana, (s) => s.players.some((p) => p.name === 'Bia' && p.voted));
  bia.close();
  await waitState(ana, (s) => s.players.length === 1);
  ana.emit('reset');
  await waitState(ana, (s) => s.round === 2);
  const { socket: bia2, joined: rejoined } = await joinRoom(joined.roomId, 'Bia');
  assert.equal(rejoined.vote, null);
  [ana, bia2].forEach((s) => s.close());
});
