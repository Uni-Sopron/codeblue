import { useId } from 'react';
import { AVATARS } from '../../data/avatars.ts';

interface LobbyProfileProps {
  playerName: string;
  avatarId: string;
  disabled: boolean;
  onNameChange: (name: string) => void;
  onAvatarChange: (avatarId: string) => void;
}

export function LobbyProfile({ playerName, avatarId, disabled, onNameChange, onAvatarChange }: LobbyProfileProps) {
  const profileId = useId();

  return (
    <fieldset className="lobby-profile-fields" disabled={disabled}>
      <legend>Orvosod</legend>
      <label className="lobby-field" htmlFor={`${profileId}-name`}>
        <span>Orvos neve</span>
        <input id={`${profileId}-name`} className="lobby-input" type="text" value={playerName} maxLength={24} placeholder="Dr. Kovács" autoComplete="nickname" onChange={(event) => onNameChange(event.target.value)} />
      </label>
      <fieldset className="lobby-avatar-fieldset">
        <legend>Karakter</legend>
        <div className="lobby-avatars">
          {AVATARS.map((avatar) => (
            <label key={avatar.id} className="lobby-avatar">
              <input type="radio" name={`${profileId}-avatar`} value={avatar.id} checked={avatarId === avatar.id} onChange={() => onAvatarChange(avatar.id)} />
              <span className="lobby-avatar-content">
                <img src={avatar.image} alt="" width="44" height="44" />
                <span>{avatar.title}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </fieldset>
  );
}
