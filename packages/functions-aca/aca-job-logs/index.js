module.exports = async function (context, req) {
  function corsHeaders() {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
  }

  if (req.method === 'OPTIONS') {
    context.res = { status: 204, headers: corsHeaders() };
    return;
  }

  const executionName = context.bindingData.executionName;
  if (!executionName) {
    context.res = { status: 400, headers: corsHeaders(), body: { error: 'executionName required' } };
    return;
  }

  // Get request parameters
  const wantSSE = (req.headers['accept'] || '').toLowerCase().includes('text/event-stream') && req.query.mode !== 'poll';
  const nextSince = req.query.since || '';
  
  // Use an in-memory store for execution logs (in a real app, this would be Redis or another cache)
  if (!global.executionLogs) {
    global.executionLogs = {};
  }
  
  // Initialize log storage for this execution if needed
  if (!global.executionLogs[executionName]) {
    global.executionLogs[executionName] = {
      status: 'running',
      logs: [],
      done: false,
      startTime: new Date().toISOString(),
      endTime: null
    };
    
    // Start the actual AZD command process for this execution
    // We'll extract the template name from the execution name (format: td-timestamp)
    const templateNameMatch = executionName.match(/^td-\d+-(.+)$/);
    const templateName = templateNameMatch ? templateNameMatch[1] : 'sample-template';
    
    // Run the command asynchronously
    runAzdCommand(executionName, templateName);
  }
  
  // Get the current execution data
  const executionData = global.executionLogs[executionName];
  
  // If polling mode, return the current logs snapshot
  if (!wantSSE) {
    // Find logs after the 'since' timestamp if provided
    let filteredLogs = executionData.logs;
    if (nextSince) {
      const sinceTime = Number(nextSince) || Date.parse(nextSince);
      filteredLogs = executionData.logs.filter(log => {
        const logTime = log.timestamp || 0;
        return logTime > sinceTime;
      }).map(log => log.message);
    } else {
      filteredLogs = executionData.logs.map(log => log.message);
    }
    
    // Get the latest timestamp
    const latestLog = executionData.logs[executionData.logs.length - 1];
    const latestTimestamp = latestLog ? (latestLog.timestamp || Date.now()) : Date.now();
    
    context.res = {
      status: 200,
      headers: corsHeaders(),
      body: {
        status: executionData.status,
        messages: filteredLogs,
        done: executionData.done,
        nextSince: String(latestTimestamp),
        details: {
          provisioningState: 'Succeeded',
          status: executionData.status,
          exitCode: executionData.exitCode,
          startTime: executionData.startTime,
          endTime: executionData.endTime
        }
      }
    };
    return;
  }
  
  // For SSE, return streaming response
  context.res = {
    status: 200,
    isRaw: true,
    headers: {
      ...corsHeaders(),
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    },
    body: undefined
  };

  const write = (event, data) => {
    context.res.write(`event: ${event}\\n`);
    context.res.write(`data: ${JSON.stringify(data)}\\n\\n`);
  };

  try {
    // Send initial status
    write('status', { state: executionData.status });
    
    // Send all existing logs first
    executionData.logs.forEach(log => {
      write('message', log.message);
    });
    
    // Then wait a bit and see if more logs come in
    let lastLogCount = executionData.logs.length;
    const maxWaitTime = 30000; // Maximum wait time (30 seconds)
    const startWait = Date.now();
    
    while (Date.now() - startWait < maxWaitTime) {
      // If the job is done, finish streaming
      if (executionData.done) {
        write('status', { 
          state: executionData.status,
          details: {
            provisioningState: 'Succeeded',
            status: executionData.status,
            exitCode: executionData.exitCode,
            startTime: executionData.startTime,
            endTime: executionData.endTime
          }
        });
        
        write('complete', { 
          succeeded: executionData.status === 'Succeeded', 
          status: executionData.status,
          details: {
            provisioningState: 'Succeeded',
            status: executionData.status,
            exitCode: executionData.exitCode,
            startTime: executionData.startTime,
            endTime: executionData.endTime
          }
        });
        break;
      }
      
      // Check if new logs have arrived
      if (executionData.logs.length > lastLogCount) {
        // Send new logs
        for (let i = lastLogCount; i < executionData.logs.length; i++) {
          write('message', executionData.logs[i].message);
        }
        lastLogCount = executionData.logs.length;
      }
      
      // Send a status update occasionally
      write('status', { 
        state: executionData.status,
        details: {
          provisioningState: 'Succeeded',
          status: executionData.status,
          exitCode: executionData.exitCode,
          startTime: executionData.startTime,
          endTime: executionData.endTime
        }
      });
      
      // Wait a bit before checking again
      await delay(1000);
    }
    
    // If we reach here and the job isn't done, end the stream anyway
    if (!executionData.done) {
      write('status', { state: 'running' });
    }
    
    context.res.end();
  } catch (err) {
    try { write('error', { message: err?.message || String(err) }); } catch {}
    try { context.res.end(); } catch {}
  }
};

async function runAzdCommand(executionName, templateName) {
  try {
    // Ensure the execution log exists
    if (!global.executionLogs) {
      global.executionLogs = {};
    }
    
    if (!global.executionLogs[executionName]) {
      global.executionLogs[executionName] = {
        status: 'running',
        logs: [],
        done: false,
        startTime: new Date().toISOString(),
        endTime: null,
        exitCode: null,
        jobName: null,
        simulation: false // Don't default to simulation - we want real Container App logs
      };
    }
    
    const execution = global.executionLogs[executionName];
    
    // Helper to add a log entry
    function addLog(message) {
      execution.logs.push({
        timestamp: Date.now(),
        message: message
      });
    }
    
    // Initial log to show we're starting
    addLog(`[${new Date().toISOString()}] Starting AZD workflow for template: ${templateName}`);
    
    // Check if this is a real container job or a simulation
    if (!execution.simulation) {
      // This is a real container job, fetch logs from Container Apps
      try {
        // Import the container app client helpers
        const { getContainerJobLogs } = require('../lib/container-app-client');
        
        // Add debug log about the execution name we're using
        addLog(`[${new Date().toISOString()}] Using execution name: ${executionName}`);
        
        // First, look for the job name format in Container Apps
        // The job name in Container Apps may have a different format than our execution name
        const containerAppJobName = process.env.ACA_JOB_NAME || 'template-doctor-job';
        let containerJobName = execution.jobName || `${containerAppJobName}-${executionName}`;
        
        addLog(`[${new Date().toISOString()}] Looking for Container App job: ${containerJobName}`);
        
        // Poll for logs periodically
        const pollingInterval = 3000; // 3 seconds
        const maxPollTime = 15 * 60 * 1000; // 15 minutes
        const startTime = Date.now();
        
        let isRunning = true;
        let lastLogCount = 0;
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 3;
        
        while (isRunning && (Date.now() - startTime < maxPollTime)) {
          try {
            // Get job logs
            const jobResult = await getContainerJobLogs(executionName);
            
            // Reset error counter on success
            consecutiveErrors = 0;
            
            // Process logs
            if (jobResult && jobResult.logs && Array.isArray(jobResult.logs)) {
              // Only process new logs
              for (let i = lastLogCount; i < jobResult.logs.length; i++) {
                const logEntry = jobResult.logs[i];
                // Format the log message
                const logTime = logEntry.time ? new Date(logEntry.time).toISOString() : new Date().toISOString();
                const logMessage = `[${logTime}] ${logEntry.message}`;
                addLog(logMessage);
              }
              lastLogCount = jobResult.logs.length;
            }
            
            // Check if job is still running
            if (jobResult.done) {
              isRunning = false;
              execution.status = jobResult.status;
              execution.done = true;
              execution.endTime = jobResult.endTime || new Date().toISOString();
              execution.exitCode = jobResult.status === 'Succeeded' ? 0 : 1;
              
              // Add final status message
              addLog(`[${new Date().toISOString()}] Container job completed with status: ${jobResult.status}`);
              
              // If failed but no logs were retrieved, add a helpful message
              if (jobResult.status === 'Failed' && lastLogCount === 0) {
                addLog(`[${new Date().toISOString()}] ERROR: Job failed but no logs were available. This may be due to a container startup issue.`);
                addLog(`[${new Date().toISOString()}] ERROR: Check your Container App configuration in the Azure portal for more details.`);
              }
            } else {
              // Job is still running, add a status update occasionally
              if (lastLogCount === 0 && (Date.now() - startTime) > 10000) {
                // If we haven't received any logs after 10 seconds, add a message
                addLog(`[${new Date().toISOString()}] Waiting for logs from container job...`);
              }
            }
          } catch (error) {
            consecutiveErrors++;
            
            // Log the error
            addLog(`[${new Date().toISOString()}] Error fetching logs: ${error.message || error}`);
            
            // If we've had too many consecutive errors, stop trying
            if (consecutiveErrors >= maxConsecutiveErrors) {
              addLog(`[${new Date().toISOString()}] Too many consecutive errors, stopping log retrieval.`);
              isRunning = false;
              execution.status = 'Failed';
              execution.done = true;
              execution.endTime = new Date().toISOString();
              execution.exitCode = 1;
              break;
            }
          }
          
          // Wait before next poll if still running
          if (isRunning) {
            await delay(pollingInterval);
          }
        }
        
        // If we timed out but the job is still running, mark it as incomplete
        if (isRunning) {
          addLog(`[${new Date().toISOString()}] Warning: Log streaming timed out after 15 minutes. The job is still running.`);
        }
      } catch (error) {
        // Log the error and fall back to simulation
        addLog(`[${new Date().toISOString()}] Error fetching Container App logs: ${error.message || error}`);
        addLog(`[${new Date().toISOString()}] Container App integration is required - please check your configuration.`);
        
        // Mark as simulation for future runs
        execution.simulation = true;
      }
    }
    
    // If this is a simulation or we failed to get real logs, throw an error
    if (execution.simulation) {
      addLog(`[${new Date().toISOString()}] ERROR: Real Container App integration is required - simulation mode is not supported.`);
      addLog(`[${new Date().toISOString()}] ERROR: Please ensure the following environment variables are set correctly:`);
      addLog(`[${new Date().toISOString()}] ERROR: - AZURE_SUBSCRIPTION_ID: Your Azure subscription ID`);
      addLog(`[${new Date().toISOString()}] ERROR: - ACA_RESOURCE_GROUP: The resource group for your Container App`);
      addLog(`[${new Date().toISOString()}] ERROR: - ACA_JOB_NAME: The name of your Container App job`);
      
      // Mark execution as failed
      execution.status = 'Failed';
      execution.done = true;
      execution.endTime = new Date().toISOString();
      execution.exitCode = 1;
      
      throw new Error('Container App integration is required - simulation mode is not supported');
    }
  } catch (error) {
    // Handle errors
    if (!global.executionLogs) {
      global.executionLogs = {};
    }
    
    const execution = global.executionLogs[executionName];
    if (execution) {
      execution.logs.push({
        timestamp: Date.now(),
        message: `[${new Date().toISOString()}] Error: ${error.message || 'Unknown error'}`
      });
      execution.status = 'Failed';
      execution.done = true;
      execution.endTime = new Date().toISOString();
      execution.exitCode = 1;
    } else {
      // If the execution doesn't exist yet, create it with error status
      global.executionLogs[executionName] = {
        status: 'Failed',
        logs: [{
          timestamp: Date.now(),
          message: `[${new Date().toISOString()}] Error: ${error.message || 'Unknown error'}`
        }],
        done: true,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        exitCode: 1,
        simulation: false
      };
    }
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
