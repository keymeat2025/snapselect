/**
 * notification-system.js - Manages notifications for the SnapSelect application
 * Firebase-based implementation to ensure consistency across browsers and devices
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

// Initialize the notification system
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
  }
  
  // Initialize the notification system
  init() {
    if (this.initialized) return;
    
    // Get DOM elements
    this.notificationBtn = document.getElementById('notificationBtn');
    this.notificationCount = document.getElementById('notificationCount');
    this.notificationDropdown = document.getElementById('notificationDropdown');
    this.notificationList = document.getElementById('notificationList');
    this.markAllReadBtn = document.getElementById('markAllReadBtn');
    this.toastContainer = document.getElementById('toastContainer');
    
    if (!this.notificationBtn || !this.notificationCount || !this.notificationDropdown || 
        !this.notificationList || !this.markAllReadBtn) {
      console.error('Notification DOM elements not found');
      return;
    }
    
    // Set up Firebase auth listener
    if (firebase && firebase.auth) {
      firebase.auth().onAuthStateChanged(this.handleAuthStateChanged);
    } else {
      console.error('Firebase is not available. Notifications will not function properly.');
    }
    
    // Add event listeners
    this.addEventListeners();
    
    console.log('NotificationSystem initialized');
    this.initialized = true;
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
  
  // Show toast notification
  showToast(type, title, message) {
    if (!this.toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <i class="${this.getIconForType(type)}"></i>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-message">${message}</div>
      </div>
    `;
    
    this.toastContainer.appendChild(toast);
    
    // Remove toast after 5 seconds
    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 5000);
  }
  
  // Show notification and save to Firebase
  showNotification(type, title, message) {
    if (!this.currentUser || !this.notificationsRef) {
      console.error('User not authenticated or notifications not initialized');
      // Still show toast even if Firebase is not available
      this.showToast(type, title, message);
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
        // Show toast notification
        this.showToast(type, title, message);
      })
      .catch(error => {
        console.error('Error adding notification:', error);
        // Still show toast even if Firebase save fails
        this.showToast(type, title, message);
      });
  }
  
  // Create notification from event
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
        
      default:
        // Handle generic notifications
        title = event.title || 'Notification';
        message = event.message || 'You have a new notification.';
        type = event.type || NOTIFICATION_TYPES.INFO;
    }
    
    // Show notification
    this.showNotification(type, title, message);
  }
  
  // Render notifications in dropdown
  renderNotifications() {
    if (!this.notificationList) return;
    
    // Clear notification list
    this.notificationList.innerHTML = '';
    
    if (this.notifications.length === 0) {
      // Show empty state
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-notification';
      emptyState.innerHTML = 'No notifications yet.';
      this.notificationList.appendChild(emptyState);
      return;
    }
    
    // Create notification items
    this.notifications.forEach(notification => {
      const notificationItem = document.createElement('div');
      notificationItem.className = 'notification-item';
      if (!notification.read) {
        notificationItem.classList.add('unread');
      }
      
      // Format timestamp
      const formattedTime = this.formatTimestamp(notification.timestamp);
      
      notificationItem.innerHTML = `
        <div class="notification-icon">
          <i class="${this.getIconForType(notification.type)}"></i>
        </div>
        <div class="notification-content">
          <div class="notification-title">${notification.title}</div>
          <div class="notification-message">${notification.message}</div>
          <div class="notification-time">${formattedTime}</div>
        </div>
      `;
      
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
      })
      .catch(error => {
        console.error('Error marking all notifications as read:', error);
      });
  }
  
  // Add event listeners
  addEventListeners() {
    // Toggle notification dropdown
    if (this.notificationBtn && this.notificationDropdown) {
      this.notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = this.notificationDropdown.style.display === 'block';
        this.notificationDropdown.style.display = isVisible ? 'none' : 'block';
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
          !this.notificationBtn.contains(e.target) && 
          !this.notificationDropdown.contains(e.target)) {
        this.notificationDropdown.style.display = 'none';
      }
    });
  }
  
  // Get icon class for notification type
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
  
  // Format timestamp to relative time
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
