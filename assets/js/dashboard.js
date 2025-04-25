/**
 * Dashboard.js
 * Main JavaScript file for the photographer dashboard functionality
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize dashboard components
    initializeDashboard();
    setupEventListeners();
    loadDashboardData();
});

/**
 * Initialize dashboard UI components
 */
function initializeDashboard() {
    // Initialize UI components
    initializeViewSwitcher();
    initializeModals();
    initializeDropdowns();
    initializeHelp();
    
    console.log('Dashboard initialized');
}

/**
 * Setup event listeners for dashboard elements
 */
function setupEventListeners() {
    // Create gallery button
    const createGalleryBtn = document.getElementById('createGalleryBtn');
    if (createGalleryBtn) {
        createGalleryBtn.addEventListener('click', openCreateGalleryModal);
    }
    
    // Empty state create button
    const emptyStateCreateBtn = document.getElementById('emptyStateCreateBtn');
    if (emptyStateCreateBtn) {
        emptyStateCreateBtn.addEventListener('click', openCreateGalleryModal);
    }
    
    // Help button
    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
        helpBtn.addEventListener('click', openHelpModal);
    }
    
    // Footer help link
    const footerHelpLink = document.getElementById('footerHelpLink');
    if (footerHelpLink) {
        footerHelpLink.addEventListener('click', function(e) {
            e.preventDefault();
            openHelpModal();
        });
    }
    
    // Search input
    const gallerySearch = document.getElementById('gallerySearch');
    if (gallerySearch) {
        gallerySearch.addEventListener('input', filterGalleries);
    }
    
    // Contact support button
    const contactSupportBtn = document.getElementById('contactSupportBtn');
    if (contactSupportBtn) {
        contactSupportBtn.addEventListener('click', function(e) {
            e.preventDefault();
            alert('Support contact form will be implemented in the next phase.');
        });
    }
    
    // Notification button
    const notificationBtn = document.getElementById('notificationBtn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', toggleNotifications);
    }
    
    // Mark all read button
    const markAllReadBtn = document.getElementById('markAllReadBtn');
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', markAllNotificationsAsRead);
    }
    
    // Cancel create gallery button
    const cancelCreateBtn = document.getElementById('cancelCreateBtn');
    if (cancelCreateBtn) {
        cancelCreateBtn.addEventListener('click', closeCreateGalleryModal);
    }
    
    // Create gallery form
    const createGalleryForm = document.getElementById('createGalleryForm');
    if (createGalleryForm) {
        createGalleryForm.addEventListener('submit', handleCreateGallery);
    }
    
    // View selections button
    const viewSelectionsBtn = document.getElementById('viewSelectionsBtn');
    if (viewSelectionsBtn) {
        viewSelectionsBtn.addEventListener('click', function() {
            alert('View Selections feature will be implemented in the next phase.');
        });
    }
    
    // Download selected button
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    if (downloadSelectedBtn) {
        downloadSelectedBtn.addEventListener('click', function() {
            alert('Download Selected feature will be implemented in the next phase.');
        });
    }
    
    // Document click event to close dropdowns
    document.addEventListener('click', handleDocumentClick);
}

/**
 * Initialize gallery view switcher (grid/list)
 */
function initializeViewSwitcher() {
    const viewBtns = document.querySelectorAll('.view-btn');
    
    viewBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const viewType = this.getAttribute('data-view');
            
            // Remove active class from all buttons
            viewBtns.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Show the selected view and hide others
            if (viewType === 'grid') {
                document.getElementById('galleryGrid').style.display = 'grid';
                document.getElementById('galleryList').style.display = 'none';
            } else if (viewType === 'list') {
                document.getElementById('galleryGrid').style.display = 'none';
                document.getElementById('galleryList').style.display = 'block';
            }
        });
    });
}

/**
 * Initialize modals
 */
function initializeModals() {
    // Close buttons for all modals
    const closeButtons = document.querySelectorAll('.close-modal');
    
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                closeModal(modal);
            }
        });
    });
    
    // Close modals when clicking outside content
    const modals = document.querySelectorAll('.modal');
    
    modals.forEach(modal => {
        modal.addEventListener('click', function(event) {
            if (event.target === this) {
                closeModal(this);
            }
        });
    });
}

/**
 * Initialize dropdowns
 */
function initializeDropdowns() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    
    if (userMenuBtn && userDropdown) {
        userMenuBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
        });
    }
}

/**
 * Initialize help tabs
 */
function initializeHelp() {
    const helpTabs = document.querySelectorAll('.help-tab');
    
    helpTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabName = this.getAttribute('data-tab');
            
            // Remove active class from all tabs
            helpTabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Hide all panels
            document.querySelectorAll('.help-panel').forEach(panel => {
                panel.style.display = 'none';
            });
            
            // Show the selected panel
            const activePanel = document.getElementById(tabName + '-help');
            if (activePanel) {
                activePanel.style.display = 'block';
            }
        });
    });
}

/**
 * Handle document click to close dropdowns
 */
function handleDocumentClick(event) {
    // Close user dropdown if open
    const userDropdown = document.getElementById('userDropdown');
    const userMenuBtn = document.getElementById('userMenuBtn');
    
    if (userDropdown && userDropdown.style.display === 'block' && !userMenuBtn.contains(event.target)) {
        userDropdown.style.display = 'none';
    }
    
    // Close notification dropdown if open
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationBtn = document.getElementById('notificationBtn');
    
    if (notificationDropdown && notificationDropdown.style.display === 'block' && !notificationBtn.contains(event.target)) {
        notificationDropdown.style.display = 'none';
    }
}

/**
 * Open create gallery modal
 */
function openCreateGalleryModal() {
    const modal = document.getElementById('createGalleryModal');
    if (modal) {
        // Set default expiry date to 30 days from now
        const expiryDateInput = document.getElementById('expiryDate');
        if (expiryDateInput) {
            const date = new Date();
            date.setDate(date.getDate() + 30);
            const formattedDate = date.toISOString().split('T')[0];
            expiryDateInput.value = formattedDate;
        }
        
        openModal(modal);
    }
}

/**
 * Close create gallery modal
 */
function closeCreateGalleryModal() {
    const modal = document.getElementById('createGalleryModal');
    if (modal) {
        closeModal(modal);
        
        // Clear form
        const form = document.getElementById('createGalleryForm');
        if (form) {
            form.reset();
        }
        
        // Clear upload preview
        const uploadPreview = document.getElementById('uploadPreview');
        if (uploadPreview) {
            uploadPreview.innerHTML = '';
        }
        
        // Hide upload progress
        const uploadProgress = document.getElementById('uploadProgress');
        if (uploadProgress) {
            uploadProgress.style.display = 'none';
        }
    }
}

/**
 * Open help modal
 */
function openHelpModal() {
    const modal = document.getElementById('helpModal');
    if (modal) {
        openModal(modal);
    }
}

/**
 * Open a modal
 */
function openModal(modal) {
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden'; // Prevent scrolling
}

/**
 * Close a modal
 */
function closeModal(modal) {
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
}

/**
 * Toggle notifications dropdown
 */
function toggleNotifications(event) {
    event.stopPropagation();
    
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    }
}

/**
 * Mark all notifications as read
 */
function markAllNotificationsAsRead() {
    // Remove unread class from all notifications
    const unreadItems = document.querySelectorAll('.notification-item.unread');
    unreadItems.forEach(item => {
        item.classList.remove('unread');
    });
    
    // Update notification count
    updateNotificationCount(0);
    
    // TODO: Update in database
    console.log('All notifications marked as read');
}

/**
 * Update notification count
 */
function updateNotificationCount(count) {
    const badge = document.getElementById('notificationCount');
    if (badge) {
        badge.textContent = count;
        
        // Hide badge if count is 0
        if (count === 0) {
            badge.style.display = 'none';
        } else {
            badge.style.display = 'flex';
        }
    }
}

/**
 * Handle gallery creation
 */
function handleCreateGallery(event) {
    event.preventDefault();
    
    // Show progress indicator
    const uploadProgress = document.getElementById('uploadProgress');
    const uploadProgressBar = document.getElementById('uploadProgressBar');
    const uploadStatus = document.getElementById('uploadStatus');
    
    if (uploadProgress && uploadProgressBar && uploadStatus) {
        uploadProgress.style.display = 'block';
        uploadProgressBar.style.width = '0%';
        uploadStatus.textContent = 'Creating gallery...';
        
        // Simulate progress animation
        let progress = 0;
        const interval = setInterval(() => {
            progress += 5;
            uploadProgressBar.style.width = progress + '%';
            uploadStatus.textContent = progress < 100 ? 'Creating gallery...' : 'Gallery created!';
            
            if (progress >= 100) {
                clearInterval(interval);
                
                // Simulate gallery creation delay
                setTimeout(() => {
                    closeCreateGalleryModal();
                    
                    // Show success message
                    alert('Gallery created successfully!');
                    
                    // Update UI with new gallery (in real implementation, this would get data from database)
                    addSampleGallery();
                }, 500);
            }
        }, 100);
    }
}

/**
 * Filter galleries based on search input
 */
function filterGalleries() {
    const searchInput = document.getElementById('gallerySearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    // Filter grid view
    const gridCards = document.querySelectorAll('.gallery-card:not(.sample-card)');
    gridCards.forEach(card => {
        const title = card.querySelector('.gallery-title').textContent.toLowerCase();
        card.style.display = title.includes(searchTerm) ? 'block' : 'none';
    });
    
    // Filter list view
    const listRows = document.querySelectorAll('#galleryTableBody tr:not(.sample-row)');
    listRows.forEach(row => {
        const name = row.querySelector('.gallery-name').textContent.toLowerCase();
        row.style.display = name.includes(searchTerm) ? 'table-row' : 'none';
    });
}

/**
 * Load dashboard data
 */
function loadDashboardData() {
    // For demo purposes, we'll simulate data loading
    simulateDataLoading();
}

/**
 * Simulate data loading for demo
 */
function simulateDataLoading() {
    // Show loading state
    
    // Simulate API delay
    setTimeout(() => {
        // Update statistics
        updateStatistics(2, 35, '158 MB');
        
        // Hide loading state
        
        // Show empty state or galleries based on count
        const hasGalleries = Math.random() > 0.5; // 50% chance of having galleries
        
        if (hasGalleries) {
            // Hide empty state
            document.getElementById('emptyGalleryState').style.display = 'none';
            
            // Add sample galleries
            addSampleGallery();
            
            // Show a second gallery with a delay for animation effect
            setTimeout(() => {
                addSampleGallery(true);
            }, 300);
        } else {
            // Show empty state
            document.getElementById('emptyGalleryState').style.display = 'flex';
            document.getElementById('galleryGrid').style.display = 'none';
        }
    }, 1000);
}

/**
 * Update dashboard statistics
 */
function updateStatistics(galleries, selections, storage) {
    const activeGalleriesCount = document.getElementById('activeGalleriesCount');
    const pendingSelectionsCount = document.getElementById('pendingSelectionsCount');
    const storageUsed = document.getElementById('storageUsed');
    
    if (activeGalleriesCount) activeGalleriesCount.textContent = galleries;
    if (pendingSelectionsCount) pendingSelectionsCount.textContent = selections;
    if (storageUsed) storageUsed.textContent = storage;
}

/**
 * Add a sample gallery for demonstration
 */
function addSampleGallery(isSecond = false) {
    // Determine gallery name and data
    const galleryData = isSecond ? {
        name: 'Corporate Headshots',
        date: 'Apr 22, 2025',
        status: 'awaiting',
        statusText: 'Awaiting Selection',
        total: 124,
        selected: '0/25',
        percent: 0,
        expires: 'May 22, 2025'
    } : {
        name: 'Johnson Wedding',
        date: 'Apr 18, 2025',
        status: 'pending',
        statusText: 'Selection in Progress',
        total: 248,
        selected: '24/50',
        percent: 48,
        expires: 'May 18, 2025'
    };
    
    // Hide the sample card
    const sampleCard = document.querySelector('.sample-card');
    if (sampleCard) sampleCard.style.display = 'none';
    
    // Hide the sample row
    const sampleRow = document.querySelector('.sample-row');
    if (sampleRow) sampleRow.style.display = 'none';
    
    // Create grid card
    const galleryGrid = document.getElementById('galleryGrid');
    if (galleryGrid) {
        const card = document.createElement('div');
        card.className = 'gallery-card animate-in';
        card.style.animationDelay = isSecond ? '0.2s' : '0';
        
        card.innerHTML = `
            <div class="gallery-thumbnail">
                <img src="../assets/images/gallery-placeholder${isSecond ? '2' : ''}.jpg" alt="Gallery thumbnail">
                <div class="gallery-status ${galleryData.status}">${galleryData.statusText}</div>
            </div>
            <div class="gallery-info">
                <h3 class="gallery-title">${galleryData.name}</h3>
                <div class="gallery-meta">
                    <span><i class="fas fa-calendar"></i> ${galleryData.date}</span>
                    <span><i class="fas fa-image"></i> ${galleryData.total} photos</span>
                </div>
                <div class="selection-progress">
                    <div class="progress-label">
                        <span>Client Selection: ${galleryData.selected}</span>
                        <span>${galleryData.percent}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress" style="width: ${galleryData.percent}%"></div>
                    </div>
                </div>
                <div class="gallery-actions">
                    <button class="action-icon" title="View Gallery">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-icon" title="Share with Client">
                        <i class="fas fa-share-alt"></i>
                    </button>
                    <button class="action-icon" title="Download Selections">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="action-icon" title="Delete Gallery">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        
        // Add event listeners for actions
        setupGalleryCardActions(card);
        
        // Add to grid
        galleryGrid.appendChild(card);
    }
    
    // Create list row
    const galleryTableBody = document.getElementById('galleryTableBody');
    if (galleryTableBody) {
        const row = document.createElement('tr');
        row.className = 'animate-in';
        row.style.animationDelay = isSecond ? '0.2s' : '0';
        
        row.innerHTML = `
            <td class="gallery-name">${galleryData.name}</td>
            <td>${galleryData.date}</td>
            <td><span class="status-badge ${galleryData.status}">${galleryData.statusText}</span></td>
            <td>${galleryData.total}</td>
            <td>${galleryData.selected}</td>
            <td>${galleryData.expires}</td>
            <td class="table-actions">
                <button class="action-icon" title="View Gallery">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-icon" title="Share with Client">
                    <i class="fas fa-share-alt"></i>
                </button>
                <button class="action-icon" title="Download Selections">
                    <i class="fas fa-download"></i>
                </button>
                <button class="action-icon" title="Delete Gallery">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        // Add event listeners for actions
        setupGalleryRowActions(row);
        
        // Add to table
        galleryTableBody.appendChild(row);
    }
}

/**
 * Setup gallery card action buttons
 */
function setupGalleryCardActions(card) {
    const viewBtn = card.querySelector('[title="View Gallery"]');
    const shareBtn = card.querySelector('[title="Share with Client"]');
    const downloadBtn = card.querySelector('[title="Download Selections"]');
    const deleteBtn = card.querySelector('[title="Delete Gallery"]');
    
    if (viewBtn) {
        viewBtn.addEventListener('click', function() {
            alert('View Gallery feature will be implemented in the next phase.');
        });
    }
    
    if (shareBtn) {
        shareBtn.addEventListener('click', function() {
            alert('Share with Client feature will be implemented in the next phase.');
        });
    }
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            alert('Download Selections feature will be implemented in the next phase.');
        });
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to delete this gallery?')) {
                // Remove card with animation
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9)';
                setTimeout(() => {
                    card.remove();
                    
                    // Check if there are any galleries left
                    const remainingCards = document.querySelectorAll('.gallery-card:not(.sample-card)');
                    if (remainingCards.length === 0) {
                        // Show empty state
                        document.getElementById('emptyGalleryState').style.display = 'flex';
                    }
                    
                    // Update statistics
                    updateStatistics(remainingCards.length, 0, '0 MB');
                }, 300);
            }
        });
    }
}

/**
 * Setup gallery row action buttons
 */
function setupGalleryRowActions(row) {
    const viewBtn = row.querySelector('[title="View Gallery"]');
    const shareBtn = row.querySelector('[title="Share with Client"]');
    const downloadBtn = row.querySelector('[title="Download Selections"]');
    const deleteBtn = row.querySelector('[title="Delete Gallery"]');
    
    if (viewBtn) {
        viewBtn.addEventListener('click', function() {
            alert('View Gallery feature will be implemented in the next phase.');
        });
    }
    
    if (shareBtn) {
        shareBtn.addEventListener('click', function() {
            alert('Share with Client feature will be implemented in the next phase.');
        });
    }
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', function() {
            alert('Download Selections feature will be implemented in the next phase.');
        });
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to delete this gallery?')) {
                // Remove row with animation
                row.style.opacity = '0';
                setTimeout(() => {
                    row.remove();
                    
                    // Check if there are any galleries left
                    const remainingRows = document.querySelectorAll('#galleryTableBody tr:not(.sample-row)');
                    if (remainingRows.length === 0) {
                        // Show empty state if we switch to grid view
                        document.getElementById('emptyGalleryState').style.display = 'flex';
                    }
                    
                    // Update statistics
                    updateStatistics(remainingRows.length, 0, '0 MB');
                }, 300);
            }
        });
    }
}
