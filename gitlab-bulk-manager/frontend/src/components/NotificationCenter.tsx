import React, { useState } from 'react';
import {
  IconButton,
  Badge,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Button,
  Divider,
  ListItemButton,
  useTheme,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  CheckCircle,
  Error,
  Warning,
  Info,
  Clear,
  DoneAll,
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import {
  markAsRead,
  markAllAsRead,
  removeNotification,
  clearNotifications,
} from '../store/slices/notificationSlice';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

export const NotificationCenter: React.FC = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { notifications, unreadCount } = useSelector((state: RootState) => state.notifications);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notificationId: string) => {
    dispatch(markAsRead(notificationId));
  };

  const handleRemoveNotification = (notificationId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    dispatch(removeNotification(notificationId));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'info':
      default:
        return <Info color="info" />;
    }
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton color="inherit" onClick={handleClick}>
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: { width: 360, maxHeight: 500 },
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">알림</Typography>
          <Box>
            <IconButton size="small" onClick={() => dispatch(markAllAsRead())} title="모두 읽음">
              <DoneAll fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => dispatch(clearNotifications())} title="모두 삭제">
              <Clear fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <Divider />

        {notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              새로운 알림이 없습니다
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
            {notifications.map((notification) => (
              <ListItem
                key={notification.id}
                disablePadding
                secondaryAction={
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => handleRemoveNotification(notification.id, e)}
                  >
                    <Clear fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemButton
                  onClick={() => handleNotificationClick(notification.id)}
                  sx={{
                    bgcolor: notification.read ? 'transparent' : theme.palette.action.hover,
                  }}
                >
                  <ListItemIcon>{getIcon(notification.type)}</ListItemIcon>
                  <ListItemText
                    primary={notification.message}
                    secondary={formatDistanceToNow(notification.timestamp, {
                      addSuffix: true,
                      locale: ko,
                    })}
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      color: notification.read ? 'text.secondary' : 'text.primary',
                    }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        {notifications.length > 0 && (
          <>
            <Divider />
            <Box sx={{ p: 1, textAlign: 'center' }}>
              <Button size="small" fullWidth>
                모든 알림 보기
              </Button>
            </Box>
          </>
        )}
      </Popover>
    </>
  );
};