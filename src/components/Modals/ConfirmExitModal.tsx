import React from 'react';
import { AlertTriangle, LogOut, RotateCcw, X } from 'lucide-react';
import './ConfirmExitModal.css';

interface ConfirmExitModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameMode: 'local' | 'online' | null;
  isHost: boolean;
  onConfirmExit: () => void;
  onRequestRematch?: () => void;
}

export const ConfirmExitModal: React.FC<ConfirmExitModalProps> = ({
  isOpen,
  onClose,
  gameMode,
  isHost,
  onConfirmExit,
  onRequestRematch,
}) => {
  if (!isOpen) return null;

  const isOnline = gameMode === 'online';

  return (
    <div className="confirm-modal-backdrop" onClick={onClose}>
      <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-header">
          <div className="confirm-modal-icon-wrapper">
            {isOnline ? (
              <LogOut className="w-6 h-6 text-rose-400" />
            ) : (
              <RotateCcw className="w-6 h-6 text-sky-400" />
            )}
          </div>
          <div>
            <h3 className="confirm-modal-title">
              {isOnline ? 'Szoba és Játék Kezelése' : 'Játék Újraindítása'}
            </h3>
            <p className="confirm-modal-subtitle">
              {isOnline
                ? isHost
                  ? 'Szobagazda műveletek'
                  : 'Kilépés az online mérkőzésből'
                : 'Helyi játékmenet megszakítása'}
            </p>
          </div>
          <button type="button" className="confirm-btn-close" onClick={onClose} aria-label="Bezárás">
            <X size={18} />
          </button>
        </div>

        <div className="confirm-modal-body">
          <div className="confirm-warning-box">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
            <p>
              {isOnline ? (
                isHost ? (
                  <>
                    Szobagazdaként <strong>közös új meccset</strong> kezdeményezhetsz a szoba
                    tagjainak, vagy <strong>kiléphetsz a főmenübe</strong>.
                  </>
                ) : (
                  <>
                    Biztosan elhagyod a szobát? A kapcsolatod megszakad, a többiek pedig nélküled
                    folytatják a meccset.
                  </>
                )
              ) : (
                <>
                  Biztosan újraindítod a játékot? A jelenlegi mentetlen játékállás elveszik, és
                  visszatérsz a konfigurációs képernyőre.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="confirm-modal-footer">
          <button type="button" className="confirm-btn-cancel" onClick={onClose}>
            Mégse
          </button>

          {isOnline && isHost && onRequestRematch && (
            <button
              type="button"
              className="confirm-btn-rematch"
              onClick={() => {
                onRequestRematch();
                onClose();
              }}
            >
              <RotateCcw size={16} />
              <span>Új Meccs Kérése</span>
            </button>
          )}

          <button
            type="button"
            className="confirm-btn-danger"
            onClick={() => {
              onConfirmExit();
              onClose();
            }}
          >
            <LogOut size={16} />
            <span>{isOnline ? 'Kilépés a Menübe' : 'Újraindítás'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmExitModal;
