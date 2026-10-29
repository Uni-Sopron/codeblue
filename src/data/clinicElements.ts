import type { ClinicElement } from '../types/game.ts';

/**
 * A Magánklinika 8 felépítendő klinikarészlege (Clinic Wings)
 * Az elfogadási feltételek (Acceptance Criteria) szerinti pontos előfeltétel-hálóval és kiegyensúlyozott költségvetéssel:
 *  i. Recepció és Váróterem (alap)
 *  ii. Orvosi Laboratórium (alap)
 *  iii. Diagnosztikai Központ (előfeltétel: Recepció)
 *  iv. Korszerű Műtő (előfeltétel: Diagnosztikai Központ)
 *  v. VIP Kórterem (előfeltétel: Recepció)
 *  vi. Intenzív Terápiás Osztály (előfeltétel: Műtő)
 *  vii. Rehabilitációs Park (előfeltétel: VIP Kórterem)
 *  viii. Helipad & Sürgősségi Állomás (előfeltétel: Intenzív)
 * 
 * Összköltség: 6 000 000 KK (KlinikaKredit), kezdőtőke (1 500 000 KK) = 25%.
 */
export const CLINIC_ELEMENTS: ClinicElement[] = [
  {
    id: 'reception',
    name: 'Recepció és Váróterem',
    cost: 400_000,
    order: 1,
    icon: 'DoorOpen',
    description: 'A magánklinika reprezentatív bejárati fogadótere digitális pácienshívóval, diszpécserpulttal és prémium váróval.',
  },
  {
    id: 'lab',
    name: 'Orvosi Laboratórium',
    cost: 600_000,
    order: 2,
    icon: 'FlaskConical',
    description: 'Automatizált klinikai kémiai, hematológiai és mikrobiológiai gyorselemző laboratórium a vizsgálati eredményekhez.',
  },
  {
    id: 'diagnostics',
    name: 'Diagnosztikai Központ',
    cost: 750_000,
    order: 3,
    icon: 'Activity',
    prerequisiteId: 'reception',
    description: 'Csúcskategóriás 3 Teslás zárt/nyitott MRI, multidetektoros CT és 4D ultrahangos vizsgálóállomás.',
  },
  {
    id: 'surgery',
    name: 'Korszerű Műtő',
    cost: 1_100_000,
    order: 4,
    icon: 'Scissors',
    prerequisiteId: 'diagnostics',
    description: 'Lamináris légáramlású steril nagyműtő altatógépekkel, laparoszkópos és mikro-sebészeti toronnyal.',
  },
  {
    id: 'vip_ward',
    name: 'VIP Kórterem',
    cost: 650_000,
    order: 5,
    icon: 'BedDouble',
    prerequisiteId: 'reception',
    description: 'Ötcsillagos hotelszintű privát betegszobák saját fürdővel, dedikált ápolói felügyelettel és cateringgel.',
  },
  {
    id: 'icu',
    name: 'Intenzív Terápiás Osztály',
    cost: 950_000,
    order: 6,
    icon: 'HeartPulse',
    prerequisiteId: 'surgery',
    description: 'Központi monitorozórendszer, invazív lélegeztetőgépek és dialízis egység a posztoperatív életmentéshez.',
  },
  {
    id: 'rehab',
    name: 'Rehabilitációs Park',
    cost: 700_000,
    order: 7,
    icon: 'Dumbbell',
    prerequisiteId: 'vip_ward',
    description: 'Mozgásszervi utókezelő hidroterápiás medencével, tornateremmel és gyógytornász szakrendelésekkel.',
  },
  {
    id: 'helipad',
    name: 'Helipad & Sürgősségi Állomás',
    cost: 850_000,
    order: 8,
    icon: 'Plane',
    prerequisiteId: 'icu',
    description: 'Tetőtéri kivilágított helikopter-leszálló és rohamkocsi-dokkoló akut szervtranszportok és traumás esetek fogadására.',
  },
];

export const getClinicElementById = (id: string): ClinicElement | undefined => {
  return CLINIC_ELEMENTS.find((element) => element.id === id);
};
