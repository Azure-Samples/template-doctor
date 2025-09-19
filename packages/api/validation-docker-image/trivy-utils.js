/**
 * Trivy scanner utility functions for processing scan results and calculating security scores
 */
const { extractFilesFromZip } = require('../shared/zip-utils');

/**
 * Processes Trivy scan results to extract detailed information about vulnerabilities, 
 * misconfigurations, secrets, and license issues
 * @param {Object} trivyResults - Parsed Trivy results from extractTrivyResults
 * @returns {Object} - Detailed analysis of the scan results
 */
function processTrivyResultsDetails(trivyResults, includeAllDetails = false) {
    // Aggregated counters for overall summary
    let totalMisconfigurations = 0;
    let criticalMisconfigurations = 0;
    let highMisconfigurations = 0;
    let mediumMisconfigurations = 0;
    let lowMisconfigurations = 0;
    let misconfigurationDetails = [];

    // Count vulnerabilities
    let totalVulnerabilities = 0;
    let criticalVulns = 0;
    let highVulns = 0;
    let mediumVulns = 0;
    let lowVulns = 0;
    let vulnerabilityDetails = [];

    // Count secrets and licenses
    let secretsFound = 0;
    let licenseIssues = 0;
    let secretDetails = [];
    let licenseDetails = [];

    // Create an object to store per-artifact results
    const artifactResults = {};

    // Analyze each Trivy result file for security issues
    for (const [filename, result] of Object.entries(trivyResults)) {
        // Initialize per-artifact counters and metadata
        const artifactInfo = {
            filename,
            artifactName: result.ArtifactName || 'unknown',
            artifactType: result.ArtifactType || 'unknown',
            imageId: '',
            repository: '',
            tag: '',
            digest: '',
            metadata: {},
            os: {
                family: '',
                name: '',
                version: ''
            },
            vulnerabilities: {
                total: 0,
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                details: []
            },
            misconfigurations: {
                total: 0,
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                details: []
            },
            secrets: {
                count: 0,
                details: []
            },
            licenses: {
                count: 0,
                details: []
            }
        };

        // Extract image metadata if available
        if (result.Metadata && includeAllDetails) {
            artifactInfo.metadata = result.Metadata;

            // Size info
            if (result.Metadata.Size) {
                artifactInfo.size = result.Metadata.Size;
            }

            // OS info
            if (result.Metadata.OS) {
                artifactInfo.os.family = result.Metadata.OS.Family || '';
                artifactInfo.os.name = result.Metadata.OS.Name || '';
                artifactInfo.os.version = result.Metadata.OS.Version || '';
            }

            // Image repository/tag info (from name or repo fields)
            if (result.Metadata.ImageID) {
                artifactInfo.imageId = result.Metadata.ImageID;
            }
            if (result.Metadata.RepoDigests && result.Metadata.RepoDigests.length > 0) {
                const digestParts = result.Metadata.RepoDigests[0].split('@');
                if (digestParts.length > 0) {
                    artifactInfo.repository = digestParts[0].split(':')[0];
                    artifactInfo.digest = digestParts.length > 1 ? digestParts[1] : '';
                }
            }
            if (result.Metadata.RepoTags && result.Metadata.RepoTags.length > 0) {
                const tagParts = result.Metadata.RepoTags[0].split(':');
                artifactInfo.repository = artifactInfo.repository || tagParts[0];
                artifactInfo.tag = tagParts.length > 1 ? tagParts[1] : 'latest';
            }
        }

        if (result.Results) {

            for (const scanResult of result.Results) {
                // Process misconfigurations
                if (scanResult.MisconfSummary) {
                    if (scanResult.MisconfSummary.Failures) {
                        totalMisconfigurations += scanResult.MisconfSummary.Failures;
                        artifactInfo.misconfigurations.total += scanResult.MisconfSummary.Failures;
                    }
                }

                if (scanResult.Misconfigurations && Array.isArray(scanResult.Misconfigurations)) {
                    for (const misconfig of scanResult.Misconfigurations) {
                        if (misconfig.Severity === 'CRITICAL') {
                            criticalMisconfigurations++;
                            artifactInfo.misconfigurations.critical++;
                        } else if (misconfig.Severity === 'HIGH') {
                            highMisconfigurations++;
                            artifactInfo.misconfigurations.high++;
                        } else if (misconfig.Severity === 'MEDIUM') {
                            mediumMisconfigurations++;
                            artifactInfo.misconfigurations.medium++;
                        } else if (misconfig.Severity === 'LOW') {
                            lowMisconfigurations++;
                            artifactInfo.misconfigurations.low++;
                        }

                        // Create misconfiguration detail object
                        const misconfigDetail = {
                            id: misconfig.ID,
                            title: misconfig.Title,
                            severity: misconfig.Severity,
                            target: scanResult.Target || misconfig.FilePath || 'unknown',
                            type: scanResult.Type || misconfig.Type || 'unknown',
                            message: misconfig.Message || 'No message provided',
                            resolution: misconfig.Resolution || 'No resolution provided'
                        };

                        // Add to global and per-artifact lists
                        if(includeAllDetails){
                            misconfigurationDetails.push(misconfigDetail);
                            artifactInfo.misconfigurations.details.push(misconfigDetail);
                        }
                    }
                }

                // Process vulnerabilities
                if (scanResult.Vulnerabilities && Array.isArray(scanResult.Vulnerabilities)) {
                    for (const vuln of scanResult.Vulnerabilities) {
                        totalVulnerabilities++;
                        artifactInfo.vulnerabilities.total++;

                        if (vuln.Severity === 'CRITICAL') {
                            criticalVulns++;
                            artifactInfo.vulnerabilities.critical++;
                        } else if (vuln.Severity === 'HIGH') {
                            highVulns++;
                            artifactInfo.vulnerabilities.high++;
                        } else if (vuln.Severity === 'MEDIUM') {
                            mediumVulns++;
                            artifactInfo.vulnerabilities.medium++;
                        } else if (vuln.Severity === 'LOW') {
                            lowVulns++;
                            artifactInfo.vulnerabilities.low++;
                        }

                        // Create vulnerability detail object
                        const vulnDetail = {
                            id: vuln.VulnerabilityID,
                            package: vuln.PkgName,
                            installedVersion: vuln.InstalledVersion,
                            fixedVersion: vuln.FixedVersion || 'Not available',
                            severity: vuln.Severity,
                            title: vuln.Title || 'N/A',
                            description: vuln.Description || 'N/A',
                            target: scanResult.Target || 'unknown'
                        };

                        // Add critical and high vulnerabilities to global details
                        if (vuln.Severity === 'CRITICAL' || vuln.Severity === 'HIGH') {
                            if(includeAllDetails){
                                vulnerabilityDetails.push(vulnDetail);
                            }
                        }

                        // Add all vulnerabilities to per-artifact details
                        if(includeAllDetails){
                            artifactInfo.vulnerabilities.details.push(vulnDetail);
                        }
                    }
                }

                // Process secrets
                if (scanResult.Secrets && Array.isArray(scanResult.Secrets)) {
                    secretsFound += scanResult.Secrets.length;
                    artifactInfo.secrets.count += scanResult.Secrets.length;

                    for (const secret of scanResult.Secrets) {
                        const secretDetail = {
                            category: secret.Category || 'Unknown',
                            title: secret.Title || 'Secret found',
                            target: scanResult.Target || secret.FilePath || 'unknown',
                            match: secret.Match ? secret.Match.substring(0, 10) + '...' : 'Hidden'
                        };

                        if(includeAllDetails){
                            secretDetails.push(secretDetail);
                            artifactInfo.secrets.details.push(secretDetail);
                        }
                    }
                }

                // Process license issues
                if (scanResult.Licenses && Array.isArray(scanResult.Licenses)) {
                    for (const license of scanResult.Licenses) {
                        if (license.Severity) {
                            licenseIssues++;
                            artifactInfo.licenses.count++;

                            const licenseDetail = {
                                pkgName: license.PkgName || 'Unknown',
                                license: license.Name || 'Unknown license',
                                severity: license.Severity || 'UNKNOWN',
                                target: scanResult.Target || 'unknown'
                            };

                            if(includeAllDetails){
                                licenseDetails.push(licenseDetail);
                                artifactInfo.licenses.details.push(licenseDetail);
                            }
                        }
                    }
                }
            }
        }

        // Store the artifact results
        artifactResults[filename] = artifactInfo;
    }

    // Find the primary artifact if there are multiple results
    // This function selects the most relevant artifact based on type priority
    const selectPrimaryArtifact = (artifacts) => {
        // If no artifacts, return null
        const artifactKeys = Object.keys(artifacts);
        if (artifactKeys.length === 0) {
            return null;
        }
        
        // Priority order for artifact types
        const priorityTypes = ['container', 'image', 'filesystem', 'repository'];
        
        // First, try to find artifacts by priority type
        for (const artifactType of priorityTypes) {
            const matchingKey = artifactKeys.find(key => 
                artifacts[key].artifactType === artifactType
            );
            
            if (matchingKey) {
                return artifacts[matchingKey];
            }
        }
        
        // If no priority matches found, return the first artifact
        return artifacts[artifactKeys[0]];
    };
    
    const primaryArtifact = selectPrimaryArtifact(artifactResults);

    // Return the processed results
    return {
        // Summary counters
        totalMisconfigurations,
        criticalMisconfigurations,
        highMisconfigurations,
        mediumMisconfigurations,
        lowMisconfigurations,
        misconfigurationDetails,
        totalVulnerabilities,
        criticalVulns,
        highVulns,
        mediumVulns,
        lowVulns,
        vulnerabilityDetails,
        secretsFound,
        licenseIssues,
        secretDetails,
        licenseDetails,

        // Artifact information
        artifacts: artifactResults,

        // Primary artifact information (if available)
        artifactName: primaryArtifact ? primaryArtifact.artifactName : '',
        artifactType: primaryArtifact ? primaryArtifact.artifactType : '',
        imageId: primaryArtifact ? primaryArtifact.imageId : '',
        repository: primaryArtifact ? primaryArtifact.repository : '',
        tag: primaryArtifact ? primaryArtifact.tag : '',
        digest: primaryArtifact ? primaryArtifact.digest : '',
        os: primaryArtifact ? primaryArtifact.os : { family: '', name: '', version: '' }
    };
}

/**
 * Extracts Trivy results from ZIP archive containing scan results
 * @param {Object} context - Azure Functions context for logging
 * @param {ArrayBuffer} zipData - The ZIP file as an ArrayBuffer
 * @param {string} [correlationId] - Optional ID to correlate logs across operations
 * @param {Object} [options] - Optional processing options
 * @param {number} [options.chunkSize=50] - Number of files to process in each chunk
 * @param {number} [options.maxFileSize=10485760] - Maximum file size to process (in bytes, default 10MB)
 * @returns {Promise<Object>} - Parsed Trivy results
 */
async function extractTrivyResults(context, zipData, correlationId = null, options = {}) {
    const requestId = correlationId || `trivy-extract-${Date.now()}`;
    const chunkSize = options.chunkSize || 50; // Process 50 files at a time by default
    const maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB default size limit
    
    // Safe logging helper for consistent logging structure
    const safeLog = (level, message, data = {}) => {
        const logData = {
            ...data,
            operation: 'extractTrivyResults',
            requestId
        };

        if (level === 'error' && context?.log?.error) {
            context.log.error(message, logData);
        } else if (level === 'warn' && context?.log?.warn) {
            context.log.warn(message, logData);
        } else if (context?.log) {
            context.log(message, logData);
        }
    };
    
    try {
        // Validate input
        if (!zipData || !(zipData instanceof ArrayBuffer)) {
            throw new Error('Invalid zip data provided: must be an ArrayBuffer');
        }
        
        const files = await extractFilesFromZip(zipData, context, correlationId);
        const fileEntries = Object.entries(files);
        const fileCount = fileEntries.length;
        
        safeLog('info', `Extracted ${fileCount} files from ZIP archive`, { fileCount });

        // Look for Trivy results files in the extracted files
        const trivyResults = {};
        const jsonFiles = fileEntries.filter(([filename]) => filename.endsWith('.json'));
        
        // Process files in chunks to avoid memory issues with large datasets
        for (let i = 0; i < jsonFiles.length; i += chunkSize) {
            const startTime = Date.now();
            const chunk = jsonFiles.slice(i, i + chunkSize);
            const chunkNumber = Math.floor(i / chunkSize) + 1;
            const totalChunks = Math.ceil(jsonFiles.length / chunkSize);
            
            safeLog('info', `Processing JSON files chunk ${chunkNumber}/${totalChunks}`, {
                chunkNumber,
                totalChunks,
                chunkSize: chunk.length,
                startIndex: i,
                endIndex: Math.min(i + chunkSize - 1, jsonFiles.length - 1)
            });
            
            // Process each file in the chunk
            for (const [filename, content] of chunk) {
                // Skip oversized files
                if (typeof content === 'string' && content.length > maxFileSize) {
                    safeLog('warn', `Skipping oversized JSON file`, {
                        filename,
                        size: content.length,
                        maxSize: maxFileSize
                    });
                    continue;
                }
                
                // Handle both string and Buffer content types
                try {
                    let parsed;
                    if (typeof content === 'string') {
                        parsed = JSON.parse(content);
                    } else if (Buffer.isBuffer(content)) {
                        parsed = JSON.parse(content.toString('utf8'));
                    } else {
                        throw new Error(`Unexpected content type: ${typeof content}`);
                    }
                    
                    trivyResults[filename] = parsed;
                } catch (parseErr) {
                    safeLog('warn', `Failed to parse JSON from ${filename}`, {
                        error: parseErr.message,
                        filename
                    });
                }
            }
            
            const chunkDuration = Date.now() - startTime;
            safeLog('info', `Completed chunk ${chunkNumber}/${totalChunks}`, {
                chunkNumber,
                durationMs: chunkDuration,
                filesProcessed: chunk.length
            });
        }

        const validCount = Object.keys(trivyResults).length;
        safeLog('info', `Found ${validCount} valid Trivy result files`, { validCount });
        
        return trivyResults;
    } catch (err) {
        safeLog('error', `Error extracting Trivy results`, {
            error: err.message,
            errorType: err.constructor.name
        });
        
        // Avoid exposing full stack traces in production
        if (process.env.NODE_ENV === 'development') {
            safeLog('error', 'Error stack trace', { stack: err.stack });
        }
        
        throw new Error(`Failed to extract Trivy results: ${err.message}`);
    }
}

module.exports = {
    extractTrivyResults,
    processTrivyResultsDetails
};
