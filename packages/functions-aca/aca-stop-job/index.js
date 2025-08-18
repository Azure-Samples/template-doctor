module.exports = async function (context, req) {
  function corsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
  }

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders() };
    return;
  }

  try {
    const { executionName, originalExecutionName, resourceGroup } = req.body || {};
    
    if (!executionName) {
      context.res = {
        status: 400,
        headers: corsHeaders(),
        body: { error: 'executionName is required in the request body' }
      };
      return;
    }
    
    // Extract the base execution name (without container job prefix) for in-memory cache lookup
    let cacheExecutionName = executionName;
    const containerJobPrefix = 'template-doctor-aca-job-';
    
    // If the execution name includes the container job prefix, strip it for cache lookup
    if (executionName.startsWith(containerJobPrefix)) {
      cacheExecutionName = executionName.substring(containerJobPrefix.length);
      context.log.info(`Using stripped execution name for cache lookup: ${cacheExecutionName} (from ${executionName})`);
    } else if (originalExecutionName) {
      // If the client sent the original short execution name, use that for cache lookup
      cacheExecutionName = originalExecutionName;
      context.log.info(`Using original execution name for cache lookup: ${cacheExecutionName}`);
    }
    
    // Check if we have this execution in our logs
    if (!global.executionLogs || !global.executionLogs[cacheExecutionName]) {
      context.log.warn(`Execution not found in cache: ${cacheExecutionName}`);
      
      // Since it's not in our cache, try stopping via direct Azure API call
      // This is a recovery path for when we don't have the execution in memory
      try {
        // Import the container client helpers
        const { stopContainerJob } = require('../lib/container-app-client');
        
        context.log.info(`Attempting direct stop for container job: ${executionName}`);
        
        // Try to stop using the full execution name
        await stopContainerJob(executionName);
        
        context.res = { 
          status: 200, 
          headers: corsHeaders(), 
          body: { 
            message: 'Stop job request processed via direct API call',
            executionName: executionName,
            status: 'Stopping'
          } 
        };
        return;
      } catch (directStopError) {
        context.log.error(`Error in direct stop: ${directStopError.message || directStopError}`);
        context.res = {
          status: 404,
          headers: corsHeaders(),
          body: { 
            error: 'Execution not found and direct stop failed',
            details: directStopError.message 
          }
        };
        return;
      }
    }
    
    const execution = global.executionLogs[cacheExecutionName];
    
    // Only try to stop if not already done
    if (!execution.done) {
      // If this is a real container job, try to stop it
      if (!execution.simulation && execution.jobName) {
        try {
          // Import the container client helpers
          const { stopContainerJob } = require('../lib/container-app-client');
          
          // Log the original execution name for debugging
          context.log.info(`Stopping container job with execution name: ${executionName}`);
          context.log.info(`Job name in execution object: ${execution.jobName}`);
          
          // Stop the container job
          const result = await stopContainerJob(executionName);
          
          // Update the execution status
          execution.status = result.status;
          execution.done = true;
          execution.endTime = result.endTime || new Date().toISOString();
          execution.exitCode = 1;
          
          // Add a log entry
          execution.logs.push({
            timestamp: Date.now(),
            message: `[${new Date().toISOString()}] Job stopped by user request. Status: ${result.status}`
          });
          
          context.log.info(`Stopped container job: ${execution.jobName} with status: ${result.status}`);
        } catch (error) {
          context.log.error(`Error stopping container job: ${error.message || error}`);
          
          // Add a log entry about the error
          execution.logs.push({
            timestamp: Date.now(),
            message: `[${new Date().toISOString()}] Error stopping job: ${error.message || error}`
          });
          
          // Still mark as done
          execution.status = 'Failed';
          execution.done = true;
          execution.endTime = new Date().toISOString();
          execution.exitCode = 1;
        }
      } else {
        // If simulation mode is detected, just fail
        context.log.error(`Error: Simulation mode is not supported - real Container App integration is required.`);
        
        // Add a log entry for the error
        execution.logs.push({
          timestamp: Date.now(),
          message: `[${new Date().toISOString()}] ERROR: Container App integration is required - simulation mode is not supported.`
        });
        
        // Update execution status to failed
        execution.status = 'Failed';
        execution.done = true;
        execution.endTime = new Date().toISOString();
        execution.exitCode = 1;
        
        context.res = { 
          status: 400, 
          headers: corsHeaders(), 
          body: { 
            message: 'Container App integration is required - simulation mode is not supported',
            executionName: executionName,
            status: 'Failed'
          } 
        };
        return;
      }
    } else {
      context.log.info(`Execution already completed: ${executionName} with status: ${execution.status}`);
    }
    
    // Always return success to the client
    context.res = { 
      status: 200, 
      headers: corsHeaders(), 
      body: { 
        message: 'Stop job request processed successfully',
        executionName: executionName,
        status: execution.status
      } 
    };
  } catch (err) {
    context.log.error('Error in stop-job:', err);
    context.res = { 
      status: 500, 
      headers: corsHeaders(), 
      body: { 
        message: 'Error processing stop job request',
        error: err.message
      } 
    };
  }
};
