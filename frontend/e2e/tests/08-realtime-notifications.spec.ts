import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { GroupManagementPage } from '../pages/GroupManagementPage';
import { ProjectManagementPage } from '../pages/ProjectManagementPage';
import { BulkOperationsPage } from '../pages/BulkOperationsPage';
import { TEST_CONFIG } from '../config/test.config';

test.describe('Real-time Notifications System', () => {
  let loginPage: LoginPage;
  let notificationsPage: NotificationsPage;
  let groupPage: GroupManagementPage;
  let projectPage: ProjectManagementPage;
  let bulkPage: BulkOperationsPage;
  const timestamp = Date.now();

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    notificationsPage = new NotificationsPage(page);
    groupPage = new GroupManagementPage(page);
    projectPage = new ProjectManagementPage(page);
    bulkPage = new BulkOperationsPage(page);
    
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
  });

  test('should display notification bell with badge', async ({ page }) => {
    // Check notification bell is visible
    await expect(notificationsPage.notificationBell).toBeVisible();
    
    // Get unread count
    const unreadCount = await notificationsPage.getUnreadCount();
    console.log(`Unread notifications: ${unreadCount}`);
    
    // Open dropdown
    await notificationsPage.openNotificationDropdown();
    
    // Get notifications
    const notifications = await notificationsPage.getNotifications();
    console.log(`Total notifications in dropdown: ${notifications.length}`);
    
    await page.screenshot({ 
      path: 'test-results/screenshots/notification-dropdown.png',
      fullPage: true 
    });
    
    await notificationsPage.closeNotificationDropdown();
  });

  test('should test WebSocket connection', async ({ page }) => {
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
    
    // Test WebSocket connection
    const connectionStatus = await notificationsPage.testWebSocketConnection();
    
    expect(connectionStatus.connected).toBeTruthy();
    expect(connectionStatus.latency).toBeLessThan(1000); // Under 1 second
    
    console.log(`WebSocket latency: ${connectionStatus.latency}ms`);
  });

  test('should receive real-time notification on group creation', async ({ page }) => {
    const groupName = `e2e-notification-test-${timestamp}`;
    
    // Test real-time notification
    const notificationTest = await notificationsPage.testRealTimeNotification(async () => {
      // Create a group to trigger notification
      await groupPage.goto();
      await groupPage.createGroup({
        name: groupName,
        description: 'Test group for notification',
        visibility: 'private',
        parentId: TEST_CONFIG.TARGET_GROUP_ID,
      });
    });
    
    expect(notificationTest.received).toBeTruthy();
    expect(notificationTest.latency).toBeLessThan(5000); // Under 5 seconds
    
    console.log(`Notification received in ${notificationTest.latency}ms`);
    console.log('Notification:', notificationTest.notification);
    
    // Verify notification content
    expect(notificationTest.notification?.text).toContain('created');
    
    await page.screenshot({ 
      path: 'test-results/screenshots/realtime-notification.png',
      fullPage: true 
    });
  });

  test('should handle multiple simultaneous notifications', async ({ page }) => {
    const notificationCount = 5;
    const results = await notificationsPage.simulateNotificationStorm(notificationCount);
    
    console.log('Notification storm results:', results);
    
    // At least 80% should be handled
    expect(results.handled).toBeGreaterThanOrEqual(notificationCount * 0.8);
    expect(results.avgRenderTime).toBeLessThan(500); // Under 500ms average
  });

  test('should update notification badge on new notifications', async ({ page }) => {
    // Get initial count
    const initialCount = await notificationsPage.getUnreadCount();
    
    // Create a group to trigger notification
    await groupPage.goto();
    await groupPage.createGroup({
      name: `e2e-badge-test-${timestamp}`,
      visibility: 'private',
    });
    
    // Wait for notification
    await page.waitForTimeout(2000);
    
    // Check updated count
    const newCount = await notificationsPage.getUnreadCount();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('should mark notifications as read', async ({ page }) => {
    // First ensure we have some notifications
    await groupPage.goto();
    await groupPage.createGroup({
      name: `e2e-mark-read-test-${timestamp}`,
      visibility: 'private',
    });
    
    await page.waitForTimeout(2000);
    
    // Open notifications
    const notifications = await notificationsPage.getNotifications();
    const unreadNotifications = notifications.filter(n => !n.read);
    
    if (unreadNotifications.length > 0) {
      const firstUnread = unreadNotifications[0];
      
      // Mark as read
      await notificationsPage.markNotificationAsRead(firstUnread.id);
      
      // Verify it's marked as read
      await page.waitForTimeout(1000);
      const updatedNotifications = await notificationsPage.getNotifications();
      const updatedNotification = updatedNotifications.find(n => n.id === firstUnread.id);
      
      expect(updatedNotification?.read).toBeTruthy();
    }
  });

  test('should mark all notifications as read', async ({ page }) => {
    // Ensure we have unread notifications
    const initialUnreadCount = await notificationsPage.getUnreadCount();
    
    if (initialUnreadCount === 0) {
      // Create some notifications
      for (let i = 0; i < 3; i++) {
        await groupPage.goto();
        await groupPage.createGroup({
          name: `e2e-bulk-read-${timestamp}-${i}`,
          visibility: 'private',
        });
        await page.waitForTimeout(500);
      }
    }
    
    // Mark all as read
    await notificationsPage.openNotificationDropdown();
    await notificationsPage.markAllNotificationsAsRead();
    
    // Verify all are read
    await page.waitForTimeout(1000);
    const finalUnreadCount = await notificationsPage.getUnreadCount();
    expect(finalUnreadCount).toBe(0);
  });

  test('should filter notifications in notification center', async ({ page }) => {
    // Navigate to notification center
    await notificationsPage.gotoNotificationCenter();
    
    // Test different filters
    const filters = ['all', 'unread', 'groups', 'projects', 'system'];
    
    for (const filter of filters) {
      await notificationsPage.filterNotifications(filter as any);
      await page.waitForTimeout(500);
      
      // Verify filter is applied
      const activeFilter = await page.locator('[data-testid="notification-filters"] button[aria-pressed="true"]').textContent();
      expect(activeFilter?.toLowerCase()).toContain(filter);
      
      await page.screenshot({ 
        path: `test-results/screenshots/notifications-filter-${filter}.png`,
        fullPage: true 
      });
    }
  });

  test('should search notifications', async ({ page }) => {
    await notificationsPage.gotoNotificationCenter();
    
    // Search for specific notification
    await notificationsPage.searchNotifications('group');
    
    // Verify search results
    const visibleNotifications = await page.locator('[data-testid="notification-item"]').count();
    console.log(`Search results: ${visibleNotifications} notifications`);
    
    // Clear search
    await notificationsPage.searchNotifications('');
  });

  test('should configure notification settings', async ({ page }) => {
    await notificationsPage.updateNotificationSettings({
      groupCreated: true,
      groupUpdated: false,
      projectCreated: true,
      projectUpdated: false,
      bulkOperationComplete: true,
      backupComplete: true,
      systemAlerts: true,
      emailNotifications: false,
      pushNotifications: true,
    });
    
    // Verify settings were saved
    await notificationsPage.openNotificationSettings();
    
    const groupCreatedToggle = await page.locator('[name="groupCreated"]').isChecked();
    expect(groupCreatedToggle).toBeTruthy();
    
    const groupUpdatedToggle = await page.locator('[name="groupUpdated"]').isChecked();
    expect(groupUpdatedToggle).toBeFalsy();
    
    await page.screenshot({ 
      path: 'test-results/screenshots/notification-settings.png',
      fullPage: true 
    });
  });

  test('should handle actionable notifications', async ({ page }) => {
    // Create a project that needs approval (simulated)
    await projectPage.goto();
    const projectName = `e2e-actionable-${timestamp}`;
    
    // Assuming this creates an actionable notification
    await projectPage.searchInTree('test');
    await projectPage.createProject({
      name: projectName,
      description: 'Project requiring approval',
      visibility: 'public', // Public projects might need approval
    });
    
    await page.waitForTimeout(2000);
    
    // Check for actionable notifications
    const notifications = await notificationsPage.getNotifications();
    const actionableNotifications = notifications.filter(n => n.actionable);
    
    if (actionableNotifications.length > 0) {
      const notification = actionableNotifications[0];
      console.log('Found actionable notification:', notification);
      
      // Perform action
      await notificationsPage.performNotificationAction(notification.id, 'Approve');
      
      // Verify action was performed
      await page.waitForTimeout(1000);
      const updatedNotifications = await notificationsPage.getNotifications();
      const updatedNotification = updatedNotifications.find(n => n.id === notification.id);
      
      // Notification might be removed or marked as actioned
      expect(updatedNotification?.actionable).toBeFalsy();
    }
  });

  test('should display notification history', async ({ page }) => {
    await notificationsPage.gotoNotificationCenter();
    
    // Get 7-day history
    const history = await notificationsPage.getNotificationHistory(7);
    
    console.log('Notification history:', history);
    expect(history.length).toBeGreaterThan(0);
    
    // Today should have notifications from our tests
    const today = history.find(h => h.date.toLowerCase().includes('today'));
    expect(today).toBeTruthy();
    expect(today?.count).toBeGreaterThan(0);
  });

  test('should handle notification deletion', async ({ page }) => {
    // Ensure we have notifications
    await notificationsPage.openNotificationDropdown();
    const notifications = await notificationsPage.getNotifications();
    
    if (notifications.length > 0) {
      const notificationToDelete = notifications[0];
      const notificationId = notificationToDelete.id;
      
      // Delete notification
      await notificationsPage.deleteNotification(notificationId);
      
      // Verify deletion
      await page.waitForTimeout(1000);
      const updatedNotifications = await notificationsPage.getNotifications();
      const deletedNotification = updatedNotifications.find(n => n.id === notificationId);
      
      expect(deletedNotification).toBeFalsy();
    }
  });

  test('should receive bulk operation completion notification', async ({ page }) => {
    // Create a small bulk operation
    const fs = require('fs');
    const path = require('path');
    const testFilesDir = path.join(process.cwd(), 'test-results', 'test-files');
    
    const groupData = `e2e-bulk-notif-${timestamp}|e2e-bulk-n-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|Bulk notification test|private`;
    const filepath = path.join(testFilesDir, `notification-bulk-${timestamp}.txt`);
    fs.writeFileSync(filepath, groupData);
    
    // Monitor for notification
    const notificationTest = await notificationsPage.testRealTimeNotification(async () => {
      await bulkPage.goto();
      await bulkPage.selectOperationType('createGroups');
      await bulkPage.uploadFile(filepath);
      await bulkPage.executeBulkOperation();
      await bulkPage.waitForOperationComplete();
    });
    
    expect(notificationTest.received).toBeTruthy();
    expect(notificationTest.notification?.text).toContain('completed');
  });

  test('should handle notification permissions', async ({ page }) => {
    // Test as different user roles
    const roles = ['manager', 'developer', 'viewer'] as const;
    
    for (const role of roles) {
      // Logout and login as different role
      await page.locator('button[aria-label="user menu"]').click();
      await page.locator('text=Logout').click();
      
      await loginPage.login(
        TEST_CONFIG.TEST_USERS[role].username,
        TEST_CONFIG.TEST_USERS[role].password
      );
      
      // Check notification access
      await expect(notificationsPage.notificationBell).toBeVisible();
      
      // Different roles might have different notification types
      const notifications = await notificationsPage.getNotifications();
      console.log(`${role} has ${notifications.length} notifications`);
      
      await notificationsPage.closeNotificationDropdown();
    }
  });

  test('should measure notification system performance', async ({ page }) => {
    const metrics = {
      dropdownLoadTime: 0,
      notificationCenterLoadTime: 0,
      markAsReadTime: 0,
      settingsUpdateTime: 0,
    };
    
    // Measure dropdown load time
    const dropdownStart = Date.now();
    await notificationsPage.openNotificationDropdown();
    metrics.dropdownLoadTime = Date.now() - dropdownStart;
    await notificationsPage.closeNotificationDropdown();
    
    // Measure notification center load time
    const centerStart = Date.now();
    await notificationsPage.gotoNotificationCenter();
    metrics.notificationCenterLoadTime = Date.now() - centerStart;
    
    // Measure mark as read time
    const notifications = await notificationsPage.getNotifications();
    if (notifications.length > 0 && !notifications[0].read) {
      const markStart = Date.now();
      await notificationsPage.markNotificationAsRead(notifications[0].id);
      metrics.markAsReadTime = Date.now() - markStart;
    }
    
    // Measure settings update time
    const settingsStart = Date.now();
    await notificationsPage.updateNotificationSettings({
      groupCreated: true,
      projectCreated: true,
    });
    metrics.settingsUpdateTime = Date.now() - settingsStart;
    
    console.log('Notification Performance Metrics:', metrics);
    
    // Performance assertions
    expect(metrics.dropdownLoadTime).toBeLessThan(1000); // Under 1 second
    expect(metrics.notificationCenterLoadTime).toBeLessThan(2000); // Under 2 seconds
    expect(metrics.markAsReadTime).toBeLessThan(500); // Under 500ms
    expect(metrics.settingsUpdateTime).toBeLessThan(1000); // Under 1 second
  });

  test.afterEach(async ({ page }) => {
    // Clean up test notifications if needed
    try {
      // Clear any remaining toasts
      while (await notificationsPage.notificationToast.isVisible()) {
        await notificationsPage.dismissToastNotification();
        await page.waitForTimeout(100);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup test groups
    const page = await browser.newPage();
    loginPage = new LoginPage(page);
    groupPage = new GroupManagementPage(page);
    
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    await groupPage.goto();
    
    const testPrefixes = [
      'e2e-notification-test-',
      'e2e-badge-test-',
      'e2e-mark-read-test-',
      'e2e-bulk-read-',
      'e2e-actionable-',
      'e2e-bulk-notif-',
    ];
    
    for (const prefix of testPrefixes) {
      await groupPage.searchGroups(prefix + timestamp);
      const groups = await groupPage.getAllGroups();
      
      for (const group of groups) {
        if (group.name.includes(timestamp.toString())) {
          try {
            page.on('dialog', dialog => dialog.accept());
            await groupPage.deleteGroup(group.name);
            await page.waitForTimeout(500);
          } catch (error) {
            console.log(`Failed to cleanup ${group.name}:`, error);
          }
        }
      }
    }
    
    await page.close();
  });
});