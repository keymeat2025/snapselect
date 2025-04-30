/**
 * analytics-manager.js - Analytics functionality
 */

/**
 * Track events to analytics service
 * @param {string} eventName - Name of the event to track
 * @param {Object} eventData - Additional data for the event
 */
function trackEvent(eventName, eventData = {}) {
  try {
    // Access Firebase Analytics if available
    if (typeof firebase !== 'undefined' && firebase.analytics) {
      firebase.analytics().logEvent(eventName, eventData);
      console.log(`Event tracked: ${eventName}`, eventData);
    } else {
      console.log(`Event would be tracked (dev mode): ${eventName}`, eventData);
    }
  } catch (error) {
    console.error('Error tracking event:', error);
  }
}

/**
 * Load analytics data from the server
 * @returns {Promise} Promise resolved with analytics data
 */
function loadAnalyticsData() {
  showLoadingState();
  
  return new Promise((resolve, reject) => {
    // Implementation would fetch data from server
    // For now, we'll just simulate this with a timeout
    setTimeout(() => {
      try {
        // Load data (mock implementation)
        const data = getAnalyticsData();
        hideLoadingState();
        resolve(data);
      } catch (error) {
        hideLoadingState();
        showErrorMessage('Failed to load analytics data');
        reject(error);
      }
    }, 1000);
  });
}

/**
 * Export analytics data to CSV
 */
function exportAnalyticsToCSV() {
    // Create CSV content
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    // Add gallery statistics
    csvContent += 'Gallery Statistics\n';
    csvContent += 'Total Galleries,Active Galleries,Completed Galleries,Expired Galleries\n';
    csvContent += `${analyticsData.galleries.total},${analyticsData.galleries.active},${analyticsData.galleries.completed},${analyticsData.galleries.expired}\n\n`;
    
    // Add photo statistics
    csvContent += 'Photo Statistics\n';
    csvContent += 'Total Photos,Selected Photos,Selection Rate\n';
    csvContent += `${analyticsData.photos.total},${analyticsData.photos.selected},${analyticsData.photos.selectionRate.toFixed(1)}%\n\n`;
    
    // Add storage statistics
    csvContent += 'Storage Statistics\n';
    csvContent += 'Used Storage (GB),Available Storage (GB),Percent Used\n';
    csvContent += `${analyticsData.storage.used.toFixed(2)},${analyticsData.storage.available.toFixed(2)},${analyticsData.storage.percentUsed.toFixed(1)}%\n\n`;
    
    // Add client statistics
    csvContent += 'Client Statistics\n';
    csvContent += 'Total Clients,Active Clients,Returning Clients\n';
    csvContent += `${analyticsData.clients.total},${analyticsData.clients.active},${analyticsData.clients.returning}\n\n`;
    
    // Add activity data
    csvContent += 'Activity Data\n';
    csvContent += 'Date,Views,Selections,Uploads\n';
    
    for (let i = 0; i < analyticsData.activity.views.length; i++) {
        const date = analyticsData.activity.views[i].date;
        const views = analyticsData.activity.views[i].count;
        const selections = analyticsData.activity.selections[i].count;
        const uploads = analyticsData.activity.uploads[i].count;
        
        csvContent += `${date},${views},${selections},${uploads}\n`;
    }
    
    csvContent += '\n';
    
    // Add popular templates
    csvContent += 'Popular Templates\n';
    csvContent += 'Template,Count,Percent\n';
    
    const sortedTemplates = Object.entries(analyticsData.popular.templates)
        .sort((a, b) => b[1] - a[1]);
    
    sortedTemplates.forEach(([template, count]) => {
        const percent = (count / analyticsData.galleries.total * 100).toFixed(1);
        csvContent += `${template},${count},${percent}%\n`;
    });
    
    csvContent += '\n';
    
    // Add popular features
    if (analyticsData.popular.settings.features) {
        csvContent += 'Popular Features\n';
        csvContent += 'Feature,Count,Percent\n';
        
        const sortedFeatures = Object.entries(analyticsData.popular.settings.features)
            .sort((a, b) => b[1] - a[1]);
        
        sortedFeatures.forEach(([feature, count]) => {
            const percent = (count / analyticsData.galleries.total * 100).toFixed(1);
            csvContent += `${formatFeatureName(feature)},${count},${percent}%\n`;
        });
    }
    
    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `snapselect-analytics-${dateStr}.csv`);
    
    // Track export event
    trackEvent('analytics_export', { format: 'csv' });
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Export analytics data to PDF
 */
function exportAnalyticsToPDF() {
    // Check if jsPDF is loaded (would need to be included in your HTML)
    if (typeof jsPDF === 'undefined') {
        alert('PDF export library not loaded. Please try again later.');
        return;
    }
    
    try {
        // Create PDF document
        const pdf = new jsPDF();
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        let yPos = 20;
        
        // Add title
        pdf.setFontSize(18);
        pdf.text('SnapSelect Analytics Report', 105, yPos, { align: 'center' });
        yPos += 10;
        
        pdf.setFontSize(12);
        pdf.text(`Generated on ${dateStr}`, 105, yPos, { align: 'center' });
        yPos += 20;
        
        // Add gallery statistics
        pdf.setFontSize(16);
        pdf.text('Gallery Statistics', 14, yPos);
        yPos += 10;
        
        pdf.setFontSize(12);
        pdf.text(`Total Galleries: ${analyticsData.galleries.total}`, 20, yPos);
        yPos += 7;
        pdf.text(`Active Galleries: ${analyticsData.galleries.active}`, 20, yPos);
        yPos += 7;
        pdf.text(`Completed Galleries: ${analyticsData.galleries.completed}`, 20, yPos);
        yPos += 7;
        pdf.text(`Expired Galleries: ${analyticsData.galleries.expired}`, 20, yPos);
        yPos += 15;
        
        // Add photo statistics
        pdf.setFontSize(16);
        pdf.text('Photo Statistics', 14, yPos);
        yPos += 10;
        
        pdf.setFontSize(12);
        pdf.text(`Total Photos: ${analyticsData.photos.total}`, 20, yPos);
        yPos += 7;
        pdf.text(`Selected Photos: ${analyticsData.photos.selected}`, 20, yPos);
        yPos += 7;
        pdf.text(`Selection Rate: ${analyticsData.photos.selectionRate.toFixed(1)}%`, 20, yPos);
        yPos += 15;
        
        // Add storage statistics
        pdf.setFontSize(16);
        pdf.text('Storage Statistics', 14, yPos);
        yPos += 10;
        
        pdf.setFontSize(12);
        pdf.text(`Used Storage: ${analyticsData.storage.used.toFixed(2)} GB`, 20, yPos);
        yPos += 7;
        pdf.text(`Available Storage: ${analyticsData.storage.available.toFixed(2)} GB`, 20, yPos);
        yPos += 7;
        pdf.text(`Percent Used: ${analyticsData.storage.percentUsed.toFixed(1)}%`, 20, yPos);
        yPos += 15;
        
        // Add client statistics
        pdf.setFontSize(16);
        pdf.text('Client Statistics', 14, yPos);
        yPos += 10;
        
        pdf.setFontSize(12);
        pdf.text(`Total Clients: ${analyticsData.clients.total}`, 20, yPos);
        yPos += 7;
        pdf.text(`Active Clients: ${analyticsData.clients.active}`, 20, yPos);
        yPos += 7;
        pdf.text(`Returning Clients: ${analyticsData.clients.returning}`, 20, yPos);
        yPos += 15;
        
        // Check if we need a new page
        if (yPos > 250) {
            pdf.addPage();
            yPos = 20;
        }
        
        // Add popular templates
        pdf.setFontSize(16);
        pdf.text('Popular Templates', 14, yPos);
        yPos += 10;
        
        const sortedTemplates = Object.entries(analyticsData.popular.templates)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Top 5 only for PDF
        
        pdf.setFontSize(12);
        if (sortedTemplates.length > 0) {
            sortedTemplates.forEach(([template, count]) => {
                const percent = (count / analyticsData.galleries.total * 100).toFixed(1);
                pdf.text(`${template}: ${count} (${percent}%)`, 20, yPos);
                yPos += 7;
            });
        } else {
            pdf.text('No template data available', 20, yPos);
            yPos += 7;
        }
        
        yPos += 8;
        
        // Add footnote
        pdf.setFontSize(10);
        pdf.text('Generated by SnapSelect Analytics', 105, 280, { align: 'center' });
        
        // Track export event
        trackEvent('analytics_export', { format: 'pdf' });
        
        // Save PDF
        pdf.save(`snapselect-analytics-${now.toISOString().split('T')[0]}.pdf`);
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF. Please try again later.');
    }
}

/**
 * Export analytics data to JSON
 */
function exportAnalyticsToJSON() {
    // Create JSON content
    const jsonData = {
        exportDate: new Date().toISOString(),
        galleries: analyticsData.galleries,
        photos: analyticsData.photos,
        storage: analyticsData.storage,
        clients: analyticsData.clients,
        activity: analyticsData.activity,
        popular: analyticsData.popular
    };
    
    // Convert to string
    const jsonString = JSON.stringify(jsonData, null, 2);
    
    // Create download link
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonString);
    const downloadAnchorNode = document.createElement('a');
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', `snapselect-analytics-${dateStr}.json`);
    
    // Track export event
    trackEvent('analytics_export', { format: 'json' });
    
    // Append to body, click, and remove
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format event name for display
 */
function formatEventName(eventName) {
    // Convert snake_case to Title Case
    return eventName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Format event details for display
 */
function formatEventDetails(event) {
    if (!event || !event.data) {
        return 'No details available';
    }
    
    switch (event.event) {
        case 'gallery_created':
            return `Gallery "${event.data.galleryName || 'Unnamed'}" created`;
        
        case 'gallery_viewed':
            return `Gallery "${event.data.galleryName || 'Unnamed'}" viewed`;
        
        case 'photo_selected':
            return `Photo selected in gallery "${event.data.galleryName || 'Unnamed'}"`;
        
        case 'photo_deselected':
            return `Photo deselected in gallery "${event.data.galleryName || 'Unnamed'}"`;
        
        case 'gallery_completed':
            return `Gallery "${event.data.galleryName || 'Unnamed'}" completed with ${event.data.selectedCount || 0} photos`;
        
        case 'user_login':
            return `User logged in`;
        
        case 'user_signup':
            return `New user signed up`;
        
        case 'photos_uploaded':
            return `${event.data.count || 1} photos uploaded to gallery "${event.data.galleryName || 'Unnamed'}"`;
        
        case 'photos_downloaded':
            return `${event.data.count || 1} photos downloaded from gallery "${event.data.galleryName || 'Unnamed'}"`;
        
        case 'plan_upgraded':
            return `Plan upgraded to ${event.data.planName || 'new plan'}`;
        
        case 'page_view':
            return `Page viewed: ${event.data.url || 'Unknown page'}`;
        
        default:
            return `${formatEventName(event.event)}`;
    }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
    if (!timestamp) {
        return 'Unknown time';
    }
    
    const now = new Date();
    const date = new Date(timestamp);
    
    // If today, show time only
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    
    // If this year, show month and day
    if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    // Otherwise show full date
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Format feature name for display
 */
function formatFeatureName(feature) {
    // Convert camelCase or snake_case to Title Case
    if (feature.includes('_')) {
        // Snake case
        return feature
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    } else {
        // Camel case or normal
        // First, split by capital letters
        const words = feature.replace(/([A-Z])/g, ' $1').trim();
        
        // Then capitalize first letter
        return words.charAt(0).toUpperCase() + words.slice(1);
    }
}

/**
 * Show loading state for analytics dashboard
 */
function showLoadingState() {
    // Create loading overlay if it doesn't exist
    let loadingOverlay = document.getElementById('analyticsLoadingOverlay');
    
    if (!loadingOverlay) {
        loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'analyticsLoadingOverlay';
        loadingOverlay.className = 'loading-overlay';
        
        const spinner = document.createElement('div');
        spinner.className = 'loading-spinner';
        
        const message = document.createElement('div');
        message.className = 'loading-message';
        message.textContent = 'Loading analytics data...';
        
        loadingOverlay.appendChild(spinner);
        loadingOverlay.appendChild(message);
        
        const dashboard = document.getElementById('analyticsDashboard');
        if (dashboard) {
            dashboard.appendChild(loadingOverlay);
        } else {
            document.body.appendChild(loadingOverlay);
        }
    }
    
    // Show the overlay
    loadingOverlay.style.display = 'flex';
}

/**
 * Hide loading state for analytics dashboard
 */
function hideLoadingState() {
    const loadingOverlay = document.getElementById('analyticsLoadingOverlay');
    
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

/**
 * Show error message on analytics dashboard
 */
function showErrorMessage(message) {
    // Create error message element if it doesn't exist
    let errorElement = document.getElementById('analyticsErrorMessage');
    
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.id = 'analyticsErrorMessage';
        errorElement.className = 'error-message';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-error';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', function() {
            errorElement.style.display = 'none';
        });
        
        const messageText = document.createElement('span');
        
        errorElement.appendChild(closeBtn);
        errorElement.appendChild(messageText);
        
        const dashboard = document.getElementById('analyticsDashboard');
        if (dashboard) {
            dashboard.insertBefore(errorElement, dashboard.firstChild);
        }
    }
    
    // Set message text
    const messageElement = errorElement.querySelector('span');
    if (messageElement) {
        messageElement.textContent = message;
    }
    
    // Show the error message
    errorElement.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorElement.style.display = 'none';
    }, 5000);
}

/**
 * Helper function to get analytics data (mock implementation)
 * This would be replaced with actual API calls in production
 */
function getAnalyticsData() {
    // This is just a placeholder - in a real implementation you'd fetch data from your backend
    return {
        galleries: {
            total: 0,
            active: 0,
            completed: 0,
            expired: 0
        },
        photos: {
            total: 0,
            selected: 0,
            selectionRate: 0
        },
        storage: {
            used: 0,
            available: 0,
            percentUsed: 0
        },
        clients: {
            total: 0,
            active: 0,
            returning: 0
        },
        activity: {
            views: [],
            selections: [],
            uploads: []
        },
        popular: {
            templates: {},
            settings: {
                features: {}
            }
        }
    };
}

// Expose analytics manager functions for use in other files
window.analyticsManager = {
    trackEvent,
    loadAnalyticsData,
    exportAnalyticsToCSV,
    exportAnalyticsToPDF,
    exportAnalyticsToJSON,
    formatDate,
    formatEventName,
    formatEventDetails,
    formatTimestamp,
    formatFeatureName
};
