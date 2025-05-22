
/**
 * photographer-dashboard-table-expansion.js
 * Adds row expansion to dashboard tables
 */

const DashboardTableExpansion = {
  // Track which rows are expanded
  expandedRows: new Set(),
  
  // Initialize the expansion system
  init() {
    console.log('Dashboard Table Expansion initializing...');
    
    // Wait a bit for the subscription manager to load the table
    setTimeout(() => {
      this.watchForTable();
    }, 1000);
  },
  
  // Watch for when the table gets created
  // Watch for when the table gets created OR recreated
  watchForTable() {
    // Use MutationObserver to watch for table changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        // Check if new table rows were added
        if (mutation.type === 'childList') {
          const table = document.querySelector('.plans-table');
          if (table && !table.hasAttribute('data-expansion-enhanced')) {
            console.log('Table recreated! Re-adding expansion controls...');
            this.addExpansionToTable(table);
          }
        }
      });
    });
    
    // Watch the plans container for changes
    const plansContainer = document.getElementById('plansContainer');
    if (plansContainer) {
      observer.observe(plansContainer, {
        childList: true,
        subtree: true
      });
    }
    
    // Also check initially
    const checkInterval = setInterval(() => {
      const table = document.querySelector('.plans-table');
      if (table && !table.hasAttribute('data-expansion-enhanced')) {
        console.log('Table found! Adding expansion controls...');
        this.addExpansionToTable(table);
        clearInterval(checkInterval);
      }
    }, 500);
    
    // Stop checking after 10 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
    }, 10000);
  },
  
  // Update addExpansionToTable to mark table as enhanced
  addExpansionToTable(table) {
    // Mark table as enhanced to avoid duplicate processing
    table.setAttribute('data-expansion-enhanced', 'true');
    
    const rows = table.querySelectorAll('tbody tr');
    
    rows.forEach((row, index) => {
      // Skip if this row already has expansion
      if (row.querySelector('.expand-btn')) {
        return;
      }
      
      const planId = `plan_${index}`;
      
      // Add chevron button to this row
      this.addChevronButton(row, planId);
      
      // Create expansion row after this row
      const expansionRow = this.createExpansionRow(planId);
      row.parentNode.insertBefore(expansionRow, row.nextSibling);
    });
  },
  
  // Add chevron button to a row
  addChevronButton(row, planId) {
    const actionsCell = row.querySelector('.plan-actions-cell');
    if (!actionsCell) return;
    
    // Create chevron button
    const chevronBtn = document.createElement('button');
    chevronBtn.className = 'expand-btn';
    chevronBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    chevronBtn.onclick = () => this.toggleExpansion(planId);
    
    // Add to beginning of actions cell
    actionsCell.insertBefore(chevronBtn, actionsCell.firstChild);
  },
  
  // Create expansion row
  createExpansionRow(planId) {
    const expansionRow = document.createElement('tr');
    expansionRow.className = 'expansion-row';
    expansionRow.setAttribute('data-plan-id', planId);
    
    expansionRow.innerHTML = `
      <td colspan="6" class="expansion-content">
        <div style="text-align: center; padding: 2rem; color: #666;">
          <i class="fas fa-check-circle" style="color: green; margin-right: 0.5rem;"></i>
          Expansion working! Plan ID: ${planId}
          <br><small>Content will be added here in next steps</small>
        </div>
      </td>
    `;
    
    return expansionRow;
  },
  
  // Toggle row expansion
  toggleExpansion(planId) {
    const expansionRow = document.querySelector(`[data-plan-id="${planId}"]`);
    const chevronBtn = document.querySelector(`[onclick*="${planId}"]`);
    
    if (!expansionRow || !chevronBtn) return;
    
    if (this.expandedRows.has(planId)) {
      // Collapse
      expansionRow.classList.remove('active');
      chevronBtn.classList.remove('expanded');
      this.expandedRows.delete(planId);
      
      setTimeout(() => {
        expansionRow.style.display = 'none';
      }, 300);
    } else {
      // Expand
      expansionRow.style.display = 'table-row';
      setTimeout(() => {
        expansionRow.classList.add('active');
        chevronBtn.classList.add('expanded');
      }, 10);
      this.expandedRows.add(planId);
    }
  }
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
  // Wait for other scripts to load first
  setTimeout(() => {
    DashboardTableExpansion.init();
  }, 2000);
});

// Make it available globally
window.DashboardTableExpansion = DashboardTableExpansion;
