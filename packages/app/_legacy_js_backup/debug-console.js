// Debug Console - Enhanced debugging for Template Doctor
// Add this to index.html after all other scripts

(function (window) {
  'use strict';

  // Store original console methods
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
  };

  // Create a console message container
  let consoleContainer = null;

  // Global debug function that all components can use
  window.debug = function (source, message, data) {
    const formattedSource = `[${source}]`;

    if (data !== undefined) {
      console.log(`${formattedSource} ${message}`, data);
    } else {
      console.log(`${formattedSource} ${message}`);
    }
  };

  function createConsoleContainer() {
    // Check if container already exists
    if (document.getElementById('debug-console-container')) {
      return document.getElementById('debug-console-container');
    }

    // Create container
    consoleContainer = document.createElement('div');
    consoleContainer.id = 'debug-console-container';
    consoleContainer.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 200px;
            background-color: rgba(0, 0, 0, 0.85);
            color: #fff;
            font-family: monospace;
            font-size: 12px;
            padding: 10px;
            overflow-y: auto;
            z-index: 9999;
            display: none;
            border-top: 2px solid #444;
        `;

    // Create header with controls
    const header = document.createElement('div');
    header.style.cssText = `
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        `;

    // Title
    const title = document.createElement('span');
    title.textContent = 'Debug Console';
    title.style.fontWeight = 'bold';

    // Controls
    const controls = document.createElement('div');

    // Clear button
    const clearBtn = document.createElement('button');
    clearBtn.textContent = 'Clear';
    clearBtn.style.cssText = `
            background: #333;
            color: #fff;
            border: 1px solid #555;
            padding: 2px 6px;
            margin-right: 5px;
            cursor: pointer;
        `;
    clearBtn.onclick = () => {
      const messages = consoleContainer.querySelector('.console-messages');
      if (messages) {
        messages.innerHTML = '';
      }
    };

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
            background: #333;
            color: #fff;
            border: 1px solid #555;
            padding: 2px 6px;
            cursor: pointer;
        `;
    closeBtn.onclick = () => {
      toggleConsole(false);
    };

    // Add controls to header
    controls.appendChild(clearBtn);
    controls.appendChild(closeBtn);
    header.appendChild(title);
    header.appendChild(controls);

    // Message container
    const messageContainer = document.createElement('div');
    messageContainer.className = 'console-messages';
    messageContainer.style.cssText = `
            height: calc(100% - 30px);
            overflow-y: auto;
        `;

    // Add everything to the container
    consoleContainer.appendChild(header);
    consoleContainer.appendChild(messageContainer);

    // Add to body
    document.body.appendChild(consoleContainer);

    return consoleContainer;
  }

  // Function to show/hide console
  function toggleConsole(show = true) {
    if (!consoleContainer) {
      consoleContainer = createConsoleContainer();
    }

    consoleContainer.style.display = show ? 'block' : 'none';
  }

  // Add message to console
  function addMessage(message, type = 'log') {
    if (!consoleContainer) {
      consoleContainer = createConsoleContainer();
    }

    const messageContainer = consoleContainer.querySelector('.console-messages');

    const messageElement = document.createElement('div');
    messageElement.className = `console-message console-${type}`;

    // Style based on type
    let color = '#fff';
    switch (type) {
      case 'error':
        color = '#ff5555';
        break;
      case 'warn':
        color = '#ffbb33';
        break;
      case 'debug':
        color = '#88ddff';
        break;
      case 'info':
        color = '#77ff77';
        break;
      default:
        color = '#fff';
    }

    messageElement.style.cssText = `
            margin: 2px 0;
            color: ${color};
            border-bottom: 1px solid #333;
            padding-bottom: 3px;
        `;

    // Format timestamp
    const timestamp = new Date().toISOString().replace('T', ' ').substr(0, 19);

    // Format message
    let formatted;
    if (typeof message === 'string') {
      formatted = message;
    } else {
      try {
        formatted = JSON.stringify(message, null, 2);
      } catch (e) {
        formatted = String(message);
      }
    }

    messageElement.innerHTML = `<span style="color: #888;">[${timestamp}][${type}]</span> ${formatted}`;
    messageContainer.appendChild(messageElement);

    // Auto-scroll to bottom
    messageContainer.scrollTop = messageContainer.scrollHeight;
  }

  // Override console methods
  console.log = function () {
    // Call original method
    originalConsole.log.apply(console, arguments);

    // Add to our console
    const args = Array.from(arguments)
      .map((arg) => String(arg))
      .join(' ');
    addMessage(args, 'log');
  };

  console.error = function () {
    // Call original method
    originalConsole.error.apply(console, arguments);

    // Add to our console
    const args = Array.from(arguments)
      .map((arg) => String(arg))
      .join(' ');
    addMessage(args, 'error');
  };

  console.warn = function () {
    // Call original method
    originalConsole.warn.apply(console, arguments);

    // Add to our console
    const args = Array.from(arguments)
      .map((arg) => String(arg))
      .join(' ');
    addMessage(args, 'warn');
  };

  // Add keyboard shortcut
  document.addEventListener('keydown', function (e) {
    // Alt + D to toggle console
    if (e.altKey && e.key === 'd') {
      toggleConsole(consoleContainer?.style.display !== 'block');
    }
  });

  // Add console toggle button
  const toggleButton = document.createElement('button');
  toggleButton.textContent = 'Debug';
  toggleButton.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.7);
        color: #fff;
        border: 1px solid #555;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 12px;
        z-index: 9998;
    `;
  toggleButton.onclick = () => {
    toggleConsole(consoleContainer?.style.display !== 'block');
  };

  // Add button after DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(toggleButton);
    });
  } else {
    document.body.appendChild(toggleButton);
  }

  // Log initialization
  console.log('[debug-console] Debug console initialized. Press Alt+D to toggle');
})(window);
