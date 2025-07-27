// Dashboard Renderer - Handles rendering of compliance reports
// Uses IIFE pattern to avoid global namespace pollution

// Only create if not already defined
(function() {
    // If DashboardRenderer already exists, don't redefine it
    if (window.DashboardRenderer !== undefined) {
        console.log('DashboardRenderer already exists, skipping initialization');
        return;
    }

    // Create a renderer function
    function DashboardRendererClass() {
        // Debug utility
        this.debug = function(message, data) {
            console.log(`[DashboardRenderer] ${message}`, data !== undefined ? data : '');
        };
        
        this.debug('Dashboard renderer initialized');

        /**
         * Renders the analysis results dashboard
         * @param {Object} result - The analysis result data
         * @param {HTMLElement} container - The container element to render into
         */
        this.render = function(result, container) {
            this.debug('Rendering dashboard', result);
            
            if (!result || !container) {
                console.error('Missing result data or container element');
                return;
            }

            // Clear the container
            container.innerHTML = '';
            
            // Create overview section
            this.renderOverview(result, container);
            
            // Create sections for each category
            if (result.categories && Array.isArray(result.categories)) {
                result.categories.forEach(category => {
                    this.renderCategory(category, container);
                });
            }
            
            // Add event listeners for expandable sections
            this.addEventListeners(container);
        }
        
        /**
         * Renders the overview section with compliance scores
         * @param {Object} result - The analysis result data
         * @param {HTMLElement} container - The container element to render into
         */
        this.renderOverview = function(result, container) {
            const overviewSection = document.createElement('section');
            overviewSection.className = 'overview-section';
            
            const overallCompliance = Math.round(
                (result.totalPassed / (result.totalPassed + result.totalIssues)) * 100
            ) || 0;
            
            overviewSection.innerHTML = `
                <h2>Compliance Overview</h2>
                <div class="compliance-summary">
                    <div class="compliance-score">
                        <div class="score-circle">
                            <span class="score-value">${overallCompliance}%</span>
                        </div>
                        <span class="score-label">Compliance</span>
                    </div>
                    <div class="compliance-stats">
                        <div class="stat-item passed">
                            <i class="fas fa-check-circle"></i>
                            <span>${result.totalPassed} checks passed</span>
                        </div>
                        <div class="stat-item issues">
                            <i class="fas fa-exclamation-triangle"></i>
                            <span>${result.totalIssues} issues found</span>
                        </div>
                    </div>
                </div>
            `;
            
            container.appendChild(overviewSection);
        }
        
        /**
         * Renders a category section with its checks
         * @param {Object} category - The category data
         * @param {HTMLElement} container - The container element to render into
         */
        this.renderCategory = function(category, container) {
            const categorySection = document.createElement('section');
            categorySection.className = 'category-section';
            
            const passedChecks = category.checks.filter(check => check.status === 'passed');
            const failedChecks = category.checks.filter(check => check.status === 'failed');
            
            // Calculate compliance percentage for this category
            const totalChecks = passedChecks.length + failedChecks.length;
            const compliancePercentage = totalChecks > 0 
                ? Math.round((passedChecks.length / totalChecks) * 100) 
                : 0;
            
            categorySection.innerHTML = `
                <div class="category-header">
                    <h3>${category.name}</h3>
                    <div class="category-stats">
                        <div class="category-compliance">
                            <div class="compliance-bar">
                                <div class="compliance-fill" style="width: ${compliancePercentage}%"></div>
                            </div>
                            <span class="compliance-value">${compliancePercentage}%</span>
                        </div>
                        <div class="check-counts">
                            <span class="passed-count">${passedChecks.length} passed</span>
                            <span class="failed-count">${failedChecks.length} failed</span>
                        </div>
                        <button class="expand-btn">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
                <div class="checks-list" style="display: none;">
                    ${this.renderChecks(category.checks)}
                </div>
            `;
            
            container.appendChild(categorySection);
        }
        
        /**
         * Renders the list of checks for a category
         * @param {Array} checks - The checks array
         * @returns {string} HTML for the checks list
         */
        this.renderChecks = function(checks) {
            if (!checks || !Array.isArray(checks)) return '';
            
            return checks.map(check => `
                <div class="check-item ${check.status}">
                    <div class="check-status">
                        <i class="fas ${check.status === 'passed' ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                    </div>
                    <div class="check-content">
                        <h4>${check.name}</h4>
                        <p class="check-description">${check.description}</p>
                        ${check.details ? `<p class="check-details">${check.details}</p>` : ''}
                        ${check.recommendation ? `
                            <div class="check-recommendation">
                                <h5>Recommendation</h5>
                                <p>${check.recommendation}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        }
        
        /**
         * Adds event listeners to expandable sections
         * @param {HTMLElement} container - The container element
         */
        this.addEventListeners = function(container) {
            const expandButtons = container.querySelectorAll('.expand-btn');
            expandButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Find the parent category section
                    const categorySection = btn.closest('.category-section');
                    const checksList = categorySection.querySelector('.checks-list');
                    
                    // Toggle visibility
                    if (checksList.style.display === 'none') {
                        checksList.style.display = 'block';
                        btn.querySelector('i').className = 'fas fa-chevron-up';
                    } else {
                        checksList.style.display = 'none';
                        btn.querySelector('i').className = 'fas fa-chevron-down';
                    }
                });
            });
        }
    }
    
    // Register the renderer in the global scope
    window.DashboardRenderer = new DashboardRendererClass();
})();
