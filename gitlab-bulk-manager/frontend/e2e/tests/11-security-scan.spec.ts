import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { GroupManagementPage } from '../pages/GroupManagementPage';
import { TEST_CONFIG } from '../config/test.config';
import * as crypto from 'crypto';

test.describe('Security Vulnerability Scanning', () => {
  let loginPage: LoginPage;
  let groupPage: GroupManagementPage;
  const timestamp = Date.now();

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    groupPage = new GroupManagementPage(page);
  });

  test('should test authentication security', async ({ page, request }) => {
    const securityTests = {
      bruteForceProtection: false,
      sessionManagement: false,
      tokenSecurity: false,
      passwordPolicy: false,
    };
    
    // Test 1: Brute force protection
    const failedAttempts = [];
    for (let i = 0; i < 5; i++) {
      await loginPage.goto();
      const startTime = Date.now();
      await loginPage.login('admin@example.com', `wrongpassword${i}`);
      const attemptTime = Date.now() - startTime;
      failedAttempts.push(attemptTime);
      
      const error = await loginPage.getErrorMessage();
      expect(error).toBeTruthy();
    }
    
    // Check if login attempts are rate-limited (later attempts should take longer)
    const avgFirstThree = failedAttempts.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const avgLastTwo = failedAttempts.slice(3).reduce((a, b) => a + b, 0) / 2;
    
    if (avgLastTwo > avgFirstThree * 1.5) {
      securityTests.bruteForceProtection = true;
      console.log('✓ Brute force protection detected');
    } else {
      console.log('⚠ No apparent brute force protection');
    }
    
    // Test 2: Session management
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    // Check for secure cookies
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(c => c.name.includes('session') || c.name.includes('token'));
    
    if (sessionCookie) {
      if (sessionCookie.secure && sessionCookie.httpOnly && sessionCookie.sameSite !== 'None') {
        securityTests.sessionManagement = true;
        console.log('✓ Session cookies are properly secured');
      } else {
        console.log('⚠ Session cookie security issues:', {
          secure: sessionCookie.secure,
          httpOnly: sessionCookie.httpOnly,
          sameSite: sessionCookie.sameSite,
        });
      }
    }
    
    // Test 3: Token security
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    if (token) {
      // Check token format (should be JWT or similar)
      const tokenParts = token.split('.');
      if (tokenParts.length === 3) {
        // Appears to be JWT
        try {
          const payload = JSON.parse(atob(tokenParts[1]));
          if (payload.exp && payload.iat) {
            securityTests.tokenSecurity = true;
            console.log('✓ Token has expiration and issued time');
          }
        } catch (e) {
          console.log('⚠ Could not parse token payload');
        }
      }
    }
    
    // Test 4: Password policy
    // Try to check if there's a password policy by looking at the UI
    const passwordRequirements = await page.locator('text=/password.*requirements|password.*policy/i').isVisible();
    if (passwordRequirements) {
      securityTests.passwordPolicy = true;
      console.log('✓ Password policy is displayed');
    }
    
    console.log('Authentication Security Results:', securityTests);
    
    // At least some security measures should be in place
    const securityScore = Object.values(securityTests).filter(v => v).length;
    expect(securityScore).toBeGreaterThanOrEqual(2); // At least 2 out of 4
  });

  test('should test XSS protection', async ({ page }) => {
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    await groupPage.goto();
    
    // Test various XSS payloads
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      'javascript:alert("XSS")',
      '<svg onload=alert("XSS")>',
      '"><script>alert("XSS")</script>',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
    ];
    
    const xssResults = [];
    
    for (const payload of xssPayloads) {
      try {
        // Try to inject through group creation
        await groupPage.createGroup({
          name: `Test ${payload}`,
          description: payload,
          visibility: 'private',
        });
        
        // Check if script executed
        const alertPresent = await page.evaluate(() => {
          return new Promise(resolve => {
            const originalAlert = window.alert;
            window.alert = () => {
              window.alert = originalAlert;
              resolve(true);
            };
            setTimeout(() => resolve(false), 1000);
          });
        });
        
        xssResults.push({
          payload,
          executed: alertPresent,
          location: 'group creation',
        });
        
        // Clean up - delete the group if created
        await page.waitForTimeout(500);
        const createdGroup = await groupPage.getGroupByName(`Test ${payload}`);
        if (createdGroup) {
          page.on('dialog', dialog => dialog.accept());
          await groupPage.deleteGroup(`Test ${payload}`);
        }
      } catch (error) {
        // Creation might fail due to validation
        xssResults.push({
          payload,
          executed: false,
          location: 'group creation',
          error: error.message,
        });
      }
    }
    
    console.log('XSS Test Results:', xssResults);
    
    // No XSS should execute
    const vulnerablePayloads = xssResults.filter(r => r.executed);
    expect(vulnerablePayloads.length).toBe(0);
  });

  test('should test SQL injection protection', async ({ page, request }) => {
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    
    // SQL injection payloads
    const sqlPayloads = [
      "' OR '1'='1",
      "1; DROP TABLE users--",
      "' UNION SELECT * FROM users--",
      "1' AND '1'='1",
      "'; SELECT * FROM information_schema.tables--",
    ];
    
    const sqlResults = [];
    
    // Test search endpoints
    for (const payload of sqlPayloads) {
      try {
        const response = await request.get(`/api/groups?search=${encodeURIComponent(payload)}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        sqlResults.push({
          payload,
          endpoint: '/api/groups',
          status: response.status(),
          error: response.status() >= 400,
        });
        
        // Check if response indicates SQL error
        if (response.ok()) {
          const body = await response.text();
          const hasSQLError = body.includes('SQL') || body.includes('syntax') || body.includes('database');
          if (hasSQLError) {
            console.log(`⚠ Possible SQL error exposed for payload: ${payload}`);
          }
        }
      } catch (error) {
        sqlResults.push({
          payload,
          endpoint: '/api/groups',
          error: true,
          message: error.message,
        });
      }
    }
    
    console.log('SQL Injection Test Results:', sqlResults);
    
    // All requests should either succeed normally or fail gracefully
    sqlResults.forEach(result => {
      expect(result.status === 200 || result.status >= 400).toBeTruthy();
    });
  });

  test('should test CSRF protection', async ({ page, request }) => {
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    const cookies = await page.context().cookies();
    
    // Test if API requires CSRF token
    const testGroupName = `e2e-csrf-test-${timestamp}`;
    
    // Try to create a group without CSRF token
    const response = await request.post('/api/groups', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        // Omit any CSRF token
      },
      data: {
        name: testGroupName,
        path: testGroupName,
        visibility: 'private',
      },
    });
    
    console.log('CSRF Test - Response status:', response.status());
    
    // Check for CSRF protection
    if (response.status() === 403 || response.status() === 401) {
      const body = await response.text();
      if (body.includes('CSRF') || body.includes('csrf')) {
        console.log('✓ CSRF protection is active');
      }
    } else if (response.status() === 201) {
      console.log('⚠ Request succeeded without CSRF token - may lack CSRF protection');
      
      // Clean up
      await groupPage.goto();
      page.on('dialog', dialog => dialog.accept());
      await groupPage.deleteGroup(testGroupName);
    }
  });

  test('should test authorization bypass attempts', async ({ page, request }) => {
    // Login as viewer (lowest privilege)
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.viewer.username,
      TEST_CONFIG.TEST_USERS.viewer.password
    );
    
    const viewerToken = await page.evaluate(() => localStorage.getItem('authToken'));
    
    // Attempt privileged operations
    const authTests = [
      {
        name: 'Create Group',
        method: 'POST',
        endpoint: '/api/groups',
        data: { name: 'Unauthorized Test', visibility: 'private' },
        expectedStatus: 403,
      },
      {
        name: 'Delete Group',
        method: 'DELETE',
        endpoint: '/api/groups/1',
        expectedStatus: 403,
      },
      {
        name: 'Access Admin Endpoint',
        method: 'GET',
        endpoint: '/api/admin/users',
        expectedStatus: 403,
      },
      {
        name: 'Modify System Settings',
        method: 'PUT',
        endpoint: '/api/settings',
        data: { key: 'value' },
        expectedStatus: 403,
      },
    ];
    
    const authResults = [];
    
    for (const test of authTests) {
      try {
        const response = await request.fetch(test.endpoint, {
          method: test.method,
          headers: {
            'Authorization': `Bearer ${viewerToken}`,
            'Content-Type': 'application/json',
          },
          data: test.data,
        });
        
        authResults.push({
          test: test.name,
          status: response.status(),
          passed: response.status() === test.expectedStatus,
        });
      } catch (error) {
        authResults.push({
          test: test.name,
          error: error.message,
          passed: false,
        });
      }
    }
    
    console.log('Authorization Test Results:', authResults);
    
    // All authorization tests should pass
    authResults.forEach(result => {
      expect(result.passed).toBeTruthy();
    });
  });

  test('should test sensitive data exposure', async ({ page }) => {
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    const exposureTests = {
      apiKeysInResponse: false,
      passwordsInResponse: false,
      debugInfoExposed: false,
      errorStackTraces: false,
      sensitiveHeaders: false,
    };
    
    // Check API responses for sensitive data
    await groupPage.goto();
    
    // Intercept network responses
    const responses = [];
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        responses.push(response);
      }
    });
    
    // Trigger some API calls
    await groupPage.searchGroups('test');
    await groupPage.getAllGroups();
    
    // Analyze responses
    for (const response of responses) {
      try {
        const headers = response.headers();
        const body = await response.text();
        
        // Check for sensitive data in response
        if (body.includes('password') && !body.includes('password_') && !body.includes('passwordPolicy')) {
          exposureTests.passwordsInResponse = true;
          console.log('⚠ Password field found in response:', response.url());
        }
        
        if (body.includes('api_key') || body.includes('apiKey') || body.includes('secret')) {
          exposureTests.apiKeysInResponse = true;
          console.log('⚠ API key/secret found in response:', response.url());
        }
        
        if (body.includes('stack') || body.includes('trace') || body.includes('at Function')) {
          exposureTests.errorStackTraces = true;
          console.log('⚠ Stack trace found in response:', response.url());
        }
        
        // Check headers
        if (headers['server'] || headers['x-powered-by']) {
          exposureTests.sensitiveHeaders = true;
          console.log('⚠ Server information exposed in headers');
        }
        
        if (headers['x-debug'] || headers['debug']) {
          exposureTests.debugInfoExposed = true;
          console.log('⚠ Debug information in headers');
        }
      } catch (error) {
        // Some responses might not have text body
      }
    }
    
    console.log('Sensitive Data Exposure Results:', exposureTests);
    
    // No sensitive data should be exposed
    const exposureCount = Object.values(exposureTests).filter(v => v).length;
    expect(exposureCount).toBe(0);
  });

  test('should test input validation', async ({ page }) => {
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    await groupPage.goto();
    
    const validationTests = [
      {
        field: 'Group Name',
        inputs: [
          { value: '', valid: false, reason: 'empty' },
          { value: 'a'.repeat(256), valid: false, reason: 'too long' },
          { value: '../../../etc/passwd', valid: false, reason: 'path traversal' },
          { value: 'test@#$%^&*()', valid: false, reason: 'special characters' },
          { value: '<script>', valid: false, reason: 'potential XSS' },
          { value: 'ValidGroupName123', valid: true, reason: 'valid' },
        ],
      },
    ];
    
    const validationResults = [];
    
    for (const test of validationTests) {
      for (const input of test.inputs) {
        try {
          await groupPage.createGroup({
            name: input.value || 'empty',
            visibility: 'private',
          });
          
          // If we reach here, validation passed
          validationResults.push({
            field: test.field,
            input: input.value,
            expected: input.valid,
            actual: true,
            passed: input.valid === true,
          });
          
          // Clean up if created
          if (input.value) {
            page.on('dialog', dialog => dialog.accept());
            await groupPage.deleteGroup(input.value);
          }
        } catch (error) {
          // Validation failed
          validationResults.push({
            field: test.field,
            input: input.value,
            expected: input.valid,
            actual: false,
            passed: input.valid === false,
          });
        }
      }
    }
    
    console.log('Input Validation Results:', validationResults);
    
    // All validation tests should pass
    const failedValidations = validationResults.filter(r => !r.passed);
    expect(failedValidations.length).toBe(0);
  });

  test('should test secure headers', async ({ page }) => {
    await loginPage.goto();
    
    // Check security headers
    const response = await page.goto(TEST_CONFIG.APP_URL);
    const headers = response?.headers() || {};
    
    const securityHeaders = {
      'strict-transport-security': false,
      'x-content-type-options': false,
      'x-frame-options': false,
      'x-xss-protection': false,
      'content-security-policy': false,
      'referrer-policy': false,
    };
    
    for (const [header, ] of Object.entries(securityHeaders)) {
      if (headers[header]) {
        securityHeaders[header] = true;
        console.log(`✓ ${header}: ${headers[header]}`);
      } else {
        console.log(`⚠ Missing security header: ${header}`);
      }
    }
    
    console.log('Security Headers Results:', securityHeaders);
    
    // At least some security headers should be present
    const presentHeaders = Object.values(securityHeaders).filter(v => v).length;
    expect(presentHeaders).toBeGreaterThanOrEqual(3); // At least 3 security headers
  });

  test('should test file upload security', async ({ page }) => {
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    await bulkPage.goto();
    
    // Test file upload restrictions
    const fs = require('fs');
    const path = require('path');
    const testFilesDir = path.join(process.cwd(), 'test-results', 'test-files');
    
    // Create test files with different extensions
    const dangerousFiles = [
      { name: 'test.exe', content: 'MZ\x90\x00', dangerous: true },
      { name: 'test.php', content: '<?php echo "test"; ?>', dangerous: true },
      { name: 'test.jsp', content: '<% out.println("test"); %>', dangerous: true },
      { name: '../../../test.txt', content: 'path traversal', dangerous: true },
      { name: 'test.txt', content: 'safe content', dangerous: false },
    ];
    
    const uploadResults = [];
    
    for (const file of dangerousFiles) {
      const filepath = path.join(testFilesDir, file.name);
      
      try {
        // Create directory if it contains path separators
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filepath, file.content);
        
        // Try to upload
        await bulkPage.selectOperationType('createGroups');
        
        try {
          await bulkPage.fileInput.setInputFiles(filepath);
          await bulkPage.uploadButton.click();
          await page.waitForTimeout(1000);
          
          // Check if upload was accepted
          const error = await page.locator('[role="alert"]').isVisible();
          
          uploadResults.push({
            file: file.name,
            dangerous: file.dangerous,
            rejected: error,
            passed: file.dangerous ? error : !error,
          });
        } catch (uploadError) {
          uploadResults.push({
            file: file.name,
            dangerous: file.dangerous,
            rejected: true,
            passed: file.dangerous,
          });
        }
        
        // Clean up
        fs.unlinkSync(filepath);
      } catch (error) {
        console.log(`Error testing file ${file.name}:`, error.message);
      }
    }
    
    console.log('File Upload Security Results:', uploadResults);
    
    // Dangerous files should be rejected
    const failedTests = uploadResults.filter(r => !r.passed);
    expect(failedTests.length).toBe(0);
  });

  test('should test rate limiting', async ({ page, request }) => {
    await loginPage.goto();
    await loginPage.login(
      TEST_CONFIG.TEST_USERS.admin.username,
      TEST_CONFIG.TEST_USERS.admin.password
    );
    
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    
    // Make rapid API requests
    const requestCount = 50;
    const requests = [];
    
    for (let i = 0; i < requestCount; i++) {
      requests.push(
        request.get('/api/groups', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
      );
    }
    
    const responses = await Promise.all(requests);
    const statusCodes = responses.map(r => r.status());
    
    // Check for rate limiting (429 status)
    const rateLimited = statusCodes.filter(status => status === 429).length;
    
    console.log('Rate Limiting Test:', {
      totalRequests: requestCount,
      successful: statusCodes.filter(s => s === 200).length,
      rateLimited: rateLimited,
    });
    
    if (rateLimited > 0) {
      console.log('✓ Rate limiting is active');
    } else {
      console.log('⚠ No rate limiting detected for rapid requests');
    }
  });

  test('should generate security report', async ({ page }) => {
    const securityReport = {
      timestamp: new Date().toISOString(),
      url: TEST_CONFIG.APP_URL,
      summary: {
        totalTests: 11,
        passed: 0,
        failed: 0,
        warnings: 0,
      },
      vulnerabilities: [] as string[],
      recommendations: [] as string[],
    };
    
    // Add test results and recommendations
    securityReport.recommendations.push(
      'Implement Content Security Policy (CSP) headers',
      'Add rate limiting to prevent brute force attacks',
      'Ensure all user inputs are properly validated and sanitized',
      'Implement CSRF protection for state-changing operations',
      'Use secure session management with httpOnly and secure flags',
      'Regularly update dependencies to patch known vulnerabilities',
      'Implement proper error handling to avoid information disclosure',
      'Use HTTPS everywhere with HSTS header',
      'Implement proper file upload validation and sandboxing',
      'Regular security audits and penetration testing',
    );
    
    console.log('Security Scan Report:', JSON.stringify(securityReport, null, 2));
    
    // Save report
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(process.cwd(), 'test-results', `security-report-${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(securityReport, null, 2));
    
    await page.screenshot({
      path: 'test-results/screenshots/security-summary.png',
      fullPage: true,
    });
  });
});