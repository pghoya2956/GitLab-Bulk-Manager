import { test, expect } from '@playwright/test';
import { TEST_CONFIG } from '../config/test.config';

test.describe('Environment Verification', () => {
  test('should have required environment variables', async () => {
    // Check if GitLab URL is configured
    expect(process.env.VITE_GITLAB_URL || TEST_CONFIG.GITLAB_URL).toBeTruthy();
    
    // Check if test group ID is set
    expect(TEST_CONFIG.TARGET_GROUP_ID).toBe(107423238);
    
    // Verify test user configuration
    expect(TEST_CONFIG.TEST_USERS.admin.username).toBeTruthy();
    expect(TEST_CONFIG.TEST_USERS.manager.username).toBeTruthy();
    expect(TEST_CONFIG.TEST_USERS.developer.username).toBeTruthy();
    expect(TEST_CONFIG.TEST_USERS.viewer.username).toBeTruthy();
  });

  test('should connect to GitLab API', async ({ request }) => {
    const token = process.env.VITE_GITLAB_TOKEN || TEST_CONFIG.GITLAB_TOKEN;
    
    if (!token) {
      test.skip('GitLab token not configured');
      return;
    }

    const response = await request.get(`${TEST_CONFIG.GITLAB_URL}/api/v4/user`, {
      headers: {
        'PRIVATE-TOKEN': token,
      },
    });

    expect(response.status()).toBe(200);
    
    const user = await response.json();
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('username');
    
    console.log(`Connected as: ${user.username} (ID: ${user.id})`);
  });

  test('should have access to target group 107423238', async ({ request }) => {
    const token = process.env.VITE_GITLAB_TOKEN || TEST_CONFIG.GITLAB_TOKEN;
    
    if (!token) {
      test.skip('GitLab token not configured');
      return;
    }

    const response = await request.get(
      `${TEST_CONFIG.GITLAB_URL}/api/v4/groups/${TEST_CONFIG.TARGET_GROUP_ID}`,
      {
        headers: {
          'PRIVATE-TOKEN': token,
        },
      }
    );

    expect(response.status()).toBe(200);
    
    const group = await response.json();
    expect(group.id).toBe(TEST_CONFIG.TARGET_GROUP_ID);
    expect(group).toHaveProperty('name');
    expect(group).toHaveProperty('path');
    expect(group).toHaveProperty('visibility');
    
    console.log(`Group Access Verified: ${group.name} (${group.full_path})`);
    console.log(`Visibility: ${group.visibility}`);
    console.log(`Projects: ${group.projects?.length || 0}`);
    console.log(`Subgroups: ${group.subgroups?.length || 0}`);
  });

  test('should verify application is running', async ({ page }) => {
    // Try to load the application
    const response = await page.goto('/', { waitUntil: 'networkidle' });
    
    expect(response?.status()).toBeLessThan(400);
    
    // Check if we're redirected to login or dashboard
    const url = page.url();
    expect(url).toMatch(/\/(login|dashboard)/);
    
    // Take a screenshot for verification
    await page.screenshot({ 
      path: 'test-results/screenshots/initial-load.png',
      fullPage: true 
    });
  });

  test('should check browser compatibility', async ({ page, browserName }) => {
    await page.goto('/');
    
    // Check for console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(2000);
    
    // Report any console errors
    if (consoleErrors.length > 0) {
      console.warn(`Console errors in ${browserName}:`, consoleErrors);
    }
    
    // Check basic JavaScript execution
    const hasReact = await page.evaluate(() => {
      return typeof (window as any).React !== 'undefined' || 
             document.querySelector('#root') !== null;
    });
    
    expect(hasReact).toBeTruthy();
  });

  test('should measure initial performance metrics', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        // Get paint timings
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
        // Network info
        transferSize: navigation.transferSize || 0,
        decodedBodySize: navigation.decodedBodySize || 0,
      };
    });
    
    console.log('Performance Metrics:', metrics);
    
    // Assert performance thresholds
    expect(metrics.firstContentfulPaint).toBeLessThan(3000); // Under 3 seconds
    expect(metrics.domContentLoaded).toBeLessThan(5000); // Under 5 seconds
  });
});