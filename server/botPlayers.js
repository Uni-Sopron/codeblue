import { randomUUID } from 'node:crypto';

const BOT_PROFILES = [
  { name: 'Dr. AI Neumann', avatar: 'diagnostician' },
  { name: 'Dr. AI Turing', avatar: 'chief_physician' },
  { name: 'Dr. AI Lovelace', avatar: 'resident' },
];
const APPEARANCES = {
  surgeon: { avatarTitle: 'Dr. Sebész', color: '#0284c7' },
  diagnostician: { avatarTitle: 'Dr. Diagnoszta', color: '#0d9488' },
  chief_physician: { avatarTitle: 'Dr. Főorvos', color: '#6366f1' },
  resident: { avatarTitle: 'Dr. Rezidens', color: '#d97706' },
};

export function addBotToRoom(room, socketId) {
  if (room.hostSocketId !== socketId) return { success: false, error: 'Csak a szobagazda adhat hozzá botot.' };
  if (room.gameStarted) return { success: false, error: 'A játék már elkezdődött.' };
  if (room.players.length >= 4) return { success: false, error: 'A szoba megtelt.' };
  const profile = BOT_PROFILES.find((candidate) => !room.players.some((player) => player.isAI && player.name === candidate.name));
  if (!profile) return { success: false, error: 'Legfeljebb három bot csatlakozhat.' };
  const available = Object.keys(APPEARANCES).filter((avatar) => !room.players.some((player) => player.avatar === avatar));
  const avatar = available.includes(profile.avatar) ? profile.avatar : available[0];
  if (!avatar) return { success: false, error: 'Nincs szabad orvosi karakter.' };
  const id = ['p1', 'p2', 'p3', 'p4'].find((candidate) => !room.players.some((player) => player.id === candidate));
  const usedColors = new Set(room.players.map((player) => player.color.toLowerCase()));
  const color = [APPEARANCES[avatar].color, '#ec4899', '#84cc16', '#f97316', '#a855f7'].find((candidate) => !usedColors.has(candidate));
  const player = {
    id, socketId: `bot:${randomUUID()}`, name: profile.name, avatar,
    avatarTitle: APPEARANCES[avatar].avatarTitle, color,
    isHost: false, isAI: true, connected: true,
  };
  room.players.push(player);
  return { success: true, player };
}

export function removeBotFromRoom(room, socketId, playerId) {
  if (room.hostSocketId !== socketId) return { success: false, error: 'Csak a szobagazda törölhet botot.' };
  if (room.gameStarted) return { success: false, error: 'Folyamatban lévő játékból nem törölhető bot.' };
  const index = room.players.findIndex((player) => player.id === playerId && player.isAI);
  if (index < 0) return { success: false, error: 'A megadott bot nem található.' };
  room.players.splice(index, 1);
  return { success: true };
}

export function canDriveActivePlayer(room, socketId) {
  if (!room?.gameStarted || !room.gameState || !Array.isArray(room.gameState.players)) return false;
  const sender = room.players.find((player) => player.socketId === socketId && !player.isAI && player.connected !== false);
  if (!sender) return false;
  const active = room.gameState.players[room.gameState.activePlayerIndex];
  const member = room.players.find((player) => player.id === active?.id);
  if (!member) return false;
  return member.isAI ? room.hostSocketId === socketId : member.socketId === socketId;
}

export function hasValidRoster(room, state) {
  return Boolean(state && Array.isArray(state.players) && state.players.length === room.players.length
    && Number.isInteger(state.activePlayerIndex) && state.activePlayerIndex >= 0 && state.activePlayerIndex < state.players.length
    && state.players.every((player, index) => player && player.id === room.players[index].id
      && Boolean(player.isAI) === Boolean(room.players[index].isAI)));
}

export function transferHostToHuman(room) {
  const previousSocketId = room.hostSocketId;
  const previous = room.players.find((player) => player.socketId === room.hostSocketId && !player.isAI && player.connected !== false);
  const host = previous || room.players.find((player) => !player.isAI && player.connected !== false);
  room.hostSocketId = host?.socketId || '';
  for (const player of room.players) player.isHost = player === host;
  if (room.gameState?.players) {
    room.gameState.players = room.gameState.players.map((player) => ({ ...player, isHost: player.id === host?.id }));
    const active = room.players.find((player) => player.id === room.gameState.players[room.gameState.activePlayerIndex]?.id);
    if (previousSocketId !== room.hostSocketId && active?.isAI && room.gameState.isRolling) {
      room.gameState = { ...room.gameState, phase: 'roll', isRolling: false, diceResult: null };
    }
  }
  return host;
}
