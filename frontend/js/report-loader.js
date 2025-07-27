/**
 * Report Loader Module - Handles loading report data from various locations
 * with multiple fallback strategies
 */
(function(window) {
    'use strict';
    
    // Helper function to check if debug function exists
    function debug(source, message, data) {
        if (typeof window.debug === 'function') {
            window.debug(source, message, data);
        } else if (console && console.log) {
            console.log(`[${source}] ${message}`, data || '');
        }
    }
    
    // Helper to check if a variable is a valid non-empty object
    function isValidObject(obj) {
        return obj && typeof obj === 'object' && Object.keys(obj).length > 0;
    }
    
    // Module containing report loading functionality
    const ReportLoader = {
        /**
         * Load report data for a template
         * @param {string|Object} template - Template name or template object
         * @param {function} successCallback - Called on successful data loading
         * @param {function} errorCallback - Called when data loading fails
         */
        loadReportData: function(template, successCallback, errorCallback) {
            if (!template) {
                debug('report-loader', 'No template provided');
                return errorCallback('No template specified');
            }
            
            // Handle the case where template is an object (from templatesData)
            let templateName;
            let templatePath;
            let directData;
            let dataJsPath;
            let folderName;
            
            if (typeof template === 'object') {
                debug('report-loader', 'Template is an object', template);
                
                // Extract folder name for real templates
                if (template.relativePath) {
                    const parts = template.relativePath.split('/');
                    if (parts.length > 0) {
                        folderName = parts[0];
                        debug('report-loader', `Extracted folder name from relativePath: ${folderName}`);
                    }
                    
                    // If template has a dataPath property, it's likely the real format
                    if (template.dataPath) {
                        dataJsPath = `${folderName}/${template.dataPath}`;
                        debug('report-loader', `Found data.js path: ${dataJsPath}`);
                    }
                    
                    templatePath = template.relativePath;
                    debug('report-loader', `Using relative path: ${templatePath}`);
                }
                
                // Extract template name from repository URL
                if (template.repoUrl) {
                    const repoUrlParts = template.repoUrl.split('/');
                    templateName = repoUrlParts[repoUrlParts.length - 1].replace(/\.git$/, '');
                    debug('report-loader', `Extracted template name from URL: ${templateName}`);
                    
                    // If we don't have a folder name yet, try to derive it from repo URL
                    if (!folderName) {
                        const repoOwner = repoUrlParts[repoUrlParts.length - 2] || '';
                        folderName = `${repoOwner}-${templateName}`.toLowerCase();
                        debug('report-loader', `Constructed folder name from URL: ${folderName}`);
                    }
                }
                
                // If we have direct result data, use it
                if (template.result) {
                    directData = template.result;
                    debug('report-loader', `Using direct result data`);
                }
            } else {
                // If template is a string, use it as is
                templateName = template;
            }
            
            debug('report-loader', `Loading report data for template: ${templateName || 'unknown'}`);
            
            // If we have direct data, return it immediately
            if (directData) {
                debug('report-loader', 'Using direct data from template object');
                successCallback(directData);
                return;
            }
            
            // Special handling for data.js files (the real template format)
            if (dataJsPath) {
                debug('report-loader', `Attempting to load data.js file: ${dataJsPath}`);
                this._loadDataJsFile(dataJsPath)
                    .then(data => {
                        debug('report-loader', 'Successfully loaded data from data.js file', data);
                        successCallback(data);
                    })
                    .catch(error => {
                        debug('report-loader', `Failed to load data.js, falling back to other strategies: ${error.message}`);
                        // Fall back to standard loading strategies
                        return this._tryLoadReport(templateName, templatePath, folderName);
                    })
                    .then(data => {
                        // This will only be reached if _loadDataJsFile failed and _tryLoadReport succeeded
                        if (data) {
                            debug('report-loader', 'Successfully loaded data from fallback methods');
                            successCallback(data);
                        }
                    })
                    .catch(error => {
                        debug('report-loader', 'All report loading strategies failed', error);
                        errorCallback(error.message || 'Failed to load report data');
                    });
            } else {
                // Try standard strategies to load the report data
                this._tryLoadReport(templateName, templatePath, folderName)
                    .then(data => {
                        debug('report-loader', 'Report data loaded successfully', data);
                        successCallback(data);
                    })
                    .catch(error => {
                        debug('report-loader', 'Error loading report data', error);
                        errorCallback(error.message || 'Failed to load report data');
                    });
            }
        },
        
        /**
         * Load data from a data.js file (used in real templates)
         * @param {string} dataJsPath - Path to the data.js file
         * @returns {Promise<Object>} - Promise resolving to report data
         */
        _loadDataJsFile: function(dataJsPath) {
            return new Promise((resolve, reject) => {
                debug('report-loader', `Loading data.js file: ${dataJsPath}`);
                console.log(`[ReportLoader] Attempting to load: /results/${dataJsPath}`);
                
                // Create a script element to load the data.js file
                const script = document.createElement('script');
                script.src = `/results/${dataJsPath}`;
                script.id = `data-js-${new Date().getTime()}`;  // Add unique ID for debugging
                script.async = true;
                
                // Success handler - data.js files set window.reportData
                script.onload = function() {
                    debug('report-loader', 'Data.js script loaded, checking for reportData');
                    console.log(`[ReportLoader] Script with ID ${script.id} loaded successfully`);
                    
                    if (window.reportData) {
                        debug('report-loader', 'Found window.reportData', window.reportData);
                        console.log(`[ReportLoader] Found reportData with keys:`, Object.keys(window.reportData));
                        const data = window.reportData;
                        
                        // Store the current data
                        const reportData = { ...data };
                        
                        // Clean up - don't want to keep polluting the global scope
                        window.reportData = null;
                        
                        resolve(reportData);
                    } else {
                        console.error(`[ReportLoader] Script loaded but window.reportData is not defined!`);
                        reject(new Error('Data.js loaded but did not set window.reportData'));
                    }
                };
                
                // Error handler
                script.onerror = function(error) {
                    console.error(`[ReportLoader] Failed to load script: /results/${dataJsPath}`, error);
                    reject(new Error(`Failed to load data.js file: ${dataJsPath}`));
                };
                
                // Add script to document
                document.head.appendChild(script);
                console.log(`[ReportLoader] Added script tag to document head with ID: ${script.id}`);
                
                // Set a timeout in case the script never calls the callback
                setTimeout(() => {
                    if (window.reportData) {
                        debug('report-loader', 'Found window.reportData after timeout', window.reportData);
                        console.log(`[ReportLoader] Found reportData after timeout with keys:`, Object.keys(window.reportData));
                        const data = window.reportData;
                        
                        // Store the current data
                        const reportData = { ...data };
                        
                        // Clean up
                        window.reportData = null;
                        
                        resolve(reportData);
                    } else {
                        console.error(`[ReportLoader] Timed out waiting for reportData. Script may have failed to execute properly.`);
                        
                        // Let's try to fetch the file directly as text to see if it's valid
                        fetch(`/results/${dataJsPath}`)
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error(`HTTP status ${response.status}`);
                                }
                                return response.text();
                            })
                            .then(text => {
                                console.log(`[ReportLoader] File content fetched (first 100 chars): ${text.substring(0, 100)}...`);
                                reject(new Error('Timed out waiting for reportData, but file exists'));
                            })
                            .catch(error => {
                                console.error(`[ReportLoader] Couldn't fetch file directly either:`, error);
                                reject(new Error(`Timed out waiting for reportData and couldn't fetch file: ${error.message}`));
                            });
                    }
                }, 3000);
            });
        },
        
        /**
         * Try multiple strategies to load the report
         * @param {string} templateName - Template name
         * @param {string} templatePath - Optional specific path to the template data
         * @param {string} folderName - Optional folder name for the template
         * @returns {Promise<Object>} - Promise resolving to report data
         */
        _tryLoadReport: function(templateName, templatePath, folderName) {
            return new Promise((resolve, reject) => {
                debug('report-loader', 'Starting report loading sequence');
                
                // Strategy 0: If we have a specific path, try that first
                if (templatePath) {
                    debug('report-loader', `Trying specific path: ${templatePath}`);
                    this._fetchReportFile(`/results/${templatePath}`)
                        .then(data => {
                            if (isValidObject(data)) {
                                debug('report-loader', 'Successfully loaded data from specific path');
                                resolve(data);
                                return;
                            }
                            throw new Error('Invalid data format from specific path');
                        })
                        .catch(error => {
                            debug('report-loader', `Failed loading from specific path, continuing with other strategies`, error);
                            // Continue with other strategies
                            tryStandardStrategies();
                        });
                } else {
                    // No specific path, try standard strategies
                    tryStandardStrategies();
                }
                
                // Define standard loading strategies as a separate function
                const tryStandardStrategies = () => {
                    // Determine which template name/folder to use
                    // Prefer folderName if available, as it's more likely to match the directory structure
                    const template = folderName || (typeof templateName === 'string' ? templateName : 'unknown');
                    
                    debug('report-loader', `Trying standard strategies for template: ${template}`);
                    
                    // Strategy 1: Try latest.json in the folder
                    this._fetchReportFile(`/results/${template}/latest.json`)
                        .then(data => {
                            if (isValidObject(data)) {
                                debug('report-loader', 'Successfully loaded data from latest.json');
                                
                                // Check if this is metadata-only and has a dataPath
                                if (data.dataPath) {
                                    debug('report-loader', `Found dataPath in latest.json: ${data.dataPath}, loading that file`);
                                    return this._loadDataJsFile(`${template}/${data.dataPath}`)
                                        .catch(err => {
                                            debug('report-loader', `Failed to load data.js file: ${err.message}, using latest.json metadata`);
                                            return data;
                                        });
                                }
                                
                                return data;
                            } else {
                                throw new Error('Invalid data format in latest.json');
                            }
                        })
                        .then(data => {
                            if (isValidObject(data)) {
                                resolve(data);
                            } else {
                                throw new Error('Invalid data after loading from latest.json or its referenced data.js');
                            }
                        })
                        .catch(error => {
                            debug('report-loader', 'Failed loading latest.json, trying fallback', error);
                            
                            // Strategy 2: Try most recent timestamp-analysis.json
                            return this._findMostRecentAnalysisFile(template);
                        })
                        .then(data => {
                            if (data && isValidObject(data)) {
                                debug('report-loader', 'Successfully loaded data from timestamp analysis file');
                                resolve(data);
                            } else {
                                throw new Error('Could not find a valid analysis file');
                            }
                        })
                        .catch(error => {
                            debug('report-loader', 'All report loading strategies failed', error);
                            reject(new Error(`Failed to load report data for template: ${template}`));
                        });
                };
                
                // Call the function
                if (!templatePath) {
                    tryStandardStrategies();
                }
            });
        },
        
        /**
         * Fetch a specific report file
         * @param {string} path - Path to the report file
         * @returns {Promise<Object>} - Promise resolving to report data
         */
        _fetchReportFile: function(path) {
            debug('report-loader', `Fetching report file: ${path}`);
            
            return fetch(path)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
                    }
                    return response.json();
                })
                .catch(error => {
                    debug('report-loader', `Error fetching ${path}:`, error);
                    throw error;
                });
        },
        
        /**
         * Find the most recent analysis file for a template
         * @param {string} template - Template name
         * @returns {Promise<Object>} - Promise resolving to report data
         */
        _findMostRecentAnalysisFile: function(template) {
            debug('report-loader', `Finding most recent analysis file for template: ${template}`);
            
            // First try to fetch the index.json to see what's available
            return this._fetchReportFile(`/results/${template}/index.json`)
                .then(indexData => {
                    // If we found an index.json with timestamp info, use the most recent one
                    if (indexData && Array.isArray(indexData.timestamps) && indexData.timestamps.length > 0) {
                        debug('report-loader', `Found index.json with ${indexData.timestamps.length} timestamps`);
                        return this._tryTimestamps(template, indexData.timestamps);
                    } else {
                        // Fall back to generating timestamps
                        debug('report-loader', 'No index.json or invalid format, using generated timestamps');
                        const timestamps = [
                            Date.now(),
                            Date.now() - 60000,
                            Date.now() - 120000
                        ];
                        return this._tryTimestamps(template, timestamps);
                    }
                })
                .catch(error => {
                    // If index.json doesn't exist, fall back to generated timestamps
                    debug('report-loader', 'Error fetching index.json, using generated timestamps', error);
                    const timestamps = [
                        Date.now(),
                        Date.now() - 60000,
                        Date.now() - 120000
                    ];
                    return this._tryTimestamps(template, timestamps);
                });
        },
        
        /**
         * Try loading reports with different timestamps
         * @param {string} template - Template name
         * @param {Array<number>} timestamps - Array of timestamps to try
         * @returns {Promise<Object>} - Promise resolving to report data
         */
        _tryTimestamps: function(template, timestamps) {
            if (!timestamps || timestamps.length === 0) {
                return Promise.reject(new Error('No more timestamps to try'));
            }
            
            // Make sure we're working with a valid template name string
            const templateName = typeof template === 'string' ? template : 'unknown';
            const timestamp = timestamps[0];
            const path = `/results/${templateName}/${timestamp}-analysis.json`;
            
            debug('report-loader', `Trying timestamp ${timestamp} for template ${templateName}`);
            
            return this._fetchReportFile(path)
                .catch(error => {
                    // Try the next timestamp
                    debug('report-loader', `Timestamp ${timestamp} failed, trying next`);
                    return this._tryTimestamps(templateName, timestamps.slice(1));
                });
        }
    };
    
    // Export the module to the global scope
    window.ReportLoader = ReportLoader;
    
    debug('report-loader', 'Report Loader module initialized', ReportLoader);
    
})(window);
