import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { websocketService } from '../services/websocket';

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { token, isAuthenticated } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // WebSocket 비활성화 - 현재 사용하지 않음
    // if (isAuthenticated && token && import.meta.env.VITE_ENABLE_WEBSOCKET !== 'false') {
    //   websocketService.connect(token);
    // }

    return () => {
      // websocketService.disconnect();
    };
  }, [isAuthenticated, token]);

  return <>{children}</>;
};