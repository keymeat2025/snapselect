/**
 * SnapSelect Nexus Dashboard - Photographers Data Management
 * This file handles all photographer-related functionality and ensures consistent data
 * across the dashboard and photographers pages.
 */

// Global variables to track the current photographers state
let photographersData = [];
let photographersStats = {
    totalCount: 0,
    approvedCount: 0,
    pendingCount: 0,
    rejectedCount: 0
};

/**
 * Initialize the photographers data system
 * Call this when the application starts
 */
function initPhotographersSystem() {
    console.log("Initializing photographers system...");
    loadPhotographersData();
}

/**
 * Load photographers data from Firebase
 * Updates both the dashboard cards and photographers management page
 */
function loadPhotographersData() {
    // Show loading indicator if available
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        
        if (document.querySelector('.loading-text')) {
            document.querySelector('.loading-text').textContent = 'Loading photographers data...';
        }
    }
    
    // Get reference to Firestore
    const db = firebase.firestore();
    const photographersRef = db.collection('photographer');
    
    // Fetch all photographers
    photographersRef.get().then(function(snapshot) {
        // Reset data array
        photographersData = [];
        
        // Process each photographer document
        snapshot.forEach(function(doc) {
            const data = doc.data();
            
            // Ensure consistent status values
            let status = data.status || 'pending';
            
            // Standardize status values
            if (status === 'active') status = 'approved';
            
            // Add to our data array
            photographersData.push({
                id: doc.id,
                ...data,
                status: status
            });
        });
        
        // Calculate statistics
        updatePhotographersStats();
        
        // Update UI elements
        updateDashboardUI();
        updatePhotographersManagementUI();
        
        // Hide loading overlay
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        
        console.log("Photographers data loaded:", photographersData.length, "records");
    }).catch(function(error) {
        console.error("Error loading photographers data:", error);
        
        // Hide loading overlay
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        
        // Show error toast if the function exists
        if (typeof showToast === 'function') {
            showToast('Error', 'Failed to load photographers data', 'error');
        }
    });
}

/**
 * Calculate photographer statistics based on the loaded data
 */
function updatePhotographersStats() {
    photographersStats.totalCount = photographersData.length;
    photographersStats.approvedCount = photographersData.filter(p => p.status === 'approved').length;
    photographersStats.pendingCount = photographersData.filter(p => p.status === 'pending').length;
    photographersStats.rejectedCount = photographersData.filter(p => 
        p.status === 'rejected' || p.status === 'inactive'
    ).length;
    
    // Store in session storage for persistence between page navigations
    sessionStorage.setItem('totalPhotographers', photographersStats.totalCount);
    sessionStorage.setItem('approvedPhotographers', photographersStats.approvedCount);
    sessionStorage.setItem('pendingPhotographers', photographersStats.pendingCount);
    sessionStorage.setItem('rejectedPhotographers', photographersStats.rejectedCount);
    
    console.log("Photographers stats updated:", photographersStats);
}

/**
 * Update the main dashboard UI with current photographer counts
 */
function updateDashboardUI() {
    // Check if we're on the dashboard page by looking for dashboard elements
    const dashboardCards = document.querySelector('.dashboard-cards');
    if (!dashboardCards) return;
    
    // Update the active photographers card value
    const activePhotographersElement = document.querySelector('.dashboard-cards .dashboard-card:nth-child(1) .card-value');
    if (activePhotographersElement) {
        activePhotographersElement.textContent = photographersStats.approvedCount;
    }
    
    // Check if we need to add a total photographers card
    let totalPhotographersElement = document.querySelector('.dashboard-card .card-label:contains("Total Photographers")');
    const needToAddTotalCard = !totalPhotographersElement;
    
    if (needToAddTotalCard) {
        // Create a new card for total photographers
        const totalCard = document.createElement('div');
        totalCard.className = 'dashboard-card';
        totalCard.innerHTML = `
            <div class="card-icon">
                <i class="fas fa-users"></i>
            </div>
            <div class="card-value">${photographersStats.totalCount}</div>
            <div class="card-label">Total Photographers</div>
            <div class="card-trend trend-up">
                <i class="fas fa-arrow-up"></i> 5% this month
            </div>
        `;
        
        // Insert it after the active photographers card
        const activeCard = document.querySelector('.dashboard-cards .dashboard-card:nth-child(1)');
        if (activeCard && activeCard.nextElementSibling) {
            dashboardCards.insertBefore(totalCard, activeCard.nextElementSibling);
        } else {
            dashboardCards.appendChild(totalCard);
        }
    } else if (totalPhotographersElement) {
        // Update the existing total photographers value
        const parentCard = totalPhotographersElement.closest('.dashboard-card');
        if (parentCard) {
            const valueElement = parentCard.querySelector('.card-value');
            if (valueElement) {
                valueElement.textContent = photographersStats.totalCount;
            }
        }
    }
    
    console.log("Dashboard UI updated with photographer counts");
}

/**
 * Update the photographers management page UI
 */
function updatePhotographersManagementUI() {
    // Check if we're on the photographers management page
    const photographersManagement = document.getElementById('totalPhotographers');
    if (!photographersManagement) return;
    
    // Update the counter cards
    document.getElementById('totalPhotographers').textContent = photographersStats.totalCount;
    document.getElementById('approvedPhotographers').textContent = photographersStats.approvedCount;
    document.getElementById('pendingPhotographers').textContent = photographersStats.pendingCount;
    document.getElementById('rejectedPhotographers').textContent = photographersStats.rejectedCount;
    
    // If the table body exists, update it with the current data
    const tableBody = document.getElementById('photographersTableBody');
    if (tableBody) {
        updatePhotographersTable(tableBody);
    }
    
    console.log("Photographers management UI updated");
}

/**
 * Update the photographers table with filtered and paginated data
 */
function updatePhotographersTable(tableBody) {
    // Get current filters
    const statusFilter = document.getElementById('statusFilter')?.value || 'all';
    const locationFilter = document.getElementById('locationFilter')?.value || 'all';
    const searchTerm = document.getElementById('photographerSearch')?.value?.toLowerCase() || '';
    
    // Apply filters
    let filteredData = [...photographersData];
    
    if (statusFilter !== 'all') {
        filteredData = filteredData.filter(p => p.status === statusFilter);
    }
    
    if (locationFilter !== 'all') {
        filteredData = filteredData.filter(p => p.studioAddress === locationFilter);
    }
    
    if (searchTerm) {
        filteredData = filteredData.filter(p => 
            (p.ownerName && p.ownerName.toLowerCase().includes(searchTerm)) ||
            (p.studioName && p.studioName.toLowerCase().includes(searchTerm)) ||
            (p.studioAddress && p.studioAddress.toLowerCase().includes(searchTerm))
        );
    }
    
    // Pagination
    const itemsPerPage = 10;
    const currentPage = parseInt(document.getElementById('currentPage')?.textContent || '1');
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    
    // Update pagination UI
    document.getElementById('totalPages').textContent = totalPages;
    document.getElementById('prevPage').disabled = currentPage <= 1;
    document.getElementById('nextPage').disabled = currentPage >= totalPages;
    
    // Get current page data
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);
    
    // Update table rows
    if (paginatedData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">No photographers found matching the current filters.</td>
            </tr>
        `;
        return;
    }
    
    // Build table HTML
    let tableHTML = '';
    paginatedData.forEach(photographer => {
        const statusClass = photographer.status === 'approved' ? 'status-active' : 
                          photographer.status === 'pending' ? 'status-pending' : 'status-inactive';
        
        const statusLabel = photographer.status === 'approved' ? 'Active' : 
                          photographer.status === 'pending' ? 'Pending' : 'Inactive';
        
        tableHTML += `
            <tr data-id="${photographer.id}">
                <td>${photographer.ownerName || 'Unknown'}</td>
                <td>${photographer.studioName || 'N/A'}</td>
                <td>${photographer.studioAddress || 'N/A'}</td>
                <td>${formatDate(photographer.registrationDate)}</td>
                <td><span class="status-pill ${statusClass}">${statusLabel}</span></td>
                <td>
                    <button class="action-btn view-photographer" data-id="${photographer.id}">
                        <i class="fas fa-eye"></i>
                    </button>
                    ${photographer.status === 'pending' ? `
                        <button class="action-btn approve-photographer" data-id="${photographer.id}">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="action-btn danger reject-photographer" data-id="${photographer.id}">
                            <i class="fas fa-times"></i>
                        </button>
                    ` : photographer.status === 'approved' ? `
                        <button class="action-btn edit-photographer" data-id="${photographer.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn warning suspend-photographer" data-id="${photographer.id}">
                            <i class="fas fa-pause"></i>
                        </button>
                    ` : `
                        <button class="action-btn approve-photographer" data-id="${photographer.id}">
                            <i class="fas fa-redo"></i>
                        </button>
                    `}
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = tableHTML;
    
    // Add event listeners to action buttons
    addPhotographerTableEventListeners();
}

/**
 * Add event listeners to the photographer table action buttons
 */
function addPhotographerTableEventListeners() {
    // View photographer
    document.querySelectorAll('.view-photographer').forEach(btn => {
        btn.addEventListener('click', function() {
            const photographerId = this.getAttribute('data-id');
            openPhotographerDetails(photographerId);
        });
    });
    
    // Approve photographer
    document.querySelectorAll('.approve-photographer').forEach(btn => {
        btn.addEventListener('click', function() {
            const photographerId = this.getAttribute('data-id');
            updatePhotographerStatus(photographerId, 'approved');
        });
    });
    
    // Reject photographer
    document.querySelectorAll('.reject-photographer').forEach(btn => {
        btn.addEventListener('click', function() {
            const photographerId = this.getAttribute('data-id');
            updatePhotographerStatus(photographerId, 'rejected');
        });
    });
    
    // Suspend photographer
    document.querySelectorAll('.suspend-photographer').forEach(btn => {
        btn.addEventListener('click', function() {
            const photographerId = this.getAttribute('data-id');
            updatePhotographerStatus(photographerId, 'inactive');
        });
    });
    
    // Edit photographer (if implemented)
    document.querySelectorAll('.edit-photographer').forEach(btn => {
        btn.addEventListener('click', function() {
            const photographerId = this.getAttribute('data-id');
            // Call your edit function if exists
            if (typeof editPhotographer === 'function') {
                editPhotographer(photographerId);
            }
        });
    });
}

/**
 * Update a photographer's status
 */
function updatePhotographerStatus(photographerId, newStatus) {
    // Show loading
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'flex';
        
        if (document.querySelector('.loading-text')) {
            document.querySelector('.loading-text').textContent = 'Updating photographer...';
        }
    }
    
    // Get reference to Firestore
    const db = firebase.firestore();
    
    // Update the photographer status
    db.collection('photographer').doc(photographerId).update({
        status: newStatus,
        statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
        console.log(`Photographer ${photographerId} status updated to ${newStatus}`);
        
        // Reload photographers data to update all UI elements
        loadPhotographersData();
        
        // Show success toast if function exists
        if (typeof showToast === 'function') {
            const action = newStatus === 'approved' ? 'approved' : 
                         newStatus === 'rejected' ? 'rejected' : 'updated';
            showToast('Success', `Photographer ${action} successfully`, 'success');
        }
    }).catch(function(error) {
        console.error("Error updating photographer status:", error);
        
        // Hide loading overlay
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        
        // Show error toast if function exists
        if (typeof showToast === 'function') {
            showToast('Error', 'Failed to update photographer status', 'error');
        }
    });
}

/**
 * Format a date for display
 */
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    // Handle Firebase Timestamp objects
    if (timestamp && typeof timestamp.toDate === 'function') {
        timestamp = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
        // Try parsing string date
        timestamp = new Date(timestamp);
    }
    
    // Check if date is valid
    if (!(timestamp instanceof Date) || isNaN(timestamp)) {
        return 'Invalid date';
    }
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return timestamp.toLocaleDateString('en-US', options);
}

/**
 * Open photographer details modal
 */
function openPhotographerDetails(photographerId) {
    const photographer = photographersData.find(p => p.id === photographerId);
    if (!photographer) {
        if (typeof showToast === 'function') {
            showToast('Error', 'Photographer not found', 'error');
        }
        return;
    }
    
    const modal = document.getElementById('photographerModal');
    if (!modal) return;
    
    const modalBody = document.getElementById('modalBody');
    const modalTitle = document.getElementById('modalTitle');
    
    // Set modal title
    modalTitle.textContent = 'Photographer Details: ' + (photographer.ownerName || 'Unknown');
    
    // Set modal content
    modalBody.innerHTML = `
        <div class="photographer-profile">
            <div class="profile-image">
                <i class="fas fa-user fa-3x"></i>
            </div>
            <div class="profile-details">
                <h3 class="profile-name">${photographer.ownerName || 'Unknown'}</h3>
                <div class="profile-specialty">${photographer.studioName || 'No studio name'}</div>
                
                <div class="profile-contact">
                    <div class="contact-item">
                        <i class="fas fa-envelope contact-icon"></i>
                        ${photographer.ownerEmail || 'No email provided'}
                    </div>
                    <div class="contact-item">
                        <i class="fas fa-phone contact-icon"></i>
                        ${photographer.ownerNumber || 'No phone provided'}
                    </div>
                    <div class="contact-item">
                        <i class="fas fa-map-marker-alt contact-icon"></i>
                        ${photographer.studioAddress || 'No address provided'}
                    </div>
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <h4 class="detail-heading">Studio Information</h4>
            <p><strong>Studio Name:</strong> ${photographer.studioName || 'N/A'}</p>
            <p><strong>Studio Address:</strong> ${photographer.studioAddress || 'N/A'}</p>
            <p><strong>Studio Pincode:</strong> ${photographer.studioPincode || 'N/A'}</p>
        </div>
        
        <div class="detail-section">
            <h4 class="detail-heading">Registration Information</h4>
            <p><strong>Registration Date:</strong> ${formatDate(photographer.registrationDate)}</p>
            <p><strong>Status:</strong> <span class="status-pill ${
                photographer.status === 'approved' ? 'status-active' : 
                photographer.status === 'pending' ? 'status-pending' : 'status-inactive'
            }">${
                photographer.status === 'approved' ? 'Approved' : 
                photographer.status === 'pending' ? 'Pending' : 'Inactive'
            }</span></p>
            <p><strong>Photographer ID:</strong> ${photographer.id}</p>
        </div>
    `;
    
    // Show/hide action buttons based on status
    const approveBtn = document.getElementById('approveBtn');
    const rejectBtn = document.getElementById('rejectBtn');
    
    if (photographer.status === 'pending') {
        approveBtn.style.display = 'block';
        rejectBtn.style.display = 'block';
        
        // Set button actions
        approveBtn.onclick = function() {
            updatePhotographerStatus(photographerId, 'approved');
            modal.style.display = 'none';
        };
        
        rejectBtn.onclick = function() {
            updatePhotographerStatus(photographerId, 'rejected');
            modal.style.display = 'none';
        };
    } else {
        approveBtn.style.display = 'none';
        rejectBtn.style.display = 'none';
    }
    
    // Setup close button events
    document.querySelector('.close-modal').onclick = function() {
        modal.style.display = 'none';
    };
    
    document.getElementById('closeModalBtn').onclick = function() {
        modal.style.display = 'none';
    };
    
    // Show modal
    modal.style.display = 'block';
    
    // Close on outside click
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
}

/**
 * Initialize event listeners for the photographers page
 */
function initPhotographersPageEventListeners() {
    // Search input
    const searchInput = document.getElementById('photographerSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const tableBody = document.getElementById('photographersTableBody');
            if (tableBody) {
                updatePhotographersTable(tableBody);
            }
        });
    }
    
    // Filter dropdowns
    ['statusFilter', 'locationFilter'].forEach(filterId => {
        const filterElement = document.getElementById(filterId);
        if (filterElement) {
            filterElement.addEventListener('change', function() {
                // Reset to first page
                const currentPageElement = document.getElementById('currentPage');
                if (currentPageElement) {
                    currentPageElement.textContent = '1';
                }
                
                // Update table
                const tableBody = document.getElementById('photographersTableBody');
                if (tableBody) {
                    updatePhotographersTable(tableBody);
                }
            });
        }
    });
    
    // Pagination buttons
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', function() {
            const currentPageElement = document.getElementById('currentPage');
            if (currentPageElement) {
                const currentPage = parseInt(currentPageElement.textContent);
                if (currentPage > 1) {
                    currentPageElement.textContent = currentPage - 1;
                    
                    // Update table
                    const tableBody = document.getElementById('photographersTableBody');
                    if (tableBody) {
                        updatePhotographersTable(tableBody);
                    }
                }
            }
        });
    }
    
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', function() {
            const currentPageElement = document.getElementById('currentPage');
            const totalPagesElement = document.getElementById('totalPages');
            
            if (currentPageElement && totalPagesElement) {
                const currentPage = parseInt(currentPageElement.textContent);
                const totalPages = parseInt(totalPagesElement.textContent);
                
                if (currentPage < totalPages) {
                    currentPageElement.textContent = currentPage + 1;
                    
                    // Update table
                    const tableBody = document.getElementById('photographersTableBody');
                    if (tableBody) {
                        updatePhotographersTable(tableBody);
                    }
                }
            }
        });
    }
}

// Call initialization when this script is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("nexus-dashboard.js loaded");
    
    // Initialize the photographers system
    initPhotographersSystem();
    
    // Check if we're on the photographers page and initialize its specific listeners
    if (document.getElementById('photographersTableBody')) {
        initPhotographersPageEventListeners();
    }
});

// jQuery-like helper for element selection with contains text
if (!Element.prototype.matches) {
    Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
}

if (typeof jQuery === 'undefined') {
    document.querySelectorAll = document.querySelectorAll || function(selector) {
        return Array.prototype.slice.call(document.querySelectorAll(selector));
    };
    
    // Add contains selector support
    if (!document.querySelector(':contains')) {
        // Add a custom contains pseudo-selector
        document.querySelector = (function(originalQuerySelector) {
            return function(selector) {
                if (selector.includes(':contains')) {
                    const parts = selector.split(':contains');
                    const baseSelector = parts[0];
                    const text = parts[1].replace(/['")(]/g, '').trim();
                    
                    const elements = document.querySelectorAll(baseSelector);
                    for (let i = 0; i < elements.length; i++) {
                        if (elements[i].textContent.includes(text)) {
                            return elements[i];
                        }
                    }
                    return null;
                }
                return originalQuerySelector.call(this, selector);
            };
        })(document.querySelector);
    }
}
