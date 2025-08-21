# App runner container: base on Azure CLI, adds azd and our app entrypoint
FROM mcr.microsoft.com/azure-cli:azurelinux3.0

# Install basics + jq
RUN tdnf install -y bash curl ca-certificates jq git tar gzip && tdnf clean all

# Install Azure Developer CLI (azd)
RUN curl -fsSL https://aka.ms/install-azd.sh | bash

# Copy entrypoint and app logic
WORKDIR /app
COPY entrypoint.sh /app/entrypoint.sh
COPY app.sh /app/app.sh
RUN chmod +x /app/entrypoint.sh /app/app.sh && echo "OK" > /app/health

# Defaults
ENV CONTAINER_ROLE=app-runner
ENV APP_MODE=azd

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD [ -f /app/health ] && grep -q "OK" /app/health || exit 1

ENTRYPOINT ["/bin/bash", "/app/entrypoint.sh"]
