// Custom tooltip functionality
document.addEventListener('DOMContentLoaded', function () {
  // Create tooltip element
  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  document.body.appendChild(tooltip);

  // Track mouse position
  let mouseX = 0;
  let mouseY = 0;

  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Update tooltip position if visible
    if (tooltip.classList.contains('visible')) {
      positionTooltip(mouseX, mouseY);
    }
  });

  // Detect elements with title attribute
  document.addEventListener('mouseover', function (e) {
    const target = e.target;

    // Check if element has title attribute
    if (target.hasAttribute('title') && target.title.trim() !== '') {
      // Store title content
      const titleContent = target.title;

      // Remove title attribute to prevent default browser tooltip
      target.dataset.tooltip = titleContent;
      target.removeAttribute('title');

      // Show custom tooltip
      tooltip.textContent = titleContent;
      tooltip.classList.add('visible');

      // Position tooltip
      positionTooltip(mouseX, mouseY);
    }

    // Check if element has data-tooltip attribute
    if (target.hasAttribute('data-tooltip') && target.dataset.tooltip.trim() !== '') {
      // Show custom tooltip
      tooltip.textContent = target.dataset.tooltip;
      tooltip.classList.add('visible');

      // Position tooltip
      positionTooltip(mouseX, mouseY);
    }
  });

  // Hide tooltip when mouse leaves the element
  document.addEventListener('mouseout', function (e) {
    const target = e.target;

    if (target.hasAttribute('data-tooltip')) {
      // Hide tooltip
      tooltip.classList.remove('visible');

      // If not a permanent tooltip (was converted from title), restore title attribute
      if (!target.classList.contains('has-permanent-tooltip')) {
        target.setAttribute('title', target.dataset.tooltip);
        target.removeAttribute('data-tooltip');
      }
    }
  });

  // Position tooltip relative to mouse cursor
  function positionTooltip(x, y) {
    const tooltipRect = tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Calculate tooltip position
    let tooltipX = x + 15; // Offset from cursor
    let tooltipY = y + 15;

    // Adjust position if tooltip would go off screen
    if (tooltipX + tooltipRect.width > windowWidth) {
      tooltipX = windowWidth - tooltipRect.width - 10;
    }

    if (tooltipY + tooltipRect.height > windowHeight) {
      tooltipY = y - tooltipRect.height - 10;
    }

    // Set tooltip position
    tooltip.style.left = tooltipX + 'px';
    tooltip.style.top = tooltipY + 'px';
  }
});
