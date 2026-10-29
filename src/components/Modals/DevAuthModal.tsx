import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, EyeOff, KeyRound, ShieldAlert, X } from 'lucide-react';
import { checkDevPassword } from '../../utils/devTools.ts';
import './DevAuthModal.css';

interface DevAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const DevAuthModal: React.FC<DevAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [hasError, setHasError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDismiss = useCallback(() => {
    setPassword('');
    setHasError(false);
    setShowPassword(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDismiss]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkDevPassword(password)) {
      setHasError(false);
      setPassword('');
      onSuccess();
      onClose();
    } else {
      setHasError(true);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  return (
    <div className="dev-auth-backdrop" onClick={handleDismiss}>
      <div
        className={`dev-auth-card ${hasError ? 'dev-auth-card--shake' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dev-auth-title"
      >
        <div className="dev-auth-header">
          <div className="dev-auth-icon-wrapper">
            <KeyRound className="dev-auth-icon" size={22} />
          </div>
          <div>
            <h3 id="dev-auth-title" className="dev-auth-title">
              Fejlesztői Mód Feloldása
            </h3>
            <p className="dev-auth-subtitle">
              Biztonsági hitelesítés teszteléshez
            </p>
          </div>
          <button
            type="button"
            className="dev-auth-btn-close"
            onClick={handleDismiss}
            aria-label="Bezárás"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dev-auth-body">
          <p className="dev-auth-info">
            Add meg a jelszót a <strong>Fejlesztői Tesztpanel</strong> és az élő bemutatóeszközök feloldásához:
          </p>

          <div className="dev-auth-input-group">
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              className={`dev-auth-input ${hasError ? 'dev-auth-input--error' : ''}`}
              placeholder="Jelszó..."
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (hasError) setHasError(false);
              }}
              autoComplete="off"
            />
            <button
              type="button"
              className="dev-auth-eye-btn"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Jelszó elrejtése' : 'Jelszó megjelenítése'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {hasError && (
            <div className="dev-auth-error-msg" role="alert">
              <ShieldAlert size={16} />
              <span>Helytelen jelszó! Kérlek próbáld újra.</span>
            </div>
          )}

          <div className="dev-auth-actions">
            <button
              type="button"
              className="dev-auth-btn dev-auth-btn--cancel"
              onClick={handleDismiss}
            >
              Mégse
            </button>
            <button
              type="submit"
              className="dev-auth-btn dev-auth-btn--submit"
            >
              Feloldás
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
