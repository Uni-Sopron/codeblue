import { io, Socket } from 'socket.io-client';
import type { GameState } from '../types/game.ts';

// Resolve backend server URL dynamically
export const getSocketUrl = (): string => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (typeof window !== 'undefined') {
    const { hostname, protocol } = window.location;
    if (hostname.includes('branchlab.tech')) {
      return `${protocol}//codeblue.branchlab.tech`;
    }
    // Local dev default
    return 'http://localhost:3001';
  }
  return 'http://localhost:3001';
};

export interface RemotePlayer {
  socketId: string;
  id: string; // 'p1' | 'p2' | 'p3' | 'p4'
  name: string;
  avatar: string;
  avatarTitle: string;
  color: string;
  isHost: boolean;
  connected: boolean;
}

export interface MultiplayerRoom {
  code: string;
  hostSocketId: string;
  players: RemotePlayer[];
  gameStarted: boolean;
  gameState: GameState | null;
  createdAt: string;
}

class MultiplayerSocketService {
  private socket: Socket | null = null;
  private currentRoom: MultiplayerRoom | null = null;
  private myPlayer: RemotePlayer | null = null;

  public connect(): Socket {
    if (!this.socket) {
      const url = getSocketUrl();
      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        console.log(`[Multiplayer] Connected to server at ${url} (Socket ID: ${this.socket?.id})`);
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`[Multiplayer] Disconnected: ${reason}`);
      });

      this.socket.on('connect_error', (err) => {
        console.warn(`[Multiplayer] Connection error:`, err.message);
      });
    }
    return this.socket;
  }

  public getSocket(): Socket {
    return this.connect();
  }

  public getCurrentRoom(): MultiplayerRoom | null {
    return this.currentRoom;
  }

  public getMyPlayer(): RemotePlayer | null {
    return this.myPlayer;
  }

  public isHost(): boolean {
    return !!this.myPlayer?.isHost;
  }

  public createRoom(
    playerName: string,
    avatarId: string,
    color: string
  ): Promise<{ success: boolean; roomCode?: string; player?: RemotePlayer; error?: string }> {
    const socket = this.connect();
    return new Promise((resolve) => {
      socket.emit(
        'room:create',
        { playerName, avatarId, color },
        (res: { success: boolean; roomCode?: string; player?: RemotePlayer; room?: MultiplayerRoom; error?: string }) => {
          if (res.success && res.room && res.player) {
            this.currentRoom = res.room;
            this.myPlayer = res.player;
          }
          resolve(res);
        }
      );
    });
  }

  public joinRoom(
    roomCode: string,
    playerName: string,
    avatarId: string,
    color: string
  ): Promise<{ success: boolean; roomCode?: string; player?: RemotePlayer; error?: string }> {
    const socket = this.connect();
    return new Promise((resolve) => {
      socket.emit(
        'room:join',
        { roomCode, playerName, avatarId, color },
        (res: { success: boolean; roomCode?: string; player?: RemotePlayer; room?: MultiplayerRoom; error?: string }) => {
          if (res.success && res.room && res.player) {
            this.currentRoom = res.room;
            this.myPlayer = res.player;
          }
          resolve(res);
        }
      );
    });
  }

  public startGame(roomCode: string, initialGameState: GameState): Promise<{ success: boolean; error?: string }> {
    const socket = this.connect();
    return new Promise((resolve) => {
      socket.emit('room:start', { roomCode, initialGameState }, (res: { success: boolean; error?: string }) => {
        resolve(res);
      });
    });
  }

  public sendAction(roomCode: string, actionType: string, payload?: unknown, newGameState?: GameState): void {
    if (!this.socket) return;
    this.socket.emit('game:action', { roomCode, actionType, payload, newGameState });
  }

  public syncState(roomCode: string, gameState: GameState): void {
    if (!this.socket) return;
    this.socket.emit('game:sync', { roomCode, gameState });
  }

  public reconnectRoom(
    roomCode: string,
    playerId: string
  ): Promise<{ success: boolean; room?: MultiplayerRoom; player?: RemotePlayer; gameState?: GameState; error?: string }> {
    const socket = this.connect();
    return new Promise((resolve) => {
      socket.emit(
        'room:reconnect',
        { roomCode, playerId },
        (res: { success: boolean; room?: MultiplayerRoom; player?: RemotePlayer; gameState?: GameState; error?: string }) => {
          if (res.success && res.room && res.player) {
            this.currentRoom = res.room;
            this.myPlayer = res.player;
          }
          resolve(res);
        }
      );
    });
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentRoom = null;
    this.myPlayer = null;
  }
}

export const multiplayerService = new MultiplayerSocketService();
