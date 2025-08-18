module.exports = async function (context, req) {
  function corsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
  }

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders() };
    return;
  }

  try {
    // Get execution name from route parameter or query string
    let executionName = context.bindingData.executionName;
    if (!executionName && req.body) {
      executionName = req.body.executionName;
    }
    if (!executionName) {
      executionName = req.query.executionName;
    }
    
    if (!executionName) {
      context.res = {
        status: 400,
        headers: corsHeaders(),
        body: { error: 'executionName is required in the route, query string, or request body' }
      };
      return;
    }
    
    // This is a debugging endpoint to check the status of a container app job
    context.log.info(`Checking status for execution: ${executionName}`);
    
    // Import the container app client helpers
    const { getContainerAppClient } = require('../lib/container-app-client');
    
    // Get environment variables
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    const resourceGroupName = process.env.ACA_RESOURCE_GROUP;
    const containerAppJobName = process.env.ACA_JOB_NAME || 'template-doctor-job';
    
    if (!subscriptionId || !resourceGroupName) {
      throw new Error('Missing required environment variables: AZURE_SUBSCRIPTION_ID, ACA_RESOURCE_GROUP');
    }
    
    // Get the client
    const client = await getContainerAppClient();
    
    // Find the actual job execution name if we have it in memory
    let actualJobExecutionName = null;
    
    // For debugging, if we have this in our global executionLogs, add that info
    let memoryInfo = null;
    if (global.executionLogs && global.executionLogs[executionName]) {
      const execInfo = global.executionLogs[executionName];
      memoryInfo = {
        status: execInfo.status,
        jobName: execInfo.jobName,
        startTime: execInfo.startTime,
        endTime: execInfo.endTime,
        done: execInfo.done,
        logCount: execInfo.logs ? execInfo.logs.length : 0,
        latestLog: execInfo.logs && execInfo.logs.length > 0 ? 
          execInfo.logs[execInfo.logs.length - 1].message : null
      };
      
      if (execInfo.jobName) {
        actualJobExecutionName = execInfo.jobName;
        context.log.info(`Found actual job name in memory: ${actualJobExecutionName}`);
      }
    }
    
    // Use the list method to get all job executions
    const results = [];
    try {
      // Get the jobs client - we'll be using list() method
      const jobExecutionsClient = client.jobsExecutions || client.containerJobExecutions || client.jobs || null;
      
      if (!jobExecutionsClient || typeof jobExecutionsClient.list !== 'function') {
        throw new Error('Could not find job executions client with list method');
      }
      
      // Get list of all job executions
      const allExecutions = await jobExecutionsClient.list(
        resourceGroupName,
        containerAppJobName
      );
      
      if (allExecutions && allExecutions.value && Array.isArray(allExecutions.value)) {
        context.log.info(`Found ${allExecutions.value.length} total job executions`);
        
        // First try to find the execution using the actual name if we have it
        if (actualJobExecutionName) {
          const matchingExecution = allExecutions.value.find(e => e.name === actualJobExecutionName);
          
          if (matchingExecution) {
            context.log.info(`Found job execution with name from memory: ${matchingExecution.name}`);
            results.push({
              name: matchingExecution.name,
              status: matchingExecution.properties?.status || 'Unknown',
              startTime: matchingExecution.properties?.startTime,
              endTime: matchingExecution.properties?.endTime,
              provisioning: matchingExecution.properties?.provisioningState,
              found: true,
              errorMsg: null
            });
          } else {
            context.log.warn(`Could not find job execution with name from memory: ${actualJobExecutionName}`);
          }
        }
        
        // If we still don't have results, get the most recent job execution
        if (results.length === 0) {
          // Sort by start time (newest first)
          allExecutions.value.sort((a, b) => {
            const aTime = a.properties?.startTime ? new Date(a.properties.startTime).getTime() : 0;
            const bTime = b.properties?.startTime ? new Date(b.properties.startTime).getTime() : 0;
            return bTime - aTime;
          });
          
          const mostRecent = allExecutions.value[0];
          if (mostRecent) {
            results.push({
              name: mostRecent.name,
              status: mostRecent.properties?.status || 'Unknown',
              startTime: mostRecent.properties?.startTime,
              endTime: mostRecent.properties?.endTime,
              provisioning: mostRecent.properties?.provisioningState,
              found: true,
              isMostRecent: true,
              errorMsg: null
            });
            
            // Update global state with the actual job name for future reference
            if (global.executionLogs && global.executionLogs[executionName]) {
              global.executionLogs[executionName].jobName = mostRecent.name;
              context.log.info(`Stored job name ${mostRecent.name} in memory for execution ${executionName}`);
            }
          }
        }
      } else {
        context.log.warn('No job executions found or unexpected response format');
      }
    } catch (error) {
      context.log.error(`Error getting job executions: ${error.message}`);
      results.push({
        name: 'error',
        status: null,
        found: false,
        errorMsg: `Error: ${error.message}`
      });
    }
    
    // Return the results
    context.res = {
      status: 200,
      headers: corsHeaders(),
      body: {
        executionName,
        containerAppJobName,
        results,
        memoryInfo
      }
    };
  } catch (err) {
    context.log.error('Error in aca-job-status:', err);
    context.res = {
      status: 500,
      headers: corsHeaders(),
      body: { error: err.message }
    };
  }
};
