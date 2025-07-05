import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class BulkOperationsPage extends BasePage {
  readonly operationTypeSelect: Locator;
  readonly fileInput: Locator;
  readonly uploadButton: Locator;
  readonly previewSection: Locator;
  readonly executeButton: Locator;
  readonly cancelButton: Locator;
  readonly progressBar: Locator;
  readonly resultsSection: Locator;
  readonly downloadResultsButton: Locator;
  readonly operationHistory: Locator;
  readonly dryRunToggle: Locator;
  readonly parallelExecutionInput: Locator;
  readonly errorHandlingSelect: Locator;

  constructor(page: Page) {
    super(page);
    
    // Operation configuration
    this.operationTypeSelect = page.locator('[name="operationType"]');
    this.fileInput = page.locator('input[type="file"]');
    this.uploadButton = page.locator('button:has-text("Upload")');
    this.dryRunToggle = page.locator('[name="dryRun"]');
    this.parallelExecutionInput = page.locator('[name="parallelExecution"]');
    this.errorHandlingSelect = page.locator('[name="errorHandling"]');
    
    // Preview section
    this.previewSection = page.locator('[data-testid="preview-section"]');
    
    // Execution controls
    this.executeButton = page.locator('button:has-text("Execute")');
    this.cancelButton = page.locator('button:has-text("Cancel")');
    
    // Progress tracking
    this.progressBar = page.locator('[role="progressbar"]');
    
    // Results
    this.resultsSection = page.locator('[data-testid="results-section"]');
    this.downloadResultsButton = page.locator('button:has-text("Download Results")');
    
    // History
    this.operationHistory = page.locator('[data-testid="operation-history"]');
  }

  async goto() {
    await this.navigate('/bulk-operations');
    await this.page.waitForLoadState('networkidle');
  }

  async selectOperationType(type: 'createGroups' | 'createProjects' | 'updateProjects' | 'deleteProjects' | 'assignMembers') {
    await this.operationTypeSelect.selectOption(type);
    await this.page.waitForTimeout(300);
  }

  async uploadFile(filePath: string) {
    await this.fileInput.setInputFiles(filePath);
    await this.uploadButton.click();
    await this.page.waitForTimeout(500);
  }

  async getPreviewData(): Promise<{
    totalItems: number;
    validItems: number;
    invalidItems: number;
    warnings: string[];
  }> {
    const stats = await this.previewSection.locator('[data-testid="preview-stats"]');
    
    return {
      totalItems: parseInt(await stats.locator('text=/total/i').locator('..').textContent() || '0'),
      validItems: parseInt(await stats.locator('text=/valid/i').locator('..').textContent() || '0'),
      invalidItems: parseInt(await stats.locator('text=/invalid/i').locator('..').textContent() || '0'),
      warnings: await this.previewSection.locator('[data-testid="warning"]').allTextContents(),
    };
  }

  async setDryRun(enabled: boolean) {
    const isChecked = await this.dryRunToggle.isChecked();
    if (isChecked !== enabled) {
      await this.dryRunToggle.click();
    }
  }

  async setParallelExecution(count: number) {
    await this.parallelExecutionInput.fill(count.toString());
  }

  async setErrorHandling(mode: 'stop' | 'skip' | 'retry') {
    await this.errorHandlingSelect.selectOption(mode);
  }

  async executeBulkOperation() {
    await this.executeButton.click();
    await this.page.waitForSelector(this.progressBar.selector);
  }

  async waitForOperationComplete(timeout: number = 60000) {
    await this.page.waitForSelector(
      '[data-testid="operation-complete"]',
      { timeout }
    );
  }

  async getOperationProgress(): Promise<{
    percentage: number;
    processed: number;
    total: number;
    status: string;
  }> {
    const percentage = await this.progressBar.getAttribute('aria-valuenow') || '0';
    const statusText = await this.page.locator('[data-testid="operation-status"]').textContent() || '';
    
    const processed = parseInt(statusText.match(/(\d+)\/\d+/)?.[1] || '0');
    const total = parseInt(statusText.match(/\d+\/(\d+)/)?.[1] || '0');
    
    return {
      percentage: parseInt(percentage),
      processed,
      total,
      status: await this.page.locator('[data-testid="status-label"]').textContent() || '',
    };
  }

  async getOperationResults(): Promise<{
    success: number;
    failed: number;
    skipped: number;
    errors: string[];
    duration: number;
  }> {
    const results = this.resultsSection;
    
    return {
      success: parseInt(await results.locator('text=/success/i').locator('..').textContent() || '0'),
      failed: parseInt(await results.locator('text=/failed/i').locator('..').textContent() || '0'),
      skipped: parseInt(await results.locator('text=/skipped/i').locator('..').textContent() || '0'),
      errors: await results.locator('[data-testid="error-message"]').allTextContents(),
      duration: parseInt(await results.locator('text=/duration/i').locator('..').textContent() || '0'),
    };
  }

  async downloadResults() {
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadResultsButton.click();
    const download = await downloadPromise;
    return download;
  }

  async cancelOperation() {
    await this.cancelButton.click();
    await this.page.waitForSelector('[data-testid="operation-cancelled"]');
  }

  async getOperationHistory(): Promise<Array<{
    id: string;
    type: string;
    status: string;
    timestamp: string;
    itemCount: number;
  }>> {
    const rows = await this.operationHistory.locator('[role="row"]').all();
    const history = [];
    
    for (const row of rows) {
      history.push({
        id: await row.locator('[data-testid="operation-id"]').textContent() || '',
        type: await row.locator('[data-testid="operation-type"]').textContent() || '',
        status: await row.locator('[data-testid="operation-status"]').textContent() || '',
        timestamp: await row.locator('[data-testid="operation-timestamp"]').textContent() || '',
        itemCount: parseInt(await row.locator('[data-testid="item-count"]').textContent() || '0'),
      });
    }
    
    return history;
  }

  async retryFailedItems(operationId: string) {
    const row = this.operationHistory.locator(`[data-testid="operation-${operationId}"]`);
    await row.locator('button:has-text("Retry Failed")').click();
    await this.page.waitForTimeout(500);
  }

  async viewOperationDetails(operationId: string) {
    const row = this.operationHistory.locator(`[data-testid="operation-${operationId}"]`);
    await row.locator('button:has-text("View Details")').click();
    await this.page.waitForSelector('[data-testid="operation-details-dialog"]');
  }

  async createTestFile(type: string, content: string): Promise<string> {
    const fs = require('fs');
    const path = require('path');
    const testDir = path.join(process.cwd(), 'test-results', 'test-files');
    
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    const filename = `bulk-${type}-${Date.now()}.txt`;
    const filepath = path.join(testDir, filename);
    fs.writeFileSync(filepath, content);
    
    return filepath;
  }
}