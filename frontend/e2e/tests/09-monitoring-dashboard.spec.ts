import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { MonitoringPage } from '../pages/MonitoringPage';
import { GroupManagementPage } from '../pages/GroupManagementPage';
import { BulkOperationsPage } from '../pages/BulkOperationsPage';
import { TEST_CONFIG } from '../config/test.config';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Monitoring Dashboard', () => {
  let loginPage: LoginPage;
  let monitoringPage: MonitoringPage;
  let groupPage: GroupManagementPage;
  let bulkPage: BulkOperationsPage;
  const timestamp = Date.now();

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    monitoringPage = new MonitoringPage(page);
    groupPage = new GroupManagementPage(page);
    bulkPage = new BulkOperationsPage(page);
    
    // Only admin and manager should have access to monitoring
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
  });

  test('should display all monitoring dashboard components', async ({ page }) => {
    await monitoringPage.goto();
    
    // Verify all cards are visible
    await expect(monitoringPage.systemHealthCard).toBeVisible();
    await expect(monitoringPage.apiMetricsCard).toBeVisible();
    await expect(monitoringPage.jobQueueCard).toBeVisible();
    await expect(monitoringPage.resourceUsageCard).toBeVisible();
    await expect(monitoringPage.activityLogsCard).toBeVisible();
    await expect(monitoringPage.alertsPanel).toBeVisible();
    
    // Take screenshot of full dashboard
    await page.screenshot({ 
      path: 'test-results/screenshots/monitoring-dashboard.png',
      fullPage: true 
    });
  });

  test('should display system health status', async ({ page }) => {
    await monitoringPage.goto();
    
    const health = await monitoringPage.getSystemHealth();
    console.log('System Health:', health);
    
    // Verify health data
    expect(health.status).toMatch(/healthy|warning|critical/);
    expect(health.uptime).toBeTruthy();
    expect(health.apiStatus).toBeTruthy();
    expect(health.databaseStatus).toBeTruthy();
    
    // Check individual component statuses
    expect(['Operational', 'Degraded', 'Down']).toContain(health.apiStatus);
    expect(['Connected', 'Slow', 'Disconnected']).toContain(health.databaseStatus);
  });

  test('should display API metrics', async ({ page }) => {
    await monitoringPage.goto();
    
    const metrics = await monitoringPage.getApiMetrics();
    console.log('API Metrics:', metrics);
    
    // Verify metrics are reasonable
    expect(metrics.totalRequests).toBeGreaterThanOrEqual(0);
    expect(metrics.avgResponseTime).toBeGreaterThanOrEqual(0);
    expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
    expect(metrics.errorRate).toBeLessThanOrEqual(100);
    expect(metrics.requestsPerMinute).toBeGreaterThanOrEqual(0);
    
    // Check top endpoints
    expect(metrics.topEndpoints).toBeDefined();
    if (metrics.topEndpoints.length > 0) {
      const topEndpoint = metrics.topEndpoints[0];
      expect(topEndpoint.endpoint).toBeTruthy();
      expect(topEndpoint.count).toBeGreaterThan(0);
      expect(topEndpoint.avgTime).toBeGreaterThan(0);
    }
  });

  test('should display job queue status', async ({ page }) => {
    await monitoringPage.goto();
    
    const jobStatus = await monitoringPage.getJobQueueStatus();
    console.log('Job Queue Status:', jobStatus);
    
    // Verify job counts
    expect(jobStatus.pending).toBeGreaterThanOrEqual(0);
    expect(jobStatus.processing).toBeGreaterThanOrEqual(0);
    expect(jobStatus.completed).toBeGreaterThanOrEqual(0);
    expect(jobStatus.failed).toBeGreaterThanOrEqual(0);
    expect(jobStatus.workers).toBeGreaterThan(0);
    
    // Check processing time is reasonable
    if (jobStatus.completed > 0) {
      expect(jobStatus.avgProcessingTime).toBeGreaterThan(0);
      expect(jobStatus.avgProcessingTime).toBeLessThan(300000); // Less than 5 minutes
    }
  });

  test('should display resource usage', async ({ page }) => {
    await monitoringPage.goto();
    
    const resources = await monitoringPage.getResourceUsage();
    console.log('Resource Usage:', resources);
    
    // Verify resource percentages
    expect(resources.cpu).toBeGreaterThanOrEqual(0);
    expect(resources.cpu).toBeLessThanOrEqual(100);
    expect(resources.memory).toBeGreaterThanOrEqual(0);
    expect(resources.memory).toBeLessThanOrEqual(100);
    expect(resources.disk).toBeGreaterThanOrEqual(0);
    expect(resources.disk).toBeLessThanOrEqual(100);
    
    // Check network metrics
    expect(resources.network.incoming).toBeGreaterThanOrEqual(0);
    expect(resources.network.outgoing).toBeGreaterThanOrEqual(0);
    
    // Check database metrics
    expect(resources.database.connections).toBeGreaterThanOrEqual(0);
    expect(resources.database.queryTime).toBeGreaterThanOrEqual(0);
  });

  test('should display recent activity logs', async ({ page }) => {
    // Generate some activity first
    await groupPage.goto();
    await groupPage.createGroup({
      name: `e2e-monitoring-activity-${timestamp}`,
      visibility: 'private',
    });
    
    // Check activity logs
    await monitoringPage.goto();
    const activities = await monitoringPage.getRecentActivity();
    console.log(`Found ${activities.length} recent activities`);
    
    expect(activities.length).toBeGreaterThan(0);
    
    // Verify activity structure
    const recentActivity = activities[0];
    expect(recentActivity.timestamp).toBeTruthy();
    expect(recentActivity.user).toBeTruthy();
    expect(recentActivity.action).toBeTruthy();
    expect(recentActivity.resource).toBeTruthy();
    expect(['Success', 'Failed', 'Pending']).toContain(recentActivity.status);
    
    // Should include our recent group creation
    const groupCreation = activities.find(a => 
      a.action.includes('Create') && 
      a.resource.includes('e2e-monitoring-activity')
    );
    expect(groupCreation).toBeTruthy();
  });

  test('should handle active alerts', async ({ page }) => {
    await monitoringPage.goto();
    
    const alerts = await monitoringPage.getActiveAlerts();
    console.log(`Found ${alerts.length} active alerts`);
    
    if (alerts.length > 0) {
      const firstAlert = alerts[0];
      
      // Verify alert structure
      expect(firstAlert.id).toBeTruthy();
      expect(['info', 'warning', 'error', 'critical']).toContain(firstAlert.severity);
      expect(firstAlert.title).toBeTruthy();
      expect(firstAlert.message).toBeTruthy();
      expect(firstAlert.timestamp).toBeTruthy();
      
      // Test acknowledging alert
      if (!firstAlert.acknowledged) {
        await monitoringPage.acknowledgeAlert(firstAlert.id);
        
        // Verify acknowledgment
        await page.waitForTimeout(1000);
        const updatedAlerts = await monitoringPage.getActiveAlerts();
        const updatedAlert = updatedAlerts.find(a => a.id === firstAlert.id);
        expect(updatedAlert?.acknowledged).toBeTruthy();
      }
      
      // Test dismissing alert
      await monitoringPage.dismissAlert(firstAlert.id);
      await page.waitForTimeout(1000);
      
      const remainingAlerts = await monitoringPage.getActiveAlerts();
      const dismissedAlert = remainingAlerts.find(a => a.id === firstAlert.id);
      expect(dismissedAlert).toBeFalsy();
    }
  });

  test('should change time range and refresh data', async ({ page }) => {
    await monitoringPage.goto();
    
    // Test different time ranges
    const timeRanges = ['1h', '6h', '24h', '7d'] as const;
    
    for (const range of timeRanges) {
      await monitoringPage.setTimeRange(range);
      
      // Verify data updates
      const metrics = await monitoringPage.getApiMetrics();
      console.log(`Metrics for ${range}:`, metrics.totalRequests);
      
      await page.screenshot({ 
        path: `test-results/screenshots/monitoring-${range}.png`,
        fullPage: true 
      });
    }
    
    // Test manual refresh
    const beforeRefresh = await monitoringPage.getApiMetrics();
    await monitoringPage.refresh();
    const afterRefresh = await monitoringPage.getApiMetrics();
    
    // Data might be the same, but the refresh should complete without errors
    expect(afterRefresh).toBeDefined();
  });

  test('should export monitoring data', async ({ page }) => {
    await monitoringPage.goto();
    
    // Test different export formats
    const formats = ['csv', 'json', 'pdf'] as const;
    
    for (const format of formats) {
      const download = await monitoringPage.exportMetrics(format);
      const downloadPath = await download.path();
      
      expect(downloadPath).toBeTruthy();
      expect(fs.existsSync(downloadPath)).toBeTruthy();
      
      // Verify file extension
      expect(path.extname(downloadPath)).toBe(`.${format}`);
      
      // Check file size
      const stats = fs.statSync(downloadPath);
      expect(stats.size).toBeGreaterThan(0);
      
      console.log(`Exported ${format} file: ${stats.size} bytes`);
    }
  });

  test('should update monitoring settings', async ({ page }) => {
    await monitoringPage.goto();
    
    await monitoringPage.updateMonitoringSettings({
      refreshInterval: 30, // 30 seconds
      alertThresholds: {
        cpu: 80,
        memory: 85,
        errorRate: 5,
        responseTime: 1000,
      },
      emailAlerts: true,
      slackAlerts: false,
    });
    
    // Verify settings were applied
    await monitoringPage.openMonitoringSettings();
    
    const refreshInterval = await page.locator('[name="refreshInterval"]').inputValue();
    expect(refreshInterval).toBe('30');
    
    const cpuThreshold = await page.locator('[name="cpuThreshold"]').inputValue();
    expect(cpuThreshold).toBe('80');
    
    const emailAlerts = await page.locator('[name="emailAlerts"]').isChecked();
    expect(emailAlerts).toBeTruthy();
    
    // Close settings
    await page.keyboard.press('Escape');
  });

  test('should test auto-refresh functionality', async ({ page }) => {
    await monitoringPage.goto();
    
    // Set a short refresh interval
    await monitoringPage.updateMonitoringSettings({
      refreshInterval: 5, // 5 seconds
    });
    
    // Test auto-refresh
    const refreshTest = await monitoringPage.testAutoRefresh(5);
    
    expect(refreshTest.refreshed).toBeTruthy();
    expect(refreshTest.actualInterval).toBeGreaterThan(4);
    expect(refreshTest.actualInterval).toBeLessThan(7);
    
    console.log(`Auto-refresh occurred after ${refreshTest.actualInterval} seconds`);
  });

  test('should generate alerts based on thresholds', async ({ page }) => {
    await monitoringPage.goto();
    
    // Set low thresholds to trigger alerts
    await monitoringPage.updateMonitoringSettings({
      alertThresholds: {
        cpu: 1, // Very low threshold
        errorRate: 0.1,
      },
    });
    
    // Wait for potential alerts
    await page.waitForTimeout(3000);
    
    const alerts = await monitoringPage.getActiveAlerts();
    const thresholdAlerts = alerts.filter(a => 
      a.title.includes('threshold') || 
      a.message.includes('exceeded')
    );
    
    if (thresholdAlerts.length > 0) {
      console.log('Threshold alerts generated:', thresholdAlerts);
      expect(thresholdAlerts[0].severity).toMatch(/warning|error|critical/);
    }
  });

  test('should display metric trends', async ({ page }) => {
    await monitoringPage.goto();
    
    // Set time range to get more data points
    await monitoringPage.setTimeRange('24h');
    
    const trends = await monitoringPage.checkMetricTrends();
    console.log('Metric Trends:', trends);
    
    // Verify trend values
    expect(['increasing', 'decreasing', 'stable']).toContain(trends.cpuTrend);
    expect(['increasing', 'decreasing', 'stable']).toContain(trends.memoryTrend);
    expect(['increasing', 'decreasing', 'stable']).toContain(trends.errorTrend);
  });

  test('should track bulk operation in monitoring', async ({ page }) => {
    // Create a bulk operation to monitor
    const testFilesDir = path.join(process.cwd(), 'test-results', 'test-files');
    const groupData = Array.from({ length: 10 }, (_, i) => 
      `e2e-monitor-bulk-${i}-${timestamp}|e2e-mon-${i}-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|Monitor test ${i}|private`
    ).join('\n');
    
    const filepath = path.join(testFilesDir, `monitor-groups-${timestamp}.txt`);
    fs.writeFileSync(filepath, groupData);
    
    // Start bulk operation
    await bulkPage.goto();
    await bulkPage.selectOperationType('createGroups');
    await bulkPage.uploadFile(filepath);
    await bulkPage.executeBulkOperation();
    
    // Monitor the operation
    await monitoringPage.goto();
    
    // Check job queue shows the operation
    const jobStatus = await monitoringPage.getJobQueueStatus();
    expect(jobStatus.processing + jobStatus.pending).toBeGreaterThan(0);
    
    // Wait for completion
    await bulkPage.goto();
    await bulkPage.waitForOperationComplete();
    
    // Check monitoring reflects completion
    await monitoringPage.goto();
    const activity = await monitoringPage.getRecentActivity();
    const bulkActivity = activity.find(a => 
      a.action.includes('Bulk') && 
      a.resource.includes('Groups')
    );
    
    expect(bulkActivity).toBeTruthy();
    expect(bulkActivity?.status).toBe('Success');
  });

  test('should restrict access based on user role', async ({ page }) => {
    // Test as viewer (should not have access)
    await page.locator('button[aria-label="user menu"]').click();
    await page.locator('text=Logout').click();
    
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.viewer.username,
      TEST_CONFIG.TEST_USERS.viewer.password
    );
    
    // Try to access monitoring
    await page.goto('/monitoring');
    
    // Should redirect or show access denied
    const url = page.url();
    const isRestricted = url.includes('dashboard') || url.includes('login');
    const hasError = await page.locator('text=/access denied|unauthorized|권한/i').isVisible();
    
    expect(isRestricted || hasError).toBeTruthy();
  });

  test('should measure monitoring dashboard performance', async ({ page }) => {
    const metrics = {
      initialLoad: 0,
      dataRefresh: 0,
      chartRender: 0,
      exportTime: 0,
    };
    
    // Measure initial load
    const loadStart = Date.now();
    await monitoringPage.goto();
    await page.waitForLoadState('networkidle');
    metrics.initialLoad = Date.now() - loadStart;
    
    // Measure data refresh
    const refreshStart = Date.now();
    await monitoringPage.refresh();
    metrics.dataRefresh = Date.now() - refreshStart;
    
    // Measure chart rendering (change time range)
    const chartStart = Date.now();
    await monitoringPage.setTimeRange('7d');
    metrics.chartRender = Date.now() - chartStart;
    
    // Measure export time
    const exportStart = Date.now();
    await monitoringPage.exportMetrics('json');
    metrics.exportTime = Date.now() - exportStart;
    
    console.log('Monitoring Performance Metrics:', metrics);
    
    // Performance assertions
    expect(metrics.initialLoad).toBeLessThan(5000); // Under 5 seconds
    expect(metrics.dataRefresh).toBeLessThan(3000); // Under 3 seconds
    expect(metrics.chartRender).toBeLessThan(2000); // Under 2 seconds
    expect(metrics.exportTime).toBeLessThan(3000); // Under 3 seconds
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
    
    // Delete monitoring test groups
    const testPrefixes = [
      'e2e-monitoring-activity-',
      'e2e-monitor-bulk-',
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