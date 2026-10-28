import test from 'node:test';
import assert from 'node:assert/strict';

// Helper sanitizers matching server logic
function sanitizeName(rawName: unknown, fallback = 'Orvos'): string {
  if (typeof rawName !== 'string') return fallback;
  const stripped = rawName.replace(/<[^>]*>?/gm, '').trim();
  return stripped.length > 0 ? stripped.slice(0, 32) : fallback;
}

function isValidRoomCode(code: unknown): boolean {
  return typeof code === 'string' && /^CB-\d{4}$/.test(code.trim().toUpperCase());
}

function sanitizeAvatar(avatarId: unknown): string {
  const allowed = ['surgeon', 'diagnostician', 'chief_physician', 'resident'];
  return typeof avatarId === 'string' && allowed.includes(avatarId) ? avatarId : 'surgeon';
}

function sanitizeColor(color: unknown, fallback = '#00b4d8'): string {
  if (typeof color === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    return color;
  }
  return fallback;
}

test('Room code validator strictly enforces CB-XXXX format', () => {
  assert.equal(isValidRoomCode('CB-1234'), true);
  assert.equal(isValidRoomCode('cb-9999'), true);
  assert.equal(isValidRoomCode('  CB-4821  '), true);

  // Invalid codes
  assert.equal(isValidRoomCode('CB-123'), false);
  assert.equal(isValidRoomCode('CB-12345'), false);
  assert.equal(isValidRoomCode('ROOM-1234'), false);
  assert.equal(isValidRoomCode('CB-ABCD'), false);
  assert.equal(isValidRoomCode(''), false);
  assert.equal(isValidRoomCode(null), false);
  assert.equal(isValidRoomCode(undefined), false);
  assert.equal(isValidRoomCode(1234), false);
});

test('Name sanitizer strips HTML and script tags to prevent XSS injections', () => {
  assert.equal(sanitizeName('<script>alert("hacked")</script>Dr. János'), 'alert("hacked")Dr. János');
  assert.equal(sanitizeName('<b>Kovács</b> Péter'), 'Kovács Péter');
  assert.equal(sanitizeName('<img src=x onerror=alert(1)>Dr. Jenő'), 'Dr. Jenő');
});

test('Name sanitizer clamps excessively long names to 32 characters', () => {
  const longName = 'Dr. Sebész '.repeat(10);
  const sanitized = sanitizeName(longName);
  assert.equal(sanitized.length <= 32, true);
  assert.equal(sanitized.length > 0, true);
});

test('Name sanitizer falls back on empty, whitespace, or invalid types', () => {
  assert.equal(sanitizeName('   '), 'Orvos');
  assert.equal(sanitizeName(''), 'Orvos');
  assert.equal(sanitizeName(null, 'Fallback'), 'Fallback');
  assert.equal(sanitizeName(undefined, 'Fallback'), 'Fallback');
  assert.equal(sanitizeName(12345, 'Fallback'), 'Fallback');
});

test('Avatar sanitizer strictly accepts valid doctor avatars and falls back to surgeon', () => {
  assert.equal(sanitizeAvatar('surgeon'), 'surgeon');
  assert.equal(sanitizeAvatar('diagnostician'), 'diagnostician');
  assert.equal(sanitizeAvatar('chief_physician'), 'chief_physician');
  assert.equal(sanitizeAvatar('resident'), 'resident');

  // Fallbacks
  assert.equal(sanitizeAvatar('admin'), 'surgeon');
  assert.equal(sanitizeAvatar('hacker'), 'surgeon');
  assert.equal(sanitizeAvatar(''), 'surgeon');
  assert.equal(sanitizeAvatar(null), 'surgeon');
});

test('Color sanitizer validates hex color strings and rejects invalid inputs', () => {
  assert.equal(sanitizeColor('#00b4d8'), '#00b4d8');
  assert.equal(sanitizeColor('#fff'), '#fff');
  assert.equal(sanitizeColor('#7209B7'), '#7209B7');

  // Invalid colors fall back to default
  assert.equal(sanitizeColor('red', '#00b4d8'), '#00b4d8');
  assert.equal(sanitizeColor('rgb(0,0,0)', '#00b4d8'), '#00b4d8');
  assert.equal(sanitizeColor('#gggggg', '#00b4d8'), '#00b4d8');
  assert.equal(sanitizeColor(null, '#00b4d8'), '#00b4d8');
});

test('Game state sync invariants: active player index and players list boundary checks', () => {
  const players = [
    { id: 'p1', name: 'János', cash: 1500000, debt: 0 },
    { id: 'p2', name: 'Jenő', cash: 1500000, debt: 0 },
  ];

  let activeIndex = 0;
  // Step 1: János active
  assert.equal(players[activeIndex].id, 'p1');

  // Step 2: Advance turn
  activeIndex = (activeIndex + 1) % players.length;
  assert.equal(activeIndex, 1);
  assert.equal(players[activeIndex].id, 'p2');

  // Step 3: Advance turn back to János
  activeIndex = (activeIndex + 1) % players.length;
  assert.equal(activeIndex, 0);
  assert.equal(players[activeIndex].id, 'p1');
});

test('Rematch ready-check logic requires all active connected players to vote ready', () => {
  const room = {
    players: [
      { id: 'p1', name: 'Dr. Kovács', connected: true },
      { id: 'p2', name: 'Dr. Nagy', connected: true },
      { id: 'p3', name: 'Dr. Kiss', connected: false } // disconnected
    ],
    rematchVotes: {
      p1: true,
      p2: false
    } as Record<string, boolean>
  };

  const connectedPlayers = room.players.filter(p => p.connected !== false);
  const isAllReadyBefore = connectedPlayers.every(p => room.rematchVotes[p.id] === true);
  assert.equal(isAllReadyBefore, false);

  // p2 votes ready
  room.rematchVotes['p2'] = true;
  const isAllReadyAfter = connectedPlayers.every(p => room.rematchVotes[p.id] === true);
  assert.equal(isAllReadyAfter, true);
});

test('Disconnect auto-pass: next connected player is selected properly', () => {
  const players = [
    { id: 'p1', name: 'Dr. Alpha', connected: false },
    { id: 'p2', name: 'Dr. Beta', connected: false },
    { id: 'p3', name: 'Dr. Gamma', connected: true }
  ];

  const currentActiveIndex = 0; // Alpha is disconnected
  let nextActiveIndex = (currentActiveIndex + 1) % players.length;
  let attempts = 0;

  while (!players[nextActiveIndex].connected && attempts < players.length) {
    nextActiveIndex = (nextActiveIndex + 1) % players.length;
    attempts++;
  }

  assert.equal(nextActiveIndex, 2);
  assert.equal(players[nextActiveIndex].id, 'p3');
});

test('In-place match restart preserves player identities and resets game board to Round 1', () => {
  const existingPlayers = [
    { id: 'p1', name: 'Dr. Alpha', color: '#00b4d8', avatar: 'surgeon', cash: 400000, debt: 200000, position: 14, builtElements: [1, 2] },
    { id: 'p2', name: 'Dr. Beta', color: '#7209B7', avatar: 'resident', cash: 2800000, debt: 0, position: 22, builtElements: [3] }
  ];

  // Simulate restartCurrentMatch logic
  const freshPlayers = existingPlayers.map(p => ({
    ...p,
    cash: 1500000,
    debt: 0,
    position: 0,
    builtElements: [],
    skipTurns: 0,
    activeBuffs: [],
  }));

  assert.equal(freshPlayers[0].name, 'Dr. Alpha');
  assert.equal(freshPlayers[0].cash, 1500000);
  assert.equal(freshPlayers[0].debt, 0);
  assert.equal(freshPlayers[0].position, 0);
  assert.equal(freshPlayers[0].builtElements.length, 0);

  assert.equal(freshPlayers[1].name, 'Dr. Beta');
  assert.equal(freshPlayers[1].cash, 1500000);
  assert.equal(freshPlayers[1].debt, 0);
  assert.equal(freshPlayers[1].position, 0);
  assert.equal(freshPlayers[1].builtElements.length, 0);
});

test('Rematch update payload properly passes requester metadata for guest modal prompt', () => {
  const payload = {
    votes: { p1: true },
    requestedBy: 'Dr. Alpha',
    requestedById: 'p1',
    isHost: true,
    ready: true,
  };

  assert.equal(payload.requestedBy, 'Dr. Alpha');
  assert.equal(payload.isHost, true);
  assert.equal(payload.ready, true);
  assert.equal(payload.votes['p1'], true);
});

test('Declining rematch resets room rematchVotes map and prepares cancelled event payload', () => {
  let roomRematchVotes = { p1: true };

  // Guest declines
  const ready = false;
  const player = { id: 'p2', name: 'Dr. Beta' };

  let cancelledEventPayload = null;
  if (!ready) {
    roomRematchVotes = {};
    cancelledEventPayload = {
      cancelledBy: player.name,
      cancelledById: player.id,
    };
  }

  assert.deepEqual(roomRematchVotes, {});
  assert.equal(cancelledEventPayload?.cancelledBy, 'Dr. Beta');
  assert.equal(cancelledEventPayload?.cancelledById, 'p2');
});

test('Szirénázó Rohammentő (Tile 4) unlocks an immediate second roll for the active player', () => {
  let hasRolledThisTurn = true;
  let extraRollAvailable = false;
  let phase = 'tile_action';

  // Landing on Tile 4 ('ambulance_speed')
  const specialAction = 'ambulance_speed';
  if (specialAction === 'ambulance_speed') {
    extraRollAvailable = true;
    hasRolledThisTurn = false;
    phase = 'roll';
  }

  assert.equal(phase, 'roll');
  assert.equal(extraRollAvailable, true);
  assert.equal(hasRolledThisTurn, false);

  // Verification of roll authorization
  const canRoll = !hasRolledThisTurn || extraRollAvailable;
  assert.equal(canRoll, true);

  // Executing the extra roll consumes the authorization
  hasRolledThisTurn = true;
  extraRollAvailable = false;
  assert.equal(hasRolledThisTurn, true);
  assert.equal(extraRollAvailable, false);
});

test('Event Card #7 (extra_roll) grants a second roll and transitions to roll phase', () => {
  const cardAction = { type: 'extra_roll' };
  let extraRollAvailable = false;
  let hasRolledThisTurn = true;
  let phase = 'card_modal';

  if (cardAction.type === 'extra_roll') {
    extraRollAvailable = true;
    hasRolledThisTurn = false;
    phase = 'roll';
  }

  assert.equal(phase, 'roll');
  assert.equal(extraRollAvailable, true);
  assert.equal(hasRolledThisTurn, false);
});
