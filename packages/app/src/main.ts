// Aggregated entry importing migrated modules in original approximate order.
// As migration proceeds, add remaining modules here to allow bundling.
import './scripts/config-loader';
import './scripts/api-routes';
import './scripts/runtime-config';
import './modules/notification-system';
import './modules/notifications';
import './modules/notifications-compat';
import './modules/notifications-init';
import './scripts/auth';
// New TypeScript GitHub client wrapper (phase 1) – placed before analyzer so it can attach immediately
import './scripts/github-client';
// Newly migrated core analytic & rendering modules
import './scripts/analyzer';
import './scripts/report-loader';
import './scripts/dashboard-renderer';
// Minimal scanned templates renderer shim (temporary until full app.js migration)
import './scripts/template-list';
import './scripts/template-card-view-handler';
import './scripts/search';
import './scripts/api-client';
import './scripts/issue-service';
import './scripts/batch-scan';
// TODO: migrate and add remaining legacy scripts progressively.

// Simple runtime confirmation that the module graph executed.
// This will be removed once migration stabilizes.
console.debug('[TemplateDoctor] main.ts module entry loaded');
