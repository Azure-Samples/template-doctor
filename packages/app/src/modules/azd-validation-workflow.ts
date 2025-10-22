/**
 * AZD Validation Workflow Wrapper
 * Provides backward-compatible interface for azd-validation using the generic workflow system.
 * Maintains the same API as the existing validation.ts module.
 */

import { GenericWorkflowUI, WorkflowState } from '../components/generic-workflow-ui';

export interface AzdValidationOptions {
  container: string | HTMLElement;
  templateRef: string; // owner/repo or full URL
  onStatusChange?: (state: WorkflowState) => void;
}

export class AzdValidationWorkflow {
  private workflowUI: GenericWorkflowUI;
  private templateRef: string;

  constructor(options: AzdValidationOptions) {
    this.templateRef = this.normalizeTemplateRef(options.templateRef);

    this.workflowUI = new GenericWorkflowUI({
      container: options.container,
      workflowId: 'azd-validation',
      inputs: {
        templateName: this.templateRef,
        templateUrl: options.templateRef,
        targetRepoUrl: options.templateRef,
      },
      onStateChange: options.onStatusChange,
      polling: {
        intervalMs: 30000, // 30 seconds (matches original workflow mode)
        maxAttempts: 60,   // 30 minutes total
      },
      features: {
        showLogs: true,
        showJobDetails: true,
        allowCancel: true,
      },
    });
  }

  private normalizeTemplateRef(ref: string): string {
    // Accept full URL or owner/repo; attempt extraction
    try {
      if (ref.startsWith('http')) {
        const u = new URL(ref);
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
      }
    } catch {
      /* ignore */
    }
    return ref;
  }

  public async start(): Promise<void> {
    return this.workflowUI.start();
  }

  public async cancel(): Promise<void> {
    return this.workflowUI.cancel();
  }

  public getState(): WorkflowState {
    return this.workflowUI.getState();
  }

  public destroy(): void {
    this.workflowUI.destroy();
  }
}

// Backward-compatible global functions
export function initAzdValidation(
  containerId: string,
  templateRef: string,
  onStatusChange?: (state: WorkflowState) => void,
): AzdValidationWorkflow {
  return new AzdValidationWorkflow({
    container: containerId,
    templateRef,
    onStatusChange,
  });
}

export function runAzdValidation(
  templateRef: string,
  containerId: string = 'validation-root',
  onStatusChange?: (state: WorkflowState) => void,
): AzdValidationWorkflow {
  const instance = initAzdValidation(containerId, templateRef, onStatusChange);
  instance.start();
  return instance;
}

// Export for global window access (backward compatibility)
if (typeof window !== 'undefined') {
  (window as any).AzdValidationWorkflow = AzdValidationWorkflow;
  (window as any).initAzdValidation = initAzdValidation;
  (window as any).runAzdValidation = runAzdValidation;
  
  // Also maintain the old naming for maximum compatibility
  (window as any).GitHubWorkflowValidation = {
    init: initAzdValidation,
    run: runAzdValidation,
  };
  (window as any).initGithubWorkflowValidation = initAzdValidation;
  (window as any).runGithubWorkflowValidation = runAzdValidation;
}
