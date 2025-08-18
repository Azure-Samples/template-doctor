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
  const timestamp = Date.now();
  const messages = [
    `[${new Date(timestamp).toISOString()}] Connected to job ${executionName}`,
    `[${new Date(timestamp + 1000).toISOString()}] Starting execution...`,
    `[${new Date(timestamp + 2000).toISOString()}] Job is running...`,
    `[${new Date(timestamp + 3000).toISOString()}] Processing template...`
  ];

  // If poll mode (or SSE is disabled), return JSON snapshot
  if (!wantSSE) {
    context.res = {
      status: 200,
      headers: corsHeaders(),
      body: {
        status: 'running',
        messages: messages,
        done: false,
        nextSince: String(timestamp + 3000),
        details: {
          provisioningState: 'Succeeded',
          status: 'running',
          exitCode: null,
          startTime: new Date(timestamp).toISOString(),
          endTime: null
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
    context.res.write(`event: ${event}\n`);
    context.res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    write('status', { state: 'running' });
    
    // Send mock messages
    for (const message of messages) {
      write('message', message);
      await delay(500); // Spread out messages
    }
    
    // Simulate completion
    const details = {
      provisioningState: 'Succeeded',
      status: 'Succeeded',
      exitCode: 0,
      startTime: new Date(timestamp).toISOString(),
      endTime: new Date(timestamp + 5000).toISOString()
    };
    write('status', { state: 'Succeeded', details });
    write('complete', { succeeded: true, status: 'Succeeded', details });
    
    context.res.end();
  } catch (err) {
    try { write('error', { message: err?.message || String(err) }); } catch {}
    try { context.res.end(); } catch {}
  }
};

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
