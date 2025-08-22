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
      endTime: null,
      pollCount: 0,
      lastPollTime: null,
      lastLogTimestamp: null
    };
    
    // Start the container job log retrieval for this execution
    // We'll fetch logs from Container Apps and stream them back
    fetchContainerJobLogs(executionName);
  }
  
  // Get the current execution data
  const executionData = global.executionLogs[executionName];
  
  // Record this poll request
  executionData.pollCount = (executionData.pollCount || 0) + 1;
  executionData.lastPollTime = new Date().toISOString();
  
  // If polling mode, return the current logs snapshot
  if (!wantSSE) {
    // Find logs after the 'since' timestamp if provided
    let filteredLogs = executionData.logs;
    if (nextSince) {
      const sinceTime = Number(nextSince) || Date.parse(nextSince);
      filteredLogs = executionData.logs.filter(log => {
        const logTime = log.timestamp || 0;
        return logTime > sinceTime;
      });
    }
    
    // Format logs for response
    const messages = filteredLogs.map(log => log.message);
    
    // Get the latest timestamp
    const latestLog = executionData.logs[executionData.logs.length - 1];
    const latestTimestamp = latestLog ? (latestLog.timestamp || Date.now()) : Date.now();
    
    context.res = {
      status: 200,
      headers: corsHeaders(),
      body: {
        status: executionData.status,
        messages,
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
    for (const log of executionData.logs) {
      write('message', log.message);
    }
    
    // Then wait a bit and see if more logs come in
    let lastLogCount = executionData.logs.length;
    const maxWaitTime = 300000; // Maximum wait time (5 minutes)
    const startWait = Date.now();
    let lastStatusUpdate = Date.now();
    
    while (Date.now() - startWait < maxWaitTime) {
      // If the job is done, finish streaming after sending any final logs
      if (executionData.done) {
        // Check for any final logs
        if (executionData.logs.length > lastLogCount) {
          // Send new logs
          for (let i = lastLogCount; i < executionData.logs.length; i++) {
            write('message', executionData.logs[i].message);
          }
        }
        
        // Send final status
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
      } else if (Date.now() - lastStatusUpdate > 10000) {
        // Send a status update every 10 seconds if no new logs
        write('status', { 
          state: executionData.status,
          details: {
            provisioningState: 'Succeeded',
            status: executionData.status,
            startTime: executionData.startTime
          }
        });
        
        // Send a keepalive message
        write('keepalive', { timestamp: Date.now() });
        
        lastStatusUpdate = Date.now();
      }
      
      // Wait a bit before checking again
      await delay(1000);
      
      // Trigger a new fetch operation if it's been more than 5 seconds since the last fetch
      if (executionData.lastFetchTime && (Date.now() - executionData.lastFetchTime > 5000)) {
        // Kick off another fetch operation (non-blocking)
        fetchContainerJobLogs(executionName);
      }
    }
    
    // If we reach here and the job isn't done, end the stream anyway
    if (!executionData.done) {
      write('status', { 
        state: 'running', 
        message: 'Log streaming timed out after 5 minutes, but the job is still running.' 
      });
    }
    
    context.res.end();
  } catch (err) {
    try { write('error', { message: err?.message || String(err) }); } catch {}
    try { context.res.end(); } catch {}
  }
};

/**
 * Function to fetch logs from the container job
 * This runs in the background and populates the global.executionLogs object
 * @param {string} executionName The execution name
 */
async function fetchContainerJobLogs(executionName) {
  // Mark the last fetch time
  if (!global.executionLogs) {
    global.executionLogs = {};
  }
  
  if (!global.executionLogs[executionName]) {
    global.executionLogs[executionName] = {
      status: 'running',
      logs: [],
      done: false,
      startTime: new Date().toISOString(),
      endTime: null
    };
  }
  
  global.executionLogs[executionName].lastFetchTime = Date.now();
  
  try {
    // Import the container app client helpers
    const { getContainerJobLogs } = require('../lib/container-app-client');
    
    // Get logs from the Container App
    console.log(`Fetching logs for execution ${executionName}`);
    const jobResult = await getContainerJobLogs(executionName);
    
    // If the job is done, mark it as such
    if (jobResult.done) {
      global.executionLogs[executionName].status = jobResult.status;
      global.executionLogs[executionName].done = true;
      global.executionLogs[executionName].endTime = jobResult.endTime || new Date().toISOString();
      global.executionLogs[executionName].exitCode = jobResult.status === 'Succeeded' ? 0 : 1;
      
      // Add a final log message if there are no logs yet
      if (!jobResult.logs || jobResult.logs.length === 0) {
        global.executionLogs[executionName].logs.push({
          timestamp: Date.now(),
          message: `[${new Date().toISOString()}] Container job completed with status: ${jobResult.status}`
        });
        
        if (jobResult.status === 'Failed') {
          global.executionLogs[executionName].logs.push({
            timestamp: Date.now(),
            message: `[${new Date().toISOString()}] ERROR: Job failed but no logs were available. Check Azure portal for details.`
          });
        }
      }
    }
    
    // If we have any new logs from the client, add them to our global log storage
    if (jobResult.logs && Array.isArray(jobResult.logs) && jobResult.logs.length > 0) {
      // Don't add duplicate logs - check if we already have these logs
      const newLogs = jobResult.logs.filter(log => {
        // Use the log message for deduplication since timestamp might change
        return !global.executionLogs[executionName].logs.some(
          existingLog => existingLog.message === log.message
        );
      });
      
      if (newLogs.length > 0) {
        console.log(`Adding ${newLogs.length} new logs for execution ${executionName}`);
        global.executionLogs[executionName].logs.push(...newLogs);
      } else {
        console.log(`No new logs to add for execution ${executionName}`);
      }
    }
    
    // Schedule the next fetch if the job is still running
    if (!global.executionLogs[executionName].done) {
      setTimeout(() => {
        fetchContainerJobLogs(executionName).catch(err => {
          console.error(`Error in scheduled fetchContainerJobLogs: ${err.message}`);
        });
      }, 5000); // Fetch every 5 seconds
    }
  } catch (error) {
    console.error(`Error fetching container job logs: ${error.message}`);
    
    // Add the error to the logs
    global.executionLogs[executionName].logs.push({
      timestamp: Date.now(),
      message: `[${new Date().toISOString()}] Error fetching logs: ${error.message}`
    });
    
    // Keep trying if there's an error
    setTimeout(() => {
      fetchContainerJobLogs(executionName).catch(err => {
        console.error(`Error in retry fetchContainerJobLogs: ${err.message}`);
      });
    }, 10000); // Wait a bit longer after an error
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
