import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class MonitoringPage extends BasePage {
  readonly systemHealthCard: Locator;
  readonly apiMetricsCard: Locator;
  readonly jobQueueCard: Locator;
  readonly resourceUsageCard: Locator;
  readonly activityLogsCard: Locator;
  readonly alertsPanel: Locator;
  readonly refreshButton: Locator;
  readonly timeRangeSelector: Locator;
  readonly exportButton: Locator;
  readonly settingsButton: Locator;

  constructor(page: Page) {
    super(page);
    
    // Dashboard cards
    this.systemHealthCard = page.locator('[data-testid="system-health-card"]');
    this.apiMetricsCard = page.locator('[data-testid="api-metrics-card"]');
    this.jobQueueCard = page.locator('[data-testid="job-queue-card"]');
    this.resourceUsageCard = page.locator('[data-testid="resource-usage-card"]');
    this.activityLogsCard = page.locator('[data-testid="activity-logs-card"]');
    this.alertsPanel = page.locator('[data-testid="alerts-panel"]');
    
    // Controls
    this.refreshButton = page.locator('button[aria-label="Refresh"]');
    this.timeRangeSelector = page.locator('[data-testid="time-range-selector"]');
    this.exportButton = page.locator('button:has-text("Export")');
    this.settingsButton = page.locator('button[aria-label="Settings"]');
  }

  async goto() {
    await this.navigate('/monitoring');
    await this.page.waitForLoadState('networkidle');
  }

  async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    uptime: string;
    apiStatus: string;
    databaseStatus: string;
    cacheStatus: string;
    queueStatus: string;
  }> {
    await this.systemHealthCard.waitFor({ state: 'visible' });
    
    return {
      status: await this.systemHealthCard.getAttribute('data-status') as any || 'healthy',
      uptime: await this.systemHealthCard.locator('[data-testid="uptime"]').textContent() || '',
      apiStatus: await this.systemHealthCard.locator('[data-testid="api-status"]').textContent() || '',
      databaseStatus: await this.systemHealthCard.locator('[data-testid="database-status"]').textContent() || '',
      cacheStatus: await this.systemHealthCard.locator('[data-testid="cache-status"]').textContent() || '',
      queueStatus: await this.systemHealthCard.locator('[data-testid="queue-status"]').textContent() || '',
    };
  }

  async getApiMetrics(): Promise<{
    totalRequests: number;
    avgResponseTime: number;
    errorRate: number;
    requestsPerMinute: number;
    topEndpoints: Array<{ endpoint: string; count: number; avgTime: number }>;
  }> {
    await this.apiMetricsCard.waitFor({ state: 'visible' });
    
    const parseMetricValue = async (selector: string): Promise<number> => {
      const text = await this.apiMetricsCard.locator(selector).textContent() || '0';
      return parseFloat(text.replace(/[^0-9.]/g, ''));
    };
    
    const endpoints = [];
    const endpointRows = await this.apiMetricsCard.locator('[data-testid="endpoint-row"]').all();
    
    for (const row of endpointRows) {
      endpoints.push({
        endpoint: await row.locator('[data-testid="endpoint-name"]').textContent() || '',
        count: await parseMetricValue('[data-testid="endpoint-count"]'),
        avgTime: await parseMetricValue('[data-testid="endpoint-avg-time"]'),
      });
    }
    
    return {
      totalRequests: await parseMetricValue('[data-testid="total-requests"]'),
      avgResponseTime: await parseMetricValue('[data-testid="avg-response-time"]'),
      errorRate: await parseMetricValue('[data-testid="error-rate"]'),
      requestsPerMinute: await parseMetricValue('[data-testid="requests-per-minute"]'),
      topEndpoints: endpoints,
    };
  }

  async getJobQueueStatus(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    avgProcessingTime: number;
    queueDepth: number;
    workers: number;
  }> {
    await this.jobQueueCard.waitFor({ state: 'visible' });
    
    const parseCount = async (status: string): Promise<number> => {
      const text = await this.jobQueueCard.locator(`[data-testid="jobs-${status}"]`).textContent() || '0';
      return parseInt(text.replace(/[^0-9]/g, ''));
    };
    
    return {
      pending: await parseCount('pending'),
      processing: await parseCount('processing'),
      completed: await parseCount('completed'),
      failed: await parseCount('failed'),
      avgProcessingTime: parseFloat(
        await this.jobQueueCard.locator('[data-testid="avg-processing-time"]').textContent() || '0'
      ),
      queueDepth: await parseCount('depth'),
      workers: await parseCount('workers'),
    };
  }

  async getResourceUsage(): Promise<{
    cpu: number;
    memory: number;
    disk: number;
    network: {
      incoming: number;
      outgoing: number;
    };
    database: {
      connections: number;
      queryTime: number;
    };
  }> {
    await this.resourceUsageCard.waitFor({ state: 'visible' });
    
    const parsePercentage = async (resource: string): Promise<number> => {
      const text = await this.resourceUsageCard.locator(`[data-testid="${resource}-usage"]`).textContent() || '0';
      return parseFloat(text.replace('%', ''));
    };
    
    const parseValue = async (metric: string): Promise<number> => {
      const text = await this.resourceUsageCard.locator(`[data-testid="${metric}"]`).textContent() || '0';
      return parseFloat(text.replace(/[^0-9.]/g, ''));
    };
    
    return {
      cpu: await parsePercentage('cpu'),
      memory: await parsePercentage('memory'),
      disk: await parsePercentage('disk'),
      network: {
        incoming: await parseValue('network-in'),
        outgoing: await parseValue('network-out'),
      },
      database: {
        connections: await parseValue('db-connections'),
        queryTime: await parseValue('db-query-time'),
      },
    };
  }

  async getRecentActivity(): Promise<Array<{
    timestamp: string;
    user: string;
    action: string;
    resource: string;
    status: string;
  }>> {
    await this.activityLogsCard.waitFor({ state: 'visible' });
    
    const activities = [];
    const rows = await this.activityLogsCard.locator('[data-testid="activity-row"]').all();
    
    for (const row of rows.slice(0, 10)) { // Get top 10
      activities.push({
        timestamp: await row.locator('[data-testid="activity-time"]').textContent() || '',
        user: await row.locator('[data-testid="activity-user"]').textContent() || '',
        action: await row.locator('[data-testid="activity-action"]').textContent() || '',
        resource: await row.locator('[data-testid="activity-resource"]').textContent() || '',
        status: await row.locator('[data-testid="activity-status"]').textContent() || '',
      });
    }
    
    return activities;
  }

  async getActiveAlerts(): Promise<Array<{
    id: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    title: string;
    message: string;
    timestamp: string;
    acknowledged: boolean;
  }>> {
    await this.alertsPanel.waitFor({ state: 'visible' });
    
    const alerts = [];
    const alertElements = await this.alertsPanel.locator('[data-testid="alert-item"]').all();
    
    for (const alert of alertElements) {
      alerts.push({
        id: await alert.getAttribute('data-alert-id') || '',
        severity: await alert.getAttribute('data-severity') as any || 'info',
        title: await alert.locator('[data-testid="alert-title"]').textContent() || '',
        message: await alert.locator('[data-testid="alert-message"]').textContent() || '',
        timestamp: await alert.locator('[data-testid="alert-time"]').textContent() || '',
        acknowledged: await alert.locator('[data-testid="alert-acknowledged"]').isVisible(),
      });
    }
    
    return alerts;
  }

  async acknowledgeAlert(alertId: string) {
    const alert = this.alertsPanel.locator(`[data-alert-id="${alertId}"]`);
    await alert.locator('button[aria-label="Acknowledge"]').click();
    await this.waitForNotification('Alert acknowledged');
  }

  async dismissAlert(alertId: string) {
    const alert = this.alertsPanel.locator(`[data-alert-id="${alertId}"]`);
    await alert.locator('button[aria-label="Dismiss"]').click();
  }

  async refresh() {
    await this.refreshButton.click();
    await this.page.waitForLoadState('networkidle');
  }

  async setTimeRange(range: '1h' | '6h' | '24h' | '7d' | '30d' | 'custom') {
    await this.timeRangeSelector.click();
    await this.page.locator(`[data-value="${range}"]`).click();
    await this.page.waitForTimeout(1000); // Wait for data refresh
  }

  async exportMetrics(format: 'csv' | 'json' | 'pdf') {
    await this.exportButton.click();
    
    const downloadPromise = this.page.waitForEvent('download');
    await this.page.locator(`[data-format="${format}"]`).click();
    const download = await downloadPromise;
    
    return download;
  }

  async openMonitoringSettings() {
    await this.settingsButton.click();
    await this.page.waitForSelector('[role="dialog"]');
  }

  async updateMonitoringSettings(settings: {
    refreshInterval?: number;
    alertThresholds?: {
      cpu?: number;
      memory?: number;
      errorRate?: number;
      responseTime?: number;
    };
    emailAlerts?: boolean;
    slackAlerts?: boolean;
  }) {
    await this.openMonitoringSettings();
    
    if (settings.refreshInterval !== undefined) {
      await this.page.fill('[name="refreshInterval"]', settings.refreshInterval.toString());
    }
    
    if (settings.alertThresholds) {
      for (const [metric, value] of Object.entries(settings.alertThresholds)) {
        await this.page.fill(`[name="${metric}Threshold"]`, value.toString());
      }
    }
    
    if (settings.emailAlerts !== undefined) {
      const checkbox = this.page.locator('[name="emailAlerts"]');
      const isChecked = await checkbox.isChecked();
      if (isChecked !== settings.emailAlerts) {
        await checkbox.click();
      }
    }
    
    if (settings.slackAlerts !== undefined) {
      const checkbox = this.page.locator('[name="slackAlerts"]');
      const isChecked = await checkbox.isChecked();
      if (isChecked !== settings.slackAlerts) {
        await checkbox.click();
      }
    }
    
    await this.page.locator('button[type="submit"]').click();
    await this.waitForNotification('Settings updated');
  }

  async testAutoRefresh(intervalSeconds: number): Promise<{
    refreshed: boolean;
    actualInterval: number;
  }> {
    // Get initial timestamp
    const initialTime = await this.page.locator('[data-testid="last-updated"]').textContent();
    
    // Wait for auto-refresh
    const startTime = Date.now();
    await this.page.waitForFunction(
      (initialTime) => {
        const currentTime = document.querySelector('[data-testid="last-updated"]')?.textContent;
        return currentTime !== initialTime;
      },
      initialTime,
      { timeout: (intervalSeconds + 5) * 1000 }
    );
    
    const actualInterval = (Date.now() - startTime) / 1000;
    
    return {
      refreshed: true,
      actualInterval,
    };
  }

  async simulateHighLoad(): Promise<void> {
    // Execute JavaScript to simulate high load
    await this.page.evaluate(() => {
      // Simulate high CPU usage
      const startTime = Date.now();
      while (Date.now() - startTime < 2000) {
        // Busy loop for 2 seconds
        Math.sqrt(Math.random());
      }
    });
  }

  async getChartData(chartId: string): Promise<{
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
    }>;
  }> {
    const chart = this.page.locator(`[data-testid="${chartId}"]`);
    
    // This is a simplified version - actual implementation would depend on chart library
    const chartData = await chart.evaluate((el) => {
      // Access chart instance if available
      const chartInstance = (el as any).__chart;
      if (chartInstance) {
        return {
          labels: chartInstance.data.labels,
          datasets: chartInstance.data.datasets.map((ds: any) => ({
            label: ds.label,
            data: ds.data,
          })),
        };
      }
      return null;
    });
    
    return chartData || { labels: [], datasets: [] };
  }

  async checkMetricTrends(): Promise<{
    cpuTrend: 'increasing' | 'decreasing' | 'stable';
    memoryTrend: 'increasing' | 'decreasing' | 'stable';
    errorTrend: 'increasing' | 'decreasing' | 'stable';
  }> {
    // Get chart data and analyze trends
    const cpuData = await this.getChartData('cpu-usage-chart');
    const memoryData = await this.getChartData('memory-usage-chart');
    const errorData = await this.getChartData('error-rate-chart');
    
    const analyzeTrend = (data: number[]): 'increasing' | 'decreasing' | 'stable' => {
      if (data.length < 2) return 'stable';
      
      const recent = data.slice(-5); // Last 5 data points
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
      const secondHalf = recent.slice(Math.floor(recent.length / 2));
      
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg * 1.1) return 'increasing';
      if (secondAvg < firstAvg * 0.9) return 'decreasing';
      return 'stable';
    };
    
    return {
      cpuTrend: analyzeTrend(cpuData.datasets[0]?.data || []),
      memoryTrend: analyzeTrend(memoryData.datasets[0]?.data || []),
      errorTrend: analyzeTrend(errorData.datasets[0]?.data || []),
    };
  }
}