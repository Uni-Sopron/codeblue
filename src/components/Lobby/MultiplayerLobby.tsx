import React, { useState, useEffect } from 'react';
import {
  Users,
  Wifi,
  Copy,
  Check,
  Play,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { AVATARS } from '../../data/avatars.ts';
import {
  multiplayerService,
  type RemotePlayer,
  type MultiplayerRoom,
} from '../../services/multiplayerSocket.ts';
import './MultiplayerLobby.css';

interface MultiplayerLobbyProps {
  onStartLocalGame: () => void;
  onStartOnlineGame: (room: MultiplayerRoom, myPlayer: RemotePlayer) => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  onStartLocalGame,
  onStartOnlineGame,
}) => {
  // Mode: 'select' | 'create' | 'join' | 'in_lobby'
  const [view, setView] = useState<'select' | 'create' | 'join' | 'in_lobby'>('select');

  // Form states
  const [playerName, setPlayerName] = useState('');
  const [selectedAvatarId, setSelectedAvatarId] = useState('surgeon');
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Active lobby room state
  const [room, setRoom] = useState<MultiplayerRoom | null>(null);
  const [myPlayer, setMyPlayer] = useState<RemotePlayer | null>(null);

  const selectedAvatar = AVATARS.find((a) => a.id === selectedAvatarId) || AVATARS[0];

  // Listen for socket events when inside a room
  useEffect(() => {
    const socket = multiplayerService.getSocket();

    const handleRoomUpdate = ({ room: updatedRoom }: { room: MultiplayerRoom }) => {
      setRoom(updatedRoom);
      // Update myPlayer reference if needed
      const me = updatedRoom.players.find((p) => p.socketId === socket.id);
      if (me) setMyPlayer(me);
    };

    const handleGameStarted = ({ room: startedRoom }: { room: MultiplayerRoom }) => {
      const me = startedRoom.players.find((p) => p.socketId === socket.id);
      if (me) {
        onStartOnlineGame(startedRoom, me);
      }
    };

    socket.on('room:update', handleRoomUpdate);
    socket.on('game:started', handleGameStarted);

    return () => {
      socket.off('room:update', handleRoomUpdate);
      socket.off('game:started', handleGameStarted);
    };
  }, [onStartOnlineGame]);

  // Create room flow
  const handleCreateRoom = async () => {
    setErrorMsg(null);
    setIsConnecting(true);
    try {
      const res = await multiplayerService.createRoom(
        playerName.trim() || '1. Orvos',
        selectedAvatarId,
        selectedAvatar.color
      );
      setIsConnecting(false);

      if (res.success && res.roomCode) {
        const currentRoom = multiplayerService.getCurrentRoom();
        const me = multiplayerService.getMyPlayer();
        setRoom(currentRoom);
        setMyPlayer(me);
        setView('in_lobby');
      } else {
        setErrorMsg(res.error || 'Nem sikerült létrehozni a szobát.');
      }
    } catch (err: unknown) {
      setIsConnecting(false);
      setErrorMsg((err as Error).message || 'Hálózati hiba történt.');
    }
  };

  // Join room flow
  const handleJoinRoom = async () => {
    if (!inputRoomCode.trim()) {
      setErrorMsg('Kérlek add meg a 4 jegyű szobakódot!');
      return;
    }

    setErrorMsg(null);
    setIsConnecting(true);
    try {
      const res = await multiplayerService.joinRoom(
        inputRoomCode.trim().toUpperCase(),
        playerName.trim() || 'Orvos',
        selectedAvatarId,
        selectedAvatar.color
      );
      setIsConnecting(false);

      if (res.success && res.roomCode) {
        const currentRoom = multiplayerService.getCurrentRoom();
        const me = multiplayerService.getMyPlayer();
        setRoom(currentRoom);
        setMyPlayer(me);
        setView('in_lobby');
      } else {
        setErrorMsg(res.error || 'Nem sikerült csatlakozni a szobához.');
      }
    } catch (err: unknown) {
      setIsConnecting(false);
      setErrorMsg((err as Error).message || 'Hálózati hiba történt.');
    }
  };

  // Host starts the game
  const handleHostStartGame = () => {
    if (!room) return;
    if (room.players.length < 2) {
      setErrorMsg('Legalább 2 játékos szükséges az indításhoz!');
      return;
    }

    // Trigger start on server
    multiplayerService.startGame(room.code, room.gameState as never);
  };

  const handleCopyCode = () => {
    if (!room) return;
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. IN LOBBY VIEW (WAITING FOR PLAYERS)
  if (view === 'in_lobby' && room) {
    const isHost = myPlayer?.isHost;

    return (
      <div className="lobby-container">
        <div className="lobby-card">
          <div className="lobby-header">
            <span className="lobby-badge">ONLINE SZOBACSARNOK</span>
            <h1 className="lobby-title">CodeBlue Váróterem</h1>
            <p className="lobby-subtitle">
              Oszd meg a szobakódot a társaiddal, hogy csatlakozni tudjanak!
            </p>
          </div>

          {/* Room Code Display */}
          <div className="room-code-showcase" onClick={handleCopyCode} title="Kattints a másoláshoz">
            <span className="room-code-label">SZOBAKÓD:</span>
            <span className="room-code-digits">{room.code}</span>
            <button type="button" className="btn-copy-code">
              {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
              <span>{copied ? 'Kimásolva!' : 'Másolás'}</span>
            </button>
          </div>

          {/* Players Grid (Slots 1 to 4) */}
          <div className="lobby-slots-grid">
            {[0, 1, 2, 3].map((idx) => {
              const player = room.players[idx];
              const isMe = player && player.socketId === myPlayer?.socketId;

              if (player) {
                const avatar = AVATARS.find((a) => a.id === player.avatar) || AVATARS[0];
                return (
                  <div
                    key={player.id}
                    className={`lobby-slot-card slot-occupied ${isMe ? 'slot-me' : ''}`}
                    style={{ borderColor: player.color }}
                  >
                    <div className="slot-avatar-wrapper">
                      <img
                        src={avatar.image || '/assets/board_center.jpg'}
                        alt={player.name}
                        className="slot-avatar-img"
                        style={{ borderColor: player.color }}
                      />
                      <span className="slot-online-dot" />
                    </div>
                    <div className="slot-info">
                      <span className="slot-role" style={{ color: player.color }}>
                        {avatar.title} {player.isHost && '👑 (Szobagazda)'}
                      </span>
                      <span className="slot-name">
                        {player.name} {isMe && '(Te)'}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={idx} className="lobby-slot-card slot-empty">
                  <div className="slot-empty-icon">➕</div>
                  <span className="slot-empty-text">Várakozás {idx + 1}. orvosra...</span>
                </div>
              );
            })}
          </div>

          {errorMsg && (
            <div className="lobby-error">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Footer */}
          <div className="lobby-actions">
            {isHost ? (
              <button
                type="button"
                className="btn-start-multiplayer"
                disabled={room.players.length < 2}
                onClick={handleHostStartGame}
              >
                <Play size={20} />
                <span>
                  {room.players.length < 2
                    ? 'Legalább 2 játékos szükséges...'
                    : `Játék Indítása (${room.players.length} Orvos)`}
                </span>
              </button>
            ) : (
              <div className="lobby-waiting-notice">
                <span className="pulse-spinner" />
                <span>Várakozás a szobagazda indítására...</span>
              </div>
            )}

            <button
              type="button"
              className="btn-leave-lobby"
              onClick={() => {
                multiplayerService.disconnect();
                setRoom(null);
                setMyPlayer(null);
                setView('select');
              }}
            >
              <ArrowLeft size={16} />
              <span>Szoba elhagyása</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. CREATE ROOM VIEW
  if (view === 'create') {
    return (
      <div className="lobby-container">
        <div className="lobby-card">
          <div className="lobby-header">
            <span className="lobby-badge">ONLINE MULTIPLAYER</span>
            <h1 className="lobby-title">Új Szoba Létrehozása</h1>
            <p className="lobby-subtitle">
              Te leszel a szobagazda! Válaszd ki orvosodat és indítsd el a szobát.
            </p>
          </div>

          <div className="lobby-form-section">
            <label className="lobby-input-label">Az Ön neve / orvosi titulusa:</label>
            <input
              type="text"
              className="lobby-text-input"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={`Pl. Dr. ${selectedAvatar.title}`}
            />
          </div>

          <div className="lobby-form-section">
            <label className="lobby-input-label">Válassz Orvosi Karaktert:</label>
            <div className="avatar-selection-grid">
              {AVATARS.map((av) => (
                <div
                  key={av.id}
                  className={`avatar-pick-card ${selectedAvatarId === av.id ? 'active' : ''}`}
                  style={{ borderColor: av.color }}
                  onClick={() => setSelectedAvatarId(av.id)}
                >
                  <img
                    src={av.image || '/assets/board_center.jpg'}
                    alt={av.title}
                    className="avatar-pick-img"
                  />
                  <div className="avatar-pick-info">
                    <span className="avatar-pick-title" style={{ color: av.color }}>
                      {av.title}
                    </span>
                    <span className="avatar-pick-role">{av.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="lobby-error">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="lobby-actions">
            <button
              type="button"
              className="btn-primary-action"
              disabled={isConnecting}
              onClick={handleCreateRoom}
            >
              <Sparkles size={18} />
              <span>{isConnecting ? 'Kapcsolódás...' : 'Szoba Létrehozása & Belépés'}</span>
            </button>

            <button type="button" className="btn-secondary-action" onClick={() => setView('select')}>
              <ArrowLeft size={16} />
              <span>Vissza</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. JOIN ROOM VIEW
  if (view === 'join') {
    return (
      <div className="lobby-container">
        <div className="lobby-card">
          <div className="lobby-header">
            <span className="lobby-badge">ONLINE MULTIPLAYER</span>
            <h1 className="lobby-title">Csatlakozás Szobához</h1>
            <p className="lobby-subtitle">
              Add meg a barátodtól kapott 4 jegyű szobakódot a belépéshez!
            </p>
          </div>

          <div className="lobby-form-section">
            <label className="lobby-input-label">Szobakód (pl. CB-4821):</label>
            <input
              type="text"
              className="lobby-text-input text-code"
              value={inputRoomCode}
              onChange={(e) => setInputRoomCode(e.target.value.toUpperCase())}
              placeholder="CB-XXXX"
              maxLength={8}
            />
          </div>

          <div className="lobby-form-section">
            <label className="lobby-input-label">Az Ön neve / orvosi titulusa:</label>
            <input
              type="text"
              className="lobby-text-input"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={`Pl. Dr. ${selectedAvatar.title}`}
            />
          </div>

          <div className="lobby-form-section">
            <label className="lobby-input-label">Válassz Orvosi Karaktert:</label>
            <div className="avatar-selection-grid">
              {AVATARS.map((av) => (
                <div
                  key={av.id}
                  className={`avatar-pick-card ${selectedAvatarId === av.id ? 'active' : ''}`}
                  style={{ borderColor: av.color }}
                  onClick={() => setSelectedAvatarId(av.id)}
                >
                  <img
                    src={av.image || '/assets/board_center.jpg'}
                    alt={av.title}
                    className="avatar-pick-img"
                  />
                  <div className="avatar-pick-info">
                    <span className="avatar-pick-title" style={{ color: av.color }}>
                      {av.title}
                    </span>
                    <span className="avatar-pick-role">{av.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="lobby-error">
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="lobby-actions">
            <button
              type="button"
              className="btn-primary-action"
              disabled={isConnecting}
              onClick={handleJoinRoom}
            >
              <Wifi size={18} />
              <span>{isConnecting ? 'Kapcsolódás...' : 'Csatlakozás a Szobához'}</span>
            </button>

            <button type="button" className="btn-secondary-action" onClick={() => setView('select')}>
              <ArrowLeft size={16} />
              <span>Vissza</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. DEFAULT: SELECT GAME MODE
  return (
    <div className="lobby-container">
      <div className="lobby-card">
        <div className="lobby-hero">
          <img src="/assets/board_center.jpg" alt="Magánklinika" className="lobby-hero-img" />
          <div className="lobby-hero-overlay">
            <span className="lobby-tag">HACKATHON 2026 EDITION</span>
            <h1 className="lobby-hero-title">CodeBlue Magánklinika</h1>
            <p className="lobby-hero-desc">
              Építsd fel a legmodernebb magánklinikát, gazdálkodj okosan a bevételeiddel, kerüld el
              a csődöt és érd el elsőként a teljes felkészültséget!
            </p>
          </div>
        </div>

        <div className="mode-selection-area">
          <h2 className="mode-heading">Válassz Játékmódot:</h2>

          <div className="mode-cards-grid">
            {/* Mode 1: Online Multiplayer */}
            <div className="mode-card mode-online" onClick={() => setView('create')}>
              <div className="mode-icon-circle online-icon">
                <Wifi size={28} />
              </div>
              <div className="mode-info">
                <span className="mode-badge-rec">⭐ AJÁNLOTT HACKATHON</span>
                <h3 className="mode-title">Online Multiplayer</h3>
                <p className="mode-desc">
                  4 külön orvos 4 különböző laptopról vagy mobiltelefonról játszik valós időben,
                  szobakóddal!
                </p>
              </div>
              <button
                type="button"
                className="btn-mode-cta"
                onClick={(e) => {
                  e.stopPropagation();
                  setView('create');
                }}
              >
                <span>Új Szoba Létrehozása</span>
              </button>
              <button
                type="button"
                className="btn-mode-sub"
                onClick={(e) => {
                  e.stopPropagation();
                  setView('join');
                }}
              >
                <span>Van már kódom? Csatlakozás</span>
              </button>
            </div>

            {/* Mode 2: Local Hotseat */}
            <div className="mode-card mode-local" onClick={onStartLocalGame}>
              <div className="mode-icon-circle local-icon">
                <Users size={28} />
              </div>
              <div className="mode-info">
                <span className="mode-badge-local">1 GÉP</span>
                <h3 className="mode-title">Helyi Játék (Hotseat)</h3>
                <p className="mode-desc">
                  2–4 játékos játszik ugyanazon az egy képernyőn, felváltva egymás után dobva.
                </p>
              </div>
              <button
                type="button"
                className="btn-mode-cta local-cta"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartLocalGame();
                }}
              >
                <ShieldCheck size={18} />
                <span>Helyi Játék Indítása</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiplayerLobby;
