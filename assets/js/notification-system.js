/**
 * Enhanced notification-system.js - Combines Firebase backend with improved UI
 * Maintains all existing functionality while adding better visual design
 */

// Notification types
const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  PAYMENT: 'payment',
  PLAN: 'plan',
  CLIENT: 'client'
};

// Enhanced NotificationSystem class
class NotificationSystem {
  constructor() {
    this.notifications = [];
    this.unreadCount = 0;
    this.initialized = false;
    this.currentUser = null;
    this.notificationsRef = null;
    this.notificationsListener = null;
    
    // DOM elements
    this.notificationBtn = null;
    this.notificationCount = null;
    this.notificationDropdown = null;
    this.notificationList = null;
    this.markAllReadBtn = null;
    this.toastContainer = null;
    
    // Bind methods
    this.init = this.init.bind(this);
    this.initFirebase = this.initFirebase.bind(this);
    this.loadNotifications = this.loadNotifications.bind(this);
    this.updateNotificationCount = this.updateNotificationCount.bind(this);
    this.showNotification = this.showNotification.bind(this);
    this.createNotificationFromEvent = this.createNotificationFromEvent.bind(this);
    this.renderNotifications = this.renderNotifications.bind(this);
    this.markAllAsRead = this.markAllAsRead.bind(this);
    this.addEventListeners = this.addEventListeners.bind(this);
    this.handleAuthStateChanged = this.handleAuthStateChanged.bind(this);
    this.showToast = this.showToast.bind(this);
    this.createToastContainer = this.createToastContainer.bind(this);
  }
  
  // Initialize the notification system
  init() {
    if (this.initialized) return;
    
    // Create toast container if it doesn't exist
    this.createToastContainer();
    
    // Get DOM elements
    this.notificationBtn = document.getElementById('notificationBtn');
    this.notificationCount = document.getElementById('notificationCount');
    this.notificationDropdown = document.getElementById('notificationDropdown');
    this.notificationList = document.getElementById('notificationList');
    this.markAllReadBtn = document.getElementById('markAllReadBtn');
    this.toastContainer = document.getElementById('toastContainer');
    
    if (!this.notificationBtn || !this.notificationCount || !this.notificationDropdown || 
        !this.notificationList || !this.markAllReadBtn) {
      console.warn('Some notification DOM elements not found - limited functionality available');
    }
    
    // Set up Firebase auth listener
    if (firebase && firebase.auth) {
      firebase.auth().onAuthStateChanged(this.handleAuthStateChanged);
    } else {
      console.error('Firebase is not available. Notifications will not function properly.');
    }
    
    // Add event listeners
    this.addEventListeners();
    
    console.log('Enhanced NotificationSystem initialized');
    this.initialized = true;
  }
  
  // Create toast container if it doesn't exist
  createToastContainer() {
    if (!document.getElementById('toastContainer')) {
      const container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }
  }
  
  // Handle auth state changes
  handleAuthStateChanged(user) {
    // Clean up previous listener if it exists
    if (this.notificationsListener) {
      this.notificationsListener();
      this.notificationsListener = null;
    }
    
    if (user) {
      this.currentUser = user;
      console.log('User authenticated, initializing notifications for:', user.email);
      this.initFirebase();
    } else {
      this.currentUser = null;
      this.notifications = [];
      this.unreadCount = 0;
      this.updateNotificationCount();
      this.renderNotifications();
    }
  }
  
  // Initialize Firebase references
  initFirebase() {
    if (!this.currentUser || !firebase || !firebase.firestore) return;
    
    try {
      const db = firebase.firestore();
      
      // Create a reference to the user's notifications collection
      this.notificationsRef = db.collection('user_notifications')
        .doc(this.currentUser.uid)
        .collection('notifications');
      
      // Load initial notifications
      this.loadNotifications();
      
      // Set up real-time listener for notifications
      this.notificationsListener = this.notificationsRef
        .orderBy('timestamp', 'desc')
        .limit(50)
        .onSnapshot(snapshot => {
          // Handle notification updates in real-time
          this.handleNotificationUpdates(snapshot);
        }, error => {
          console.error('Error setting up notification listener:', error);
        });
        
    } catch (error) {
      console.error('Error initializing Firebase for notifications:', error);
    }
  }
  
  // Handle notification updates from Firestore
  handleNotificationUpdates(snapshot) {
    if (!snapshot) return;
    
    let newNotifications = [];
    let newUnreadCount = 0;
    
    snapshot.forEach(doc => {
      const notification = {
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date()
      };
      
      if (!notification.read) {
        newUnreadCount++;
      }
      
      newNotifications.push(notification);
    });
    
    // Update local notification state
    this.notifications = newNotifications;
    this.unreadCount = newUnreadCount;
    
    // Update UI
    this.updateNotificationCount();
    this.renderNotifications();
  }
  
  // Load notifications from Firebase
  loadNotifications() {
    if (!this.notificationsRef) return;
    
    this.notificationsRef
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get()
      .then(snapshot => {
        let newNotifications = [];
        let newUnreadCount = 0;
        
        snapshot.forEach(doc => {
          const notification = {
            id: doc.id,
            ...doc.data(),
            timestamp: doc.data().timestamp?.toDate() || new Date()
          };
          
          if (!notification.read) {
            newUnreadCount++;
          }
          
          newNotifications.push(notification);
        });
        
        // Update local notification state
        this.notifications = newNotifications;
        this.unreadCount = newUnreadCount;
        
        // Update UI
        this.updateNotificationCount();
        this.renderNotifications();
      })
      .catch(error => {
        console.error('Error loading notifications:', error);
      });
  }
  
  // Update notification count badge
  updateNotificationCount() {
    if (this.notificationCount) {
      this.notificationCount.textContent = this.unreadCount;
      this.notificationCount.style.display = this.unreadCount > 0 ? 'flex' : 'none';
    }
  }
  
  // Enhanced toast notification with better styling
  showToast(type, title, message, duration = 5000) {
    if (!this.toastContainer) this.createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    
    // Enhanced styling
    toast.style.cssText = `
      background: white;
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
      border-left: 4px solid ${this.getColorForType(type)};
      min-width: 300px;
      max-width: 400px;
      animation: slideInFromRight 0.3s ease;
      display: flex;
      align-items: center;
      gap: 12px;
      position: relative;
      pointer-events: auto;
      transform: translateX(100%);
      opacity: 0;
    `;
    
    // Add CSS animation keyframes if not already added
    if (!document.getElementById('toast-animations')) {
      const style = document.createElement('style');
      style.id = 'toast-animations';
      style.textContent = `
        @keyframes slideInFromRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutToRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
    
    const iconHtml = `<div style="font-size: 20px; color: ${this.getColorForType(type)}; flex-shrink: 0;">
      <i class="${this.getIconForType(type)}"></i>
    </div>`;
    
    const contentHtml = `<div style="flex: 1;">
      <div style="font-weight: 600; margin-bottom: 4px; color: #1f2937;">${title}</div>
      <div style="color: #6b7280; font-size: 14px; line-height: 1.4;">${message}</div>
    </div>`;
    
    const closeHtml = `<button style="
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s;
      flex-shrink: 0;
    " onmouseover="this.style.background='rgba(0,0,0,0.1)'" onmouseout="this.style.background='none'">
      <i class="fas fa-times"></i>
    </button>`;
    
    toast.innerHTML = iconHtml + contentHtml + closeHtml;
    
    // Add close functionality
    const closeBtn = toast.querySelector('button');
    closeBtn.addEventListener('click', () => {
      this.removeToast(toast);
    });
    
    // Add to container and animate in
    this.toastContainer.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    }, 10);
    
    // Auto remove after duration
    setTimeout(() => {
      this.removeToast(toast);
    }, duration);
    
    return toast;
  }
  
  // Remove toast with animation
  removeToast(toast) {
    if (toast && toast.parentNode) {
      toast.style.animation = 'slideOutToRight 0.3s ease forwards';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }
  }
  
  // Get color for notification type
  getColorForType(type) {
    switch (type) {
      case NOTIFICATION_TYPES.SUCCESS: return '#10b981';
      case NOTIFICATION_TYPES.ERROR: return '#ef4444';
      case NOTIFICATION_TYPES.WARNING: return '#f59e0b';
      case NOTIFICATION_TYPES.INFO: return '#3b82f6';
      case NOTIFICATION_TYPES.PAYMENT: return '#8b5cf6';
      case NOTIFICATION_TYPES.PLAN: return '#06b6d4';
      case NOTIFICATION_TYPES.CLIENT: return '#f97316';
      default: return '#6b7280';
    }
  }
  
  // Show notification and save to Firebase
  showNotification(type, title, message) {
    // Always show toast first for immediate feedback
    this.showToast(type, title, message);
    
    if (!this.currentUser || !this.notificationsRef) {
      console.warn('User not authenticated or notifications not initialized - only showing toast');
      return;
    }
    
    // Create notification object
    const notification = {
      type: type,
      title: title,
      message: message,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      read: false,
      userId: this.currentUser.uid
    };
    
    // Add to Firebase
    this.notificationsRef.add(notification)
      .then(docRef => {
        console.log('Notification added with ID:', docRef.id);
      })
      .catch(error => {
        console.error('Error adding notification:', error);
      });
  }
  
  // Create notification from event (keep existing functionality)
  createNotificationFromEvent(event) {
    if (!event || !event.type) return;
    
    let title = '';
    let message = '';
    let type = NOTIFICATION_TYPES.INFO;
    
    // Generate notification based on event type
    switch (event.type) {
      case 'client_created':
        title = 'New Client Added';
        message = `Client "${event.clientName}" has been created successfully.`;
        type = NOTIFICATION_TYPES.CLIENT;
        break;
        
      case 'plan_purchased':
        title = 'Plan Purchased';
        message = `${event.planName} plan has been purchased for ${event.clientName}.`;
        type = NOTIFICATION_TYPES.PLAN;
        break;
        
      case 'plan_expiring':
        title = 'Plan Expiring Soon';
        message = `The ${event.planName} plan for ${event.clientName} will expire in ${event.daysLeft} days.`;
        type = NOTIFICATION_TYPES.WARNING;
        break;
        
      case 'payment_successful':
        title = 'Payment Successful';
        message = `Payment of ₹${event.amount} for ${event.planName} plan has been completed successfully.`;
        type = NOTIFICATION_TYPES.PAYMENT;
        break;
        
      case 'storage_warning':
        title = 'Storage Warning';
        message = `Your storage usage has reached ${event.percentage}% of your limit.`;
        type = NOTIFICATION_TYPES.WARNING;
        break;
        
      case 'client_deleted':
        title = 'Client Deleted';
        message = `Client "${event.clientName}" has been permanently removed.`;
        type = NOTIFICATION_TYPES.WARNING;
        break;
        
      case 'access_revoked':
        title = 'Access Revoked';
        message = `Gallery sharing has been revoked successfully.`;
        type = NOTIFICATION_TYPES.INFO;
        break;
        
      default:
        // Handle generic notifications
        title = event.title || 'Notification';
        message = event.message || 'You have a new notification.';
        type = event.type || NOTIFICATION_TYPES.INFO;
    }
    
    // Show notification
    this.showNotification(type, title, message);
  }
  
  // Enhanced notification rendering
  renderNotifications() {
    if (!this.notificationList) return;
    
    // Clear notification list
    this.notificationList.innerHTML = '';
    
    if (this.notifications.length === 0) {
      // Show empty state
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-notification';
      emptyState.style.cssText = `
        padding: 32px 24px;
        text-align: center;
        color: #6b7280;
        font-size: 16px;
      `;
      emptyState.innerHTML = 'No notifications yet.';
      this.notificationList.appendChild(emptyState);
      return;
    }
    
    // Create notification items with enhanced styling
    this.notifications.forEach(notification => {
      const notificationItem = document.createElement('div');
      notificationItem.className = 'notification-item';
      notificationItem.style.cssText = `
        padding: 16px 20px;
        border-bottom: 1px solid #e5e7eb;
        transition: all 0.25s ease;
        position: relative;
        cursor: pointer;
        ${!notification.read ? 'background-color: rgba(59, 130, 246, 0.08);' : ''}
      `;
      
      // Add unread indicator
      if (!notification.read) {
        notificationItem.classList.add('unread');
        const indicator = document.createElement('div');
        indicator.style.cssText = `
          position: absolute;
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          width: 8px;
          height: 8px;
          background-color: #3b82f6;
          border-radius: 50%;
        `;
        notificationItem.appendChild(indicator);
      }
      
      // Format timestamp
      const formattedTime = this.formatTimestamp(notification.timestamp);
      
      notificationItem.innerHTML += `
        <div style="margin-left: ${!notification.read ? '24px' : '0'};">
          <div style="display: flex; align-items: flex-start; gap: 12px;">
            <div style="font-size: 16px; color: ${this.getColorForType(notification.type)}; margin-top: 2px; flex-shrink: 0;">
              <i class="${this.getIconForType(notification.type)}"></i>
            </div>
            <div style="flex: 1;">
              <div style="font-weight: 600; color: #111827; margin-bottom: 4px; line-height: 1.4;">
                ${notification.title}
              </div>
              <div style="color: #4b5563; font-size: 14px; line-height: 1.4; margin-bottom: 6px;">
                ${notification.message}
              </div>
              <div style="color: #9ca3af; font-size: 12px; display: flex; align-items: center; gap: 4px;">
                <i class="fas fa-clock" style="font-size: 11px;"></i>
                ${formattedTime}
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Add hover effect
      notificationItem.addEventListener('mouseenter', () => {
        notificationItem.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
      });
      
      notificationItem.addEventListener('mouseleave', () => {
        notificationItem.style.backgroundColor = !notification.read ? 
          'rgba(59, 130, 246, 0.08)' : 'transparent';
      });
      
      // Add click event to mark as read
      notificationItem.addEventListener('click', () => {
        this.markAsRead(notification.id);
      });
      
      this.notificationList.appendChild(notificationItem);
    });
  }
  
  // Mark a single notification as read
  markAsRead(notificationId) {
    if (!this.currentUser || !this.notificationsRef) return;
    
    this.notificationsRef.doc(notificationId).update({
      read: true
    }).catch(error => {
      console.error('Error marking notification as read:', error);
    });
  }
  
  // Mark all notifications as read
  markAllAsRead() {
    if (!this.currentUser || !this.notificationsRef) return;
    
    // Using a batch to update multiple documents
    const batch = firebase.firestore().batch();
    
    this.notifications.forEach(notification => {
      if (!notification.read) {
        const notificationRef = this.notificationsRef.doc(notification.id);
        batch.update(notificationRef, { read: true });
      }
    });
    
    batch.commit()
      .then(() => {
        console.log('All notifications marked as read');
        this.showToast('success', 'Success', 'All notifications marked as read');
      })
      .catch(error => {
        console.error('Error marking all notifications as read:', error);
        this.showToast('error', 'Error', 'Failed to mark notifications as read');
      });
  }
  
  // Enhanced event listeners
  addEventListeners() {
    // Toggle notification dropdown with enhanced behavior
    if (this.notificationBtn && this.notificationDropdown) {
      this.notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = this.notificationDropdown.classList.contains('show') || 
                         this.notificationDropdown.style.display === 'block';
        
        if (isVisible) {
          this.notificationDropdown.classList.remove('show');
          this.notificationDropdown.style.display = 'none';
        } else {
          this.notificationDropdown.classList.add('show');
          this.notificationDropdown.style.display = 'block';
        }
      });
    }
    
    // Mark all as read button
    if (this.markAllReadBtn) {
      this.markAllReadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.markAllAsRead();
      });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (this.notificationDropdown && 
          this.notificationBtn &&
          !this.notificationBtn.contains(e.target) && 
          !this.notificationDropdown.contains(e.target)) {
        this.notificationDropdown.classList.remove('show');
        this.notificationDropdown.style.display = 'none';
      }
    });
  }
  
  // Get icon class for notification type (keep existing)
  getIconForType(type) {
    switch (type) {
      case NOTIFICATION_TYPES.SUCCESS:
        return 'fas fa-check-circle';
      case NOTIFICATION_TYPES.ERROR:
        return 'fas fa-exclamation-circle';
      case NOTIFICATION_TYPES.WARNING:
        return 'fas fa-exclamation-triangle';
      case NOTIFICATION_TYPES.INFO:
        return 'fas fa-info-circle';
      case NOTIFICATION_TYPES.PAYMENT:
        return 'fas fa-credit-card';
      case NOTIFICATION_TYPES.PLAN:
        return 'fas fa-ticket-alt';
      case NOTIFICATION_TYPES.CLIENT:
        return 'fas fa-user';
      default:
        return 'fas fa-bell';
    }
  }
  
  // Format timestamp to relative time (keep existing)
  formatTimestamp(timestamp) {
    if (!timestamp) return 'Just now';
    
    // Convert string to Date if needed
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) {
      return 'Just now';
    } else if (diffMin < 60) {
      return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    } else if (diffHour < 24) {
      return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    } else if (diffDay < 7) {
      return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
}

// Create and expose the notification system globally
window.NotificationSystem = new NotificationSystem();

// Initialize on document ready
document.addEventListener('DOMContentLoaded', function() {
  if (window.NotificationSystem) {
    window.NotificationSystem.init();
  }
});
