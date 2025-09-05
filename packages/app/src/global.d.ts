// Global type declarations for browser usage
// These allow legacy scripts (still loaded via script tags) to access migrated TS modules

declare interface Window {
  NotificationSystem?: any;
  Notifications?: any;
  TemplateDoctorConfig?: any;
  TemplateDoctorRuntime?: any;
}
