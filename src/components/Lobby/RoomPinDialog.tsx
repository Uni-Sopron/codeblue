import { useEffect, useId, useRef, useState } from 'react';
import { LockKeyhole, X } from 'lucide-react';
import type { FormEvent } from 'react';

interface RoomPinDialogProps {
  roomName: string;
  pending: boolean;
  locked: boolean;
  error: string | null;
  onSubmit: (pin: string) => void;
  onClose: () => void;
}

export function RoomPinDialog({ roomName, pending, locked, error, onSubmit, onClose }: RoomPinDialogProps) {
  const dialogId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pin, setPin] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    if (error && !locked) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [error, locked]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pending && !locked && /^[0-9]{4}$/.test(pin)) onSubmit(pin);
  };

  return (
    <dialog
      ref={dialogRef}
      className="lobby-pin-dialog"
      aria-labelledby={`${dialogId}-title`}
      aria-describedby={`${dialogId}-room`}
      onCancel={(event) => { event.preventDefault(); if (!pending) onClose(); }}
    >
      <header className="lobby-pin-header">
        <LockKeyhole aria-hidden="true" />
        <h2 id={`${dialogId}-title`}>Belépési PIN</h2>
        <button type="button" className="lobby-icon-button" aria-label="PIN-ablak bezárása" disabled={pending} onClick={onClose}><X aria-hidden="true" /></button>
      </header>
      <p id={`${dialogId}-room`} className="lobby-pin-room">{roomName}</p>
      <form onSubmit={handleSubmit}>
        <label className="lobby-field" htmlFor={`${dialogId}-pin`}>
          <span>4 számjegyű PIN</span>
          <input
            ref={inputRef}
            id={`${dialogId}-pin`}
            className="lobby-input lobby-pin-input"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            required
            pattern="[0-9]{4}"
            minLength={4}
            maxLength={4}
            value={pin}
            disabled={pending || locked}
            onChange={(event) => setPin(event.target.value.replace(/[^0-9]/g, ''))}
            aria-describedby={error || locked ? `${dialogId}-error` : undefined}
            aria-invalid={Boolean(error && !locked)}
          />
        </label>
        {(error || locked) && <p id={`${dialogId}-error`} className="lobby-form-error" role="alert">{error ?? 'A PIN-próbálkozások átmenetileg zárolva vannak.'}</p>}
        <button className="lobby-primary" type="submit" disabled={pending || locked || pin.length !== 4}>{pending ? 'Csatlakozás…' : 'Csatlakozás'}</button>
      </form>
    </dialog>
  );
}
