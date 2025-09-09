This directory ensures the relative path ./configs/*.json resolves when the built frontend bundle is served
from an Express static root that does NOT rewrite unknown asset paths. During the Vite build, the
original source referenced `./configs/*.json`.

If the build output does not copy the `configs` folder automatically, we can either:
1. Copy the configs folder into the dist output as part of the build (preferred), or
2. Serve a symlink or copy within the container image build stage.

Currently this is a placeholder to explain why the folder may appear empty in source control.
