// @ts-nocheck
// Migrated from js/runtime-config.js (behavior preserved)
(function(){
  const DEFAULTS = {
    apiBase: `${window.location.origin}`,
    apiVersion: 'v4',
    defaultRuleSet: 'dod',
    requireAuthForResults: true,
    autoSaveResults: false,
    archiveEnabled: false,
    archiveCollection: 'aigallery',
    dispatchTargetRepo: ''
  };
  (window as any).TemplateDoctorConfig = Object.assign({}, DEFAULTS);
  (window as any).TemplateDoctorRuntime = { lastMode: 'unknown', fallbackUsed: false };
  const loadConfig = async () => {
    try {
      if ((window as any).ConfigLoader && (window as any).ConfigLoader.loadConfig) {
        const config = await (window as any).ConfigLoader.loadConfig();
        console.log('[runtime-config] loaded config via ConfigLoader');
        const mapped: any = { ...config };
        if (!mapped.apiBase && config.backend && typeof config.backend.baseUrl === 'string') {
          mapped.apiBase = config.backend.baseUrl;
        }
        if (config.backend && typeof config.backend.functionKey === 'string') {
          mapped.functionKey = config.backend.functionKey;
        }
        if (config.API_BASE_URL) mapped.apiBase = config.API_BASE_URL;
        if (config.FUNCTION_KEY) mapped.functionKey = config.FUNCTION_KEY;
        if (config.DISPATCH_TARGET_REPO) mapped.dispatchTargetRepo = config.DISPATCH_TARGET_REPO;
        if (config.DEFAULT_RULE_SET) mapped.defaultRuleSet = String(config.DEFAULT_RULE_SET).toLowerCase();
        if (typeof config.REQUIRE_AUTH_FOR_RESULTS !== 'undefined' && config.REQUIRE_AUTH_FOR_RESULTS !== null){
          const v = String(config.REQUIRE_AUTH_FOR_RESULTS).trim().toLowerCase();
          mapped.requireAuthForResults = /^(1|true|yes|on)$/i.test(v);
        }
        if (typeof config.AUTO_SAVE_RESULTS !== 'undefined' && config.AUTO_SAVE_RESULTS !== null){
          const v2 = String(config.AUTO_SAVE_RESULTS).trim().toLowerCase();
          mapped.autoSaveResults = /^(1|true|yes|on)$/i.test(v2);
        }
        if (!mapped.apiVersion && mapped.backend && mapped.backend.apiVersion) mapped.apiVersion = mapped.backend.apiVersion;
        (window as any).TemplateDoctorConfig = Object.assign({}, DEFAULTS, mapped);
        document.dispatchEvent(new CustomEvent('template-config-loaded'));
        return;
      }
      const response = await fetch('config.json', { cache: 'no-store' });
      if (response.ok){
        const cfg = await response.json();
        if (cfg && typeof cfg === 'object') {
          const mapped: any = { ...cfg };
          if (!mapped.apiBase && cfg.backend && typeof cfg.backend.baseUrl === 'string') mapped.apiBase = cfg.backend.baseUrl;
          if (cfg.backend && typeof cfg.backend.functionKey === 'string') mapped.functionKey = cfg.backend.functionKey;
          if (cfg.defaultRuleSet) mapped.defaultRuleSet = String(cfg.defaultRuleSet).toLowerCase();
            if (typeof cfg.requireAuthForResults === 'boolean') mapped.requireAuthForResults = cfg.requireAuthForResults;
            if (typeof cfg.autoSaveResults === 'boolean') mapped.autoSaveResults = cfg.autoSaveResults;
            if (typeof cfg.archiveEnabled === 'boolean') mapped.archiveEnabled = cfg.archiveEnabled;
            if (typeof cfg.archiveCollection === 'string') mapped.archiveCollection = cfg.archiveCollection;
            if (typeof cfg.dispatchTargetRepo === 'string') mapped.dispatchTargetRepo = cfg.dispatchTargetRepo;
            if (!mapped.apiVersion && mapped.backend && mapped.backend.apiVersion) mapped.apiVersion = mapped.backend.apiVersion;
          (window as any).TemplateDoctorConfig = Object.assign({}, DEFAULTS, mapped);
          document.dispatchEvent(new CustomEvent('template-config-loaded'));
          console.log('[runtime-config] loaded config.json');
        } else {
          console.log('[runtime-config] no config.json found, using defaults');
        }
      }
    } catch (error){
      console.error('[runtime-config] error loading config:', error);
      console.log('[runtime-config] using default configuration');
    }
  };
  loadConfig().catch(()=> console.log('[runtime-config] failed to load config, using defaults'));
})();
export {};
