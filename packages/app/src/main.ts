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
// Newly migrated core analytic & rendering modules
import './scripts/analyzer';
import './scripts/report-loader';
import './scripts/dashboard-renderer';
// Minimal scanned templates renderer shim (temporary until full app.js migration)
import './scripts/template-list';
import './scripts/template-card-view-handler';
// TODO: migrate and add remaining legacy scripts progressively.

// Simple runtime confirmation that the module graph executed.
// This will be removed once migration stabilizes.
console.debug('[TemplateDoctor] main.ts module entry loaded');
