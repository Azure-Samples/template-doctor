#!/usr/bin/env bash
#
# Template Doctor - Full Setup Script
# ===============================================
# This script guides you through the complete setup process for Template Doctor.
# It handles both local development and Azure production deployment.
#
# Usage: ./scripts/full-setup.sh
#

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Path to repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

# Track setup state
DEPLOYMENT_TARGET=""  # "local" or "azure"
GITHUB_OAUTH_DONE=false
GITHUB_PAT_DONE=false
MONGODB_DONE=false
ENV_CONFIGURED=false

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}${BOLD}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   ████████╗███████╗███╗   ███╗██████╗ ██╗      █████╗ ████████╗███████╗
║   ╚══██╔══╝██╔════╝████╗ ████║██╔══██╗██║     ██╔══██╗╚══██╔══╝██╔════╝
║      ██║   █████╗  ██╔████╔██║██████╔╝██║     ███████║   ██║   █████╗  
║      ██║   ██╔══╝  ██║╚██╔╝██║██╔═══╝ ██║     ██╔══██║   ██║   ██╔══╝  
║      ██║   ███████╗██║ ╚═╝ ██║██║     ███████╗██║  ██║   ██║   ███████╗
║      ╚═╝   ╚══════╝╚═╝     ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝   ╚═╝   ╚══════╝
║                                                                      ║
║                   ██████╗  ██████╗  ██████╗████████╗ ██████╗ ██████╗ 
║                   ██╔══██╗██╔═══██╗██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗
║                   ██║  ██║██║   ██║██║        ██║   ██║   ██║██████╔╝
║                   ██║  ██║██║   ██║██║        ██║   ██║   ██║██╔══██╗
║                   ██████╔╝╚██████╔╝╚██████╗   ██║   ╚██████╔╝██║  ██║
║                   ╚═════╝  ╚═════╝  ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝
║                                                                      ║
║                            ⚕  Setup Wizard  ⚕                        ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}${BOLD}  $1${NC}"
    echo -e "${MAGENTA}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

wait_for_enter() {
    echo ""
    read -p "Press ENTER to continue..." -r
}

ask_yes_no() {
    local prompt="$1"
    local default="${2:-n}"
    
    if [[ "$default" == "y" ]]; then
        read -p "$prompt [Y/n] " -r
        [[ -z "$REPLY" || "$REPLY" =~ ^[Yy]$ ]]
    else
        read -p "$prompt [y/N] " -r
        [[ "$REPLY" =~ ^[Yy]$ ]]
    fi
}

# =============================================================================
# Deployment Target Selection
# =============================================================================

select_deployment_target() {
    print_section "Step 1: Choose Deployment Target"
    
    while true; do
        print_info "Are you setting up for local development or Azure deployment?"
        echo ""
        echo "Choose your path:"
        echo -e "  ${BOLD}1)${NC} ${CYAN}Local Development${NC} - Run on your machine with Docker (5 minutes)"
        echo "     • Installs dependencies"
        echo "     • Creates .env configuration"
        echo "     • Builds all packages"
        echo "     • Starts Docker containers"
        echo "     • Opens http://localhost:3000"
        echo ""
        echo -e "  ${BOLD}2)${NC} ${MAGENTA}Azure Production${NC} - Deploy to Azure Container Apps (10 minutes)"
        echo "     • Installs dependencies"
        echo "     • Creates .env configuration"
        echo "     • Runs azd up (provisions + deploys)"
        echo "     • Opens your Azure app URL"
        echo ""
        
        read -p "Your choice [1-2]: " -r
        
        case "$REPLY" in
            1)
                DEPLOYMENT_TARGET="local"
                print_success "Selected: Local Development"
                break
                ;;
            2)
                DEPLOYMENT_TARGET="azure"
                print_success "Selected: Azure Production Deployment"
                break
                ;;
            *)
                print_error "Invalid choice. Please enter 1 or 2."
                echo ""
                ;;
        esac
    done
    
    wait_for_enter
}

# =============================================================================
# Prerequisites Check
# =============================================================================

check_prerequisites() {
    print_section "Step 2: Prerequisites Check"
    
    local all_good=true
    
    # Check Node.js
    print_step "Checking Node.js..."
    if command -v node &> /dev/null; then
        local node_version=$(node --version)
        local major_version=$(echo "$node_version" | cut -d'.' -f1 | tr -d 'v')
        if [[ "$major_version" -ge 20 && "$major_version" -le 22 ]]; then
            print_success "Node.js $node_version (compatible)"
        else
            print_error "Node.js $node_version (need v20.x - v22.x)"
            print_info "Install with: nvm install 20 && nvm use 20"
            all_good=false
        fi
    else
        print_error "Node.js not found"
        print_info "Install: https://nodejs.org/ or use nvm"
        all_good=false
    fi
    
    if [[ "$DEPLOYMENT_TARGET" == "local" ]]; then
        # Check Docker for local development
        print_step "Checking Docker..."
        if command -v docker &> /dev/null; then
            if docker info &> /dev/null; then
                local docker_version=$(docker --version | cut -d' ' -f3 | tr -d ',')
                print_success "Docker running (version: $docker_version)"
            else
                print_error "Docker installed but not running"
                print_info "Start Docker Desktop or docker daemon"
                all_good=false
            fi
        else
            print_error "Docker not found"
            print_info "Install: https://www.docker.com/products/docker-desktop"
            all_good=false
        fi
        
        # Check Docker Compose
        print_step "Checking Docker Compose..."
        if docker compose version &> /dev/null 2>&1 || docker-compose --version &> /dev/null 2>&1; then
            print_success "Docker Compose available"
        else
            print_error "Docker Compose not found"
            all_good=false
        fi
    fi
    
    if [[ "$DEPLOYMENT_TARGET" == "azure" ]]; then
        # Check Azure CLI
        print_step "Checking Azure CLI..."
        if command -v az &> /dev/null; then
            local az_version=$(az version --query '"azure-cli"' -o tsv 2>/dev/null || echo "unknown")
            print_success "Azure CLI installed ($az_version)"
        else
            print_error "Azure CLI not found"
            print_info "Install: https://learn.microsoft.com/cli/azure/install-azure-cli"
            all_good=false
        fi
        
        # Check azd
        print_step "Checking Azure Developer CLI (azd)..."
        if command -v azd &> /dev/null; then
            local azd_version=$(azd version 2>/dev/null | head -n1 || echo "unknown")
            print_success "azd installed ($azd_version)"
        else
            print_error "azd not found"
            print_info "Install: https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd"
            all_good=false
        fi
    fi
    
    echo ""
    
    if [[ "$all_good" != true ]]; then
        print_error "Some prerequisites are missing. Please install them and run this script again."
        exit 1
    fi
    
    print_success "All prerequisites satisfied!"
    wait_for_enter
}

# =============================================================================
# GitHub OAuth App Setup
# =============================================================================

setup_github_oauth() {
    print_section "Step 2: GitHub OAuth App Setup"
    
    print_info "You need a GitHub OAuth App for user authentication."
    echo ""
    echo "This will be used for:"
    echo "  • User login to Template Doctor"
    echo "  • GitHub issue creation"
    echo "  • User-specific repository access"
    echo ""
    
    echo "Choose an option:"
    echo -e "  ${BOLD}1)${NC} Create new GitHub OAuth App (guided setup)"
    echo -e "  ${BOLD}2)${NC} I already have OAuth credentials"
    echo -e "  ${BOLD}3)${NC} I will add values manually to .env later"
    echo ""
    
    while true; do
        read -p "Your choice [1-3]: " -r
        
        case "$REPLY" in
            1)
                echo ""
                print_info "Let's create a GitHub OAuth App:"
                echo ""
                echo -e "1. Open: ${CYAN}https://github.com/settings/developers${NC}"
                echo -e "2. Click '${BOLD}New OAuth App${NC}'"
                echo -e "3. Fill in:"
                echo -e "   ${BOLD}Application name:${NC} Template Doctor"
                echo -e "   ${BOLD}Homepage URL:${NC} http://localhost:3000 (for local dev)"
                echo -e "   ${BOLD}Authorization callback URL:${NC} http://localhost:3000/callback.html"
                echo -e "4. Click '${BOLD}Register application${NC}'"
                echo -e "5. Copy the ${BOLD}Client ID${NC} (starts with Ov or Iv)"
                echo -e "6. Click '${BOLD}Generate a new client secret${NC}'"
                echo -e "7. Copy the ${BOLD}Client Secret${NC} (you won't see it again!)"
                echo ""
                print_warning "NOTE: For production, create a separate OAuth app with production URL"
                echo ""
                
                wait_for_enter
                
                echo ""
                read -p "GitHub Client ID: " GITHUB_CLIENT_ID
                read -sp "GitHub Client Secret: " GITHUB_CLIENT_SECRET
                echo ""
                
                if [[ -z "$GITHUB_CLIENT_ID" || -z "$GITHUB_CLIENT_SECRET" ]]; then
                    print_error "Both Client ID and Secret are required"
                    exit 1
                fi
                
                GITHUB_OAUTH_DONE=true
                print_success "OAuth App configured!"
                break
                ;;
            
            2)
                echo ""
                print_step "Great! Enter your OAuth App credentials:"
                echo ""
                
                read -p "GitHub Client ID (starts with Ov or Iv): " GITHUB_CLIENT_ID
                read -sp "GitHub Client Secret: " GITHUB_CLIENT_SECRET
                echo ""
                
                if [[ -z "$GITHUB_CLIENT_ID" || -z "$GITHUB_CLIENT_SECRET" ]]; then
                    print_error "Both Client ID and Secret are required"
                    exit 1
                fi
                
                GITHUB_OAUTH_DONE=true
                print_success "OAuth credentials saved!"
                break
                ;;
            
            3)
                GITHUB_CLIENT_ID="<add-manually>"
                GITHUB_CLIENT_SECRET="<add-manually>"
                GITHUB_OAUTH_DONE=true
                print_warning "You chose manual configuration."
                echo ""
                print_info "${BOLD}ACTION REQUIRED:${NC} After setup completes, edit ${CYAN}.env${NC} and add:"
                echo -e "  ${BOLD}GITHUB_CLIENT_ID${NC}=your_oauth_client_id"
                echo -e "  ${BOLD}GITHUB_CLIENT_SECRET${NC}=your_oauth_client_secret"
                break
                ;;
            
            *)
                print_error "Invalid choice. Please enter 1, 2, or 3."
                echo ""
                continue
                ;;
        esac
    done
    
    wait_for_enter
}

# =============================================================================
# GitHub Personal Access Token
# =============================================================================

setup_github_pat() {
    print_section "Step 3: GitHub Personal Access Tokens"
    
    print_info "Template Doctor needs GitHub PATs for backend operations."
    echo ""
    echo "We need tokens for:"
    echo "  • ${BOLD}GITHUB_TOKEN${NC} - General repository access (clone, analyze, PR creation)"
    echo "  • ${BOLD}GITHUB_TOKEN_ANALYZER${NC} - Analyzer-specific operations"
    echo "  • ${BOLD}GH_WORKFLOW_TOKEN${NC} - Workflow dispatch for validations"
    echo ""
    echo "Required scopes: ${BOLD}repo${NC}, ${BOLD}workflow${NC}, ${BOLD}read:org${NC}"
    echo ""
    print_info "${BOLD}NOTE:${NC} You can use the same token for all three variables unless you need different scopes."
    echo ""
    
    echo "Choose an option:"
    echo -e "  ${BOLD}1)${NC} Create new GitHub PAT (guided setup)"
    echo -e "  ${BOLD}2)${NC} I already have a GitHub PAT"
    echo -e "  ${BOLD}3)${NC} I will add values manually to .env later"
    echo ""
    
    while true; do
        read -p "Your choice [1-3]: " -r
        
        case "$REPLY" in
            1)
            echo ""
            print_info "Let's create a GitHub Personal Access Token:"
            echo ""
            echo -e "1. Open: ${CYAN}https://github.com/settings/tokens/new${NC}"
            echo -e "2. Give it a name: ${BOLD}Template Doctor${NC}"
            echo -e "3. Set expiration: ${BOLD}90 days${NC} or longer"
            echo -e "4. Select these scopes:"
            echo -e "   ${BOLD}☑ repo${NC} - Full control of private repositories"
            echo -e "   ${BOLD}☑ workflow${NC} - Update GitHub Action workflows"
            echo -e "   ${BOLD}☑ read:org${NC} - Read org and team membership"
            echo -e "5. Click '${BOLD}Generate token${NC}'"
            echo -e "6. Copy the token (starts with ghp_)"
            echo ""
            print_warning "You won't be able to see this token again!"
            echo ""
            
            wait_for_enter
            
            echo ""
            read -sp "GitHub Personal Access Token: " GITHUB_TOKEN
            echo ""
            
            if [[ -z "$GITHUB_TOKEN" ]]; then
                print_error "GitHub token is required"
                exit 1
            fi
            
            # Use same token for all three by default
            echo ""
            if ask_yes_no "Use the same token for GITHUB_TOKEN_ANALYZER and GH_WORKFLOW_TOKEN?" "y"; then
                GITHUB_TOKEN_ANALYZER="$GITHUB_TOKEN"
                GH_WORKFLOW_TOKEN="$GITHUB_TOKEN"
                print_info "Using same token for all GitHub operations"
            else
                echo ""
                print_step "Enter separate tokens (or press Enter to use same):"
                echo ""
                read -sp "GITHUB_TOKEN_ANALYZER (Enter for same): " GITHUB_TOKEN_ANALYZER
                echo ""
                if [[ -z "$GITHUB_TOKEN_ANALYZER" ]]; then
                    GITHUB_TOKEN_ANALYZER="$GITHUB_TOKEN"
                fi
                
                read -sp "GH_WORKFLOW_TOKEN (Enter for same): " GH_WORKFLOW_TOKEN
                echo ""
                if [[ -z "$GH_WORKFLOW_TOKEN" ]]; then
                    GH_WORKFLOW_TOKEN="$GITHUB_TOKEN"
                fi
            fi
            
            GITHUB_PAT_DONE=true
            print_success "GitHub PATs configured!"
            break
            ;;
            
        2)
            echo ""
            print_step "Enter your GitHub PAT:"
            echo ""
            
            read -sp "GitHub Personal Access Token (ghp_...): " GITHUB_TOKEN
            echo ""
            
            if [[ ! "$GITHUB_TOKEN" =~ ^ghp_ ]]; then
                print_warning "Token doesn't start with 'ghp_' - are you sure it's correct?"
                if ! ask_yes_no "Continue anyway?"; then
                    exit 1
                fi
            fi
            
            echo ""
            if ask_yes_no "Use the same token for GITHUB_TOKEN_ANALYZER and GH_WORKFLOW_TOKEN?" "y"; then
                GITHUB_TOKEN_ANALYZER="$GITHUB_TOKEN"
                GH_WORKFLOW_TOKEN="$GITHUB_TOKEN"
            else
                echo ""
                read -sp "GITHUB_TOKEN_ANALYZER (Enter for same): " GITHUB_TOKEN_ANALYZER
                echo ""
                if [[ -z "$GITHUB_TOKEN_ANALYZER" ]]; then
                    GITHUB_TOKEN_ANALYZER="$GITHUB_TOKEN"
                fi
                
                read -sp "GH_WORKFLOW_TOKEN (Enter for same): " GH_WORKFLOW_TOKEN
                echo ""
                if [[ -z "$GH_WORKFLOW_TOKEN" ]]; then
                    GH_WORKFLOW_TOKEN="$GITHUB_TOKEN"
                fi
            fi
            
            GITHUB_PAT_DONE=true
            print_success "GitHub PATs saved!"
            break
            ;;
            
        3)
            GITHUB_TOKEN="<add-manually>"
            GITHUB_TOKEN_ANALYZER="<add-manually>"
            GH_WORKFLOW_TOKEN="<add-manually>"
            GITHUB_PAT_DONE=true
            print_warning "You chose manual configuration."
            echo ""
            print_info "${BOLD}ACTION REQUIRED:${NC} After setup completes, edit ${CYAN}.env${NC} and add:"
            echo -e "  ${BOLD}GITHUB_TOKEN${NC}=ghp_your_token_here"
            echo -e "  ${BOLD}GITHUB_TOKEN_ANALYZER${NC}=ghp_your_token_here (can be same)"
            echo -e "  ${BOLD}GH_WORKFLOW_TOKEN${NC}=ghp_your_token_here (can be same)"
            break
            ;;
            
        *)
            print_error "Invalid choice. Please enter 1, 2, or 3."
            echo ""
            continue
            ;;
        esac
    done
    
    wait_for_enter
}

# =============================================================================
# MongoDB Setup
# =============================================================================

setup_mongodb() {
    local step_num="4"
    if [[ "$DEPLOYMENT_TARGET" == "azure" ]]; then
        step_num="5"
    fi
    
    print_section "Step $step_num: MongoDB Database Setup"
    
    if [[ "$DEPLOYMENT_TARGET" == "local" ]]; then
        print_step "Configuring for local development..."
        echo ""
        print_info "For local development, Template Doctor uses:"
        echo -e "  • MongoDB container via docker-compose"
        echo -e "  • Database: ${BOLD}template-doctor${NC}"
        echo -e "  • Connection: ${CYAN}mongodb://mongodb:27017/template-doctor${NC}"
        echo ""
        print_success "No configuration needed - docker-compose handles this automatically!"
        echo ""
        print_warning "${BOLD}CRITICAL:${NC} Do NOT set MONGODB_URI in .env for local development!"
        
        # Don't set MONGODB_URI for local - let docker-compose default handle it
        MONGODB_URI="UNSET_FOR_LOCAL_DEV"
        MONGODB_DONE=true
        
    else  # Azure deployment
        print_step "Configuring for Azure Cosmos DB (Production)..."
        echo ""
        print_success "Production deployment uses Managed Identity - NO configuration needed in .env!"
        echo ""
        print_info "When you run ${BOLD}azd up${NC}, it will automatically:"
        echo -e "  ✓ Provision Cosmos DB (serverless, MongoDB API)"
        echo -e "  ✓ Create Container App with System-Assigned Managed Identity"
        echo -e "  ✓ Set COSMOS_ENDPOINT environment variable"
        echo -e "  ✓ Grant MI 'Cosmos DB Built-in Data Contributor' role"
        echo -e "  ✓ Connect securely using tokens (no connection strings!)"
        echo ""
        
        # For production, mark as configured by Bicep
        MONGODB_URI="<production-configured-by-bicep>"
        MONGODB_DONE=true
    fi
    
    wait_for_enter
}

# =============================================================================
# Admin User Setup
# =============================================================================

setup_admin_user() {
    print_section "Step 5: Admin User Configuration"
    
    print_info "Who should have admin access to Template Doctor?"
    echo ""
    echo "Admin users can:"
    echo "  • Access /leaderboard endpoints"
    echo "  • View /api/v4/admin/* endpoints"
    echo "  • Manage system configuration"
    echo ""
    
    echo "Choose an option:"
    echo -e "  ${BOLD}1)${NC} Enter admin usernames now"
    echo -e "  ${BOLD}2)${NC} I will configure manually later"
    echo ""
    
    while true; do
        read -p "Your choice [1-2]: " -r
        
        case "$REPLY" in
            1)
                echo ""
                print_step "Enter GitHub usernames (comma-separated):"
                print_info "Example: user1,user2,user3"
                echo ""
                
                read -p "Admin GitHub users: " ADMIN_GITHUB_USERS
                
                if [[ -z "$ADMIN_GITHUB_USERS" ]]; then
                    print_warning "No admin users specified - you can add them to .env later"
                    ADMIN_GITHUB_USERS=""
                else
                    print_success "Admin users: $ADMIN_GITHUB_USERS"
                fi
                break
                ;;
            
            2)
                ADMIN_GITHUB_USERS="<add-manually>"
                print_warning "You chose manual configuration."
                echo ""
                print_info "${BOLD}ACTION REQUIRED:${NC} After setup completes, edit ${CYAN}.env${NC} and add:"
                echo -e "  ${BOLD}ADMIN_GITHUB_USERS${NC}=username1,username2"
                break
                ;;
            
            *)
                print_error "Invalid choice. Please enter 1 or 2."
                echo ""
                continue
                ;;
        esac
    done
    
    wait_for_enter
}

# =============================================================================
# Workflow Dispatch Repository
# =============================================================================

setup_dispatch_repo() {
    print_section "Step 6: GitHub Actions Workflow Configuration"
    
    print_info "Where should GitHub Actions workflows run?"
    echo ""
    echo "Template Doctor triggers GitHub Actions workflows for:"
    echo "  • Template validation (azd-validation)"
    echo "  • Docker image scanning"
    echo "  • OSSF scorecard checks"
    echo ""
    echo -e "The ${BOLD}DISPATCH_TARGET_REPO${NC} is where these workflows execute."
    echo ""
    print_info "This should typically be YOUR fork or the repository you're working with."
    echo ""
    echo "Choose an option:"
    echo -e "  ${BOLD}1)${NC} Enter repository now (format: owner/repo)"
    echo -e "  ${BOLD}2)${NC} I will configure manually later"
    echo ""
    
    while true; do
        read -p "Your choice [1-2]: " -r
        
        case "$REPLY" in
            1)
                echo ""
                read -p "Repository (format: owner/repo): " DISPATCH_TARGET_REPO
                
                if [[ ! "$DISPATCH_TARGET_REPO" =~ ^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$ ]]; then
                    print_error "Invalid format - must be owner/repo"
                    exit 1
                fi
                
                print_success "Dispatch target: $DISPATCH_TARGET_REPO"
                break
                ;;
            
            2)
                DISPATCH_TARGET_REPO="<add-manually>"
                print_warning "You chose manual configuration."
                echo ""
                print_info "${BOLD}ACTION REQUIRED:${NC} After setup completes, edit ${CYAN}.env${NC} and add:"
                echo -e "  ${BOLD}DISPATCH_TARGET_REPO${NC}=owner/repo"
                break
                ;;
            
            *)
                print_error "Invalid choice. Please enter 1 or 2."
                echo ""
                continue
                ;;
        esac
    done
    
    wait_for_enter
}

# =============================================================================
# Create .env File
# =============================================================================

create_env_file() {
    print_section "Step 7: Creating .env File"
    
    if [[ -f "$ENV_FILE" ]]; then
        print_warning "${BOLD}.env file already exists!${NC}"
        echo ""
        print_info "Your existing .env contains configuration that will be ${RED}OVERWRITTEN${NC}."
        echo ""
        echo "Choose an option:"
        echo -e "  ${BOLD}1)${NC} Overwrite .env now (backup will be created)"
        echo -e "  ${BOLD}2)${NC} Skip .env creation (I'll configure it manually)"
        if [[ "$DEPLOYMENT_TARGET" == "azure" ]]; then
            echo -e "  ${BOLD}3)${NC} Skip for now and configure before deployment"
        fi
        echo ""
        
        while true; do
            read -p "Your choice [1-$(if [[ "$DEPLOYMENT_TARGET" == "azure" ]]; then echo "3"; else echo "2"; fi)]: " -r
            
            case "$REPLY" in
                1)
                    mv "$ENV_FILE" "${ENV_FILE}.backup.$(date +%s)"
                    print_success "Backed up existing .env file"
                    break
                    ;;
                2)
                    print_info "Skipping .env creation - using existing file"
                    print_warning "${BOLD}REMINDER:${NC} Make sure your .env has all required values!"
                    wait_for_enter
                    return
                    ;;
                3)
                    if [[ "$DEPLOYMENT_TARGET" == "azure" ]]; then
                        print_info "Skipping .env creation for now"
                        print_warning "${BOLD}ACTION REQUIRED:${NC} Configure .env before running deployment!"
                        wait_for_enter
                        return
                    else
                        print_error "Invalid choice. Please enter 1 or 2."
                        echo ""
                        continue
                    fi
                    ;;
                *)
                    print_error "Invalid choice. Please enter 1$(if [[ "$DEPLOYMENT_TARGET" == "azure" ]]; then echo ", 2, or 3"; else echo " or 2"; fi)."
                    echo ""
                    continue
                    ;;
            esac
        done
    fi
    
    print_step "Creating .env file with your configuration..."
    
    # Prepare MongoDB line based on whether URI was set
    if [[ "$MONGODB_URI" == "UNSET_FOR_LOCAL_DEV" ]]; then
        # For local dev, we must NOT set MONGODB_URI at all
        # Docker Compose will use its default: mongodb://mongodb:27017/template-doctor
        MONGODB_LINE="# MONGODB_URI - DO NOT SET for local dev! Docker Compose handles this automatically."
    elif [[ -n "$MONGODB_URI" ]]; then
        MONGODB_LINE="MONGODB_URI=$MONGODB_URI"
    else
        MONGODB_LINE="# MONGODB_URI - Leave unset for local dev (docker-compose default)"
    fi
    
    cat > "$ENV_FILE" << EOF
###################################################################################################
# Template Doctor - Environment Configuration
# Generated by full-setup.sh on $(date)
###################################################################################################

############################################
# GitHub OAuth / API Authentication (REQUIRED)
############################################
GITHUB_CLIENT_ID=$GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=$GITHUB_CLIENT_SECRET
GITHUB_TOKEN=$GITHUB_TOKEN
GITHUB_TOKEN_ANALYZER=$GITHUB_TOKEN_ANALYZER
GH_WORKFLOW_TOKEN=$GH_WORKFLOW_TOKEN

# Admin Access Control (comma-separated GitHub usernames)
ADMIN_GITHUB_USERS=$ADMIN_GITHUB_USERS

# Database
$MONGODB_LINE
MONGODB_DATABASE=template-doctor

############################################
# Server Configuration
############################################
# Express Server Port (backend + frontend combined)
PORT=3000

# Frontend Vite Dev Server Port (if running separately)
VITE_PORT=3000

# Legacy compatibility
SERVE_FRONTEND=true
BASE=http://localhost:7071

############################################
# Application Defaults
############################################
DEFAULT_RULE_SET=dod
REQUIRE_AUTH_FOR_RESULTS=true
AUTO_SAVE_RESULTS=false
ARCHIVE_ENABLED=true
ARCHIVE_COLLECTION=gallery
ARCHIVE_REPO_SLUG=Template-Doctor/centralized-collections-archive
ISSUE_AI_ENABLED=false
DEPRECATED_MODELS=gpt-3.5-turbo,model-old-x

# Target repository for GitHub Actions workflow dispatch
DISPATCH_TARGET_REPO=$DISPATCH_TARGET_REPO

EOF
    
    ENV_CONFIGURED=true
    print_success ".env file created successfully!"
    print_info "Location: $ENV_FILE"
    
    # Show what needs manual configuration
    if grep -q "<add-manually>" "$ENV_FILE"; then
        echo ""
        print_warning "The following values need manual configuration:"
        grep "<add-manually>" "$ENV_FILE" | sed 's/=.*//' | while read -r var; do
            echo "  • $var"
        done
        echo ""
        print_info "Edit $ENV_FILE to add these values"
    fi
    
    wait_for_enter
}

# =============================================================================
# Install Dependencies
# =============================================================================

install_dependencies() {
    local step_num
    if [[ "$DEPLOYMENT_TARGET" == "local" ]]; then
        step_num="5"
    else
        step_num="6"
    fi
    
    print_section "Step $step_num: Installing Dependencies"
    
    print_step "Running npm install..."
    echo ""
    
    # Use 'npm install' instead of 'npm ci' for better compatibility across environments.
    # 'npm ci' requires a clean node_modules and a lockfile, which may not always be present.
    if npm install; then
        print_success "Dependencies installed successfully!"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
    
    wait_for_enter
}

# =============================================================================
# Build Packages
# =============================================================================

build_packages() {
    local step_num
    if [[ "$DEPLOYMENT_TARGET" == "local" ]]; then
        step_num="6"
    else
        step_num="7"
    fi
    
    print_section "Step $step_num: Building Packages"
    
    print_step "Building analyzer-core..."
    if npm run build -w packages/analyzer-core; then
        print_success "analyzer-core built"
    else
        print_error "Failed to build analyzer-core"
        exit 1
    fi
    
    print_step "Building server..."
    if npm run build -w packages/server; then
        print_success "server built"
    else
        print_error "Failed to build server"
        exit 1
    fi
    
    print_step "Building app..."
    if npm run build -w packages/app; then
        print_success "app built"
    else
        print_error "Failed to build app"
        exit 1
    fi
    
    echo ""
    print_success "All packages built successfully!"
    
    wait_for_enter
}

# =============================================================================
# Start Local Development
# =============================================================================

start_local_development() {
    print_section "Step 7: Starting Local Development"
    
    print_info "Starting Docker Compose with combined profile..."
    echo ""
    echo "This will start:"
    echo "  • MongoDB container"
    echo "  • Express backend + Vite frontend (port 3000)"
    echo ""
    
    if ask_yes_no "Start Docker containers now (MongoDB + Template Doctor)?" "y"; then
        print_step "Starting docker compose..."
        echo ""
        
        # Start in background
        if docker compose --profile combined up -d; then
            echo ""
            print_success "Containers started successfully!"
            echo ""
            print_info "Waiting for services to be ready..."
            sleep 5
            
            # Check if all required services are running
            local running_services=$(docker compose ps --services --filter "status=running" 2>/dev/null | wc -l | tr -d ' ')
            local total_services=$(docker compose ps --services 2>/dev/null | wc -l | tr -d ' ')
            
            if [[ "$running_services" -eq "$total_services" ]] && [[ "$running_services" -gt 0 ]]; then
                print_success "All services are running! ($running_services/$total_services)"
                echo ""
                print_info "Opening http://localhost:3000 in your browser..."
                sleep 2
                
                # Open browser (cross-platform)
                if command -v open &> /dev/null; then
                    open "http://localhost:3000" &>/dev/null &
                elif command -v xdg-open &> /dev/null; then
                    xdg-open "http://localhost:3000" &>/dev/null &
                elif command -v start &> /dev/null; then
                    start "http://localhost:3000" &>/dev/null &
                fi
                
                echo ""
                print_success "🎉 Template Doctor is running!"
                echo ""
                echo -e "${BOLD}Access your application:${NC}"
                echo -e "  ${GREEN}http://localhost:3000${NC}"
                echo ""
                echo -e "${BOLD}Useful commands:${NC}"
                echo -e "  View logs:    ${CYAN}docker compose logs -f${NC}"
                echo -e "  Stop:         ${CYAN}docker compose down${NC}"
                echo -e "  Restart:      ${CYAN}docker compose restart${NC}"
                echo ""
            else
                print_error "Services failed to start. Check logs:"
                echo "  docker compose logs"
                exit 1
            fi
        else
            print_error "Failed to start containers"
            exit 1
        fi
    else
        print_info "Skipping container start. To start manually, run:"
        echo "  docker compose --profile combined up"
    fi
}

# =============================================================================
# Deploy to Azure
# =============================================================================

deploy_to_azure() {
    print_section "Step 8: Deploy to Azure"
    
    print_info "Ready to deploy to Azure with azd!"
    echo ""
    echo "This will:"
    echo "  • Initialize azd environment (if needed)"
    echo "  • Provision Azure resources (Cosmos DB, Container Apps, etc.)"
    echo "  • Deploy your application"
    echo "  • Configure Managed Identity for database access"
    echo ""
    
    # Check if azd is already initialized using azd env list
    if ! azd env list --output json | grep -q '"name":'; then
        print_step "Initializing azd environment..."
        echo ""
        if azd init; then
            print_success "azd initialized"
        else
            print_error "Failed to initialize azd"
            exit 1
        fi
    else
        print_info "azd environment already initialized"
    fi
    
    echo ""
    if ask_yes_no "Run azd up now?" "y"; then
        print_step "Running azd up (this may take 5-10 minutes)..."
        echo ""
        
        if azd up; then
            echo ""
            print_success "🎉 Deployment complete!"
            echo ""
            print_info "Your application is now running on Azure!"
            echo ""
            print_info "Next steps:"
            echo "  • azd has printed your application URL above"
            echo "  • Set up production OAuth app with your Azure domain"
            echo "  • Update GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET for production"
            echo ""
            echo -e "${BOLD}Useful commands:${NC}"
            echo -e "  View logs:    ${CYAN}azd logs${NC}"
            echo -e "  Redeploy:     ${CYAN}azd deploy${NC}"
            echo -e "  Tear down:    ${CYAN}azd down${NC}"
            echo ""
        else
            print_error "Deployment failed"
            print_info "Check the error messages above and try again"
            exit 1
        fi
    else
        print_info "Skipping deployment. To deploy manually, run:"
        echo "  azd up"
    fi
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
    print_section "Setup Complete! 🎉"
    
    echo -e "${GREEN}${BOLD}Template Doctor setup is complete!${NC}"
    echo ""
    
    print_info "What's configured:"
    echo ""
    
    if [[ "$GITHUB_OAUTH_DONE" == true ]]; then
        print_success "GitHub OAuth App"
    fi
    
    if [[ "$GITHUB_PAT_DONE" == true ]]; then
        print_success "GitHub Personal Access Tokens"
    fi
    
    if [[ "$MONGODB_DONE" == true ]]; then
        print_success "MongoDB Database"
    fi
    
    if [[ "$ENV_CONFIGURED" == true ]]; then
        print_success ".env file created"
    fi
    
    print_success "Dependencies installed"
    print_success "Packages built"
    
    if [[ "$DEPLOYMENT_TARGET" == "local" ]]; then
        print_success "Docker containers running"
    else
        print_success "Deployed to Azure"
    fi
    
    echo ""
    print_success "Happy template analyzing! 🚀"
    echo ""
}

# =============================================================================
# Main Flow
# =============================================================================

main() {
    print_header
    
    # Change to repo root
    cd "$REPO_ROOT"
    
    # Step 1: Choose deployment target
    select_deployment_target
    
    # Step 2: Check prerequisites
    check_prerequisites
    
    # Step 3: GitHub OAuth
    setup_github_oauth
    
    # Step 4: GitHub PAT
    setup_github_pat
    
    # Step 5 (local) or 4 (azure): Admin users
    setup_admin_user
    
    # Step 5 (azure) or skip: Dispatch repo (only needed for Azure)
    if [[ "$DEPLOYMENT_TARGET" == "azure" ]]; then
        setup_dispatch_repo
    else
        DISPATCH_TARGET_REPO="<add-manually>"
    fi
    
    # MongoDB setup
    setup_mongodb
    
    # Create .env file
    create_env_file
    
    # Install dependencies
    install_dependencies
    
    # Build packages
    build_packages
    
    # Deploy based on target
    if [[ "$DEPLOYMENT_TARGET" == "local" ]]; then
        start_local_development
    else
        deploy_to_azure
    fi
    
    # Print summary
    print_summary
}

# Run main function
main
