document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const browseBtn = document.getElementById('browseBtn');
  const collectionSelect = document.getElementById('collectionSelect');
  const notifyClient = document.getElementById('notifyClient');
  const notificationMessage = document.getElementById('notificationMessage');
  const progressArea = document.getElementById('progressArea');
  const progressBar = document.getElementById('progressBar');
  const progressStats = document.getElementById('progressStats');
  const fileList = document.getElementById('fileList');
  const pauseBtn = document.getElementById('pauseBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const doneBtn = document.getElementById('doneBtn');
  const advancedSettingsBtn = document.getElementById('advancedSettingsBtn');
  const advancedSettings = document.getElementById('advancedSettings');
  
  // Assignment elements
  const assignmentStatus = document.getElementById('assignmentStatus');
  const noClientAssigned = document.getElementById('noClientAssigned');
  const clientAssigned = document.getElementById('clientAssigned');
  const assignedClientName = document.getElementById('assignedClientName');
  const assignmentDate = document.getElementById('assignmentDate');
  const assignmentExpiry = document.getElementById('assignmentExpiry');
  const clientStatus = document.getElementById('clientStatus');
  const verificationStatus = document.getElementById('verificationStatus');
  const changeAssignment = document.getElementById('changeAssignment');
  
  // Header client status bar
  const clientStatusBar = document.getElementById('clientStatusBar');
  const noClientStatus = document.getElementById('noClientStatus');
  const activeClientStatus = document.getElementById('activeClientStatus');
  const headerClientName = document.getElementById('headerClientName');
  const headerDaysLeft = document.getElementById('headerDaysLeft');
  
  // First-time user elements
  const firstTimeIntro = document.getElementById('firstTimeIntro');
  const dismissIntro = document.getElementById('dismissIntro');
  const startTutorial = document.getElementById('startTutorial');
  const closeIntro = document.getElementById('closeIntro');
  
  // Help elements
  const showHelp = document.getElementById('showHelp');
  const helpModal = document.getElementById('helpModal');
  const closeHelpModal = document.getElementById('closeHelpModal');
  const closeHelp = document.getElementById('closeHelp');
  
  // Why Assign Client elements
  const whyAssignClient = document.getElementById('whyAssignClient');
  const whyAssignModal = document.getElementById('whyAssignModal');
  const closeWhyModal = document.getElementById('closeWhyModal');
  const gotItBtn = document.getElementById('gotItBtn');
  
  // Upload container
  const uploadContainer = document.getElementById('uploadContainer');
  
  // Modal elements
  const collectionModal = document.getElementById('collectionModal');
  const closeModal = document.getElementById('closeModal');
  const cancelModal = document.getElementById('cancelModal');
  const saveCollection = document.getElementById('saveCollection');
  const collectionName = document.getElementById('collectionName');
  const modalClientName = document.getElementById('modalClientName');
  
  // Recovery alert
  const recoveryAlert = document.getElementById('recoveryAlert');
  const discardRecovery = document.getElementById('discardRecovery');
  const resumeUpload = document.getElementById('resumeUpload');
  const recoveryClientName = document.getElementById('recoveryClientName');
  
  // Authentication & subscription checks
  const authCheck = document.getElementById('authCheck');
  const subCheck = document.getElementById('subCheck');
  
  // State
  let files = [];
  let totalSize = 0;
  let uploadedSize = 0;
  let uploadPaused = false;
  let uploadCancelled = false;
  let offlineMode = false;
  let recoveredSession = false;
  let currentAssignment = null;
  let isFirstTimeUser = true; // Set based on user's history
  let tutorialStep = 0;
  
  // Check if first time user
  function checkFirstTimeUser() {
    const visited = localStorage.getItem('hasVisitedUpload');
    if (!visited) {
      // First time user
      isFirstTimeUser = true;
      firstTimeIntro.style.display = 'block';
      localStorage.setItem('hasVisitedUpload', 'true');
    } else {
      isFirstTimeUser = false;
      firstTimeIntro.style.display = 'none';
    }
  }
  
  // Handle first time user interactions
  function setupFirstTimeUserExperience() {
    dismissIntro.addEventListener('click', () => {
      firstTimeIntro.style.display = 'none';
    });
    
    closeIntro.addEventListener('click', () => {
      firstTimeIntro.style.display = 'none';
    });
    
    startTutorial.addEventListener('click', () => {
      firstTimeIntro.style.display = 'none';
      startOnboardingTutorial();
    });
  }
  
  // Simple tutorial that highlights different parts of the interface
  function startOnboardingTutorial() {
    const tutorialSteps = [
      {
        element: clientStatusBar,
        title: 'Client Status',
        content: 'This shows your currently assigned client. You need to assign a client before uploading.'
      },
      {
        element: document.querySelector('.collection-select'),
        title: 'Collections',
        content: 'Group your photos into collections to keep them organized for your client.'
      },
      {
        element: dropZone,
        title: 'Upload Area',
        content: 'Drag and drop your photos here, or click to browse files from your device.'
      },
      {
        element: document.querySelector('.upload-settings'),
        title: 'Upload Settings',
        content: 'Configure how your photos are processed and organized.'
      }
    ];
    
    // Simple implementation - in a real app, this would be more sophisticated
    showTutorialStep(0, tutorialSteps);
  }
  
  function showTutorialStep(index, steps) {
    if (index >= steps.length) {
      alert('Tutorial completed! You're ready to start using Snap Select.');
      return;
    }
    
    const step = steps[index];
    const elem = step.element;
    
    // Highlight element (in a real implementation, this would be more sophisticated)
    elem.classList.add('tutorial-highlight');
    
    // Show tooltip with information
    alert(`${step.title}: ${step.content}`);
    
    // Remove highlight after user acknowledges
    elem.classList.remove('tutorial-highlight');
    
    // Move to next step
    showTutorialStep(index + 1, steps);
  }
  
  // Check if user is authenticated and has valid subscription
  function checkPermissions() {
    // This would connect to your authentication system
    const isAuthenticated = true; // Simulate authenticated user
    const hasValidSubscription = true; // Simulate valid subscription
    const remainingStorage = 5000; // MB available
    const subscriptionTier = "Professional"; // User's current plan
    
    if (!isAuthenticated) {
      authCheck.textContent = 'You must be logged in to upload photos.';
      authCheck.classList.add('show');
      disableUpload();
      return false;
    }
    
    if (!hasValidSubscription) {
      subCheck.textContent = 'Your subscription doesn\'t allow uploads. Please upgrade your plan.';
      subCheck.classList.add('show');
      disableUpload();
      return false;
    } else if (remainingStorage < 100) {
      subCheck.textContent = `Storage almost full! Only ${remainingStorage}MB remaining. Consider upgrading.`;
      subCheck.classList.add('show');
    }
    
    // Adjust UI based on subscription tier
    if (subscriptionTier === "Basic") {
      // Disable advanced features for Basic tier
      document.getElementById('allowOffline').disabled = true;
      document.getElementById('allowOffline').parentNode.classList.add('disabled');
      
      // Add tooltip explaining the limitation
      const tooltip = document.createElement('span');
      tooltip.className = 'feature-tooltip';
      tooltip.textContent = 'Available on Professional plan';
      document.getElementById('allowOffline').parentNode.appendChild(tooltip);
    }
    
    return true;
  }
  
  // Check for client assignment
  function checkClientAssignment() {
    // This would fetch from your API in real implementation
    const assignmentData = localStorage.getItem('currentAssignment');
    
    if (!assignmentData) {
      // No client is assigned
      noClientAssigned.hidden = false;
      clientAssigned.hidden = true;
      
      // Update header status
      noClientStatus.hidden = false;
      activeClientStatus.hidden = true;
      
      // Disable upload functionality
      disableUpload();
      return false;
    }
    
    try {
      currentAssignment = JSON.parse(assignmentData);
      
      // Show assignment info
      assignedClientName.textContent = currentAssignment.clientName;
      modalClientName.textContent = currentAssignment.clientName;
      
      // Format dates for display
      const assignDate = new Date(currentAssignment.assignedDate);
      const expiryDate = new Date(currentAssignment.expiryDate);
      
      assignmentDate.textContent = assignDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      assignmentExpiry.textContent = expiryDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
      
      // Calculate days remaining
      const now = new Date();
      const daysLeft = Math.max(0, Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24)));
      
      // Update header client status
      headerClientName.textContent = currentAssignment.clientName;
      headerDaysLeft.textContent = `${daysLeft} days left`;
      noClientStatus.hidden = true;
      activeClientStatus.hidden = false;
      
      // Check verification status
      const isVerified = currentAssignment.verified || false;
      if (isVerified) {
        document.querySelector('.verification-status span').textContent = 'Verified';
        document.querySelector('.verification-status span').className = 'verified';
      } else {
        document.querySelector('.verification-status span').textContent = 'Pending Verification';
        document.querySelector('.verification-status span').className = 'pending';
      }
      
      // Calculate if expired
      if (expiryDate < now) {
        clientStatus.textContent = 'Expired';
        clientStatus.className = 'status unverified';
        
        // Show warning and disable upload
        const warningDiv = document.createElement('div');
        warningDiv.className = 'alert warning';
        warningDiv.innerHTML = `
          <p>Your client assignment has expired. 
          <a href="client-management.html" class="alert-link">Renew or change assignment</a></p>
        `;
        clientAssigned.appendChild(warningDiv);
        
        disableUpload();
        return false;
      }
      
      // Show assigned client UI
      noClientAssigned.hidden = true;
      clientAssigned.hidden = false;
      
      return true;
    } catch (e) {
      console.error('Error parsing assignment data:', e);
      localStorage.removeItem('currentAssignment');
      
      // Show no assignment UI
      noClientAssigned.hidden = false;
      clientAssigned.hidden = true;
      
      // Update header status
      noClientStatus.hidden = false;
      activeClientStatus.hidden = true;
      
      disableUpload();
      return false;
    }
  }
  
  function disableUpload() {
    dropZone.style.opacity = '0.5';
    dropZone.style.pointerEvents = 'none';
    browseBtn.disabled = true;
    
    if (authCheck.classList.contains('show') || subCheck.classList.contains('show')) {
      // Authentication or subscription issues
      uploadContainer.classList.add('disabled');
    }
  }
  
  // Check for network status
  function checkNetworkStatus() {
    const isOnline = navigator.onLine;
    if (!isOnline) {
      offlineMode = true;
      document.body.classList.add('offline-mode');
      
      // Show offline notification
      const notification = document.createElement('div');
      notification.className = 'offline-notification';
      notification.textContent = 'You are currently offline. Files will be queued for upload when connection is restored.';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.classList.add('show');
      }, 100);
    }
    
    return isOnline;
  }
  
  // Check for unfinished upload session
  function checkForUnfinishedSession() {
    const savedSession = localStorage.getItem('uploadSession');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session.files && session.files.length > 0) {
          // Verify the session belongs to the current client
          if (currentAssignment && session.clientId === currentAssignment.clientId) {
            // Update recovery alert with client name
            recoveryClientName.textContent = currentAssignment.clientName;
            recoveryAlert.classList.add('show');
            
            // Set up recovery handlers
            resumeUpload.addEventListener('click', () => {
              recoverSession(session);
              recoveryAlert.classList.remove('show');
            });
            
            discardRecovery.addEventListener('click', () => {
              localStorage.removeItem('uploadSession');
              recoveryAlert.classList.remove('show');
            });
            
            return true;
          } else {
            // Session is for a different client, can't recover
            localStorage.removeItem('uploadSession');
          }
        }
      } catch (e) {
        console.error('Error parsing saved session:', e);
        localStorage.removeItem('uploadSession');
      }
    }
    return false;
  }
  
  // Recover previous upload session
  function recoverSession(session) {
    files = session.files || [];
    totalSize = session.totalSize || 0;
    uploadedSize = session.uploadedSize || 0;
    
    // Update UI
    if (files.length > 0) {
      progressArea.hidden = false;
      renderFileList();
      recoveredSession = true;
    }
  }
  
  // Load existing collections
  function loadCollections() {
    // This would fetch from your API with the current client ID
    const collections = [
      { id: '1', name: 'Wedding Photos', clientId: currentAssignment.clientId },
      { id: '2', name: 'Portrait Session', clientId: currentAssignment.clientId },
      { id: '3', name: 'Product Shoot', clientId: currentAssignment.clientId }
    ];
    
    // Clear except first two options
    while (collectionSelect.options.length > 2) {
      collectionSelect.remove(2);
    }
    
    // Add collections that belong to the current client
    collections.forEach(collection => {
      if (collection.clientId === currentAssignment.clientId) {
        const option = document.createElement('option');
        option.value = collection.id;
        option.textContent = collection.name;
        collectionSelect.appendChild(option);
      }
    });
  }
  
  // File handlers
  function handleFiles(newFiles) {
    const validFiles = Array.from(newFiles).filter(file => {
      // Check if file is an image
      const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/tiff', 'image/bmp', 'image/webp', 'image/svg+xml'];
      const isImage = validImageTypes.includes(file.type);
      
      if (!isImage) {
        showError(`${file.name} is not a supported image type.`);
        return false;
      }
      
      // Check size limit (50MB per file)
      if (file.size > 50 * 1024 * 1024) {
        showError(`${file.name} exceeds the 50MB size limit.`);
        return false;
      }
      
      // Check for potential security issues (this is a simplified example)
      // In a real implementation, you would do more thorough validation
      if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
        showError(`${file.name} contains invalid characters.`);
        return false;
      }
      
      return true;
    });
    
    // Check total size limit (500MB)
    let newTotalSize = totalSize;
    validFiles.forEach(file => newTotalSize += file.size);
    
    if (newTotalSize > 500 * 1024 * 1024) {
      showError('Total upload size exceeds 500MB limit.');
      return;
    }
    
    // Process files (extract EXIF if needed, rename if batch rename is set)
    const processedFiles = validFiles.map(file => {
      const batchRenamePattern = document.getElementById('batchRename').value;
      
      // Apply batch rename if pattern is provided
      if (batchRenamePattern) {
        const fileExt = file.name.split('.').pop();
        const counter = files.length + 1;
        const date = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const time = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
        
        let newName = batchRenamePattern
          .replace('{counter}', counter.toString().padStart(3, '0'))
          .replace('{date}', date)
          .replace('{time}', time);
        
        newName = `${newName}.${fileExt}`;
        
        // In a real implementation, we would create a new File object with the renamed file
        // For simplicity, we're just updating the name property
        file.originalName = file.name;
        file.name = newName;
      }
      
      // Add metadata fields
      file.status = 'pending';
      file.uploadTime = new Date();
      file.clientId = currentAssignment.clientId;
      
      return file;
    });
    
    // Add valid files to list
    files = [...files, ...processedFiles];
    totalSize = newTotalSize;
    
    // Show progress area if we have files
    if (files.length > 0) {
      progressArea.hidden = false;
      renderFileList();
      
      // Save session state
      saveSessionState();
    }
  }
  
  function renderFileList() {
    fileList.innerHTML = '';
    
    files.forEach((file, index) => {
      const li = document.createElement('li');
      li.className = 'file-item';
      
      const fileSize = formatFileSize(file.size);
      const status = file.status || 'pending';
      
      li.innerHTML = `
        <div class="file-icon">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        </div>
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-size">${fileSize}</div>
        </div>
        <div class="file-status status-${status}">${status}</div>
      `;
      
      fileList.appendChild(li);
    });
    
    // Update stats
    updateProgress();
  }
  
  function updateProgress() {
    const percent = files.length > 0 ? Math.round((uploadedSize / totalSize) * 100) : 0;
    progressBar.style.width = `${percent}%`;
    progressStats.textContent = `${files.filter(f => f.status === 'complete').length}/${files.length} files • ${percent}%`;
    
    // Enable/disable done button
    doneBtn.disabled = !(percent === 100 || files.length === 0);
  }
  
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  }
  
  function showError(message) {
    // Simple error handling - could be enhanced with a toast system
    alert(message);
  }
  
  // Save current upload session state
  function saveSessionState() {
    if (!currentAssignment) return;
    
    const sessionData = {
      files: files,
      totalSize: totalSize,
      uploadedSize: uploadedSize,
      collection: document.getElementById('collectionSelect').value,
      clientId: currentAssignment.clientId,
      timestamp: new Date().getTime()
    };
    
    // In a real implementation, we would remove the actual file blobs from storage
    // and only store metadata to avoid excessive local storage usage
    const serializableSession = { ...sessionData };
    localStorage.setItem('uploadSession', JSON.stringify(serializableSession));
  }
  
  // Simulate upload with offline support and retry logic
  function simulateUpload() {
    if (files.length === 0 || uploadPaused || uploadCancelled) return;
    
    // Check if we're offline
    if (offlineMode) {
      // In offline mode, we queue files but don't actually upload
      files.forEach(file => {
        if (!file.status || file.status === 'pending') {
          file.status = 'queued';
        }
      });
      renderFileList();
      return;
    }
    
    // Find next pending file
    const pendingIndex = files.findIndex(f => !f.status || f.status === 'pending' || f.status === 'queued');
    if (pendingIndex === -1) return;
    
    // Update status
    files[pendingIndex].status = 'uploading';
    renderFileList();
    
    // Simulate upload progress
    const file = files[pendingIndex];
    const fileSize = file.size;
    let uploaded = 0;
    const chunkSize = fileSize / 10;
    
    const interval = setInterval(() => {
      if (uploadPaused || uploadCancelled) {
        clearInterval(interval);
        return;
      }
      
      // Simulate random network errors (1 in 20 chance)
      if (!offlineMode && Math.random() < 0.05 && uploaded < fileSize) {
        clearInterval(interval);
        files[pendingIndex].status = 'error';
        files[pendingIndex].errorMessage = 'Network error';
        renderFileList();
        
        // Add retry button for failed uploads
        const fileItem = fileList.children[pendingIndex];
        if (fileItem) {
          const retryBtn = document.createElement('button');
          retryBtn.className = 'retry-btn';
          retryBtn.textContent = 'Retry';
          retryBtn.addEventListener('click', () => {
            files[pendingIndex].status = 'pending';
            renderFileList();
            setTimeout(() => simulateUpload(), 500);
          });
          fileItem.appendChild(retryBtn);
        }
        
        // Continue with next file
        setTimeout(() => simulateUpload(), 500);
        return;
      }
      
      uploaded += chunkSize;
      uploadedSize += chunkSize;
      
      if (uploaded >= fileSize) {
        clearInterval(interval);
        files[pendingIndex].status = 'complete';
        renderFileList();
        
        // Update session state
        saveSessionState();
        
        // Process next file
        simulateUpload();
      } else {
        updateProgress();
      }
    }, 500);
  }
  
  // Event Listeners for new UI elements
  function setupEventListeners() {
    // Why assign client modal
    whyAssignClient.addEventListener('click', () => {
      whyAssignModal.classList.add('active');
    });
    
    closeWhyModal.addEventListener('click', () => {
      whyAssignModal.classList.remove('active');
    });
    
    gotItBtn.addEventListener('click', () => {
      whyAssignModal.classList.remove('active');
    });
    
    // Help modal
    showHelp.addEventListener('click', () => {
      helpModal.classList.add('active');
    });
    
    closeHelpModal.addEventListener('click', () => {
      helpModal.classList.remove('active');
    });
    
    closeHelp.addEventListener('click', () => {
      helpModal.classList.remove('active');
    });
    
    // Change assignment button
    if (changeAssignment) {
      changeAssignment.addEventListener('click', () => {
        // Check if cooldown period has passed
        const lastChange = localStorage.getItem('lastAssignmentChange');
        if (lastChange) {
          const changeDate = new Date(parseInt(lastChange));
          const now = new Date();
          const daysSinceChange = Math.floor((now - changeDate) / (1000 * 60 * 60 * 24));
          
          if (daysSinceChange < 7) {
            const daysLeft = 7 - daysSinceChange;
            alert(`You cannot change client assignments for ${daysLeft} more days due to the cooldown period.`);
            return;
          }
        }
        
        // Confirm before redirecting
        const confirmChange = confirm('Changing your client assignment will prevent you from uploading to this client. Are you sure you want to proceed?');
        if (confirmChange) {
          window.location.href = 'client-management.html';
        }
      });
    }
  }
  
  // Basic upload event listeners
  browseBtn.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = ''; // Reset input
  });
  
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('active');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('active');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
    handleFiles(e.dataTransfer.files);
  });
  
  // Toggle advanced settings
  advancedSettingsBtn.addEventListener('click', () => {
    advancedSettings.classList.toggle('hidden');
    advancedSettingsBtn.textContent = advancedSettings.classList.contains('hidden') 
      ? 'Show advanced settings' 
      : 'Hide advanced settings';
  });
  
  // Handle collection selection
  collectionSelect.addEventListener('change', () => {
    if (collectionSelect.value === 'new') {
      // Set client name in modal
      if (currentAssignment) {
        modalClientName.textContent = currentAssignment.clientName;
      }
      
      collectionModal.classList.add('active');
      collectionName.focus();
    }
    
    // Save session state when collection changes
    saveSessionState();
  });
  
  // Network status listeners
  window.addEventListener('online', () => {
    offlineMode = false;
    document.body.classList.remove('offline-mode');
    
    const notification = document.createElement('div');
    notification.className = 'online-notification';
    notification.textContent = 'Connection restored. Resuming uploads...';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
      
      // Auto-remove notification after 5 seconds
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 5000);
    }, 100);
    
    // Resume uploads if we have pending files
    if (files.length > 0 && !uploadPaused && !uploadCancelled) {
      simulateUpload();
    }
  });
  
  window.addEventListener('offline', () => {
    offlineMode = true;
    document.body.classList.add('offline-mode');
    
    const notification = document.createElement('div');
    notification.className = 'offline-notification';
    notification.textContent = 'You are now offline. Files will be queued for upload when connection is restored.';
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
      
      // Auto-remove notification after 5 seconds
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 5000);
    }, 100);
  });
  
  // Modal events
  closeModal.addEventListener('click', () => {
    collectionModal.classList.remove('active');
    collectionSelect.value = '';
  });
  
  cancelModal.addEventListener('click', () => {
    collectionModal.classList.remove('active');
    collectionSelect.value = '';
  });
  
  saveCollection.addEventListener('click', () => {
    if (!collectionName.value.trim()) {
      collectionName.focus();
      return;
    }
    
    // Would send to API in real implementation
    // Here we simulate collection creation with validation
    const collectionExists = Array.from(collectionSelect.options).some(
      option => option.textContent.toLowerCase() === collectionName.value.toLowerCase()
    );
    
    if (collectionExists) {
      alert(`A collection named "${collectionName.value}" already exists. Please choose a different name.`);
      collectionName.focus();
      return;
    }
    
    // Simulate successful API response
    alert(`Collection "${collectionName.value}" created successfully for client ${currentAssignment.clientName}!`);
    
    // Add to dropdown
    const option = document.createElement('option');
    option.value = 'new-' + Date.now(); // Temporary ID
    option.textContent = collectionName.value;
    collectionSelect.insertBefore(option, collectionSelect.options[2]);
    collectionSelect.value = option.value;
    
    // Reset and close modal
    collectionModal.classList.remove('active');
    collectionName.value = '';
    
    // Update session state
    saveSessionState();
  });
  
  // Upload control buttons
  pauseBtn.addEventListener('click', () => {
    uploadPaused = !uploadPaused;
    pauseBtn.textContent = uploadPaused ? 'Resume' : 'Pause';
    
    if (!uploadPaused) {
      simulateUpload();
    }
    
    // Update session state
    saveSessionState();
  });
  
  cancelBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to cancel the upload? All progress will be lost.')) {
      uploadCancelled = true;
      files = [];
      totalSize = 0;
      uploadedSize = 0;
      renderFileList();
      progressArea.hidden = true;
      
      // Clear session data
      localStorage.removeItem('uploadSession');
    }
  });
  
  doneBtn.addEventListener('click', () => {
    // Validate required fields before completion
    if (files.length > 0 && !collectionSelect.value) {
      alert('Please select or create a collection for your photos.');
      collectionSelect.focus();
      return;
    }
    
    // Check if there are any files still uploading
    const pendingFiles = files.filter(f => f.status !== 'complete' && f.status !== 'error');
    if (pendingFiles.length > 0) {
      const proceed = confirm(`There are still ${pendingFiles.length} files uploading. Are you sure you want to finish now?`);
      if (!proceed) return;
    }
    
    // Handle client notification if selected
    const sendNotification = notifyClient.checked;
    let notificationText = notificationMessage.value.trim();
    
    if (sendNotification) {
      // In a real implementation, this would be sent to the API
      console.log(`Sending notification to client: ${currentAssignment.clientName}`);
      console.log(`Message: ${notificationText || 'Your photos have been uploaded and are ready for review.'}`);
    }
    
    // Simulate API call to finalize upload
    let message = 'Upload completed successfully!';
    
    if (sendNotification) {
      message += ' Client has been notified.';
    }
    
    alert(message);
    
    // Reset state
    files = [];
    totalSize = 0;
    uploadedSize = 0;
    progressArea.hidden = true;
    
    // Clear session data
    localStorage.removeItem('uploadSession');
    
    // In a real implementation, we would redirect to the collection page
    // window.location.href = 'collection.html?id=' + collectionSelect.value;
  });
  
  // Handle window events for session persistence
  window.addEventListener('beforeunload', (e) => {
    // If there's an active upload, warn before leaving
    if (files.length > 0 && files.some(f => f.status === 'uploading')) {
      const message = 'You have uploads in progress. Are you sure you want to leave?';
      e.returnValue = message;
      return message;
    }
    
    // Save session state before unloading
    if (files.length > 0) {
      saveSessionState();
    }
  });
  
  // Initialize everything
  function init() {
    checkFirstTimeUser();
    setupFirstTimeUserExperience();
    setupEventListeners();
    
    const isAuthenticated = checkPermissions();
    if (isAuthenticated) {
      const hasAssignedClient = checkClientAssignment();
      if (hasAssignedClient) {
        loadCollections();
        checkNetworkStatus();
        checkForUnfinishedSession();
      }
    }
  }
  
  // Start everything
  init();
  
  // For demo purposes, simulate starting upload when files are added
  const originalHandleFiles = handleFiles;
  handleFiles = (...args) => {
    originalHandleFiles(...args);
    if (!uploadPaused && !uploadCancelled) {
      simulateUpload();
    }
  };
});
