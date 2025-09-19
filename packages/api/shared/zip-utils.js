/**
 * Zip file utility functions for extracting and processing ZIP archives
 */
const yauzl = require("yauzl");
const path = require("path");

// Constants for ZIP extraction safety
const MAX_ZIP_SIZE_MB = 100; // Maximum zip file size in MB
const MAX_SINGLE_FILE_SIZE_MB = 50; // Maximum single file size in MB
const MAX_TOTAL_EXTRACTED_SIZE_MB = 500; // Maximum total uncompressed size in MB
const MAX_FILES_COUNT = 1000; // Maximum number of files to extract

/**
 * Extracts files from a ZIP archive contained in an ArrayBuffer
 * @param {ArrayBuffer} zipData - The ZIP file as an ArrayBuffer
 * @param {Object} context - Azure Functions context for logging
 * @param {string} [correlationId] - Optional ID to correlate logs across operations
 * @param {Object} [options] - Optional extraction options
 * @param {boolean} [options.returnBuffers=false] - If true, returns Buffer objects instead of UTF-8 strings
 * @param {number} [options.maxZipSizeMB=100] - Maximum allowed zip file size in MB
 * @param {number} [options.maxSingleFileSizeMB=50] - Maximum allowed size for a single file in MB
 * @param {number} [options.maxTotalSizeMB=500] - Maximum allowed total uncompressed size in MB
 * @param {number} [options.maxFileCount=1000] - Maximum number of files to extract
 * @returns {Promise<Object>} - Object containing file contents, with filenames as keys
 */
async function extractFilesFromZip(zipData, context = null, correlationId = null, options = {}) {
    const requestId = correlationId || `zip-extract-${Date.now()}`;
    
    // Apply extraction limits with defaults
    const extractionLimits = {
        maxZipSizeMB: options.maxZipSizeMB || MAX_ZIP_SIZE_MB,
        maxSingleFileSizeMB: options.maxSingleFileSizeMB || MAX_SINGLE_FILE_SIZE_MB, 
        maxTotalSizeMB: options.maxTotalSizeMB || MAX_TOTAL_EXTRACTED_SIZE_MB,
        maxFileCount: options.maxFileCount || MAX_FILES_COUNT,
        returnBuffers: options.returnBuffers || false
    };

    return new Promise((resolve, reject) => {
        // Convert ArrayBuffer to Buffer for yauzl using optimized method
        const buffer = arrayBufferToBuffer(zipData);
        const files = {};
        
        // Check zip file size limit
        const zipSizeInMB = buffer.length / (1024 * 1024);
        if (zipSizeInMB > extractionLimits.maxZipSizeMB) {
            const error = new Error(`ZIP file size exceeds maximum allowed: ${zipSizeInMB.toFixed(2)}MB > ${extractionLimits.maxZipSizeMB}MB`);
            error.code = 'ZIP_TOO_LARGE';
            error.requestId = requestId;
            
            if (context && context.log && context.log.error) {
                context.log.error(`ZIP file size exceeds maximum allowed`, {
                    operation: 'extractFilesFromZip',
                    zipSizeMB: zipSizeInMB.toFixed(2),
                    maxAllowedMB: extractionLimits.maxZipSizeMB,
                    requestId
                });
            }
            
            reject(error);
            return;
        }

        // Safe logging helper
        const safeLog = (level, message, data) => {
            if (context && context.log) {
                if (level === 'error' && context.log.error) {
                    context.log.error(message, { ...data, operation: 'extractFilesFromZip', requestId });
                } else if (level === 'warn' && context.log.warn) {
                    context.log.warn(message, { ...data, operation: 'extractFilesFromZip', requestId });
                } else {
                    context.log(message, { ...data, operation: 'extractFilesFromZip', requestId });
                }
            }
        };

        safeLog('info', `Extracting files from ZIP archive`, {
            bufferSize: buffer.length,
            zipSizeMB: (buffer.length / (1024 * 1024)).toFixed(2),
            extractionLimits
        });

        // Tracking variables for ZIP bomb protection
        let totalExtractedSize = 0;
        let fileCount = 0;

        // Use yauzl to open the zip file from the buffer
        yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
            if (err) {
                const error = new Error(`Failed to open zip file: ${err.message}`);
                error.code = err.code;
                error.requestId = requestId;
                error.cause = err; // Preserve original error

                safeLog('error', `Failed to open zip file`, {
                    error: err.message,
                    code: err.code,
                    stack: err.stack
                });

                reject(error);
                return;
            }

            zipfile.on("entry", (entry) => {
                // Check file count limit
                if (fileCount >= extractionLimits.maxFileCount) {
                    safeLog('warn', `Maximum file count reached, skipping further extraction`, {
                        fileName: entry.fileName,
                        fileCount,
                        maxFileCount: extractionLimits.maxFileCount
                    });
                    zipfile.readEntry();
                    return;
                }

                // Skip directory entries
                if (/\/$/.test(entry.fileName)) {
                    zipfile.readEntry();
                    return;
                }

                // Check single file size limit
                const fileSizeMB = entry.uncompressedSize / (1024 * 1024);
                if (fileSizeMB > extractionLimits.maxSingleFileSizeMB) {
                    safeLog('warn', `File size exceeds maximum allowed for single file, skipping`, {
                        fileName: entry.fileName,
                        fileSizeMB: fileSizeMB.toFixed(2),
                        maxAllowedMB: extractionLimits.maxSingleFileSizeMB
                    });
                    zipfile.readEntry();
                    return;
                }

                // Check if this file would exceed total extraction size limit
                if ((totalExtractedSize + entry.uncompressedSize) / (1024 * 1024) > extractionLimits.maxTotalSizeMB) {
                    safeLog('warn', `Total extracted size would exceed maximum allowed, skipping further extraction`, {
                        fileName: entry.fileName,
                        currentTotalMB: (totalExtractedSize / (1024 * 1024)).toFixed(2),
                        fileSizeMB: fileSizeMB.toFixed(2),
                        maxAllowedMB: extractionLimits.maxTotalSizeMB
                    });
                    zipfile.readEntry();
                    return;
                }

                // Sanitize the file path to prevent path traversal attacks
                let sanitizedFileName = entry.fileName;
                
                // Remove any attempt to navigate up directories
                sanitizedFileName = sanitizedFileName.replace(/\.\.\//g, '');
                sanitizedFileName = sanitizedFileName.replace(/\.\.\\/g, '');
                
                // Normalize the path (resolve .. and . segments)
                sanitizedFileName = path.normalize(sanitizedFileName).replace(/^(\.\.[\/\\])+/, '');
                
                // Read the entry
                zipfile.openReadStream(entry, (err, readStream) => {
                    if (err) {
                        safeLog('warn', `Error opening read stream for file in ZIP`, {
                            fileName: entry.fileName,
                            sanitizedFileName,
                            error: err.message
                        });
                        zipfile.readEntry();
                        return;
                    }

                    const chunks = [];
                    readStream.on("data", (chunk) => {
                        chunks.push(chunk);
                    });

                    readStream.on("end", () => {
                        const contentBuffer = Buffer.concat(chunks);
                        
                        // Update tracking variables
                        totalExtractedSize += contentBuffer.length;
                        fileCount++;
                        
                        // Store content as buffer or string based on options
                        if (extractionLimits.returnBuffers) {
                            files[sanitizedFileName] = contentBuffer;
                        } else {
                            // Try to convert to UTF-8 string, fall back to buffer if it fails
                            try {
                                files[sanitizedFileName] = contentBuffer.toString('utf8');
                            } catch (e) {
                                safeLog('warn', `Failed to convert file to UTF-8, storing as buffer`, {
                                    fileName: sanitizedFileName,
                                    error: e.message
                                });
                                files[sanitizedFileName] = contentBuffer;
                            }
                        }
                        
                        zipfile.readEntry();
                    });

                    readStream.on("error", (err) => {
                        safeLog('error', `Error reading file from ZIP`, {
                            fileName: entry.fileName,
                            sanitizedFileName,
                            error: err.message
                        });

                        zipfile.readEntry();
                    });
                });
            });

            zipfile.on("end", () => {
                safeLog('info', `ZIP extraction completed successfully`, {
                    fileCount,
                    totalExtractedSizeMB: (totalExtractedSize / (1024 * 1024)).toFixed(2),
                    extractedFileCount: Object.keys(files).length
                });
                
                resolve(files);
            });

            zipfile.on("error", (err) => {
                const error = new Error(`Error reading zip file: ${err.message}`);
                error.code = err.code;
                error.requestId = requestId;
                error.cause = err; // Preserve original error
                
                safeLog('error', `Error reading zip file`, {
                    error: err.message,
                    code: err.code,
                    stack: err.stack
                });

                reject(error);
            });

            // Start reading entries
            zipfile.readEntry();
        });
    });
}

/**
 * Creates a buffer from an ArrayBuffer with optimized memory usage
 * @param {ArrayBuffer} arrayBuffer - The array buffer to convert
 * @returns {Buffer} - Node.js Buffer sharing the same memory when possible
 */
function arrayBufferToBuffer(arrayBuffer) {
    // In Node.js versions that support it, use a more efficient conversion
    if (Buffer.from && Buffer.from !== Uint8Array.from) {
        return Buffer.from(arrayBuffer);
    }
    
    // Fallback for older Node.js versions
    const buffer = Buffer.alloc(arrayBuffer.byteLength);
    const view = new Uint8Array(arrayBuffer);
    for (let i = 0; i < buffer.length; i++) {
        buffer[i] = view[i];
    }
    return buffer;
}

module.exports = {
    extractFilesFromZip,
    arrayBufferToBuffer,
    // Export constants for use elsewhere
    MAX_ZIP_SIZE_MB,
    MAX_SINGLE_FILE_SIZE_MB,
    MAX_TOTAL_EXTRACTED_SIZE_MB,
    MAX_FILES_COUNT
};