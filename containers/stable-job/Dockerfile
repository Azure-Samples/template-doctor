# Minimal, stable base
FROM mcr.microsoft.com/azure-cli:azurelinux3.0

# Install runtime deps only; avoid heavy layers
RUN tdnf install -y bash curl jq ca-certificates && tdnf clean all

# Health endpoint
RUN echo OK > /health

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Default: idle and ready; does not crash
ENTRYPOINT ["/entrypoint.sh"]
