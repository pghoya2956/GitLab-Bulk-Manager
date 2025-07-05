import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { GroupManagementPage } from '../pages/GroupManagementPage';
import { ProjectManagementPage } from '../pages/ProjectManagementPage';
import { BulkOperationsPage } from '../pages/BulkOperationsPage';
import { NotificationsPage } from '../pages/NotificationsPage';
import { MonitoringPage } from '../pages/MonitoringPage';
import { TEST_CONFIG } from '../config/test.config';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Performance and Load Testing', () => {
  let loginPage: LoginPage;
  let groupPage: GroupManagementPage;
  let projectPage: ProjectManagementPage;
  let bulkPage: BulkOperationsPage;
  let notificationsPage: NotificationsPage;
  let monitoringPage: MonitoringPage;
  const timestamp = Date.now();

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    groupPage = new GroupManagementPage(page);
    projectPage = new ProjectManagementPage(page);
    bulkPage = new BulkOperationsPage(page);
    notificationsPage = new NotificationsPage(page);
    monitoringPage = new MonitoringPage(page);
    
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
  });

  test('should measure page load performance', async ({ page }) => {
    const pageLoadMetrics: Record<string, number> = {};
    
    const pages = [
      { name: 'Dashboard', path: '/dashboard' },
      { name: 'Groups', path: '/groups' },
      { name: 'Projects', path: '/projects' },
      { name: 'Bulk Operations', path: '/bulk-operations' },
      { name: 'Monitoring', path: '/monitoring' },
      { name: 'Backup/Restore', path: '/backup-restore' },
    ];
    
    for (const pageInfo of pages) {
      const startTime = Date.now();
      await page.goto(pageInfo.path);
      await page.waitForLoadState('networkidle');
      const loadTime = Date.now() - startTime;
      
      pageLoadMetrics[pageInfo.name] = loadTime;
      
      // Get performance timing from browser
      const perfTiming = await page.evaluate(() => {
        const perf = window.performance;
        const timing = perf.timing;
        return {
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          loadComplete: timing.loadEventEnd - timing.navigationStart,
          firstPaint: perf.getEntriesByType('paint')[0]?.startTime || 0,
          firstContentfulPaint: perf.getEntriesByType('paint')[1]?.startTime || 0,
        };
      });
      
      console.log(`${pageInfo.name} Performance:`, {
        totalLoadTime: loadTime,
        ...perfTiming,
      });
      
      // Performance assertions
      expect(loadTime).toBeLessThan(3000); // Under 3 seconds
      expect(perfTiming.firstContentfulPaint).toBeLessThan(1500); // FCP under 1.5s
    }
    
    console.log('Page Load Metrics:', pageLoadMetrics);
  });

  test('should handle large dataset rendering', async ({ page }) => {
    // Test with progressively larger datasets
    const testSizes = [100, 500, 1000];
    const renderMetrics: Record<number, number> = {};
    
    for (const size of testSizes) {
      // Create test data
      const testFilesDir = path.join(process.cwd(), 'test-results', 'test-files');
      const groupData = Array.from({ length: size }, (_, i) => 
        `e2e-perf-test-${i}-${timestamp}|e2e-perf-${i}-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|Perf test ${i}|private`
      ).join('\n');
      
      const filepath = path.join(testFilesDir, `perf-test-${size}-${timestamp}.txt`);
      fs.writeFileSync(filepath, groupData);
      
      // Measure bulk creation time
      await bulkPage.goto();
      await bulkPage.selectOperationType('createGroups');
      await bulkPage.uploadFile(filepath);
      
      const createStart = Date.now();
      await bulkPage.executeBulkOperation();
      await bulkPage.waitForOperationComplete(120000); // 2 minute timeout
      const createTime = Date.now() - createStart;
      
      console.log(`Created ${size} groups in ${createTime}ms`);
      
      // Measure rendering time
      const renderStart = Date.now();
      await groupPage.goto();
      await page.waitForLoadState('networkidle');
      const renderTime = Date.now() - renderStart;
      
      renderMetrics[size] = renderTime;
      
      // Check if virtual scrolling is working
      const visibleItems = await page.locator('[role="listitem"]').count();
      console.log(`Rendering ${size} items: ${renderTime}ms, Visible: ${visibleItems}`);
      
      // Performance should not degrade linearly
      if (size === 1000) {
        expect(renderTime).toBeLessThan(5000); // Under 5 seconds for 1000 items
        expect(visibleItems).toBeLessThan(100); // Virtual scrolling should limit visible items
      }
    }
    
    console.log('Render Performance Metrics:', renderMetrics);
  });

  test('should test concurrent user load', async ({ browser }) => {
    const concurrentUsers = 5;
    const userMetrics: Array<{ user: string; loginTime: number; navigationTime: number }> = [];
    
    // Create multiple browser contexts
    const contexts = await Promise.all(
      Array.from({ length: concurrentUsers }, () => browser.newContext())
    );
    
    // Perform concurrent operations
    const userPromises = contexts.map(async (context, index) => {
      const page = await context.newPage();
      const userLoginPage = new LoginPage(page);
      const userGroupPage = new GroupManagementPage(page);
      
      const metrics = {
        user: `User ${index + 1}`,
        loginTime: 0,
        navigationTime: 0,
      };
      
      // Measure login time
      const loginStart = Date.now();
      await userLoginPage.goto();
      await userLoginPage.login(
        TEST_CONFIG.TEST_USERS.admin.username,
        TEST_CONFIG.TEST_USERS.admin.password
      );
      metrics.loginTime = Date.now() - loginStart;
      
      // Measure navigation and operation time
      const navStart = Date.now();
      await userGroupPage.goto();
      await userGroupPage.createGroup({
        name: `e2e-concurrent-${index}-${timestamp}`,
        visibility: 'private',
      });
      metrics.navigationTime = Date.now() - navStart;
      
      userMetrics.push(metrics);
      
      await page.close();
      await context.close();
    });
    
    await Promise.all(userPromises);
    
    console.log('Concurrent User Metrics:', userMetrics);
    
    // Calculate averages
    const avgLoginTime = userMetrics.reduce((sum, m) => sum + m.loginTime, 0) / concurrentUsers;
    const avgNavTime = userMetrics.reduce((sum, m) => sum + m.navigationTime, 0) / concurrentUsers;
    
    console.log(`Average login time: ${avgLoginTime}ms`);
    console.log(`Average operation time: ${avgNavTime}ms`);
    
    // Performance should not degrade significantly with concurrent users
    expect(avgLoginTime).toBeLessThan(3000); // Under 3 seconds average
    expect(avgNavTime).toBeLessThan(5000); // Under 5 seconds average
  });

  test('should test API response times under load', async ({ page, request }) => {
    const apiEndpoints = [
      { name: 'Groups List', method: 'GET', path: '/api/groups' },
      { name: 'Projects List', method: 'GET', path: '/api/projects' },
      { name: 'Notifications', method: 'GET', path: '/api/notifications' },
      { name: 'Monitoring Stats', method: 'GET', path: '/api/monitoring/stats' },
    ];
    
    const apiMetrics: Record<string, number[]> = {};
    
    // Get auth token
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    
    // Test each endpoint multiple times
    for (const endpoint of apiEndpoints) {
      apiMetrics[endpoint.name] = [];
      
      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        
        const response = await request.fetch(endpoint.path, {
          method: endpoint.method,
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        const responseTime = Date.now() - startTime;
        apiMetrics[endpoint.name].push(responseTime);
        
        expect(response.status()).toBe(200);
      }
    }
    
    // Calculate statistics
    const apiStats = Object.entries(apiMetrics).map(([name, times]) => {
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const min = Math.min(...times);
      const max = Math.max(...times);
      const p95 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.95)];
      
      return { name, avg, min, max, p95 };
    });
    
    console.log('API Performance Statistics:', apiStats);
    
    // Performance assertions
    apiStats.forEach(stat => {
      expect(stat.avg).toBeLessThan(1000); // Average under 1 second
      expect(stat.p95).toBeLessThan(2000); // 95th percentile under 2 seconds
    });
  });

  test('should test memory usage with long sessions', async ({ page }) => {
    const memoryMetrics: Array<{ time: string; usedJSHeapSize: number; totalJSHeapSize: number }> = [];
    
    // Function to collect memory metrics
    const collectMemoryMetrics = async () => {
      const metrics = await page.evaluate(() => {
        if ('memory' in performance) {
          return {
            time: new Date().toISOString(),
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          };
        }
        return null;
      });
      
      if (metrics) {
        memoryMetrics.push(metrics);
      }
    };
    
    // Initial measurement
    await collectMemoryMetrics();
    
    // Perform various operations
    const operations = [
      async () => {
        await groupPage.goto();
        await groupPage.searchGroups('test');
      },
      async () => {
        await projectPage.goto();
        await projectPage.getAllVisibleNodes();
      },
      async () => {
        await bulkPage.goto();
        await bulkPage.getOperationHistory();
      },
      async () => {
        await monitoringPage.goto();
        await monitoringPage.getSystemHealth();
      },
      async () => {
        await notificationsPage.gotoNotificationCenter();
        await notificationsPage.getNotificationHistory();
      },
    ];
    
    // Execute operations multiple times
    for (let round = 0; round < 3; round++) {
      for (const operation of operations) {
        await operation();
        await collectMemoryMetrics();
        await page.waitForTimeout(1000);
      }
    }
    
    // Analyze memory growth
    const initialMemory = memoryMetrics[0].usedJSHeapSize;
    const finalMemory = memoryMetrics[memoryMetrics.length - 1].usedJSHeapSize;
    const memoryGrowth = finalMemory - initialMemory;
    const growthPercentage = (memoryGrowth / initialMemory) * 100;
    
    console.log('Memory Usage Analysis:', {
      initial: `${(initialMemory / 1024 / 1024).toFixed(2)} MB`,
      final: `${(finalMemory / 1024 / 1024).toFixed(2)} MB`,
      growth: `${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`,
      growthPercentage: `${growthPercentage.toFixed(2)}%`,
    });
    
    // Memory leak detection
    expect(growthPercentage).toBeLessThan(50); // Less than 50% growth
  });

  test('should test search performance with large datasets', async ({ page }) => {
    const searchMetrics: Record<string, number> = {};
    
    // Test group search
    await groupPage.goto();
    
    const searchTerms = ['test', 'e2e', 'perf', 'xyz'];
    
    for (const term of searchTerms) {
      const startTime = Date.now();
      await groupPage.searchGroups(term);
      await page.waitForTimeout(500); // Wait for debounce
      const searchTime = Date.now() - startTime;
      
      searchMetrics[`Groups: "${term}"`] = searchTime;
      
      // Clear search
      await groupPage.searchGroups('');
    }
    
    // Test project tree search
    await projectPage.goto();
    
    for (const term of searchTerms) {
      const startTime = Date.now();
      await projectPage.searchInTree(term);
      await page.waitForTimeout(500);
      const searchTime = Date.now() - startTime;
      
      searchMetrics[`Projects: "${term}"`] = searchTime;
      
      // Clear search
      await projectPage.searchInTree('');
    }
    
    console.log('Search Performance Metrics:', searchMetrics);
    
    // Search should be fast
    Object.values(searchMetrics).forEach(time => {
      expect(time).toBeLessThan(1500); // Under 1.5 seconds
    });
  });

  test('should test notification system under stress', async ({ page }) => {
    // Simulate notification storm
    const notificationCount = 50;
    const stormResults = await notificationsPage.simulateNotificationStorm(notificationCount);
    
    console.log('Notification Storm Results:', stormResults);
    
    // Performance assertions
    expect(stormResults.handled).toBeGreaterThanOrEqual(notificationCount * 0.9); // 90% handled
    expect(stormResults.avgRenderTime).toBeLessThan(100); // Under 100ms average
    expect(stormResults.dropped).toBeLessThan(notificationCount * 0.1); // Less than 10% dropped
  });

  test('should test bulk operations scalability', async ({ page }) => {
    const bulkSizes = [10, 50, 100, 200];
    const bulkMetrics: Record<number, { uploadTime: number; executionTime: number; throughput: number }> = {};
    
    for (const size of bulkSizes) {
      // Create test file
      const testFilesDir = path.join(process.cwd(), 'test-results', 'test-files');
      const projectData = Array.from({ length: size }, (_, i) => 
        `e2e-bulk-scale-${i}-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|Bulk scale test ${i}|private|true|true|main`
      ).join('\n');
      
      const filepath = path.join(testFilesDir, `bulk-scale-${size}-${timestamp}.txt`);
      fs.writeFileSync(filepath, projectData);
      
      await bulkPage.goto();
      await bulkPage.selectOperationType('createProjects');
      
      // Measure upload and preview time
      const uploadStart = Date.now();
      await bulkPage.uploadFile(filepath);
      const uploadTime = Date.now() - uploadStart;
      
      // Set parallel execution based on size
      const parallelCount = Math.min(10, Math.ceil(size / 20));
      await bulkPage.setParallelExecution(parallelCount);
      
      // Measure execution time
      const execStart = Date.now();
      await bulkPage.executeBulkOperation();
      await bulkPage.waitForOperationComplete(300000); // 5 minute timeout
      const executionTime = Date.now() - execStart;
      
      const throughput = size / (executionTime / 1000); // items per second
      
      bulkMetrics[size] = {
        uploadTime,
        executionTime,
        throughput,
      };
      
      console.log(`Bulk operation (${size} items):`, bulkMetrics[size]);
    }
    
    // Analyze scalability
    const sizes = Object.keys(bulkMetrics).map(Number).sort((a, b) => a - b);
    for (let i = 1; i < sizes.length; i++) {
      const prevSize = sizes[i - 1];
      const currSize = sizes[i];
      const scaleFactor = currSize / prevSize;
      const timeIncrease = bulkMetrics[currSize].executionTime / bulkMetrics[prevSize].executionTime;
      
      console.log(`Scaling from ${prevSize} to ${currSize} (${scaleFactor}x): Time increased ${timeIncrease.toFixed(2)}x`);
      
      // Time should not increase linearly with size (should be better due to batching)
      expect(timeIncrease).toBeLessThan(scaleFactor * 0.8);
    }
  });

  test('should test UI responsiveness during heavy operations', async ({ page }) => {
    // Start a heavy operation
    const testFilesDir = path.join(process.cwd(), 'test-results', 'test-files');
    const heavyData = Array.from({ length: 100 }, (_, i) => 
      `e2e-ui-responsive-${i}-${timestamp}|e2e-ui-${i}-${timestamp}|${TEST_CONFIG.TARGET_GROUP_ID}|UI test ${i}|private`
    ).join('\n');
    
    const filepath = path.join(testFilesDir, `ui-responsive-${timestamp}.txt`);
    fs.writeFileSync(filepath, heavyData);
    
    await bulkPage.goto();
    await bulkPage.selectOperationType('createGroups');
    await bulkPage.uploadFile(filepath);
    await bulkPage.executeBulkOperation();
    
    // Test UI responsiveness while operation is running
    const responsivenessTasks = [
      async () => {
        const start = Date.now();
        await page.click('button:has-text("Groups")');
        return Date.now() - start;
      },
      async () => {
        const start = Date.now();
        await notificationsPage.openNotificationDropdown();
        await notificationsPage.closeNotificationDropdown();
        return Date.now() - start;
      },
      async () => {
        const start = Date.now();
        await page.locator('button[aria-label="user menu"]').click();
        await page.keyboard.press('Escape');
        return Date.now() - start;
      },
    ];
    
    const responseMetrics = await Promise.all(responsivenessTasks);
    
    console.log('UI Responsiveness during heavy operation:', responseMetrics);
    
    // UI should remain responsive
    responseMetrics.forEach(time => {
      expect(time).toBeLessThan(1000); // Under 1 second
    });
    
    // Wait for operation to complete
    await bulkPage.waitForOperationComplete(120000);
  });

  test('should generate performance report', async ({ page }) => {
    const performanceReport = {
      timestamp: new Date().toISOString(),
      environment: {
        url: TEST_CONFIG.APP_URL,
        browser: 'Chromium',
      },
      summary: {
        totalTests: 10,
        passedTests: 0,
        failedTests: 0,
        avgPageLoad: 0,
        avgApiResponse: 0,
        maxMemoryUsage: 0,
      },
      recommendations: [] as string[],
    };
    
    // Collect metrics from monitoring dashboard
    await monitoringPage.goto();
    const systemHealth = await monitoringPage.getSystemHealth();
    const apiMetrics = await monitoringPage.getApiMetrics();
    const resourceUsage = await monitoringPage.getResourceUsage();
    
    performanceReport.summary.avgApiResponse = apiMetrics.avgResponseTime;
    performanceReport.summary.maxMemoryUsage = resourceUsage.memory;
    
    // Add recommendations based on metrics
    if (apiMetrics.avgResponseTime > 500) {
      performanceReport.recommendations.push('Consider optimizing API endpoints - average response time exceeds 500ms');
    }
    
    if (apiMetrics.errorRate > 1) {
      performanceReport.recommendations.push(`API error rate is ${apiMetrics.errorRate}% - investigate error sources`);
    }
    
    if (resourceUsage.cpu > 80) {
      performanceReport.recommendations.push('High CPU usage detected - consider scaling or optimization');
    }
    
    if (resourceUsage.memory > 85) {
      performanceReport.recommendations.push('High memory usage - check for memory leaks');
    }
    
    console.log('Performance Test Report:', JSON.stringify(performanceReport, null, 2));
    
    // Save report to file
    const reportPath = path.join(process.cwd(), 'test-results', `performance-report-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(performanceReport, null, 2));
    
    await page.screenshot({
      path: 'test-results/screenshots/performance-summary.png',
      fullPage: true,
    });
  });

  test.afterAll(async ({ browser }) => {
    // Cleanup performance test data
    const page = await browser.newPage();
    loginPage = new LoginPage(page);
    groupPage = new GroupManagementPage(page);
    
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    await groupPage.goto();
    
    // Delete test groups
    const testPrefixes = [
      'e2e-perf-test-',
      'e2e-concurrent-',
      'e2e-bulk-scale-',
      'e2e-ui-responsive-',
    ];
    
    for (const prefix of testPrefixes) {
      await groupPage.searchGroups(prefix + timestamp);
      const groups = await groupPage.getAllGroups();
      
      for (const group of groups) {
        if (group.name.includes(timestamp.toString())) {
          try {
            page.on('dialog', dialog => dialog.accept());
            await groupPage.deleteGroup(group.name);
            await page.waitForTimeout(200);
          } catch (error) {
            console.log(`Failed to cleanup ${group.name}:`, error);
          }
        }
      }
    }
    
    await page.close();
  });
});