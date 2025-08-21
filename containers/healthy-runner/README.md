Healthy Runner Container

Purpose: Provide a minimal, always-healthy image that logs heartbeats and supports optional Managed Identity login. Use this to validate Azure Container Apps Job plumbing end-to-end.

Includes:
- Dockerfile
- runner.sh main loop
- File-based healthcheck (/app/health)

Environment variables:
- CONTAINER_ROLE (optional): string label in logs
- AZURE_SUBSCRIPTION_ID (optional): used only for visibility in logs

Build locally:
- docker build -t healthy-runner:local containers/healthy-runner

Push to ACR (example):
- az acr login -n <acrName>
- docker tag healthy-runner:local <loginServer>/healthy-runner:<tag>
- docker push <loginServer>/healthy-runner:<tag>
