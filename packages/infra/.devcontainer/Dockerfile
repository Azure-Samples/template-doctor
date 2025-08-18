# Azure CLI Mariner-based image
FROM mcr.microsoft.com/azure-cli:azurelinux3.0

# Install dependencies for azd
RUN tdnf install -y curl unzip git bash tar gzip && tdnf clean all

# Install Azure Developer CLI (azd)
RUN curl -fsSL https://aka.ms/install-azd.sh | bash

# Set working directory
WORKDIR /app

# Copy job scripts
COPY start-azd-job.sh /usr/local/bin/start-azd-job.sh
COPY entrypoint-wrapper.sh /usr/local/bin/entrypoint-wrapper.sh
RUN chmod +x /usr/local/bin/start-azd-job.sh /usr/local/bin/entrypoint-wrapper.sh

# Default command
ENTRYPOINT ["/usr/local/bin/entrypoint-wrapper.sh"]
CMD []
