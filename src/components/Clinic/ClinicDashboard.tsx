import { useId, useRef, useState } from 'react';
import { Building2, CheckCircle2, LockKeyhole, ShoppingBag } from 'lucide-react';
import type { Player, ClinicElementId } from '../../types/game.ts';
import { CLINIC_ELEMENTS, getClinicElementById } from '../../data/clinicElements.ts';
import { ClinicBlueprint } from './ClinicBlueprint.tsx';
import { CLINIC_VISUALS } from './clinicVisuals.ts';
import type { ClinicRoomState } from './clinicVisuals.ts';
import './ClinicDashboard.css';

interface ClinicDashboardProps {
  player: Player | null;
  onBuyElement?: (elementId: ClinicElementId) => void;
  canBuyCheck?: (elementId: ClinicElementId) => { canBuy: boolean; reason?: string; finalCost: number };
  hasBuiltThisTurn?: boolean;
  isCurrentTurnActive?: boolean;
}

const STATE_LABELS: Record<ClinicRoomState, string> = {
  built: 'Felépült',
  available: 'Megvásárolható',
  locked: 'Zárolt',
};

export function ClinicDashboard({
  player,
  onBuyElement,
  canBuyCheck,
  hasBuiltThisTurn = false,
  isCurrentTurnActive = true,
}: ClinicDashboardProps) {
  const dashboardId = useId();
  const [selectedId, setSelectedId] = useState<ClinicElementId>('reception');
  const cardRefs = useRef<Partial<Record<ClinicElementId, HTMLElement | null>>>({});

  if (!player) return null;

  const rooms = CLINIC_ELEMENTS.map((element) => {
    const isBuilt = player.builtElements.includes(element.id);
    const prerequisite = element.prerequisiteId ? getClinicElementById(element.prerequisiteId) : undefined;
    const prerequisiteMissing = Boolean(prerequisite && !player.builtElements.includes(prerequisite.id));
    const check = canBuyCheck?.(element.id) ?? {
      canBuy: !isBuilt && !prerequisiteMissing && player.cash >= element.cost,
      finalCost: element.cost,
      reason: player.cash < element.cost ? 'Nincs elegendő fedezet.' : undefined,
    };
    const finalCost = !check.canBuy && check.finalCost === 0 ? element.cost : check.finalCost;
    const status: ClinicRoomState = isBuilt
      ? 'built'
      : check.canBuy && !prerequisiteMissing && !hasBuiltThisTurn && isCurrentTurnActive
        ? 'available'
        : 'locked';
    const reason = isBuilt ? undefined
      : prerequisiteMissing ? `Előfeltétel: ${prerequisite?.name}`
        : hasBuiltThisTurn ? 'Ebben a körben már építettél.'
          : !isCurrentTurnActive ? 'Építkezéskor vásárolható.'
            : check.reason;

    return { element, status, reason, finalCost, ...CLINIC_VISUALS[element.id] };
  });
  const builtCount = rooms.filter((room) => room.status === 'built').length;
  const progressPercent = Math.round(builtCount / CLINIC_ELEMENTS.length * 100);

  const selectRoom = (id: ClinicElementId) => {
    setSelectedId(id);
    const card = cardRefs.current[id];
    card?.focus({ preventScroll: true });
    card?.scrollIntoView({
      block: 'nearest',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  return (
    <section className="clinic-dashboard" aria-labelledby={`${dashboardId}-title`}>
      <header className="clinic-header">
        <div className="clinic-title-group">
          <span className="clinic-title-icon"><Building2 aria-hidden="true" /></span>
          <div>
            <h2 id={`${dashboardId}-title`} className="clinic-title">{player.name} magánklinikája</h2>
            <p className="clinic-subtitle">Részlegfejlesztés</p>
          </div>
        </div>
        <div className="clinic-progress-wrapper">
          <span className="clinic-progress-count"><strong>{builtCount}</strong> / 8 részleg</span>
          <progress className="clinic-progress" value={builtCount} max={CLINIC_ELEMENTS.length} aria-label={`Klinika készültsége: ${progressPercent}%`} />
        </div>
      </header>

      <ClinicBlueprint rooms={rooms} selectedId={selectedId} onSelectRoom={selectRoom} />

      <div className="clinic-grid">
        {rooms.map(({ element, image, status, reason, finalCost }) => {
          const isBuilt = status === 'built';
          const hasDiscount = finalCost < element.cost;
          const titleId = `${dashboardId}-${element.id}-title`;
          const reasonId = `${dashboardId}-${element.id}-reason`;
          const StateIcon = isBuilt ? CheckCircle2 : status === 'available' ? ShoppingBag : LockKeyhole;

          return (
            <article
              key={element.id}
              ref={(node) => { cardRefs.current[element.id] = node; }}
              className={`clinic-room clinic-room--${status}${selectedId === element.id ? ' clinic-room--selected' : ''}`}
              tabIndex={-1}
              aria-labelledby={titleId}
            >
              <div className="clinic-room-visual">
                <img className="clinic-room-image" src={image} alt="" loading="lazy" width="768" height="512" />
                <span className="clinic-room-number">{String(element.order).padStart(2, '0')}</span>
                <span className="clinic-room-status"><StateIcon aria-hidden="true" />{STATE_LABELS[status]}</span>
                {status === 'locked' && <LockKeyhole className="clinic-room-lock" aria-hidden="true" />}
              </div>

              <div className="clinic-room-content">
                <h3 id={titleId} className="clinic-room-name">{element.name}</h3>
                <p className="clinic-room-description">{element.description}</p>
                {reason && <p id={reasonId} className="clinic-room-reason"><LockKeyhole aria-hidden="true" />{reason}</p>}

                <div className="clinic-room-footer">
                  <div className="clinic-room-price">
                    <span>{isBuilt ? 'Beruházási érték' : 'Beruházási ár'}</span>
                    <strong className={hasDiscount && !isBuilt ? 'clinic-room-price--discount' : undefined}>
                      {(isBuilt ? element.cost : finalCost).toLocaleString('hu-HU')} KK
                    </strong>
                    {hasDiscount && !isBuilt && <del>{element.cost.toLocaleString('hu-HU')} KK</del>}
                  </div>

                  {isBuilt ? (
                    <span className="clinic-room-operating"><CheckCircle2 aria-hidden="true" />Üzemel</span>
                  ) : (
                    <button
                      type="button"
                      className="clinic-room-buy"
                      disabled={status !== 'available' || !onBuyElement}
                      onClick={() => onBuyElement?.(element.id)}
                      aria-label={`${element.name} megvásárlása, ${finalCost.toLocaleString('hu-HU')} KK`}
                      aria-describedby={reason ? reasonId : undefined}
                    >
                      <ShoppingBag aria-hidden="true" />Vásárlás
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default ClinicDashboard;
