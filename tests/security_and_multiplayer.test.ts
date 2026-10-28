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

  let currentActiveIndex = 0; // Alpha is disconnected
  let nextActiveIndex = (currentActiveIndex + 1) % players.length;
  let attempts = 0;

  while (!players[nextActiveIndex].connected && attempts < players.length) {
    nextActiveIndex = (nextActiveIndex + 1) % players.length;
    attempts++;
  }

  assert.equal(nextActiveIndex, 2);
  assert.equal(players[nextActiveIndex].id, 'p3');
});

