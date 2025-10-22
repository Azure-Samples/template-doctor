/**
 * Generic Workflow UI Component
 * Provides a reusable UI for executing any workflow with the generic workflow system.
 * Used by validation, docker scanning, OSSF scorecard, etc.
 */

import {
  WorkflowService,
  WorkflowConfig,
  WorkflowStatusResponse,
} from '../services/workflow-service';

export type WorkflowState =
  | 'idle'
  | 'starting'
  | 'running'
  | 'cancelling'
  | 'completed-success'
  | 'completed-failure'
  | 'cancelled'
  | 'error'
  | 'timeout';

export interface GenericWorkflowUIOptions {
  container: string | HTMLElement;
  workflowId: string;
  inputs: Record<string, any>;
  onStateChange?: (state: WorkflowState, response?: WorkflowStatusResponse) => void;
  polling?: {
    intervalMs?: number;
    maxAttempts?: number;
  };
  features?: {
    showLogs?: boolean;
    showJobDetails?: boolean;
    allowCancel?: boolean;
  };
}

interface UIElements {
  root: HTMLElement;
  header: HTMLElement;
  startBtn: HTMLButtonElement | null;
  cancelBtn: HTMLButtonElement | null;
  statusEl: HTMLElement | null;
  progressBar: HTMLElement | null;
  progressInner: HTMLElement | null;
  logsWrap: HTMLElement | null;
  logsPre: HTMLPreElement | null;
  jobsWrap: HTMLElement | null;
  resultsWrap: HTMLElement | null;
  summary: HTMLElement | null;
  details: HTMLElement | null;
}

interface InternalContext {
  options: Required<GenericWorkflowUIOptions>;
  container: HTMLElement;
  ui: UIElements | null;
  state: WorkflowState;
  workflowRunId?: string;
  pollAttempts: number;
  pollTimer?: number;
  workflowConfig?: WorkflowConfig;
}

export class GenericWorkflowUI {
  private ctx: InternalContext;

  constructor(options: GenericWorkflowUIOptions) {
    const defaults: Partial<GenericWorkflowUIOptions> = {
      polling: { intervalMs: 10000, maxAttempts: 60 },
      features: { showLogs: true, showJobDetails: true, allowCancel: true },
    };

    this.ctx = {
      options: { ...defaults, ...options } as Required<GenericWorkflowUIOptions>,
      container: this.resolveContainer(options.container),
      ui: null,
      state: 'idle',
      pollAttempts: 0,
    };

    this.init();
  }

  private resolveContainer(container: string | HTMLElement): HTMLElement {
    if (typeof container === 'string') {
      const el = document.getElementById(container);
      if (!el) throw new Error(`Container '${container}' not found`);
      return el;
    }
    return container;
  }

  private async init() {
    try {
      const config = await WorkflowService.getWorkflow(this.ctx.options.workflowId);
      if (!config) {
        throw new Error(`Workflow '${this.ctx.options.workflowId}' not found`);
      }
      this.ctx.workflowConfig = config;
      this.buildUI();
    } catch (error: any) {
      console.error('[GenericWorkflowUI] Failed to load workflow config:', error);
      this.ctx.container.innerHTML = `<div class="alert alert-error">Failed to load workflow: ${error.message}</div>`;
    }
  }

  private buildUI() {
    const { workflowConfig, options } = this.ctx;
    if (!workflowConfig) return;

    this.ctx.container.innerHTML = '';
    const root = document.createElement('div');
    root.className = 'td-workflow-ui';

    const title = workflowConfig.name || workflowConfig.id;
    const description = workflowConfig.description || '';

    root.innerHTML = `
      <div class="td-workflow-header">
        <div class="td-workflow-title">
          <h3>${this.escapeHtml(title)}</h3>
          ${description ? `<p class="td-workflow-description">${this.escapeHtml(description)}</p>` : ''}
        </div>
        <div class="td-workflow-controls">
          <button class="td-workflow-start btn btn-primary" type="button">Run ${this.escapeHtml(title)}</button>
          ${options.features.allowCancel ? '<button class="td-workflow-cancel btn btn-danger" type="button" style="display:none;">Cancel</button>' : ''}
        </div>
      </div>
      <div class="td-workflow-status" role="status" aria-live="polite" style="display:none;"></div>
      <div class="td-workflow-progress" style="display:none;">
        <div class="td-workflow-progress-bar"><div class="td-workflow-progress-inner" style="width:0%"></div></div>
      </div>
      ${options.features.showLogs ? '<div class="td-workflow-logs" style="display:none;"><pre class="td-workflow-log-pre"></pre></div>' : ''}
      ${options.features.showJobDetails ? '<div class="td-workflow-jobs" style="display:none;"></div>' : ''}
      <div class="td-workflow-results" style="display:none;">
        <div class="td-workflow-summary"></div>
        <div class="td-workflow-details"></div>
      </div>
    `;

    this.ctx.container.appendChild(root);

    this.ctx.ui = {
      root,
      header: root.querySelector('.td-workflow-header')!,
      startBtn: root.querySelector('.td-workflow-start'),
      cancelBtn: root.querySelector('.td-workflow-cancel'),
      statusEl: root.querySelector('.td-workflow-status'),
      progressBar: root.querySelector('.td-workflow-progress'),
      progressInner: root.querySelector('.td-workflow-progress-inner'),
      logsWrap: root.querySelector('.td-workflow-logs'),
      logsPre: root.querySelector('.td-workflow-log-pre'),
      jobsWrap: root.querySelector('.td-workflow-jobs'),
      resultsWrap: root.querySelector('.td-workflow-results'),
      summary: root.querySelector('.td-workflow-summary'),
      details: root.querySelector('.td-workflow-details'),
    };

    this.bindEvents();
    this.tryResumeLastRun();
  }

  private bindEvents() {
    const { ui } = this.ctx;
    if (!ui) return;

    ui.startBtn?.addEventListener('click', () => this.start());
    ui.cancelBtn?.addEventListener('click', () => this.cancel());
  }

  private tryResumeLastRun() {
    try {
      const stored = localStorage.getItem(`workflow_${this.ctx.options.workflowId}_last`);
      if (!stored) return;

      const info = JSON.parse(stored);
      if (!info?.workflowRunId || !info.ts) return;

      // Resume if fresh (within 2 hours)
      if (Date.now() - info.ts < 2 * 60 * 60 * 1000) {
        this.ctx.workflowRunId = info.workflowRunId;
        this.transition('running', 'Resuming previous run...');
        this.schedulePoll(0);
      }
    } catch (error) {
      console.warn('[GenericWorkflowUI] Resume failed:', error);
    }
  }

  public async start(): Promise<void> {
    if (this.ctx.state !== 'idle' && !this.ctx.state.startsWith('completed')) return;

    this.transition('starting', 'Starting workflow...');
    this.ctx.pollAttempts = 0;
    this.ctx.workflowRunId = undefined;

    const { ui } = this.ctx;
    if (ui) {
      ui.resultsWrap!.style.display = 'none';
      ui.logsWrap && (ui.logsWrap.style.display = this.ctx.options.features.showLogs ? 'block' : 'none');
      ui.jobsWrap && (ui.jobsWrap.style.display = 'none');
      ui.statusEl!.style.display = 'block';
      ui.progressBar!.style.display = 'block';
      ui.startBtn!.disabled = true;
      if (ui.cancelBtn) ui.cancelBtn.style.display = this.ctx.options.features.allowCancel ? 'inline-block' : 'none';
      this.setProgress(5);
    }

    try {
      const response = await WorkflowService.executeWorkflow({
        workflowId: this.ctx.options.workflowId,
        inputs: this.ctx.options.inputs,
      });

      this.ctx.workflowRunId = response.workflowRunId;
      this.persistRunMeta();
      this.transition('running', 'Workflow triggered successfully');
      this.notify('info', 'Workflow Started', `Run ID: ${response.workflowRunId}`);
      this.setProgress(15);
      this.schedulePoll(0);
    } catch (error: any) {
      this.transition('error', error.message || 'Failed to start workflow');
      if (ui) {
        ui.startBtn!.disabled = false;
        if (ui.cancelBtn) ui.cancelBtn.style.display = 'none';
      }
      this.notify('error', 'Workflow Error', error.message || 'Failed to start');
    }
  }

  public async cancel(): Promise<void> {
    if (!this.ctx.workflowRunId || this.ctx.state !== 'running') return;

    this.transition('cancelling', 'Cancelling workflow...');

    try {
      await WorkflowService.cancelWorkflow(this.ctx.workflowRunId);
      this.notify('success', 'Cancellation Requested', 'Workflow is being cancelled');
    } catch (error: any) {
      this.notify('error', 'Cancellation Failed', error.message || 'Failed to cancel');
      this.transition('running', 'Resuming...');
    }
  }

  private schedulePoll(delay: number) {
    if (this.ctx.pollTimer) window.clearTimeout(this.ctx.pollTimer);
    this.ctx.pollTimer = window.setTimeout(
      () => this.poll(),
      delay,
    ) as unknown as number;
  }

  private async poll() {
    if (!this.ctx.workflowRunId) return;

    const { polling } = this.ctx.options;
    if (this.ctx.pollAttempts >= (polling.maxAttempts || 60)) {
      this.finalize('timeout');
      return;
    }

    this.ctx.pollAttempts++;
    const progress = Math.min(90, 15 + this.ctx.pollAttempts * 2);
    this.setProgress(progress);

    try {
      const status = await WorkflowService.getWorkflowStatus(
        this.ctx.workflowRunId,
        this.ctx.options.workflowId,
      );

      this.renderStatus(status);

      if (status.status === 'completed') {
        this.finalize(
          status.conclusion === 'success' ? 'completed-success' :
          status.conclusion === 'cancelled' ? 'cancelled' :
          'completed-failure',
          status,
        );
        return;
      }

      this.schedulePoll(polling.intervalMs || 10000);
    } catch (error: any) {
      console.error('[GenericWorkflowUI] Poll error:', error);
      this.schedulePoll(Math.min((polling.intervalMs || 10000) * 1.5, 60000));
    }
  }

  private renderStatus(status: WorkflowStatusResponse) {
    const { ui, options } = this.ctx;
    if (!ui) return;

    // Render logs
    if (options.features.showLogs && status.logs && ui.logsPre) {
      ui.logsPre.textContent = status.logs.join('\n');
      ui.logsPre.scrollTop = ui.logsPre.scrollHeight;
    }

    // Render job details
    if (options.features.showJobDetails && status.jobs && ui.jobsWrap) {
      const jobsHtml = status.jobs
        .map(
          (job) => `
          <li>
            <strong>${this.escapeHtml(job.name)}</strong>
            <em>(${this.escapeHtml(job.conclusion || job.status || 'unknown')})</em>
            ${job.logsUrl ? ` - <a href="${job.logsUrl}" target="_blank">logs</a>` : ''}
          </li>
        `,
        )
        .join('');
      ui.jobsWrap.style.display = 'block';
      ui.jobsWrap.innerHTML = `<h4>Job Details</h4><ul>${jobsHtml}</ul>`;
    }
  }

  private finalize(state: WorkflowState, status?: WorkflowStatusResponse) {
    this.transition(state, this.getStateMessage(state));
    this.setProgress(100);

    const { ui } = this.ctx;
    if (ui) {
      ui.startBtn!.disabled = false;
      if (ui.cancelBtn) ui.cancelBtn.style.display = 'none';
      ui.resultsWrap!.style.display = 'block';

      if (ui.summary) {
        ui.summary.innerHTML = this.renderSummary(state, status);
      }

      if (ui.details && status?.result) {
        ui.details.innerHTML = this.renderDetails(status.result);
      }
    }

    // Notifications
    switch (state) {
      case 'completed-success':
        this.notify('success', 'Workflow Completed', 'All checks passed');
        break;
      case 'completed-failure':
        this.notify('error', 'Workflow Failed', 'Some checks failed');
        break;
      case 'cancelled':
        this.notify('warning', 'Workflow Cancelled', 'Execution was cancelled');
        break;
      case 'timeout':
        this.notify('warning', 'Workflow Timeout', 'Still running in background?');
        break;
    }
  }

  private renderSummary(state: WorkflowState, status?: WorkflowStatusResponse): string {
    const runLink = status?.runUrl
      ? `<p><a href="${status.runUrl}" target="_blank" rel="noopener noreferrer">View workflow on GitHub</a></p>`
      : '';

    let className = 'td-workflow-summary';
    if (state === 'completed-success') className += ' success';
    else if (state === 'completed-failure') className += ' failure';

    switch (state) {
      case 'completed-success':
        return `<div class="${className}"><strong>Success!</strong> Workflow completed successfully.${runLink}</div>`;
      case 'completed-failure':
        return `<div class="${className}"><strong>Failed.</strong> Workflow completed with issues.${runLink}</div>`;
      case 'cancelled':
        return `<div class="${className}"><strong>Cancelled.</strong> Workflow was cancelled.${runLink}</div>`;
      case 'timeout':
        return `<div class="${className}"><strong>Timeout.</strong> Workflow may still be running.${runLink}</div>`;
      default:
        return `<div class="${className}"><strong>${state}</strong>${runLink}</div>`;
    }
  }

  private renderDetails(result: any): string {
    if (!result) return '';

    // Check if result has validation-style details
    if (Array.isArray(result.details)) {
      return this.renderValidationDetails(result.details);
    }

    // Otherwise render as JSON
    return `<pre>${JSON.stringify(result, null, 2)}</pre>`;
  }

  private renderValidationDetails(details: any[]): string {
    const failed = details.filter((d) => d.status === 'fail');
    const warn = details.filter((d) => d.status === 'warn');
    const pass = details.filter((d) => d.status === 'pass');

    const section = (title: string, icon: string, arr: any[], color: string) =>
      arr.length
        ? `
      <details open style="margin:0 0 12px 0; border:1px solid ${color}; border-radius:6px;">
        <summary style="cursor:pointer; padding:8px 12px; font-weight:600; background:rgba(0,0,0,0.03);">${icon} ${title} (${arr.length})</summary>
        <div style="padding:10px 14px; font-size:13px; line-height:1.45;">
          ${arr.map((d) => `
            <div style="margin:0 0 12px 0;">
              <div style="font-weight:600;">${this.escapeHtml(d.category)}</div>
              <div style="margin:4px 0 6px 0;">${this.escapeHtml(d.message)}</div>
              ${d.issues?.length ? `<ul style="margin:4px 0 0 16px; padding:0; list-style:disc;">${d.issues.map((i: any) => `<li style="margin:2px 0;">${this.escapeHtml(i)}</li>`).join('')}</ul>` : ''}
            </div>
          `).join('')}
        </div>
      </details>`
        : '';

    return [
      section('Failed Checks', '❌', failed, '#f9d0d0'),
      section('Warnings', '⚠️', warn, '#f1e05a'),
      section('Passed Checks', '✅', pass, '#34d058'),
    ].join('');
  }

  private transition(state: WorkflowState, message?: string) {
    this.ctx.state = state;
    if (this.ctx.ui?.statusEl) {
      this.ctx.ui.statusEl.textContent = message || state;
    }
    this.ctx.options.onStateChange?.(state, undefined);
  }

  private setProgress(percent: number) {
    if (this.ctx.ui?.progressInner) {
      this.ctx.ui.progressInner.style.width = `${percent}%`;
    }
  }

  private getStateMessage(state: WorkflowState): string {
    const messages: Record<WorkflowState, string> = {
      idle: 'Ready',
      starting: 'Starting workflow...',
      running: 'Workflow running...',
      cancelling: 'Cancelling...',
      'completed-success': 'Workflow completed successfully',
      'completed-failure': 'Workflow completed with issues',
      cancelled: 'Workflow cancelled',
      error: 'Error occurred',
      timeout: 'Workflow timed out',
    };
    return messages[state] || state;
  }

  private persistRunMeta() {
    if (!this.ctx.workflowRunId) return;
    try {
      const meta = {
        workflowRunId: this.ctx.workflowRunId,
        ts: Date.now(),
      };
      localStorage.setItem(
        `workflow_${this.ctx.options.workflowId}_last`,
        JSON.stringify(meta),
      );
    } catch (error) {
      console.warn('[GenericWorkflowUI] Failed to persist run meta:', error);
    }
  }

  private notify(
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string,
  ) {
    const ns: any = (window as any).NotificationSystem;
    if (!ns) return;

    const methodMap: Record<string, string> = {
      success: 'showSuccess',
      error: 'showError',
      warning: 'showWarning',
      info: 'showInfo',
    };

    const fn = ns[methodMap[type]];
    if (typeof fn === 'function') fn(title, message);
  }

  private escapeHtml(str: string): string {
    return String(str).replace(
      /[&<>"']/g,
      (s) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[s] as string,
    );
  }

  public getState(): WorkflowState {
    return this.ctx.state;
  }

  public destroy() {
    if (this.ctx.pollTimer) window.clearTimeout(this.ctx.pollTimer);
    this.ctx.container.innerHTML = '';
    this.ctx.state = 'idle';
  }
}

// Export for global window access
if (typeof window !== 'undefined') {
  (window as any).GenericWorkflowUI = GenericWorkflowUI;
}
