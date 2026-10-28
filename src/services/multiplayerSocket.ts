import { io, type Socket } from 'socket.io-client';
import type { GameState } from '../types/game.ts';

export const getSocketUrl = (): string => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (typeof window !== 'undefined' && window.location.hostname.includes('branchlab.tech')) {
    return `${window.location.protocol}//codeblue.branchlab.tech`;
  }
  return 'http://localhost:3001';
};

export type RoomVisibility = 'public' | 'private';
export interface RoomCreateOptions {
  name?: string;
  visibility?: RoomVisibility;
  pin?: string;
}
export interface PublicRoomSummary {
  code: string;
  name: string;
  hostName: string;
  hostAvatar: string;
  playerCount: number;
  maxPlayers: 4;
  gameStarted: boolean;
  hasPin: boolean;
}
export interface RemotePlayer {
  socketId: string;
  id: string;
  name: string;
  avatar: string;
  avatarTitle: string;
  color: string;
  isHost: boolean;
  connected: boolean;
  isAI?: boolean;
}
export interface MultiplayerRoom {
  code: string;
  name: string;
  visibility: RoomVisibility;
  hasPin: boolean;
  hostSocketId: string;
  players: RemotePlayer[];
  gameStarted: boolean;
  gameState: GameState | null;
  createdAt: string;
  rematchVotes?: Record<string, boolean>;
  disconnectTimeout?: { playerId: string; remainingSeconds: number } | null;
}
export interface RoomResponse {
  success: boolean;
  roomCode?: string;
  room?: MultiplayerRoom;
  player?: RemotePlayer;
  gameState?: GameState;
  error?: string;
  errorCode?: string;
  retryAfterSeconds?: number;
  reconnectToken?: string;
}

class MultiplayerSocketService {
  private socket: Socket | null = null;
  private currentRoom: MultiplayerRoom | null = null;
  private myPlayer: RemotePlayer | null = null;
  private reconnectTokens = new Map<string, string>();
  private roomSubscriptions = new Set<(rooms: PublicRoomSummary[]) => void>();
  private latestRooms: PublicRoomSummary[] = [];

  private tokenKey(roomCode: string, playerId: string): string {
    return `codeblue:reconnect:${roomCode}:${playerId}`;
  }
  private remember(response: RoomResponse): void {
    if (!response.success || !response.room || !response.player) return;
    this.currentRoom = response.room;
    this.myPlayer = response.player;
    if (response.reconnectToken) {
      const key = this.tokenKey(response.room.code, response.player.id);
      this.reconnectTokens.set(key, response.reconnectToken);
      try { sessionStorage.setItem(key, response.reconnectToken); } catch { /* Storage can be disabled. */ }
    }
  }
  private readToken(roomCode: string, playerId: string): string | undefined {
    const key = this.tokenKey(roomCode, playerId);
    try { return this.reconnectTokens.get(key) || sessionStorage.getItem(key) || undefined; }
    catch { return this.reconnectTokens.get(key); }
  }
  private forgetToken(): void {
    if (!this.currentRoom || !this.myPlayer) return;
    const key = this.tokenKey(this.currentRoom.code, this.myPlayer.id);
    this.reconnectTokens.delete(key);
    try { sessionStorage.removeItem(key); } catch { /* Storage can be disabled. */ }
  }
  private request(event: string, payload: unknown): Promise<RoomResponse> {
    const socket = this.connect();
    return new Promise((resolve) => {
      socket.timeout(8000).emit(event, payload, (error: Error | null, response: RoomResponse) => {
        if (error) { resolve({ success: false, error: 'A szerver nem válaszol. Próbáld újra.', errorCode: 'CONNECTION_TIMEOUT' }); return; }
        this.remember(response);
        resolve(response);
      });
    });
  }

  public connect(): Socket {
    if (!this.socket) {
      this.socket = io(getSocketUrl(), { transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: 5, reconnectionDelay: 1000 });
      this.socket.on('connect', () => {
        if (this.roomSubscriptions.size) this.socket?.emit('rooms:subscribe');
        if (this.currentRoom && this.myPlayer) void this.reconnectRoom(this.currentRoom.code, this.myPlayer.id);
      });
      const onRooms = ({ rooms }: { rooms: PublicRoomSummary[] }) => {
        this.latestRooms = rooms;
        this.roomSubscriptions.forEach((listener) => listener(rooms));
      };
      this.socket.on('rooms:list', onRooms);
      this.socket.on('rooms:update', onRooms);
      this.socket.on('room:update', ({ room }: { room: MultiplayerRoom }) => {
        if (room.code !== this.currentRoom?.code) return;
        this.currentRoom = room;
        this.myPlayer = room.players.find((p) => p.id === this.myPlayer?.id) || null;
      });
    }
    return this.socket;
  }
  public getSocket(): Socket { return this.connect(); }
  public getCurrentRoom(): MultiplayerRoom | null { return this.currentRoom; }
  public getMyPlayer(): RemotePlayer | null { return this.myPlayer; }
  public isHost(): boolean { return !!this.myPlayer?.isHost; }

  public subscribeRooms(listener: (rooms: PublicRoomSummary[]) => void): () => void {
    const socket = this.connect();
    this.roomSubscriptions.add(listener);
    listener(this.latestRooms);
    if (this.roomSubscriptions.size === 1 && socket.connected) socket.emit('rooms:subscribe');
    return () => {
      this.roomSubscriptions.delete(listener);
      if (!this.roomSubscriptions.size) this.socket?.emit('rooms:unsubscribe');
    };
  }
  public createRoom(playerName: string, avatarId: string, color: string, options: RoomCreateOptions = {}): Promise<RoomResponse> {
    return this.request('room:create', { playerName, avatarId, color, ...options });
  }
  public joinRoom(roomCode: string, playerName: string, avatarId: string, color: string, pin?: string): Promise<RoomResponse> {
    return this.request('room:join', { roomCode, playerName, avatarId, color, pin });
  }
  public startGame(roomCode: string, initialGameState?: GameState): Promise<RoomResponse> {
    return this.request('room:start', { roomCode, initialGameState });
  }
  public sendAction(roomCode: string, actionType: string, payload?: unknown, newGameState?: GameState): void {
    this.socket?.emit('game:action', { roomCode, actionType, payload, newGameState });
  }
  public syncState(roomCode: string, gameState: GameState): void {
    this.socket?.emit('game:sync', { roomCode, gameState });
  }
  public reconnectRoom(roomCode: string, playerId: string): Promise<RoomResponse> {
    return this.request('room:reconnect', { roomCode, playerId, reconnectToken: this.readToken(roomCode, playerId) });
  }
  public voteRematch(roomCode: string, ready: boolean): void { this.socket?.emit('room:rematch_vote', { roomCode, ready }); }
  public leaveRoom(roomCode: string): void {
    this.socket?.emit('room:leave', { roomCode });
    this.disconnect();
  }
  public disconnect(): void {
    this.forgetToken();
    this.currentRoom = null;
    this.myPlayer = null;
    this.socket?.disconnect();
    this.socket = null;
    this.latestRooms = [];
  }
}

export const multiplayerService = new MultiplayerSocketService();
