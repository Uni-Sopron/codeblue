import type { ClinicElementId } from '../../types/game.ts';

export type ClinicRoomState = 'locked' | 'available' | 'built';

export const CLINIC_VISUALS: Record<ClinicElementId, { image: string; shortName: string }> = {
  reception: { image: '/assets/clinic/reception.webp', shortName: 'Recepció' },
  lab: { image: '/assets/clinic/lab.webp', shortName: 'Labor' },
  diagnostics: { image: '/assets/clinic/diagnostics.webp', shortName: 'Diagnosztika' },
  surgery: { image: '/assets/clinic/surgery.webp', shortName: 'Műtő' },
  vip_ward: { image: '/assets/clinic/vip_ward.webp', shortName: 'VIP kórterem' },
  icu: { image: '/assets/clinic/icu.webp', shortName: 'Intenzív' },
  rehab: { image: '/assets/clinic/rehab.webp', shortName: 'Rehab. park' },
  helipad: { image: '/assets/clinic/helipad.webp', shortName: 'Helipad' },
};
