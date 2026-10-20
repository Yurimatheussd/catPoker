const socket = io();

const lobbyScreen = document.getElementById('lobby-screen');
const tableScreen = document.getElementById('table-screen');
const roomTitle = document.getElementById('room-title');
const roomListEl = document.getElementById('room-list');
const roomListEmpty = document.getElementById('room-list-empty');
const createRoomBtn = document.getElementById('create-room-btn');

const joinRoomModal = document.getElementById('join-room-modal');
const joinRoomTitle = document.getElementById('join-room-title');
const joinNameInput = document.getElementById('join-name-input');
const joinPasswordInput = document.getElementById('join-password-input');
const joinSpectatorCheckbox = document.getElementById('join-spectator-checkbox');
const joinRoomError = document.getElementById('join-room-error');
const joinRoomConfirmBtn = document.getElementById('join-room-confirm-btn');

const createRoomModal = document.getElementById('create-room-modal');
const createRoomNameInput = document.getElementById('create-room-name-input');
const createRoomPasswordInput = document.getElementById('create-room-password-input');
const createNameInput = document.getElementById('create-name-input');
const createMaxCardSelect = document.getElementById('create-max-card-select');
const createMaxCardRow = document.getElementById('create-max-card-row');
const createModeSelect = document.getElementById('create-mode-select');
const createModeHint = document.getElementById('create-mode-hint');
const createSpectatorCheckbox = document.getElementById('create-spectator-checkbox');
const createRoomError = document.getElementById('create-room-error');
const createRoomConfirmBtn = document.getElementById('create-room-confirm-btn');

const leaveBtn = document.getElementById('leave-btn');
const revealBtn = document.getElementById('reveal-btn');
const resetBtn = document.getElementById('reset-btn');
const seatsEl = document.getElementById('seats');
const cardsEl = document.getElementById('cards');
const resultModal = document.getElementById('result-modal');
const resultClose = document.getElementById('result-close');
const showResultBtn = document.getElementById('show-result-btn');
const resultSummary = document.getElementById('result-summary');
const resultVotes = document.getElementById('result-votes');
const spectatorsBar = document.getElementById('spectators-bar');
const handEl = document.querySelector('.hand');
const analyticPanel = document.getElementById('analytic-panel');
const resultBox = document.getElementById('result-box');
const resultAnalytic = document.getElementById('result-analytic');
const helpModal = document.getElementById('help-modal');
const analyticHelpHeaderBtn = document.getElementById('analytic-help-header-btn');

const A = window.CatAnalytic;

const MAX_ROOMS = 5;

function catUrl(seed, w, h) {
  return `https://cataas.com/cat?width=${w}&height=${h}&_=${encodeURIComponent(seed)}`;
}

function makeCatPhoto(seed, w, h, extraClass) {
  const wrap = document.createElement('div');
  wrap.className = 'cat-photo' + (extraClass ? ' ' + extraClass : '');
  const img = document.createElement('img');
  img.src = catUrl(seed, w, h);
  img.alt = 'gatinho';
  img.loading = 'lazy';
  img.onerror = () => {
    img.onerror = null;
    wrap.classList.add('cat-fallback');
  };
  wrap.appendChild(img);
  return wrap;
}

let myId = null;
let myVote = null;
let amSpectator = false;
let prevRevealed = false;
let modalDismissed = false;
let selectedRoomId = null;
let knownRooms = [];

// Identifica este navegador entre reconexões do socket, para restaurar o voto sem duplicar a cadeira.
const clientId = Math.random().toString(36).slice(2) + Date.now().toString(36);
let pendingJoin = null;
let currentJoin = null;
let rejoining = false;

let roomMode = 'classic';
let currentRound = null;
let myScores = A.emptyScores();
// Etapa atual do modo analítico (0 a 4) ou null quando a avaliação está no resumo.
let currentStep = 0;
let legendOpen = false;
let hoverScore = null;
let openChartRow = null;
const openVoteDetails = new Set();

function showModal(modal) {
  modal.classList.remove('hidden');
}

function hideModal(modal) {
  modal.classList.add('hidden');
}

document.querySelectorAll('[data-close-modal]').forEach((btn) => {
  btn.addEventListener('click', () => hideModal(document.getElementById(btn.dataset.closeModal)));
});

createRoomBtn.addEventListener('click', () => {
  if (knownRooms.length >= MAX_ROOMS) return;
  createRoomError.textContent = '';
  createRoomNameInput.value = '';
  createRoomPasswordInput.value = '';
  createNameInput.value = '';
  createMaxCardSelect.value = '21';
  createModeSelect.value = 'classic';
  updateCreateModeFields();
  createSpectatorCheckbox.checked = false;
  showModal(createRoomModal);
});

function updateCreateModeFields() {
  const isAnalytic = createModeSelect.value === 'analytic';
  createMaxCardRow.classList.toggle('hidden', isAnalytic);
  createModeHint.classList.toggle('hidden', !isAnalytic);
}

createModeSelect.addEventListener('change', updateCreateModeFields);

createRoomConfirmBtn.addEventListener('click', () => {
  const roomName = createRoomNameInput.value.trim();
  const password = createRoomPasswordInput.value;
  const name = createNameInput.value.trim();
  const maxCard = createMaxCardSelect.value;
  if (!roomName) { createRoomError.textContent = 'Informe um nome para a sala'; return; }
  if (!password) { createRoomError.textContent = 'Informe uma senha para a sala'; return; }
  if (!name) { createRoomError.textContent = 'Informe seu nome'; return; }
  const mode = createModeSelect.value;
  const spectator = createSpectatorCheckbox.checked;
  createRoomError.textContent = '';
  pendingJoin = { password, name, spectator };
  socket.emit('create-room', { roomName, password, name, maxCard, mode, spectator, clientId });
});

function openJoinRoomModal(room) {
  selectedRoomId = room.id;
  joinRoomTitle.textContent = `Entrar em "${room.name}"`;
  joinRoomError.textContent = '';
  joinNameInput.value = '';
  joinPasswordInput.value = '';
  joinSpectatorCheckbox.checked = false;
  showModal(joinRoomModal);
}

joinRoomConfirmBtn.addEventListener('click', () => {
  const name = joinNameInput.value.trim();
  const password = joinPasswordInput.value;
  if (!name) { joinRoomError.textContent = 'Informe seu nome'; return; }
  joinRoomError.textContent = '';
  pendingJoin = { password, name, spectator: joinSpectatorCheckbox.checked };
  socket.emit('join-room', {
    roomId: selectedRoomId,
    password,
    name,
    spectator: joinSpectatorCheckbox.checked,
    clientId,
  });
});

[joinNameInput, joinPasswordInput].forEach((el) => {
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoomConfirmBtn.click(); });
});
[createRoomNameInput, createRoomPasswordInput, createNameInput].forEach((el) => {
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter') createRoomConfirmBtn.click(); });
});

function renderRoomList(rooms) {
  knownRooms = rooms;
  createRoomBtn.disabled = rooms.length >= MAX_ROOMS;
  createRoomBtn.textContent = rooms.length >= MAX_ROOMS ? 'Limite de 5 salas' : '+ Criar sala';

  roomListEl.innerHTML = '';
  roomListEmpty.classList.toggle('hidden', rooms.length > 0);

  rooms.forEach((room) => {
    const card = document.createElement('div');
    card.className = 'room-card';

    const left = document.createElement('div');
    left.className = 'room-card-left';

    const cat = makeCatPhoto(`room-${room.id}`, 72, 72, 'room-cat');

    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'room-name';
    name.textContent = room.name;
    const count = document.createElement('div');
    count.className = 'room-count';
    count.textContent = `${room.playerCount} pessoa${room.playerCount === 1 ? '' : 's'}`
      + (room.mode === 'analytic' ? ' · Modo analítico' : '');
    info.appendChild(name);
    info.appendChild(count);

    left.appendChild(cat);
    left.appendChild(info);

    const enterBtn = document.createElement('button');
    enterBtn.textContent = 'Entrar';
    enterBtn.addEventListener('click', () => openJoinRoomModal(room));

    card.appendChild(left);
    card.appendChild(enterBtn);
    roomListEl.appendChild(card);
  });
}

leaveBtn.addEventListener('click', () => {
  socket.emit('leave-room');
  goToLobby();
});

function goToLobby() {
  myVote = null;
  amSpectator = false;
  currentJoin = null;
  rejoining = false;
  currentRound = null;
  myScores = A.emptyScores();
  currentStep = 0;
  hideModal(resultModal);
  hideModal(helpModal);
  tableScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
}

revealBtn.addEventListener('click', () => socket.emit('reveal'));
resetBtn.addEventListener('click', () => {
  myVote = null;
  socket.emit('reset');
});

function closeResultModal() {
  modalDismissed = true;
  resultModal.classList.add('hidden');
  showResultBtn.classList.remove('hidden');
}

function openResultModal() {
  modalDismissed = false;
  resultModal.classList.remove('hidden');
  showResultBtn.classList.add('hidden');
}

resultClose.addEventListener('click', closeResultModal);
resultModal.addEventListener('click', (e) => {
  if (e.target === resultModal) closeResultModal();
});
showResultBtn.addEventListener('click', openResultModal);

function openHelpModal() {
  showModal(helpModal);
}

analyticHelpHeaderBtn.addEventListener('click', openHelpModal);
helpModal.addEventListener('click', (e) => {
  if (e.target === helpModal) hideModal(helpModal);
});

socket.on('connect', () => {
  myId = socket.id;
  // Reconexão: volta para a mesma sala com o mesmo clientId para recuperar o voto.
  if (currentJoin) {
    rejoining = true;
    socket.emit('join-room', { ...currentJoin, clientId });
  }
});

socket.on('rooms', renderRoomList);

socket.on('room-error', (msg) => {
  if (rejoining) {
    showToast(`🔌 Não foi possível voltar à mesa: ${msg}`);
    goToLobby();
    return;
  }
  if (!joinRoomModal.classList.contains('hidden')) {
    joinRoomError.textContent = msg;
  } else if (!createRoomModal.classList.contains('hidden')) {
    createRoomError.textContent = msg;
  }
});

socket.on('room-closed', (reason) => {
  showToast(`🔒 ${reason}`);
  goToLobby();
});

socket.on('joined', ({ roomId, roomName, spectator, mode, round, vote, scores } = {}) => {
  if (pendingJoin) {
    currentJoin = { roomId, ...pendingJoin };
    pendingJoin = null;
  }
  rejoining = false;
  amSpectator = !!spectator;
  roomMode = mode === 'analytic' ? 'analytic' : 'classic';
  currentRound = round;
  myVote = vote === undefined ? null : vote;
  myScores = Array.isArray(scores) ? scores.slice() : A.emptyScores();
  currentStep = firstUnansweredStep();
  analyticHelpHeaderBtn.classList.toggle('hidden', roomMode !== 'analytic');
  roomTitle.textContent = `🃏🐱 ${roomName}`;
  handEl.classList.toggle('hidden', amSpectator);
  revealBtn.classList.toggle('hidden', amSpectator);
  resetBtn.classList.toggle('hidden', amSpectator);
  hideModal(joinRoomModal);
  hideModal(createRoomModal);
  lobbyScreen.classList.add('hidden');
  tableScreen.classList.remove('hidden');
});

socket.on('paper-thrown', ({ fromId, toId, fromName }) => {
  throwPaperBall(fromId, toId);
  if (toId === myId) {
    showToast(`🧻 ${fromName} jogou uma bolinha de papel em você!`);
  }
});

socket.on('state', (state) => {
  if (state.round !== currentRound) {
    // Nova rodada: limpa o voto e as avaliações locais.
    currentRound = state.round;
    myVote = null;
    myScores = A.emptyScores();
    currentStep = 0;
    openChartRow = null;
    openVoteDetails.clear();
  }
  roomMode = state.mode === 'analytic' ? 'analytic' : 'classic';
  if (roomMode === 'analytic') {
    cardsEl.classList.add('hidden');
    analyticPanel.classList.remove('hidden');
    renderAnalyticPanel(state);
  } else {
    cardsEl.classList.remove('hidden');
    analyticPanel.classList.add('hidden');
    renderCards(state);
  }
  renderSeats(state);
  renderSpectators(state);
  updateResultModal(state);
  revealBtn.disabled = state.revealed || !state.allVoted;
  revealBtn.title = state.allVoted ? '' : 'Aguardando todos votarem';
});

function renderSpectators(state) {
  const spectators = state.spectators || [];
  if (spectators.length === 0) {
    spectatorsBar.classList.add('hidden');
    spectatorsBar.textContent = '';
    return;
  }
  const names = spectators.map((s) => s.name + (s.id === myId ? ' (você)' : '')).join(', ');
  spectatorsBar.textContent = `👀 Espectadores: ${names}`;
  spectatorsBar.classList.remove('hidden');
}

const SUITS = ['♠', '♥', '♦', '♣'];

function renderCards(state) {
  cardsEl.innerHTML = '';
  let suitIndex = 0;
  state.cards.forEach((card) => {
    const isSpecial = card === '?' || card === '☕';
    const suit = isSpecial ? null : SUITS[suitIndex++ % SUITS.length];
    const isRed = suit === '♥' || suit === '♦';
    const cornerLabel = isSpecial ? card : `${card}<br>${suit}`;

    const btn = document.createElement('button');
    btn.className = 'card' + (myVote === card ? ' selected' : '') + (isRed ? ' red' : '');
    btn.disabled = state.revealed;
    btn.addEventListener('click', () => {
      myVote = card;
      socket.emit('vote', card);
    });

    const corner1 = document.createElement('span');
    corner1.className = 'card-corner card-corner-tl';
    corner1.innerHTML = cornerLabel;

    const corner2 = document.createElement('span');
    corner2.className = 'card-corner card-corner-br';
    corner2.innerHTML = cornerLabel;

    const photo = makeCatPhoto(`card-${card}`, 92, 92, 'card-photo');

    btn.appendChild(corner1);
    btn.appendChild(photo);
    btn.appendChild(corner2);
    cardsEl.appendChild(btn);
  });
}

function renderSeats(state) {
  // remove cadeiras antigas, mantém o centro da mesa
  Array.from(seatsEl.querySelectorAll('.seat')).forEach((el) => el.remove());

  const total = state.players.length;
  if (total === 0) return;

  const radiusPercent = 66;
  state.players.forEach((player, i) => {
    const angle = (2 * Math.PI * i) / total - Math.PI / 2;
    const x = 50 + radiusPercent * Math.cos(angle);
    const y = 50 + radiusPercent * Math.sin(angle);

    const seat = document.createElement('div');
    seat.className = 'seat' + (player.voted ? ' voted' : '');
    seat.dataset.playerId = player.id;
    seat.style.left = x + '%';
    seat.style.top = y + '%';

    const chair = document.createElement('div');
    chair.className = 'chair';
    chair.textContent = '🪑';
    seat.appendChild(chair);

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.appendChild(makeCatPhoto(`player-${player.id}`, 112, 112));

    const inProgress = state.mode === 'analytic' && !player.voted && player.progress > 0;
    if (state.revealed && player.vote !== null) {
      const badge = document.createElement('div');
      badge.className = 'vote-badge';
      badge.textContent = player.vote;
      if (state.mode === 'analytic') badge.title = 'Mediana das cinco notas';
      avatar.appendChild(badge);
    } else if (!state.revealed && inProgress) {
      const badge = document.createElement('div');
      badge.className = 'vote-badge vote-progress';
      badge.textContent = `${player.progress}/${A.CRITERIA_COUNT}`;
      badge.title = 'Avaliando os critérios';
      avatar.appendChild(badge);
    } else if (!state.revealed && player.voted) {
      const badge = document.createElement('div');
      badge.className = 'vote-badge voted-check';
      badge.textContent = '✓';
      avatar.appendChild(badge);
    }

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = player.name + (player.id === myId ? ' (você)' : '');

    seat.appendChild(avatar);
    seat.appendChild(name);

    if (player.id !== myId) {
      const throwBtn = document.createElement('button');
      throwBtn.className = 'throw-btn';
      throwBtn.title = 'Jogar bolinha de papel';
      throwBtn.textContent = '🧻';
      throwBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        socket.emit('throw-paper', player.id);
      });
      seat.appendChild(throwBtn);
    }

    seatsEl.appendChild(seat);
  });
}

function showToast(text) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = text;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 1800);
}

function throwPaperBall(fromId, toId) {
  const fromAvatar = seatsEl.querySelector(`[data-player-id="${fromId}"] .avatar`);
  const toAvatar = seatsEl.querySelector(`[data-player-id="${toId}"] .avatar`);
  if (!toAvatar) return;

  const toRect = toAvatar.getBoundingClientRect();
  const toX = toRect.left + toRect.width / 2 - 8;
  const toY = toRect.top + toRect.height / 2 - 8;

  // Espectadores não têm cadeira: a bolinha entra por uma borda aleatória, de fora da tela.
  const offScreen = !fromAvatar;
  let fromX;
  let fromY;
  if (offScreen) {
    const margin = 40;
    const side = Math.floor(Math.random() * 4);
    const alongX = Math.random() * window.innerWidth;
    const alongY = Math.random() * window.innerHeight;
    fromX = side === 0 ? -margin : side === 1 ? window.innerWidth + margin : alongX;
    fromY = side === 2 ? -margin : side === 3 ? window.innerHeight + margin : alongY;
  } else {
    const fromRect = fromAvatar.getBoundingClientRect();
    fromX = fromRect.left + fromRect.width / 2 - 8;
    fromY = fromRect.top + fromRect.height / 2 - 8;
  }

  const ball = document.createElement('div');
  ball.className = 'paper-ball' + (offScreen ? ' from-outside' : '');
  ball.style.left = fromX + 'px';
  ball.style.top = fromY + 'px';
  document.body.appendChild(ball);

  const dx = toX - fromX;
  const dy = toY - fromY;

  requestAnimationFrame(() => {
    ball.style.transform = `translate(${dx}px, ${dy}px) rotate(${offScreen ? 900 : 540}deg)`;
  });

  setTimeout(() => {
    ball.remove();
    const toSeat = toAvatar.closest('.seat');
    if (toSeat) {
      toSeat.classList.add('hit');
      setTimeout(() => toSeat.classList.remove('hit'), 400);
    }
  }, offScreen ? 850 : 550);
}

function updateResultModal(state) {
  const hasResult = state.revealed && state.players.length > 0;

  if (!hasResult) {
    resultModal.classList.add('hidden');
    showResultBtn.classList.add('hidden');
    modalDismissed = false;
    prevRevealed = state.revealed;
    return;
  }

  if (!prevRevealed) {
    modalDismissed = false;
  }
  prevRevealed = state.revealed;

  const isAnalytic = state.mode === 'analytic';
  resultBox.classList.toggle('modal-wide', isAnalytic);
  resultVotes.classList.toggle('hidden', isAnalytic);
  resultAnalytic.classList.toggle('hidden', !isAnalytic);
  if (isAnalytic) {
    renderAnalyticResult(state);
  } else {
    renderClassicResult(state);
  }

  if (modalDismissed) {
    resultModal.classList.add('hidden');
    showResultBtn.classList.remove('hidden');
  } else {
    resultModal.classList.remove('hidden');
    showResultBtn.classList.add('hidden');
  }
}

function renderClassicResult(state) {
  const votes = state.players.filter((p) => p.vote !== null).map((p) => p.vote);
  const numeric = votes.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
  const allEqual = votes.length > 0 && votes.every((v) => v === votes[0]);

  let summary = '';
  if (allEqual) {
    summary = `<span class="consensus">🎉 Consenso: ${votes[0]}</span>`;
  } else if (numeric.length > 0) {
    const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
    summary = `Média: ${avg.toFixed(1)}`;
  } else {
    summary = 'Sem valores numéricos para calcular média';
  }
  resultSummary.innerHTML = summary;

  resultVotes.innerHTML = '';
  state.players.forEach((p) => {
    const chip = document.createElement('div');
    chip.className = 'vote-chip';
    chip.textContent = `${p.name}: ${p.vote !== null ? p.vote : '—'}`;
    resultVotes.appendChild(chip);
  });
}

// ---------- Modo analítico ----------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function firstUnansweredStep() {
  const index = myScores.findIndex((score) => !A.isValidScore(score));
  return index === -1 ? null : index;
}

function chooseScore(state, index, value) {
  if (state.revealed) return;
  myScores[index] = value;
  socket.emit('analytic-score', { index, value });
  hoverScore = null;
  currentStep = firstUnansweredStep();
  renderAnalyticPanel(state);
}

function goToStep(state, index) {
  currentStep = index;
  hoverScore = null;
  renderAnalyticPanel(state);
}

function makeScoreCard(value, selected, disabled) {
  const suit = SUITS[value % SUITS.length];
  const isRed = suit === '♥' || suit === '♦';
  const btn = el('button', 'card' + (selected ? ' selected' : '') + (isRed ? ' red' : ''));
  btn.disabled = disabled;
  btn.dataset.score = value;
  btn.setAttribute('aria-label', `Nota ${value}`);
  const label = `${value}<br>${suit}`;
  const corner1 = el('span', 'card-corner card-corner-tl');
  corner1.innerHTML = label;
  const corner2 = el('span', 'card-corner card-corner-br');
  corner2.innerHTML = label;
  btn.appendChild(corner1);
  btn.appendChild(makeCatPhoto(`card-${value}`, 92, 92, 'card-photo'));
  btn.appendChild(corner2);
  return btn;
}

function renderAnalyticPanel(state) {
  analyticPanel.innerHTML = '';
  if (amSpectator) return;
  if (state.revealed || currentStep === null) {
    renderAnalyticSummary(state);
  } else {
    renderAnalyticStep(state);
  }
}

function renderProgressDots(state) {
  const dots = el('div', 'an-dots');
  const reachable = firstUnansweredStep();
  A.CRITERIA.forEach((criterion, i) => {
    const answered = A.isValidScore(myScores[i]);
    const dot = el('button', 'an-dot' + (answered ? ' answered' : '') + (i === currentStep ? ' current' : ''), String(i + 1));
    dot.title = criterion.name + (answered ? ` — nota ${myScores[i]}` : '');
    dot.disabled = state.revealed || !(answered || i === reachable);
    dot.addEventListener('click', () => goToStep(state, i));
    dots.appendChild(dot);
  });
  return dots;
}

function renderAnalyticStep(state) {
  const index = currentStep;
  const criterion = A.CRITERIA[index];
  const selected = myScores[index];

  const head = el('div', 'an-head');
  head.appendChild(el('span', 'an-step', `Etapa ${index + 1}/${A.CRITERIA_COUNT}`));
  head.appendChild(renderProgressDots(state));
  analyticPanel.appendChild(head);

  const title = el('div', 'an-title');
  title.appendChild(el('span', null, `${criterion.icon} ${criterion.name}`));
  const infoBtn = el('button', 'info-btn' + (legendOpen ? ' active' : ''), 'i');
  infoBtn.title = legendOpen ? 'Esconder legenda' : 'Ver legenda completa';
  infoBtn.setAttribute('aria-expanded', String(legendOpen));
  infoBtn.addEventListener('click', () => {
    legendOpen = !legendOpen;
    renderAnalyticPanel(state);
  });
  title.appendChild(infoBtn);
  analyticPanel.appendChild(title);

  analyticPanel.appendChild(el('div', 'an-question', criterion.question));
  analyticPanel.appendChild(el('div', 'an-short', criterion.short));

  const legend = el('div', 'an-legend' + (legendOpen ? '' : ' hidden'));
  if (criterion.note) legend.appendChild(el('div', 'an-legend-note', `💡 ${criterion.note}`));
  criterion.legend.forEach((text, score) => {
    const row = el('div', 'an-legend-row');
    row.dataset.score = score;
    row.appendChild(el('b', null, String(score)));
    row.appendChild(el('span', null, text));
    legend.appendChild(row);
  });
  analyticPanel.appendChild(legend);

  const cards = el('div', 'cards an-cards');
  for (let score = A.MIN_SCORE; score <= A.MAX_SCORE; score++) {
    const card = makeScoreCard(score, selected === score, state.revealed);
    card.addEventListener('click', () => chooseScore(state, index, score));
    card.addEventListener('mouseenter', () => setHoverScore(criterion, score));
    card.addEventListener('focus', () => setHoverScore(criterion, score));
    card.addEventListener('mouseleave', () => setHoverScore(criterion, null));
    card.addEventListener('blur', () => setHoverScore(criterion, null));
    cards.appendChild(card);
  }
  analyticPanel.appendChild(cards);

  analyticPanel.appendChild(el('div', 'an-hint'));

  const nav = el('div', 'an-nav');
  const back = el('button', 'ghost', '← Voltar');
  back.disabled = index === 0;
  back.addEventListener('click', () => goToStep(state, index - 1));
  nav.appendChild(back);
  if (A.isComplete(myScores)) {
    const summary = el('button', 'ghost', 'Ver resumo ✓');
    summary.addEventListener('click', () => goToStep(state, null));
    nav.appendChild(summary);
  } else if (A.isValidScore(selected) && index < A.CRITERIA_COUNT - 1) {
    const next = el('button', 'ghost', 'Avançar →');
    next.addEventListener('click', () => goToStep(state, index + 1));
    nav.appendChild(next);
  }
  analyticPanel.appendChild(nav);

  setHoverScore(criterion, hoverScore);
}

// Destaca na legenda (e na linha de dica) a nota que o participante está apontando ou já escolheu.
function setHoverScore(criterion, score) {
  hoverScore = score;
  const selected = myScores[currentStep];
  const active = score !== null ? score : (A.isValidScore(selected) ? selected : null);
  analyticPanel.querySelectorAll('.an-legend-row').forEach((row) => {
    row.classList.toggle('active', Number(row.dataset.score) === active);
  });
  const hint = analyticPanel.querySelector('.an-hint');
  if (!hint) return;
  hint.innerHTML = '';
  if (active === null) {
    hint.classList.add('muted');
    hint.textContent = 'Passe o mouse ou toque numa carta. Use o ⓘ para ver a legenda completa.';
  } else {
    hint.classList.remove('muted');
    hint.appendChild(el('b', null, `${active} — `));
    hint.appendChild(document.createTextNode(criterion.legend[active]));
  }
}

function renderAnalyticSummary(state) {
  const complete = A.isComplete(myScores);
  const head = el('div', 'an-head');
  head.appendChild(el('span', 'an-step', complete ? `Avaliação ${A.CRITERIA_COUNT}/${A.CRITERIA_COUNT}` : `Avaliação ${A.answeredCount(myScores)}/${A.CRITERIA_COUNT}`));
  head.appendChild(renderProgressDots(state));
  analyticPanel.appendChild(head);

  let message;
  if (state.revealed) {
    message = complete ? '🃏 Votos revelados! Veja o resultado da equipe.' : '🃏 Votos revelados. Você não concluiu a avaliação nesta rodada.';
  } else {
    message = '✅ Avaliação concluída! Sua cartinha está na mesa e as notas ficam ocultas até a revelação.';
  }
  analyticPanel.appendChild(el('div', 'an-done', message));

  const chips = el('div', 'an-chips');
  A.CRITERIA.forEach((criterion, i) => {
    const chip = el('button', 'an-chip');
    chip.appendChild(el('span', null, `${criterion.icon} ${criterion.name}`));
    chip.appendChild(el('b', null, A.isValidScore(myScores[i]) ? String(myScores[i]) : '—'));
    chip.disabled = state.revealed;
    chip.title = state.revealed ? '' : 'Alterar esta nota';
    chip.addEventListener('click', () => goToStep(state, i));
    chips.appendChild(chip);
  });
  analyticPanel.appendChild(chips);

  if (complete) {
    analyticPanel.appendChild(el('div', 'an-median', `Sua mediana: ${A.median(myScores)}`));
  }
}

function renderAnalyticResult(state) {
  const result = A.roomResult(state);
  resultSummary.innerHTML = '';
  resultAnalytic.innerHTML = '';

  const helpBtn = el('button', 'ghost help-btn', '?');
  helpBtn.title = 'Como funciona o cálculo?';
  helpBtn.setAttribute('aria-label', 'Como funciona o cálculo?');
  helpBtn.addEventListener('click', openHelpModal);

  if (!result || result.count === 0) {
    const empty = el('div', 'an-result-empty', 'Nenhuma avaliação completa nesta rodada.');
    empty.appendChild(helpBtn);
    resultSummary.appendChild(empty);
    return;
  }

  const points = el('div', 'an-points');
  points.appendChild(el('span', 'an-points-label', 'Pontuação sugerida'));
  const value = el('div', 'an-points-value');
  value.appendChild(el('span', 'an-points-number', String(result.fibonacci)));
  value.appendChild(el('span', 'an-points-unit', 'Story Points'));
  value.appendChild(helpBtn);
  points.appendChild(value);
  points.appendChild(el('span', 'an-points-sub',
    `Média das medianas: ${A.formatAverage(result.average)} · ${result.count} participante${result.count === 1 ? '' : 's'}`));
  resultSummary.appendChild(points);

  resultAnalytic.appendChild(renderFinalEstimate(state, result));

  resultAnalytic.appendChild(el('h3', 'an-section-title', 'Perfil da dificuldade (média por critério)'));
  resultAnalytic.appendChild(renderCriteriaChart(result));
  const divergent = result.criteria.filter((c) => c.divergent);
  if (divergent.length > 0) {
    resultAnalytic.appendChild(el('div', 'an-divergence',
      `⚡ Divergência importante em ${divergent.map((c) => c.name).join(', ')}: vale conversar sobre as notas mais altas e mais baixas.`));
  }

  resultAnalytic.appendChild(el('h3', 'an-section-title', 'Cartinhas reveladas'));
  resultAnalytic.appendChild(renderIndividualVotes(state, result));
}

function renderFinalEstimate(state, result) {
  const box = el('div', 'an-final');
  const final = state.finalEstimate;
  box.appendChild(el('div', 'an-final-title', final
    ? `✅ Estimativa confirmada pela equipe: ${final} SP`
    : 'Discutam e confirmem (ou ajustem) a estimativa final:'));
  const row = el('div', 'an-final-row');
  A.FIBONACCI_POINTS.forEach((points) => {
    const value = String(points);
    const chip = el('button', 'an-final-chip'
      + (points === result.fibonacci ? ' suggested' : '')
      + (final === value ? ' chosen' : ''), value);
    chip.title = points === result.fibonacci ? 'Pontuação sugerida pelo cálculo' : '';
    chip.disabled = amSpectator;
    chip.addEventListener('click', () => socket.emit('set-final', final === value ? null : value));
    row.appendChild(chip);
  });
  box.appendChild(row);
  return box;
}

function renderCriteriaChart(result) {
  const chart = el('div', 'an-chart');
  result.criteria.forEach((c, i) => {
    const criterion = A.CRITERIA[i];
    const row = el('button', 'an-chart-row'
      + (c.highest ? ' highest' : '')
      + (openChartRow === c.key ? ' open' : ''));
    row.setAttribute('aria-expanded', String(openChartRow === c.key));
    row.setAttribute('aria-label', `${c.name}: média ${A.formatNumber(c.average)} de 5`);

    const label = el('span', 'an-chart-label', `${criterion.icon} ${c.name}`);
    if (c.highest) label.appendChild(el('span', 'an-tag an-tag-top', 'maior'));
    if (c.divergent) label.appendChild(el('span', 'an-tag an-tag-div', '⚡ divergência'));
    row.appendChild(label);

    const track = el('span', 'an-chart-track');
    const bar = el('span', 'an-chart-bar');
    bar.style.width = `${(c.average / A.MAX_SCORE) * 100}%`;
    track.appendChild(bar);
    row.appendChild(track);
    row.appendChild(el('span', 'an-chart-value', A.formatNumber(c.average)));

    const tip = el('span', 'an-chart-tip');
    tip.appendChild(el('b', null, criterion.question));
    tip.appendChild(el('span', null, criterion.short));
    tip.appendChild(el('span', 'an-chart-range', `Notas da equipe: de ${c.min} a ${c.max}`
      + (c.divergent ? ' (divergência importante)' : '')));
    row.appendChild(tip);

    row.addEventListener('click', () => {
      openChartRow = openChartRow === c.key ? null : c.key;
      chart.querySelectorAll('.an-chart-row').forEach((r) => {
        const isOpen = r === row && openChartRow === c.key;
        r.classList.toggle('open', isOpen);
        r.setAttribute('aria-expanded', String(isOpen));
      });
    });
    chart.appendChild(row);
  });

  const axis = el('div', 'an-chart-axis');
  axis.appendChild(el('span'));
  const ticks = el('span', 'an-chart-ticks');
  for (let t = A.MIN_SCORE; t <= A.MAX_SCORE; t++) ticks.appendChild(el('span', null, String(t)));
  axis.appendChild(ticks);
  axis.appendChild(el('span'));
  chart.appendChild(axis);
  return chart;
}

function renderIndividualVotes(state, result) {
  const list = el('div', 'an-votes');
  state.players.forEach((p) => {
    const complete = A.isComplete(p.scores);
    const item = el('details', 'an-vote');
    item.open = openVoteDetails.has(p.id);
    item.addEventListener('toggle', () => {
      if (item.open) openVoteDetails.add(p.id); else openVoteDetails.delete(p.id);
    });
    const summary = el('summary');
    summary.appendChild(el('span', 'an-vote-name', p.name + (p.id === myId ? ' (você)' : '')));
    summary.appendChild(el('span', 'an-vote-median', complete ? `mediana ${A.median(p.scores)}` : 'avaliação incompleta'));
    item.appendChild(summary);
    if (complete) {
      const scores = el('div', 'an-vote-scores');
      A.CRITERIA.forEach((criterion, i) => {
        const criterionResult = result.criteria[i];
        const cell = el('div', 'an-vote-score' + (criterionResult.divergent ? ' divergent' : ''));
        cell.title = criterion.legend[p.scores[i]];
        cell.appendChild(el('span', null, `${criterion.icon} ${criterion.name}`));
        cell.appendChild(el('b', null, String(p.scores[i])));
        scores.appendChild(cell);
      });
      item.appendChild(scores);
    }
    list.appendChild(item);
  });
  return list;
}
