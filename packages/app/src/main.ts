// Aggregated entry importing migrated modules.
// ORDER MATTERS for test stability:
// Order adjusted: ensure configuration + auth + GitHub client load BEFORE analyzer so
// server-side analysis has user token and TemplateDataLoader can activate early.
// 1. Notifications (flush queue)
import './modules/notifications';
// 2. Config & routes (API base, runtime config)
import './scripts/config-loader';
import './scripts/api-routes';
import './scripts/runtime-config';
// 3. Auth & GitHub client BEFORE analyzer (previously analyzer loaded first causing missing token on early server calls)
import './scripts/auth';
import './scripts/github-client';
// 4. Analyzer & bridge
import './scripts/analyzer';
import './bridge/analyze-repo-bridge';
// Ensure core styles (previously missing in production build) are part of bundle
// Import core legacy CSS assets so they get bundled (fallback if path changes)
const legacyCss = [
	'/css/style.css',
	'/css/templates.css',
	'/css/dashboard.css'
];
legacyCss.forEach(p => {
	try {
		// Vite will treat this as a fetch of a public asset if it exists in root public path
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = p;
		document.head.appendChild(link);
	} catch (e){
		console.warn('[main] unable to append legacy stylesheet', p, e);
	}
});
import './scripts/templates-data-loader';
// Remaining analytic & rendering modules (analyzer already loaded above)
import './scripts/report-loader';
import './scripts/dashboard-renderer';
// Minimal scanned templates renderer shim (temporary until full app.js migration)
import './scripts/template-list';
import './scripts/template-card-view-handler';
import './scripts/rescan-handler';
import './scripts/validate-handler';
import './scripts/search';
import './scripts/api-client';
import './scripts/issue-service';
import './scripts/github-action-hook';
import './scripts/azd-provision';
import './scripts/batch-scan';
import './scripts/scan-mode-toggle';
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
