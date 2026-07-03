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
  createSpectatorCheckbox.checked = false;
  showModal(createRoomModal);
});

createRoomConfirmBtn.addEventListener('click', () => {
  const roomName = createRoomNameInput.value.trim();
  const password = createRoomPasswordInput.value;
  const name = createNameInput.value.trim();
  const maxCard = createMaxCardSelect.value;
  if (!roomName) { createRoomError.textContent = 'Informe um nome para a sala'; return; }
  if (!password) { createRoomError.textContent = 'Informe uma senha para a sala'; return; }
  if (!name) { createRoomError.textContent = 'Informe seu nome'; return; }
  createRoomError.textContent = '';
  socket.emit('create-room', { roomName, password, name, maxCard, spectator: createSpectatorCheckbox.checked });
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
  socket.emit('join-room', {
    roomId: selectedRoomId,
    password,
    name,
    spectator: joinSpectatorCheckbox.checked,
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
    count.textContent = `${room.playerCount} pessoa${room.playerCount === 1 ? '' : 's'}`;
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

socket.on('connect', () => { myId = socket.id; });

socket.on('rooms', renderRoomList);

socket.on('room-error', (msg) => {
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

socket.on('joined', ({ roomName, spectator } = {}) => {
  amSpectator = !!spectator;
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
  renderCards(state);
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

    if (state.revealed && player.vote !== null) {
      const badge = document.createElement('div');
      badge.className = 'vote-badge';
      badge.textContent = player.vote;
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
  if (!fromAvatar || !toAvatar) return;

  const fromRect = fromAvatar.getBoundingClientRect();
  const toRect = toAvatar.getBoundingClientRect();

  const ball = document.createElement('div');
  ball.className = 'paper-ball';
  ball.style.left = fromRect.left + fromRect.width / 2 - 8 + 'px';
  ball.style.top = fromRect.top + fromRect.height / 2 - 8 + 'px';
  document.body.appendChild(ball);

  const dx = toRect.left - fromRect.left;
  const dy = toRect.top - fromRect.top;

  requestAnimationFrame(() => {
    ball.style.transform = `translate(${dx}px, ${dy}px) rotate(540deg)`;
  });

  setTimeout(() => {
    ball.remove();
    const toSeat = toAvatar.closest('.seat');
    if (toSeat) {
      toSeat.classList.add('hit');
      setTimeout(() => toSeat.classList.remove('hit'), 400);
    }
  }, 550);
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

  if (modalDismissed) {
    resultModal.classList.add('hidden');
    showResultBtn.classList.remove('hidden');
  } else {
    resultModal.classList.remove('hidden');
    showResultBtn.classList.add('hidden');
  }
}
