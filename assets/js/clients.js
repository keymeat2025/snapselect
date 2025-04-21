document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const createClientBtn = document.getElementById('createClientBtn');
  const clientModal = document.getElementById('clientModal');
  const closeClientModal = document.getElementById('closeClientModal');
  const cancelClientModal = document.getElementById('cancelClientModal');
  const saveClient = document.getElementById('saveClient');
  const clientName = document.getElementById('clientName');
  const clientEmail = document.getElementById('clientEmail');
  const clientPhone = document.getElementById('clientPhone');
  const assignNow = document.getElementById('assignNow');
  const createAccess = document.getElementById('createAccess');
  
  const assignmentModal = document.getElementById('assignmentModal');
  const closeAssignModal = document.getElementById('closeAssignModal');
  const cancelAssignment = document.getElementById('cancelAssignment');
  const confirmAssignmentBtn = document.getElementById('confirmAssignmentBtn');
  const confirmAssignment = document.getElementById('confirmAssignment');
  const assignClientName = document.getElementById('assignClientName');
  
  const searchClients = document.getElementById('searchClients');
  const statusFilter = document.getElementById('statusFilter');
  const clientsGrid = document.getElementById('clientsGrid');
  const currentAssignment = document.getElementById('currentAssignment');
  
  // State
  let clients = [];
  let currentAssignedClient = null;
  let planLimits = {
    maxClients: 10,
    clientsCreated: 0,
    assignmentCooldown: 7, // days
    lastAssignmentChange: null
  };
  
  // Check for existing plan assignment
  function checkCurrentAssignment() {
    // This would fetch from your API
    // For demo, we'll use localStorage
    const assignmentData = localStorage.getItem('currentAssignment');
    
    if (assignmentData) {
      try {
        const assignment = JSON.parse(assignmentData);
        currentAssignedClient = assignment.clientId;
        currentAssignment.textContent = assignment.clientName;
        updateClientCards();
        return assignment;
      } catch (e) {
        console.error('Error parsing assignment data:', e);
        localStorage.removeItem('currentAssignment');
      }
    }
    
    currentAssignment.textContent = 'None';
    return null;
  }
  
  // Load clients
  function loadClients() {
    // This would fetch from your API
    // For demo, we'll use hardcoded data
    clients = [
      { 
        id: '1', 
        name: 'Sarah Johnson', 
        email: 'sarah@example.com', 
        phone: '(555) 123-4567',
        status: 'active',
        verified: true,
        created: '2025-04-15'
      },
      { 
        id: '2', 
        name: 'Michael Smith', 
        email: 'mike@example.com', 
        phone: '(555) 987-6543',
        status: 'pending',
        verified: false,
        verificationExpires: '2025-04-25',
        created: '2025-04-18'
      }
    ];
    
    // Check if we've reached plan limits
    planLimits.clientsCreated = clients.length;
    
    renderClients();
  }
  
  // Render client cards
  function renderClients() {
    // Filter clients based on search and status filter
    const searchTerm = searchClients.value.toLowerCase();
    const statusFilterValue = statusFilter.value;
    
    const filteredClients = clients.filter(client => {
      const matchesSearch = client.name.toLowerCase().includes(searchTerm) || 
                          client.email.toLowerCase().includes(searchTerm);
      
      const matchesStatus = statusFilterValue === 'all' || client.status === statusFilterValue;
      
      return matchesSearch && matchesStatus;
    });
    
    // Clear grid
    clientsGrid.innerHTML = '';
    
    // Render filtered clients
    filteredClients.forEach(client => {
      const card = document.createElement('div');
      card.className = 'client-card';
      
      // Calculate verification status text
      let verificationText = 'Not Verified';
      if (client.verified) {
        verificationText = 'Verified';
      } else if (client.status === 'pending') {
        const expiryDate = new Date(client.verificationExpires);
        const today = new Date();
        const daysLeft = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        verificationText = `Pending (${daysLeft} days left)`;
      }
      
      // Format created date
      const createdDate = new Date(client.created);
      const formattedDate = createdDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      // Check if this is the currently assigned client
      const isAssigned = currentAssignedClient === client.id;
      
      card.innerHTML = `
        <div class="client-card-header">
          <h3>${client.name}</h3>
          <span class="status ${client.status}">${client.status === 'active' ? 'Active' : client.status === 'pending' ? 'Pending' : 'Unverified'}</span>
        </div>
        <div class="client-card-body">
          <p><strong>Email:</strong> ${client.email}</p>
          <p><strong>Phone:</strong> ${client.phone || 'Not provided'}</p>
          <p><strong>Created:</strong> ${formattedDate}</p>
          <p><strong>Verification:</strong> ${verificationText}</p>
        </div>
        <div class="client-card-footer">
          ${isAssigned ? 
            `<button class="btn outline" disabled>Currently Assigned</button>` : 
            `<button class="btn primary assign-btn" data-id="${client.id}" data-name="${client.name}">Assign Plan</button>`}
          ${!client.verified ? 
            `<button class="btn outline btn-icon remind-btn" data-id="${client.id}" data-email="${client.email}">
              <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14"></path></svg>
              Remind
             </button>` : ''}
        </div>
      `;
      
      clientsGrid.appendChild(card);
    });
    
    // Add event listeners to the buttons
    document.querySelectorAll('.assign-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const clientId = btn.dataset.id;
        const clientName = btn.dataset.name;
        openAssignmentModal(clientId, clientName);
      });
    });
    
    document.querySelectorAll('.remind-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const clientId = btn.dataset.id;
        const clientEmail = btn.dataset.email;
        sendVerificationReminder(clientId, clientEmail);
      });
    });
  }
  
  // Update client cards (specifically for assignment status)
  function updateClientCards() {
    document.querySelectorAll('.client-card').forEach(card => {
      const assignBtn = card.querySelector('.assign-btn');
      if (assignBtn) {
        const clientId = assignBtn.dataset.id;
        
        if (clientId === currentAssignedClient) {
          // Replace assign button with 'currently assigned' button
          const footer = card.querySelector('.client-card-footer');
          const newButton = document.createElement('button');
          newButton.className = 'btn outline';
          newButton.disabled = true;
          newButton.textContent = 'Currently Assigned';
          footer.replaceChild(newButton, assignBtn);
        }
      }
    });
  }
  
  // Check for plan limits before adding new client
  function checkPlanLimits() {
    if (planLimits.clientsCreated >= planLimits.maxClients) {
      alert(`You've reached your plan limit of ${planLimits.maxClients} clients. Please upgrade your plan to add more clients.`);
      return false;
    }
    
    return true;
  }
  
  // Check for assignment cooldown period
  function checkAssignmentCooldown() {
    if (!planLimits.lastAssignmentChange) return true;
    
    const lastChange = new Date(planLimits.lastAssignmentChange);
    const today = new Date();
    const daysSinceChange = Math.floor((today - lastChange) / (1000 * 60 * 60 * 24));
    
    if (daysSinceChange < planLimits.assignmentCooldown) {
      const daysLeft = planLimits.assignmentCooldown - daysSinceChange;
      alert(`You cannot change client assignments for ${daysLeft} more days due to the cooldown period.`);
      return false;
    }
    
    return true;
  }
  
  // Open assignment confirmation modal
  function openAssignmentModal(clientId, clientName) {
    // Check if we can reassign
    if (currentAssignedClient && !checkAssignmentCooldown()) {
      return;
    }
    
    assignClientName.textContent = clientName;
    assignmentModal.dataset.clientId = clientId;
    assignmentModal.dataset.clientName = clientName;
    assignmentModal.classList.add('active');
    confirmAssignment.checked = false;
    confirmAssignmentBtn.disabled = true;
  }
  
  // Send verification reminder
  function sendVerificationReminder(clientId, clientEmail) {
    // This would call your API to send a reminder email
    alert(`Verification reminder sent to ${clientEmail}`);
    
    // For demo, let's simulate a successful reminder
    // In a real implementation, this would be handled by the API response
    const clientIndex = clients.findIndex(c => c.id === clientId);
    if (clientIndex !== -1) {
      const reminderSent = confirm(`Verification reminder sent to ${clientEmail}. For demo purposes, would you like to simulate the client verifying their account?`);
      
      if (reminderSent) {
        clients[clientIndex].verified = true;
        clients[clientIndex].status = 'active';
        renderClients();
      }
    }
  }
  
  // Handle client assignment
  function assignClient(clientId, clientName) {
    // This would call your API to update assignment
    
    // Update local state
    currentAssignedClient = clientId;
    currentAssignment.textContent = clientName;
    
    // Save to localStorage for demo
    const assignmentData = {
      clientId,
      clientName,
      assignedDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    };
    
    localStorage.setItem('currentAssignment', JSON.stringify(assignmentData));
    
    // Update cooldown period
    planLimits.lastAssignmentChange = new Date().toISOString();
    
    // Update UI
    updateClientCards();
    
    // Show success message
    alert(`Your plan has been successfully assigned to ${clientName}. You can now upload photos for this client.`);
  }
  
  // Create new client
  function createClient(clientData) {
    // Validate data
    if (!clientData.name.trim()) {
      alert('Please enter a client name');
      return false;
    }
    
    if (!clientData.email.trim() || !validateEmail(clientData.email)) {
      alert('Please enter a valid email address');
      return false;
    }
    
    // Check for duplicates
    const emailExists = clients.some(client => 
      client.email.toLowerCase() === clientData.email.toLowerCase()
    );
    
    if (emailExists) {
      alert(`A client with the email ${clientData.email} already exists`);
      return false;
    }
    
    // Check plan limits
    if (!checkPlanLimits()) {
      return false;
    }
    
    // This would call your API to create client
    // For demo purposes, we'll add to our local array
    
    const newClient = {
      id: 'client-' + Date.now(),
      name: clientData.name,
      email: clientData.email,
      phone: clientData.phone || '',
      status: 'pending',
      verified: false,
      verificationExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      created: new Date().toISOString()
    };
    
    clients.push(newClient);
    planLimits.clientsCreated++;
    
    // Render updated list
    renderClients();
    
    // If assign now is checked, assign this client
    if (clientData.assignNow) {
      assignClient(newClient.id, newClient.name);
    }
    
    return true;
  }
  
  // Email validation helper
  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
  
  // Event Listeners
  createClientBtn.addEventListener('click', () => {
    if (!checkPlanLimits()) return;
    
    clientModal.classList.add('active');
    clientName.focus();
  });
  
  closeClientModal.addEventListener('click', () => {
    clientModal.classList.remove('active');
  });
  
  cancelClientModal.addEventListener('click', () => {
    clientModal.classList.remove('active');
  });
  
  saveClient.addEventListener('click', () => {
    const clientData = {
      name: clientName.value,
      email: clientEmail.value,
      phone: clientPhone.value,
      createAccess: createAccess.checked,
      assignNow: assignNow.checked
    };
    
    const success = createClient(clientData);
    
    if (success) {
      // Reset form
      clientName.value = '';
      clientEmail.value = '';
      clientPhone.value = '';
      
      // Close modal
      clientModal.classList.remove('active');
    }
  });
  
  confirmAssignment.addEventListener('change', () => {
    confirmAssignmentBtn.disabled = !confirmAssignment.checked;
  });
  
  closeAssignModal.addEventListener('click', () => {
    assignmentModal.classList.remove('active');
  });
  
  cancelAssignment.addEventListener('click', () => {
    assignmentModal.classList.remove('active');
  });
  
  confirmAssignmentBtn.addEventListener('click', () => {
    const clientId = assignmentModal.dataset.clientId;
    const clientName = assignmentModal.dataset.clientName;
    
    assignClient(clientId, clientName);
    assignmentModal.classList.remove('active');
  });
  
  searchClients.addEventListener('input', () => {
    renderClients();
  });
  
  statusFilter.addEventListener('change', () => {
    renderClients();
  });
  
  // Initialize
  checkCurrentAssignment();
  loadClients();
});
