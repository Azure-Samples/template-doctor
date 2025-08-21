# Minimal always-healthy container based on Azure CLI image
FROM mcr.microsoft.com/azure-cli:azurelinux3.0

# Install a few basics
RUN tdnf install -y bash curl ca-certificates jq tar gzip && tdnf clean all

# Add a simple health endpoint and runner
WORKDIR /app
COPY runner.sh /app/runner.sh
RUN chmod +x /app/runner.sh && echo "OK" > /app/health

# Default envs and labels
ENV CONTAINER_ROLE=healthy-runner
LABEL org.opencontainers.image.title="Template Doctor Healthy Runner"
LABEL org.opencontainers.image.description="Minimal container that stays healthy, logs heartbeats, and supports MI login"

# Healthcheck (file-based)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD [ -f /app/health ] && grep -q "OK" /app/health || exit 1

ENTRYPOINT ["/bin/bash", "/app/runner.sh"]
