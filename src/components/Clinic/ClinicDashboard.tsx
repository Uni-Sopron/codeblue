import React from 'react';
import type { Player, ClinicElementId, ClinicElement } from '../../types/game.ts';
import { CLINIC_ELEMENTS, getClinicElementById } from '../../data/clinicElements.ts';
import {
  DoorOpen,
  FlaskConical,
  Activity,
  Scissors,
  BedDouble,
  HeartPulse,
  Dumbbell,
  Plane,
  CheckCircle2,
  Lock,
  Building2,
  AlertCircle,
  ShoppingBag,
} from 'lucide-react';
import './ClinicDashboard.css';

interface ClinicDashboardProps {
  player: Player | null;
  onBuyElement?: (elementId: ClinicElementId) => void;
  canBuyCheck?: (elementId: ClinicElementId) => { canBuy: boolean; reason?: string; finalCost: number };
  hasBuiltThisTurn?: boolean;
  isCurrentTurnActive?: boolean;
}

const ELEMENT_ICON_MAP: Record<ClinicElementId, React.ComponentType<{ className?: string }>> = {
  reception: DoorOpen,
  lab: FlaskConical,
  diagnostics: Activity,
  surgery: Scissors,
  vip_ward: BedDouble,
  icu: HeartPulse,
  rehab: Dumbbell,
  helipad: Plane,
};

export const ClinicDashboard: React.FC<ClinicDashboardProps> = ({
  player,
  onBuyElement,
  canBuyCheck,
  hasBuiltThisTurn = false,
  isCurrentTurnActive = true,
}) => {
  if (!player) {
    return null;
  }

  const builtCount = player.builtElements.length;
  const progressPercent = Math.round((builtCount / CLINIC_ELEMENTS.length) * 100);

  return (
    <div className="clinic-dashboard">
      <div className="clinic-header">
        <div className="clinic-title-group">
          <Building2 className="clinic-title-icon" />
          <div>
            <h2 className="clinic-title">{player.name} Magánklinikája</h2>
            <p className="clinic-subtitle">
              Tervrajz és Részlegfejlesztés • {player.avatarTitle}
            </p>
          </div>
        </div>

        <div className="clinic-progress-wrapper">
          <div className="clinic-progress-bar-container" title={`${builtCount} / ${CLINIC_ELEMENTS.length} részleg felépült`}>
            <div
              className="clinic-progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="clinic-progress-badge">
            {builtCount} / {CLINIC_ELEMENTS.length} Részleg ({progressPercent}%)
          </span>
        </div>
      </div>

      <div className="clinic-grid">
        {CLINIC_ELEMENTS.map((element: ClinicElement) => {
          const isBuilt = player.builtElements.includes(element.id);
          const IconComponent = ELEMENT_ICON_MAP[element.id] || Building2;
          const prereqElement = element.prerequisiteId ? getClinicElementById(element.prerequisiteId) : null;
          const prereqMissing = element.prerequisiteId && !player.builtElements.includes(element.prerequisiteId);

          // Vásárlási ellenőrzés
          const check = canBuyCheck
            ? canBuyCheck(element.id)
            : {
                canBuy: !isBuilt && !prereqMissing && !hasBuiltThisTurn && player.cash >= element.cost,
                reason: isBuilt
                  ? 'Már felépült'
                  : prereqMissing
                  ? `Előfeltétel: ${prereqElement?.name}`
                  : hasBuiltThisTurn
                  ? 'Ebben a körben már építettél'
                  : player.cash < element.cost
                  ? 'Nincs elég pénz'
                  : undefined,
                finalCost: element.cost,
              };

          // 3 állapot meghatározása
          let cardStatusClass = 'status-locked';
          if (isBuilt) {
            cardStatusClass = 'status-built';
          } else if (check.canBuy && isCurrentTurnActive) {
            cardStatusClass = 'status-available';
          }

          const hasDiscount = check.finalCost < element.cost;

          return (
            <div key={element.id} className={`clinic-card ${cardStatusClass}`}>
              <div className="card-top">
                <div className="card-icon-group">
                  <div className="card-icon-wrapper">
                    <IconComponent className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="card-order">#{element.order}. Fázis</span>
                    <h3 className="card-name">{element.name}</h3>
                  </div>
                </div>

                {isBuilt ? (
                  <span className="card-badge built">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Felépült
                  </span>
                ) : check.canBuy && isCurrentTurnActive ? (
                  <span className="card-badge available">
                    <ShoppingBag className="w-3.5 h-3.5" /> Megvásárolható
                  </span>
                ) : (
                  <span className="card-badge locked">
                    <Lock className="w-3.5 h-3.5" /> Zárolt
                  </span>
                )}
              </div>

              <p className="card-description">{element.description}</p>

              {prereqMissing && !isBuilt && (
                <div className="card-prerequisite">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Előfeltétel: <strong>{prereqElement?.name || element.prerequisiteId}</strong></span>
                </div>
              )}

              <div className="card-bottom">
                <div className="price-tag">
                  <span className="price-label">Beruházási ár</span>
                  <div className="flex items-baseline">
                    <span className={`price-value ${hasDiscount ? 'price-discounted' : ''}`}>
                      {check.finalCost.toLocaleString()} KK
                    </span>
                    {hasDiscount && (
                      <span className="price-original">
                        {element.cost.toLocaleString()} KK
                      </span>
                    )}
                  </div>
                </div>

                {isBuilt ? (
                  <div className="built-indicator">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Üzemel</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-buy"
                    disabled={!check.canBuy || !isCurrentTurnActive || hasBuiltThisTurn}
                    onClick={() => onBuyElement?.(element.id)}
                    title={check.reason || 'Klinikai részleg megvásárlása'}
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Vásárlás</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default ClinicDashboard;
