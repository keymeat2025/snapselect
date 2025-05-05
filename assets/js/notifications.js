/**
* Enhanced notification system for plan management notifications.js
*/
const NotificationSystem = {
 init() {
   console.log('Notification system initialized');
   this.loadNotifications();
   this.setupEventListeners();
   this.initWebPushNotifications();
 },
 
 loadNotifications() {
   // Load notifications from backend or localStorage
   const savedNotifications = localStorage.getItem('notifications');
   if (savedNotifications) {
     try {
       const notifications = JSON.parse(savedNotifications);
       this.renderNotifications(notifications);
       this.updateBadgeCount(notifications.filter(n => !n.read).length);
     } catch (e) {
       console.error('Error loading notifications:', e);
     }
   }
 },
 
 renderNotifications(notifications) {
   const container = document.getElementById('notificationList');
   if (!container) return;
   
   container.innerHTML = '';
   
   if (!notifications || notifications.length === 0) {
     container.innerHTML = '<div class="empty-notification">No notifications</div>';
     return;
   }
   
   notifications.forEach(notification => {
     const item = document.createElement('div');
     item.className = `notification-item ${notification.read ? '' : 'unread'}`;
     item.innerHTML = `
       <div class="notification-icon">
         <i class="fas fa-${this.getIcon(notification.type)}"></i>
       </div>
       <div class="notification-content">
         <div class="notification-title">${notification.title}</div>
         <div class="notification-message">${notification.message}</div>
         <div class="notification-time">${this.formatTime(notification.time)}</div>
       </div>
     `;
     
     // Add click event to mark as read
     item.addEventListener('click', () => {
       this.markAsRead(notification.id);
     });
     
     container.appendChild(item);
   });
 },
 
 formatTime(timestamp) {
   if (!timestamp) return '';
   
   const date = new Date(timestamp);
   const now = new Date();
   const diffMs = now - date;
   const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
   
   if (diffDays === 0) {
     return 'Today';
   } else if (diffDays === 1) {
     return 'Yesterday';
   } else if (diffDays < 7) {
     return `${diffDays} days ago`;
   } else {
     return date.toLocaleDateString();
   }
 },
 
 setupEventListeners() {
   // Setup notification-related event listeners
   const markAllReadBtn = document.getElementById('markAllReadBtn');
   if (markAllReadBtn) {
     markAllReadBtn.addEventListener('click', () => this.markAllAsRead());
   }
   
   const notificationBtn = document.getElementById('notificationBtn');
   if (notificationBtn) {
     notificationBtn.addEventListener('click', (e) => {
       e.stopPropagation();
       this.toggleNotificationDropdown();
     });
   }
   
   // Close dropdown when clicking outside
   document.addEventListener('click', (e) => {
     const dropdown = document.getElementById('notificationDropdown');
     if (dropdown && dropdown.style.display === 'block') {
       const notificationBtn = document.getElementById('notificationBtn');
       if (!dropdown.contains(e.target) && !notificationBtn.contains(e.target)) {
         dropdown.style.display = 'none';
       }
     }
   });
 },
 
 toggleNotificationDropdown() {
   const dropdown = document.getElementById('notificationDropdown');
   if (dropdown) {
     const isVisible = dropdown.style.display === 'block';
     dropdown.style.display = isVisible ? 'none' : 'block';
     
     // If showing dropdown, mark notifications as seen (not read)
     if (!isVisible) {
       this.markNotificationsAsSeen();
     }
   }
 },
 
 markNotificationsAsSeen() {
   // This marks notifications as seen but not read
   const savedNotifications = localStorage.getItem('notifications');
   if (savedNotifications) {
     try {
       const notifications = JSON.parse(savedNotifications);
       let changed = false;
       
       notifications.forEach(notification => {
         if (notification.unseen) {
           notification.unseen = false;
           changed = true;
         }
       });
       
       if (changed) {
         localStorage.setItem('notifications', JSON.stringify(notifications));
       }
     } catch (e) {
       console.error('Error marking notifications as seen:', e);
     }
   }
 },
 
 markAllAsRead() {
   // Mark all notifications as read
   const savedNotifications = localStorage.getItem('notifications');
   if (savedNotifications) {
     try {
       const notifications = JSON.parse(savedNotifications);
       notifications.forEach(notification => {
         notification.read = true;
       });
       
       localStorage.setItem('notifications', JSON.stringify(notifications));
       this.renderNotifications(notifications);
       this.updateBadgeCount(0);
       
       // Also update UI
       const unreadItems = document.querySelectorAll('.notification-item.unread');
       unreadItems.forEach(item => {
         item.classList.remove('unread');
       });
     } catch (e) {
       console.error('Error marking all as read:', e);
     }
   }
 },
 
 markAsRead(id) {
   // Mark single notification as read
   const savedNotifications = localStorage.getItem('notifications');
   if (savedNotifications) {
     try {
       const notifications = JSON.parse(savedNotifications);
       const notification = notifications.find(n => n.id === id);
       if (notification) {
         notification.read = true;
         localStorage.setItem('notifications', JSON.stringify(notifications));
         
         // Update badge count
         const unreadCount = notifications.filter(n => !n.read).length;
         this.updateBadgeCount(unreadCount);
       }
     } catch (e) {
       console.error('Error marking as read:', e);
     }
   }
 },
 
 updateBadgeCount(count) {
   const badge = document.getElementById('notificationCount');
   if (badge) {
     badge.textContent = count;
     badge.style.display = count > 0 ? 'flex' : 'none';
   }
 },
 
 addNotification(notification) {
   // Add a new notification
   const savedNotifications = localStorage.getItem('notifications') || '[]';
   try {
     const notifications = JSON.parse(savedNotifications);
     
     // Add unique ID and timestamp
     notification.id = Date.now().toString();
     notification.time = new Date().toISOString();
     notification.read = false;
     notification.unseen = true;
     
     notifications.unshift(notification);
     
     // Keep only most recent 20 notifications
     if (notifications.length > 20) {
       notifications.pop();
     }
     
     localStorage.setItem('notifications', JSON.stringify(notifications));
     
     // Update UI
     this.renderNotifications(notifications);
     this.updateBadgeCount(notifications.filter(n => !n.read).length);
     
     // Show toast notification
     this.showNotification(notification.type, notification.title, notification.message);
   } catch (e) {
     console.error('Error adding notification:', e);
   }
 },
 
 createNotificationFromEvent(event) {
   let notification = {
     type: 'info',
     title: 'New Notification',
     message: 'You have a new notification'
   };
   
   switch(event.type) {
     case 'plan_purchased':
       notification = {
         type: 'plan',
         title: 'Plan Purchased',
         message: `${event.planName} plan has been activated for ${event.clientName}.`
       };
       break;
     case 'plan_expiring':
       notification = {
         type: 'warning',
         title: 'Plan Expiring Soon',
         message: `The ${event.planName} plan for ${event.clientName} expires in ${event.daysLeft} days.`
       };
       break;
     case 'payment_successful':
       notification = {
         type: 'payment',
         title: 'Payment Successful',
         message: `Payment of ₹${event.amount} for ${event.planName} plan was successful.`
       };
       break;
     case 'storage_warning':
       notification = {
         type: 'warning',
         title: 'Storage Limit Warning',
         message: `You're using ${event.percentage}% of your storage limit.`
       };
       break;
     case 'client_created':
       notification = {
         type: 'client',
         title: 'New Client Added',
         message: `${event.clientName} has been added to your clients.`
       };
       break;
   }
   
   this.addNotification(notification);
 },
 
 initWebPushNotifications() {
   // Initialize web push notifications if browser supports it
   if ('Notification' in window) {
     if (Notification.permission === 'granted') {
       console.log('Web push notifications are enabled');
     } else if (Notification.permission !== 'denied') {
       // We need to ask for permission
       Notification.requestPermission().then(permission => {
         if (permission === 'granted') {
           console.log('Web push notification permission granted');
         }
       });
     }
   }
 },
 
 sendWebPushNotification(title, options) {
   // Send a web push notification
   if ('Notification' in window && Notification.permission === 'granted') {
     return new Notification(title, options);
   }
   return null;
 },
 
 setupEmailPlaceholder() {
   // Placeholder for email notification system
   console.log('Email notification system ready to integrate');
 },
 
 setupSMSPlaceholder() {
   // Placeholder for SMS notification system
   console.log('SMS notification system ready to integrate');
 },
 
 showNotification(type, title, message, duration = 5000) {
   const toast = document.createElement('div');
   toast.className = `toast toast-${type}`;
   toast.innerHTML = `
     <i class="fas fa-${this.getIcon(type)}"></i>
     <div class="toast-content">
       <strong>${title}</strong>
       <p>${message}</p>
     </div>
   `;
   
   const container = document.getElementById('toastContainer');
   if (container) {
     container.appendChild(toast);
     
     setTimeout(() => {
       toast.classList.add('hide');
       setTimeout(() => toast.remove(), 300);
     }, duration);
   }
 },
 
 getIcon(type) {
   const icons = {
     success: 'check-circle',
     error: 'exclamation-circle',
     warning: 'exclamation-triangle',
     info: 'info-circle',
     plan: 'ticket-alt',
     payment: 'credit-card',
     client: 'user'
   };
   return icons[type] || 'bell';
 }
};

// Initialize on document ready
document.addEventListener('DOMContentLoaded', () => {
 // Create toast container if it doesn't exist
 if (!document.getElementById('toastContainer')) {
   const toastContainer = document.createElement('div');
   toastContainer.id = 'toastContainer';
   document.body.appendChild(toastContainer);
 }
 
 NotificationSystem.init();
});

// Make NotificationSystem available globally
window.NotificationSystem = NotificationSystem;
