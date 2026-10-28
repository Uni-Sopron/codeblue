import { LockKeyhole, Users, Wifi } from 'lucide-react';
import { AVATARS } from '../../data/avatars.ts';
import type { PublicRoomSummary } from '../../services/multiplayerSocket.ts';

interface PublicRoomListProps {
  rooms: PublicRoomSummary[];
  loaded: boolean;
  error: string | null;
  pending: boolean;
  onJoin: (room: PublicRoomSummary) => void;
}

export function PublicRoomList({ rooms, loaded, error, pending, onJoin }: PublicRoomListProps) {
  return (
    <section className="lobby-browser" aria-labelledby="public-rooms-title">
      <header className="lobby-browser-heading">
        <h2 id="public-rooms-title"><Wifi aria-hidden="true" />Nyilvános szobák</h2>
        <span className="lobby-room-total" aria-live="polite">{loaded ? `${rooms.length} szoba` : 'Kapcsolódás…'}</span>
      </header>
      {error ? <p className="lobby-browser-message" role="status">{error}</p>
        : !loaded ? <p className="lobby-browser-message" role="status">Szobák betöltése…</p>
          : rooms.length === 0 ? <p className="lobby-browser-message">Még nincs nyilvános szoba.</p>
            : <ul className="lobby-room-list">
              {rooms.map((room) => {
                const avatar = AVATARS.find((candidate) => candidate.id === room.hostAvatar) ?? AVATARS[0];
                const full = room.playerCount >= room.maxPlayers;
                return (
                  <li key={room.code} className="lobby-public-room">
                    <img className="lobby-host-portrait" src={avatar.image} alt="" width="48" height="48" />
                    <div className="lobby-public-room-info">
                      <h3>{room.name}{room.hasPin && <span className="lobby-pin-mark"><LockKeyhole aria-hidden="true" /><span className="lobby-sr-only">PIN-védelem</span></span>}</h3>
                      <p>Szobagazda: {room.hostName}</p>
                      <span className={`lobby-room-status${room.gameStarted ? ' lobby-room-status--playing' : ''}`}>{room.gameStarted ? 'Játék folyamatban' : 'Várakozás játékosokra'}</span>
                    </div>
                    <span className="lobby-player-count" aria-label={`${room.playerCount} játékos, ${room.maxPlayers} hely`}><Users aria-hidden="true" />{room.playerCount} / {room.maxPlayers}</span>
                    <button className="lobby-room-join" type="button" disabled={pending || room.gameStarted || full} aria-label={`Csatlakozás: ${room.name}`} onClick={() => onJoin(room)}>{room.gameStarted ? 'Folyamatban' : full ? 'Megtelt' : 'Csatlakozás'}</button>
                  </li>
                );
              })}
            </ul>}
    </section>
  );
}
