// Synchronous programmatic model entrypoint.
// We do a static import of the built registration file so that all app.http()
// calls run during module evaluation (required by the Functions worker).
// Ensure you run `npm run build` before `func start` so dist exists.
import './dist/src/index.js';