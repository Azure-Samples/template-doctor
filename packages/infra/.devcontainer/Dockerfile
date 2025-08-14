# Azure CLI Mariner-based image
FROM mcr.microsoft.com/azure-cli:azurelinux3.0

# Install dependencies for azd
RUN tdnf install -y curl unzip git bash tar gzip && tdnf clean all

# Install Azure Developer CLI (azd)
RUN curl -fsSL https://aka.ms/install-azd.sh | bash

# Set working directory
WORKDIR /app

# Default command
CMD ["/bin/bash"]
