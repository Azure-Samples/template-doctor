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
    
    // Try different formats for the execution name
    let jobNames = [];
    
    // Format 1: Original execution name (td-timestamp-template)
    jobNames.push(executionName);
    
    // Format 2: Container App Job Name prefix (template-doctor-job-executionName)
    if (!executionName.startsWith(containerAppJobName + '-')) {
      jobNames.push(`${containerAppJobName}-${executionName}`);
    }
    
    // Format 3: Container App Job with template-doctor-aca-job prefix
    if (!executionName.startsWith('template-doctor-aca-job-')) {
      jobNames.push(`template-doctor-aca-job-${executionName}`);
    }
    
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
    }
    
    // Try each job name format
    const results = [];
    
    for (const jobName of jobNames) {
      try {
        context.log.info(`Trying to get status for job: ${jobName}`);
        const execution = await client.containerJobExecutions.get(
          resourceGroupName,
          containerAppJobName,
          jobName
        );
        
        results.push({
          name: jobName,
          status: execution.properties.status,
          startTime: execution.properties.startTime,
          endTime: execution.properties.endTime,
          provisioning: execution.properties.provisioningState,
          found: true,
          errorMsg: null
        });
      } catch (error) {
        results.push({
          name: jobName,
          status: null,
          found: false,
          errorMsg: error.message
        });
      }
    }
    
    // Return the results
    context.res = {
      status: 200,
      headers: corsHeaders(),
      body: {
        executionName,
        containerAppJobName,
        jobNames,
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
