import { AVATARS } from './avatars.ts';
import type { AvatarId, PlayerId } from '../types/game.ts';

export const BOT_PROFILES = [
  { name: 'Dr. AI Neumann', avatar: 'diagnostician', color: '#0d9488' },
  { name: 'Dr. AI Turing', avatar: 'chief_physician', color: '#6366f1' },
  { name: 'Dr. AI Lovelace', avatar: 'resident', color: '#d97706' },
] as const;

export type LocalPlayerType = 'human' | 'bot';

export interface LocalDoctorConfig {
  id: PlayerId;
  name: string;
  avatar: AvatarId;
  color: string;
  isAI: boolean;
}

/** A helyi orvosok egymástól eltérő, már meglévő portrét és bábuszínt kapnak. */
export function createLocalPlayerConfigs(
  count: number,
  playerTypes: readonly LocalPlayerType[],
  names: readonly string[],
): LocalDoctorConfig[] {
  if (!Number.isInteger(count) || count < 2 || count > 4) return [];
  const types = Array.from({ length: count }, (_, index) => playerTypes[index] ?? 'human');
  if (!types.includes('human')) return [];
  const humanAvatars = AVATARS.filter((_, index) => types[index] === 'human');
  const available = AVATARS.filter((avatar) => !humanAvatars.some((human) => human.id === avatar.id));
  let botIndex = 0;

  return types.map((type, index) => {
    const isAI = type === 'bot';
    const profile = isAI ? BOT_PROFILES[botIndex++] : null;
    const avatar = profile
      ? available.find((candidate) => candidate.id === profile.avatar) ?? available[0]
      : AVATARS[index];
    if (profile) available.splice(available.indexOf(avatar), 1);
    return {
      id: `p${index + 1}` as PlayerId,
      name: profile?.name ?? (names[index]?.trim() || `${index + 1}. Orvos`),
      avatar: avatar.id,
      color: avatar.color,
      isAI,
    };
  });
}
