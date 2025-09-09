// Aggregated entry importing migrated modules.
// ORDER MATTERS for test stability:
// Notifications first so that tests depending on NotificationSystem always see real implementation
// even if analyzer (below) throws early.
import './modules/notifications'; // Rich notification system (flushes guard stub queue + readiness)
// Import analyzer normally; wrap its top-level runtime-dependent code in the analyzer itself (preferred).
// If we still want isolation, we can later convert analyzer to expose an init() we call in try/catch.
import './scripts/analyzer';
// Bridge providing window.analyzeRepo (replaces legacy js/app.js usage)
import './bridge/analyze-repo-bridge';

// Config & data loaders
import './scripts/config-loader';
import './scripts/api-routes';
import './scripts/runtime-config';
import './scripts/templates-data-loader';
import './scripts/auth';
// New TypeScript GitHub client wrapper (phase 1) – placed before analyzer so it can attach immediately
import './scripts/github-client';
// Remaining analytic & rendering modules (analyzer already loaded above)
import './scripts/report-loader';
import './scripts/dashboard-renderer';
// Minimal scanned templates renderer shim (temporary until full app.js migration)
import './scripts/template-list';
import './scripts/template-card-view-handler';
import './scripts/search';
import './scripts/api-client';
import './scripts/issue-service';
import './scripts/github-action-hook';
import './scripts/azd-provision';
import './scripts/batch-scan';
import './modules/tooltips';
import './modules/ruleset-modal';
import './modules/validation';
import './css/validation.css';
// Legacy batch scan UI (IndexedDB + per-item cards) extraction in progress
import './scripts/batch-scan-legacy';
// TODO: migrate and add remaining legacy scripts progressively.

// Simple runtime confirmation that the module graph executed.
// This will be removed once migration stabilizes.
console.debug('[TemplateDoctor] main.ts module entry loaded');
