import { io, Socket } from 'socket.io-client';
import { store } from '../store';
import { addNotification } from '../store/slices/notificationSlice';
import { WebSocketMessage } from '../types/gitlab';

export enum WebSocketEvent {
  // Connection events
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  
  // GitLab events
  GROUP_CREATED = 'group:created',
  GROUP_UPDATED = 'group:updated',
  GROUP_DELETED = 'group:deleted',
  
  PROJECT_CREATED = 'project:created',
  PROJECT_UPDATED = 'project:updated',
  PROJECT_DELETED = 'project:deleted',
  
  MEMBER_ADDED = 'member:added',
  MEMBER_REMOVED = 'member:removed',
  MEMBER_UPDATED = 'member:updated',
  
  // Job events
  JOB_STARTED = 'job:started',
  JOB_PROGRESS = 'job:progress',
  JOB_COMPLETED = 'job:completed',
  JOB_FAILED = 'job:failed',
  
  // System events
  BACKUP_STARTED = 'backup:started',
  BACKUP_COMPLETED = 'backup:completed',
  SYSTEM_ALERT = 'system:alert',
}

class WebSocketService {
  private socket: Socket | null = null;
  // private reconnectAttempts = 0; // Will be used for reconnect logic
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(token: string) {
    if (this.socket?.connected) {
      return;
    }

    // Connect to the same backend server (WebSocket is on the same port)
    const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:4000';
    
    this.socket = io(wsUrl, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    if (!this.socket) {return;}

    // Connection events
    this.socket.on(WebSocketEvent.CONNECT, () => {
      // this.reconnectAttempts = 0;
      store.dispatch(addNotification({
        type: 'success',
        message: '실시간 연결이 설정되었습니다',
      }));
    });

    this.socket.on(WebSocketEvent.DISCONNECT, (reason) => {
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect
        this.socket?.connect();
      }
    });

    this.socket.on(WebSocketEvent.ERROR, () => {
      store.dispatch(addNotification({
        type: 'error',
        message: '실시간 연결 오류가 발생했습니다',
      }));
    });

    // GitLab events
    this.socket.on(WebSocketEvent.GROUP_CREATED, (data) => {
      store.dispatch(addNotification({
        type: 'info',
        message: `새 그룹이 생성되었습니다: ${data.name}`,
      }));
    });

    this.socket.on(WebSocketEvent.PROJECT_CREATED, (data) => {
      store.dispatch(addNotification({
        type: 'info',
        message: `새 프로젝트가 생성되었습니다: ${data.name}`,
      }));
    });

    // Job events
    this.socket.on(WebSocketEvent.JOB_STARTED, (data) => {
      store.dispatch(addNotification({
        type: 'info',
        message: `작업이 시작되었습니다: ${data.name}`,
        jobId: data.id,
      }));
    });

    this.socket.on(WebSocketEvent.JOB_PROGRESS, (data) => {
      // Update job progress in the store
      store.dispatch({
        type: 'jobs/updateProgress',
        payload: { id: data.id, progress: data.progress },
      });
    });

    this.socket.on(WebSocketEvent.JOB_COMPLETED, (data) => {
      store.dispatch(addNotification({
        type: 'success',
        message: `작업이 완료되었습니다: ${data.name}`,
        jobId: data.id,
      }));
    });

    this.socket.on(WebSocketEvent.JOB_FAILED, (data) => {
      store.dispatch(addNotification({
        type: 'error',
        message: `작업이 실패했습니다: ${data.name}`,
        jobId: data.id,
      }));
    });

    // System events
    this.socket.on(WebSocketEvent.SYSTEM_ALERT, (data) => {
      store.dispatch(addNotification({
        type: data.severity || 'warning',
        message: data.message,
        persistent: data.persistent || false,
      }));
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit<T = unknown>(event: string, data?: T) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      // WebSocket is not connected, silently ignore
    }
  }

  on<T = WebSocketMessage>(event: string, callback: (data: T) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off<T = WebSocketMessage>(event: string, callback?: (data: T) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  subscribeToJob(jobId: string) {
    this.emit('job:subscribe', { jobId });
  }

  unsubscribeFromJob(jobId: string) {
    this.emit('job:unsubscribe', { jobId });
  }

  subscribeToGroup(groupId: number) {
    this.emit('group:subscribe', { groupId });
  }

  unsubscribeFromGroup(groupId: number) {
    this.emit('group:unsubscribe', { groupId });
  }

  subscribeToProject(projectId: number) {
    this.emit('project:subscribe', { projectId });
  }

  unsubscribeFromProject(projectId: number) {
    this.emit('project:unsubscribe', { projectId });
  }
}

export const websocketService = new WebSocketService();