import type { AvatarInfo } from '../types/game.ts';

/**
 * A 4 egyedi orvosi bábu és karakter (Avatars)
 * Mindegyikhez tartozik egyedi színkód, szerep és stílus.
 */
export const AVATARS: AvatarInfo[] = [
  {
    id: 'surgeon',
    title: 'Dr. Sebész',
    role: 'Vezető Sebészorvos',
    color: '#0284c7', // Sky blue / Cyan
    accentColor: '#e0f2fe',
    icon: 'Scissors',
    description: 'Hidegvérű precizitás a műtőben. Specialitása a sürgősségi és laparoszkópos beavatkozások.',
  },
  {
    id: 'diagnostician',
    title: 'Dr. Diagnoszta',
    role: 'Képalkotó és Belgyógyász Szakorvos',
    color: '#0d9488', // Teal
    accentColor: '#ccfbf1',
    icon: 'Activity',
    description: 'Kiemelkedő analitikus készség. Nincs olyan rejtélyes kórkép, amit ne derítene fel a leletekből.',
  },
  {
    id: 'chief_physician',
    title: 'Dr. Főorvos',
    role: 'Orvos-igazgató & Intézetvezető',
    color: '#6366f1', // Indigo
    accentColor: '#e0e7ff',
    icon: 'Award',
    description: 'Kiváló stratégiai és intézményvezetési érzék. A nemzetközi akkreditációk és fejlesztések mestere.',
  },
  {
    id: 'resident',
    title: 'Dr. Rezidens',
    role: 'Kutató és Fiatal Szakorvosjelölt',
    color: '#d97706', // Amber / Gold
    accentColor: '#fef3c7',
    icon: 'Sparkles',
    description: 'Fiatalos lendület, modern telemedicina és mesterséges intelligencia alapú orvosi megoldások híve.',
  },
];

export const getAvatarById = (id: string): AvatarInfo | undefined => {
  return AVATARS.find((avatar) => avatar.id === id);
};
