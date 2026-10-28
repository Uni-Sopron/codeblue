import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowLeft, Check, Copy, Globe2, LockKeyhole, Play, Plus, Users, Wifi } from 'lucide-react';
import { AVATARS } from '../../data/avatars.ts';
import {
  multiplayerService,
  type MultiplayerRoom,
  type PublicRoomSummary,
  type RemotePlayer,
  type RoomVisibility,
} from '../../services/multiplayerSocket.ts';
import { LobbyProfile } from './LobbyProfile.tsx';
import { PublicRoomList } from './PublicRoomList.tsx';
import { RoomPinDialog } from './RoomPinDialog.tsx';
import './MultiplayerLobby.css';

interface MultiplayerLobbyProps {
  onStartLocalGame: () => void;
  onStartOnlineGame: (room: MultiplayerRoom, myPlayer: RemotePlayer) => void;
}

type LobbyView = 'select' | 'create' | 'join' | 'in_lobby';
interface PinTarget { code: string; name: string }

export function MultiplayerLobby({ onStartLocalGame, onStartOnlineGame }: MultiplayerLobbyProps) {
  const [view, setView] = useState<LobbyView>('select');
  const [playerName, setPlayerName] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState('surgeon');
  const [roomName, setRoomName] = useState('');
  const [visibility, setVisibility] = useState<RoomVisibility>('public');
  const [creationPin, setCreationPin] = useState('');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [room, setRoom] = useState<MultiplayerRoom | null>(null);
  const [myPlayer, setMyPlayer] = useState<RemotePlayer | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);
  const [browserError, setBrowserError] = useState<string | null>(null);
  const [pinTarget, setPinTarget] = useState<PinTarget | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBlockedUntil, setPinBlockedUntil] = useState<number | null>(null);
  const requestPending = useRef(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedAvatar = AVATARS.find((avatar) => avatar.id === selectedAvatarId) ?? AVATARS[0];
  const effectiveName = playerName.trim() || selectedAvatar.title;
  const defaultRoomName = `${effectiveName} Klinikája`.slice(0, 24);

  useEffect(() => {
    const socket = multiplayerService.getSocket();
    const handleRoomUpdate = ({ room: updatedRoom }: { room: MultiplayerRoom }) => {
      setRoom(updatedRoom);
      const me = updatedRoom.players.find((player) => player.socketId === socket.id);
      if (me) setMyPlayer(me);
    };
    const handleGameStarted = ({ room: startedRoom }: { room: MultiplayerRoom }) => {
      const me = startedRoom.players.find((player) => player.socketId === socket.id);
      if (me) onStartOnlineGame(startedRoom, me);
    };
    const handleConnectError = () => {
      setBrowserError('A szobalista most nem érhető el. Újracsatlakozás…');
      setRoomsLoaded(true);
    };
    const handleDisconnect = () => setBrowserError('A kapcsolat megszakadt. Újracsatlakozás…');
    socket.on('room:update', handleRoomUpdate);
    socket.on('game:started', handleGameStarted);
    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);
    return () => {
      socket.off('room:update', handleRoomUpdate);
      socket.off('game:started', handleGameStarted);
      socket.off('connect_error', handleConnectError);
      socket.off('disconnect', handleDisconnect);
    };
  }, [onStartOnlineGame, view]);

  useEffect(() => {
    if (view !== 'select') return;
    return multiplayerService.subscribeRooms((rooms) => {
      setPublicRooms(rooms);
      setRoomsLoaded(true);
      setBrowserError(null);
    });
  }, [view]);

  useEffect(() => {
    if (pinBlockedUntil === null) return;
    const timeout = setTimeout(() => {
      setPinBlockedUntil(null);
      setPinError(null);
    }, Math.max(0, pinBlockedUntil - Date.now()));
    return () => clearTimeout(timeout);
  }, [pinBlockedUntil]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  const navigateTo = (nextView: LobbyView) => {
    setErrorMsg(null);
    setCreationPin('');
    if (nextView === 'select') setRoomsLoaded(false);
    setView(nextView);
  };

  const enterRoom = () => {
    const currentRoom = multiplayerService.getCurrentRoom();
    const me = multiplayerService.getMyPlayer();
    if (!currentRoom || !me) {
      setErrorMsg('Nem érkeztek meg a szoba adatai.');
      return;
    }
    setRoom(currentRoom);
    setMyPlayer(me);
    setCreationPin('');
    setPinTarget(null);
    setPinError(null);
    setView('in_lobby');
  };

  const handleCreateRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requestPending.current) return;
    requestPending.current = true;
    setErrorMsg(null);
    setIsConnecting(true);
    try {
      const result = await multiplayerService.createRoom(effectiveName, selectedAvatarId, selectedAvatar.color, {
        name: roomName.trim() || undefined,
        visibility,
        pin: creationPin || undefined,
      });
      if (result.success) enterRoom();
      else setErrorMsg(result.error || 'Nem sikerült létrehozni a szobát.');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'Hálózati hiba történt.');
    } finally {
      requestPending.current = false;
      setIsConnecting(false);
    }
  };

  const joinRoom = async (code: string, pin?: string, name?: string) => {
    if (requestPending.current) return;
    requestPending.current = true;
    setErrorMsg(null);
    setPinError(null);
    setIsConnecting(true);
    try {
      const result = await multiplayerService.joinRoom(code, effectiveName, selectedAvatarId, selectedAvatar.color, pin);
      if (result.success) {
        enterRoom();
      } else if (result.errorCode === 'PIN_LOCKED') {
        setPinBlockedUntil(Date.now() + (result.retryAfterSeconds ?? 60) * 1000);
        const message = result.error || 'A belépés átmenetileg zárolva van.';
        if (pinTarget) setPinError(message);
        else setErrorMsg(message);
      } else if (result.errorCode === 'PIN_REQUIRED' || result.errorCode === 'PIN_INVALID') {
        setPinTarget((current) => current?.code === code ? current : { code, name: name || `Szoba: ${code}` });
        setPinError(result.errorCode === 'PIN_REQUIRED' ? null : result.error || 'Hibás PIN.');
      } else if (pinTarget) {
        setPinError(result.error || 'Nem sikerült csatlakozni.');
      } else {
        setErrorMsg(result.error || 'Nem sikerült csatlakozni a szobához.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Hálózati hiba történt.';
      if (pinTarget) setPinError(message);
      else setErrorMsg(message);
    } finally {
      requestPending.current = false;
      setIsConnecting(false);
    }
  };

  const joinPublicRoom = (target: PublicRoomSummary) => {
    if (target.hasPin) {
      setPinError(null);
      setPinTarget({ code: target.code, name: target.name });
    } else void joinRoom(target.code, undefined, target.name);
  };

  const handleCodeJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = inputRoomCode.trim().toUpperCase();
    void joinRoom(/^[0-9]{4}$/.test(code) ? `CB-${code}` : code);
  };

  const handleHostStartGame = async () => {
    if (!room || room.players.length < 2 || requestPending.current) return;
    requestPending.current = true;
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      const result = await multiplayerService.startGame(room.code);
      if (!result.success) setErrorMsg(result.error || 'Nem sikerült elindítani a játékot.');
    } catch {
      setErrorMsg('Nem sikerült elindítani a játékot.');
    } finally {
      requestPending.current = false;
      setIsConnecting(false);
    }
  };

  const copyRoomCode = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMsg('A szobakód nem másolható automatikusan.');
    }
  };

  const profile = <LobbyProfile playerName={playerName} avatarId={selectedAvatarId} disabled={isConnecting} onNameChange={setPlayerName} onAvatarChange={setSelectedAvatarId} />;

  return (
    <main className="lobby-container">
      <div className="lobby-card">
        {view === 'select' ? (
          <>
            <header className="lobby-hero">
              <img src="/assets/board_center.jpg" alt="" className="lobby-hero-img" />
              <div className="lobby-hero-overlay"><span className="lobby-tag">ONLINE ÉS HELYI JÁTÉK</span><h1 className="lobby-hero-title">CodeBlue Magánklinika</h1></div>
            </header>
            <div className="lobby-content">
              <div className="lobby-main-actions">
                <button className="lobby-primary" type="button" disabled={isConnecting} onClick={() => navigateTo('create')}><Plus aria-hidden="true" />Szoba létrehozása</button>
                <button className="lobby-secondary" type="button" disabled={isConnecting} onClick={() => navigateTo('join')}><LockKeyhole aria-hidden="true" />Csatlakozás kóddal</button>
                <button className="lobby-secondary" type="button" disabled={isConnecting} onClick={onStartLocalGame}><Users aria-hidden="true" />Helyi játék</button>
              </div>
              <details className="lobby-profile-disclosure"><summary>Orvosod: <strong>{effectiveName}</strong></summary>{profile}</details>
              {errorMsg && <p className="lobby-form-error" role="alert">{errorMsg}</p>}
              <PublicRoomList rooms={publicRooms} loaded={roomsLoaded} error={browserError} pending={isConnecting} onJoin={joinPublicRoom} />
            </div>
          </>
        ) : view === 'in_lobby' && room ? (
          <div className="lobby-content">
            <header className="lobby-header">
              <span className="lobby-badge">{room.visibility === 'private' ? <LockKeyhole aria-hidden="true" /> : <Globe2 aria-hidden="true" />}{room.visibility === 'private' ? 'Privát szoba' : 'Nyilvános szoba'}{room.hasPin && <span> · PIN-védelem</span>}</span>
              <h1 className="lobby-title">{room.name}</h1>
            </header>
            <div className="lobby-room-code"><span>Szobakód <strong>{room.code}</strong></span><button className="lobby-secondary" type="button" onClick={() => void copyRoomCode()}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? 'Másolva' : 'Másolás'}</button></div>
            <div className="lobby-slots" aria-label="Játékosok">
              {[0, 1, 2, 3].map((index) => {
                const player = room.players[index];
                const avatar = AVATARS.find((candidate) => candidate.id === player?.avatar) ?? AVATARS[0];
                return player ? (
                  <div className="lobby-slot" key={player.id}>
                    <img src={avatar.image} alt="" width="48" height="48" />
                    <div><strong>{player.name}{player.id === myPlayer?.id ? ' (Te)' : ''}</strong><span>{player.isHost ? 'Szobagazda' : avatar.title}{!player.connected ? ' · Kapcsolat megszakadt' : ''}</span></div>
                  </div>
                ) : <div className="lobby-slot lobby-slot--empty" key={`empty-${index}`}><Users aria-hidden="true" /><span>Szabad hely</span></div>;
              })}
            </div>
            {errorMsg && <p className="lobby-form-error" role="alert">{errorMsg}</p>}
            <div className="lobby-form-actions">
              {myPlayer?.isHost ? <button className="lobby-primary" type="button" disabled={isConnecting || room.players.length < 2} onClick={() => void handleHostStartGame()}><Play aria-hidden="true" />{room.players.length < 2 ? 'Legalább 2 játékos szükséges' : isConnecting ? 'Indítás…' : `Játék indítása (${room.players.length} fő)`}</button>
                : <p className="lobby-waiting" role="status">Várakozás a szobagazda indítására…</p>}
              <button className="lobby-secondary" type="button" disabled={isConnecting} onClick={() => { multiplayerService.leaveRoom(room.code); setRoom(null); setMyPlayer(null); setCopied(false); navigateTo('select'); }}><ArrowLeft aria-hidden="true" />Szoba elhagyása</button>
            </div>
          </div>
        ) : (
          <div className="lobby-content">
            <header className="lobby-header"><span className="lobby-badge"><Wifi aria-hidden="true" />Online játék</span><h1 className="lobby-title">{view === 'create' ? 'Szoba létrehozása' : 'Csatlakozás kóddal'}</h1></header>
            <form className="lobby-form" onSubmit={view === 'create' ? handleCreateRoom : handleCodeJoin}>
              {profile}
              <fieldset className="lobby-room-fields" disabled={isConnecting}>
                <legend>{view === 'create' ? 'Szobabeállítások' : 'Szoba'}</legend>
                {view === 'create' ? (
                  <>
                    <label className="lobby-field" htmlFor="lobby-room-name"><span>Szoba neve</span><input id="lobby-room-name" className="lobby-input" type="text" value={roomName} maxLength={24} placeholder={defaultRoomName} onChange={(event) => setRoomName(event.target.value)} /><span className="lobby-field-hint">Legfeljebb 24 karakter.</span></label>
                    <fieldset className="lobby-visibility"><legend>Láthatóság</legend><label><input type="radio" name="room-visibility" value="public" checked={visibility === 'public'} onChange={() => setVisibility('public')} /><span><Globe2 aria-hidden="true" /><strong>Nyilvános</strong><small>Megjelenik a szobalistában.</small></span></label><label><input type="radio" name="room-visibility" value="private" checked={visibility === 'private'} onChange={() => setVisibility('private')} /><span><LockKeyhole aria-hidden="true" /><strong>Privát</strong><small>Csak szobakóddal érhető el.</small></span></label></fieldset>
                    <label className="lobby-field" htmlFor="lobby-create-pin"><span>Belépési PIN (opcionális)</span><input id="lobby-create-pin" className="lobby-input" type="password" inputMode="numeric" autoComplete="off" pattern="[0-9]{4}" minLength={4} maxLength={4} value={creationPin} onChange={(event) => setCreationPin(event.target.value.replace(/[^0-9]/g, ''))} /><span className="lobby-field-hint">Üresen hagyva nincs PIN-védelem. Egyébként 4 számjegy.</span></label>
                  </>
                ) : <label className="lobby-field" htmlFor="lobby-room-code"><span>Szobakód</span><input id="lobby-room-code" className="lobby-input lobby-code-input" type="text" required pattern="(?:CB-)?[0-9]{4}" maxLength={7} spellCheck={false} autoComplete="off" value={inputRoomCode} placeholder="CB-1234" onChange={(event) => setInputRoomCode(event.target.value.toUpperCase())} /></label>}
              </fieldset>
              {errorMsg && <p className="lobby-form-error" role="alert">{errorMsg}</p>}
              <div className="lobby-form-actions"><button className="lobby-primary" type="submit" disabled={isConnecting}>{view === 'create' ? <Plus aria-hidden="true" /> : <Wifi aria-hidden="true" />}{isConnecting ? 'Kapcsolódás…' : view === 'create' ? 'Szoba létrehozása' : 'Csatlakozás'}</button><button className="lobby-secondary" type="button" disabled={isConnecting} onClick={() => navigateTo('select')}><ArrowLeft aria-hidden="true" />Vissza</button></div>
            </form>
          </div>
        )}
      </div>
      {pinTarget && <RoomPinDialog key={pinTarget.code} roomName={pinTarget.name} pending={isConnecting} locked={pinBlockedUntil !== null} error={pinError} onSubmit={(pin) => void joinRoom(pinTarget.code, pin, pinTarget.name)} onClose={() => { setPinTarget(null); setPinError(null); }} />}
    </main>
  );
}

export default MultiplayerLobby;
