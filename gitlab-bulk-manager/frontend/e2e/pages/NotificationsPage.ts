import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class NotificationsPage extends BasePage {
  readonly notificationBell: Locator;
  readonly notificationBadge: Locator;
  readonly notificationDropdown: Locator;
  readonly notificationList: Locator;
  readonly markAllReadButton: Locator;
  readonly notificationSettings: Locator;
  readonly notificationToast: Locator;
  readonly notificationCenter: Locator;
  readonly filterButtons: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page);
    
    // Notification bell in header
    this.notificationBell = page.locator('[aria-label*="notifications"], [data-testid="notification-bell"]');
    this.notificationBadge = page.locator('[data-testid="notification-badge"]');
    
    // Notification dropdown
    this.notificationDropdown = page.locator('[data-testid="notification-dropdown"]');
    this.notificationList = page.locator('[data-testid="notification-list"]');
    this.markAllReadButton = page.locator('button:has-text("Mark all read")');
    
    // Settings
    this.notificationSettings = page.locator('[data-testid="notification-settings"]');
    
    // Toast notifications
    this.notificationToast = page.locator('[role="alert"][data-testid="notification-toast"]');
    
    // Notification center (full page)
    this.notificationCenter = page.locator('[data-testid="notification-center"]');
    this.filterButtons = page.locator('[data-testid="notification-filters"]');
    this.searchInput = page.locator('input[placeholder*="Search notifications"]');
  }

  async openNotificationDropdown() {
    await this.notificationBell.click();
    await this.notificationDropdown.waitFor({ state: 'visible' });
  }

  async closeNotificationDropdown() {
    await this.page.keyboard.press('Escape');
    await this.notificationDropdown.waitFor({ state: 'hidden' });
  }

  async getUnreadCount(): Promise<number> {
    if (!await this.notificationBadge.isVisible()) {
      return 0;
    }
    const badgeText = await this.notificationBadge.textContent() || '0';
    return parseInt(badgeText);
  }

  async getNotifications(): Promise<Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
    actionable: boolean;
  }>> {
    await this.openNotificationDropdown();
    
    const items = await this.notificationList.locator('[data-testid="notification-item"]').all();
    const notifications = [];
    
    for (const item of items) {
      const isRead = await item.getAttribute('data-read') === 'true';
      const hasActions = await item.locator('[data-testid="notification-action"]').count() > 0;
      
      notifications.push({
        id: await item.getAttribute('data-notification-id') || '',
        type: await item.getAttribute('data-notification-type') || '',
        title: await item.locator('[data-testid="notification-title"]').textContent() || '',
        message: await item.locator('[data-testid="notification-message"]').textContent() || '',
        timestamp: await item.locator('[data-testid="notification-time"]').textContent() || '',
        read: isRead,
        actionable: hasActions,
      });
    }
    
    return notifications;
  }

  async markNotificationAsRead(notificationId: string) {
    const notification = this.notificationList.locator(`[data-notification-id="${notificationId}"]`);
    await notification.hover();
    await notification.locator('[aria-label="Mark as read"]').click();
  }

  async markAllNotificationsAsRead() {
    await this.markAllReadButton.click();
    await this.waitForNotification('All notifications marked as read');
  }

  async deleteNotification(notificationId: string) {
    const notification = this.notificationList.locator(`[data-notification-id="${notificationId}"]`);
    await notification.hover();
    await notification.locator('[aria-label="Delete"]').click();
  }

  async performNotificationAction(notificationId: string, actionText: string) {
    const notification = this.notificationList.locator(`[data-notification-id="${notificationId}"]`);
    await notification.locator(`button:has-text("${actionText}")`).click();
  }

  async waitForToastNotification(text: string, timeout: number = 10000) {
    await this.notificationToast.filter({ hasText: text }).waitFor({ 
      state: 'visible', 
      timeout 
    });
  }

  async dismissToastNotification() {
    if (await this.notificationToast.isVisible()) {
      const closeButton = this.notificationToast.locator('[aria-label="Close"]');
      if (await closeButton.isVisible()) {
        await closeButton.click();
      } else {
        // Click outside to dismiss
        await this.page.mouse.click(0, 0);
      }
      await this.notificationToast.waitFor({ state: 'hidden' });
    }
  }

  async gotoNotificationCenter() {
    await this.navigate('/notifications');
    await this.notificationCenter.waitFor({ state: 'visible' });
  }

  async filterNotifications(filter: 'all' | 'unread' | 'groups' | 'projects' | 'system') {
    await this.filterButtons.locator(`button:has-text("${filter}")`).click();
    await this.page.waitForTimeout(300);
  }

  async searchNotifications(query: string) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(500); // Debounce
  }

  async openNotificationSettings() {
    await this.gotoNotificationCenter();
    await this.page.locator('button[aria-label="Settings"]').click();
    await this.notificationSettings.waitFor({ state: 'visible' });
  }

  async updateNotificationSettings(settings: {
    groupCreated?: boolean;
    groupUpdated?: boolean;
    groupDeleted?: boolean;
    projectCreated?: boolean;
    projectUpdated?: boolean;
    projectDeleted?: boolean;
    bulkOperationComplete?: boolean;
    backupComplete?: boolean;
    systemAlerts?: boolean;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
  }) {
    await this.openNotificationSettings();
    
    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        const toggle = this.page.locator(`[name="${key}"]`);
        const isChecked = await toggle.isChecked();
        if (isChecked !== value) {
          await toggle.click();
        }
      }
    }
    
    await this.page.locator('button[type="submit"]').click();
    await this.waitForNotification('Settings updated');
  }

  async getNotificationHistory(days: number = 7): Promise<Array<{
    date: string;
    count: number;
    notifications: Array<any>;
  }>> {
    await this.gotoNotificationCenter();
    
    // Select date range
    await this.page.locator('[data-testid="date-range-picker"]').click();
    await this.page.locator(`[data-testid="last-${days}-days"]`).click();
    
    const history = [];
    const sections = await this.page.locator('[data-testid="notification-day-section"]').all();
    
    for (const section of sections) {
      const date = await section.locator('[data-testid="section-date"]').textContent() || '';
      const notifications = await section.locator('[data-testid="notification-item"]').all();
      
      history.push({
        date,
        count: notifications.length,
        notifications: [], // Would populate with actual notification data
      });
    }
    
    return history;
  }

  async testRealTimeNotification(triggerAction: () => Promise<void>): Promise<{
    received: boolean;
    latency: number;
    notification: any;
  }> {
    const startTime = Date.now();
    let notificationReceived = false;
    let receivedNotification = null;
    
    // Set up listener for new notifications
    const checkForNotification = async () => {
      const toastVisible = await this.notificationToast.isVisible();
      if (toastVisible) {
        notificationReceived = true;
        receivedNotification = {
          text: await this.notificationToast.textContent(),
          type: await this.notificationToast.getAttribute('data-notification-type'),
        };
        return true;
      }
      return false;
    };
    
    // Trigger the action
    await triggerAction();
    
    // Wait for notification (max 10 seconds)
    for (let i = 0; i < 100; i++) {
      if (await checkForNotification()) {
        break;
      }
      await this.page.waitForTimeout(100);
    }
    
    const latency = Date.now() - startTime;
    
    return {
      received: notificationReceived,
      latency,
      notification: receivedNotification,
    };
  }

  async testWebSocketConnection(): Promise<{
    connected: boolean;
    latency: number;
  }> {
    // Execute JavaScript to check WebSocket connection
    const connectionStatus = await this.page.evaluate(() => {
      // This assumes the WebSocket instance is accessible
      const ws = (window as any).notificationWebSocket;
      return {
        connected: ws?.readyState === WebSocket.OPEN,
        url: ws?.url,
      };
    });
    
    // Test ping/pong latency
    const startTime = Date.now();
    const pingResult = await this.page.evaluate(() => {
      return new Promise((resolve) => {
        const ws = (window as any).notificationWebSocket;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
          const handler = (event: MessageEvent) => {
            const data = JSON.parse(event.data);
            if (data.type === 'pong') {
              ws.removeEventListener('message', handler);
              resolve(true);
            }
          };
          ws.addEventListener('message', handler);
          // Timeout after 5 seconds
          setTimeout(() => resolve(false), 5000);
        } else {
          resolve(false);
        }
      });
    });
    
    const latency = Date.now() - startTime;
    
    return {
      connected: connectionStatus.connected && pingResult === true,
      latency,
    };
  }

  async simulateNotificationStorm(count: number): Promise<{
    handled: number;
    dropped: number;
    avgRenderTime: number;
  }> {
    const results = {
      handled: 0,
      dropped: 0,
      avgRenderTime: 0,
    };
    
    const renderTimes: number[] = [];
    
    // Trigger multiple notifications rapidly
    for (let i = 0; i < count; i++) {
      const startTime = Date.now();
      
      // Simulate notification via console command
      await this.page.evaluate((index) => {
        (window as any).testNotification({
          title: `Storm Test ${index}`,
          message: `Notification ${index} of stress test`,
          type: 'info',
        });
      }, i);
      
      // Check if notification rendered
      const rendered = await this.page.waitForTimeout(50).then(async () => {
        return await this.notificationToast.isVisible();
      });
      
      if (rendered) {
        results.handled++;
        renderTimes.push(Date.now() - startTime);
        await this.dismissToastNotification();
      } else {
        results.dropped++;
      }
    }
    
    results.avgRenderTime = renderTimes.length > 0 
      ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length 
      : 0;
    
    return results;
  }
}