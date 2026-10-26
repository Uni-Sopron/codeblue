import React from 'react';
import type { Player } from '../../types/game.ts';
import { GAME_CONSTANTS } from '../../types/game.ts';
import {
  Landmark,
  X,
  Wallet,
  AlertCircle,
  PlusCircle,
  MinusCircle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import './BankModal.css';

interface BankModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  onTakeLoan: (amount: number) => void;
  onRepayLoan: (amount: number) => void;
}

export const BankModal: React.FC<BankModalProps> = ({
  isOpen,
  onClose,
  player,
  onTakeLoan,
  onRepayLoan,
}) => {
  if (!isOpen || !player) {
    return null;
  }

  const unit = GAME_CONSTANTS.LOAN_UNIT; // 200 000 KK
  const canRepayFull = player.debt > 0 && player.cash >= player.debt;
  const canRepayPartial = player.debt > 0 && player.cash >= unit;

  return (
    <div className="bank-modal-backdrop" onClick={onClose}>
      <div className="bank-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="bank-header">
          <div className="bank-header-title">
            <Landmark className="bank-icon" />
            <div>
              <h2 className="bank-title">Klinikai Finanszírozási Bank</h2>
              <p className="bank-subtitle">Hitelkezelés és Likviditási Központ</p>
            </div>
          </div>
          <button type="button" className="btn-bank-close" onClick={onClose} aria-label="Bezárás">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bank-body">
          {/* Pénzügyi áttekintő */}
          <div className="bank-summary-grid">
            <div className="summary-box cash">
              <span className="summary-label">
                <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                Rendelkezésre álló tőke
              </span>
              <p className="summary-val cash">{player.cash.toLocaleString()} KK</p>
            </div>
            <div className="summary-box debt">
              <span className="summary-label">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                Fennálló tartozás
              </span>
              <p className="summary-val debt">{player.debt.toLocaleString()} KK</p>
            </div>
          </div>

          {/* Hitelfelvétel */}
          <div className="bank-section">
            <h3 className="bank-section-title">
              <PlusCircle className="w-4 h-4 text-sky-400" />
              Gyors Hitelfelvétel
            </h3>
            <p className="bank-notice">
              <Info className="w-3.5 h-3.5 shrink-0 text-sky-400" />
              Minimális egység: {unit.toLocaleString()} KK. A felvett összeg azonnal a számládra kerül.
            </p>
            <div className="bank-quick-buttons">
              <button
                type="button"
                className="btn-loan"
                onClick={() => onTakeLoan(unit)}
              >
                +{unit.toLocaleString()} KK
              </button>
              <button
                type="button"
                className="btn-loan"
                onClick={() => onTakeLoan(unit * 2)}
              >
                +{(unit * 2).toLocaleString()} KK
              </button>
              <button
                type="button"
                className="btn-loan"
                onClick={() => onTakeLoan(1_000_000)}
              >
                +1 000 000 KK
              </button>
            </div>
          </div>

          {/* Hiteltörlesztés */}
          <div className="bank-section">
            <h3 className="bank-section-title">
              <MinusCircle className="w-4 h-4 text-emerald-400" />
              Tartozás Törlesztése
            </h3>

            {player.debt === 0 ? (
              <p className="text-sm text-emerald-400 flex items-center gap-1.5 my-2">
                <CheckCircle2 className="w-4 h-4" />
                Nincs fennálló tartozásod! A klinika adósságmentes.
              </p>
            ) : (
              <>
                <p className="bank-notice">
                  A győzelemhez 0 KK adósság szükséges a játék végén!
                </p>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    className="btn-repay"
                    disabled={!canRepayPartial}
                    onClick={() => onRepayLoan(Math.min(unit, player.debt))}
                  >
                    Törlesztés: {Math.min(unit, player.debt).toLocaleString()} KK
                  </button>
                  <button
                    type="button"
                    className="btn-repay"
                    disabled={!canRepayFull}
                    onClick={() => onRepayLoan(player.debt)}
                  >
                    Teljes törlesztés ({player.debt.toLocaleString()} KK)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="bank-footer">
          <button type="button" className="btn-bank-done" onClick={onClose}>
            Rendben
          </button>
        </div>
      </div>
    </div>
  );
};
export default BankModal;
