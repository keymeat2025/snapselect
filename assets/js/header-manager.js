// header-manager.js - Include this in all dashboard pages
class HeaderManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        this.loadUserData();
        this.setupNavigation();
        this.setupNotifications();
        this.setActiveNavItem();
    }

    async loadUserData() {
        try {
            // Load user data from Firebase or your auth system
            if (firebase.auth().currentUser) {
                this.currentUser = firebase.auth().currentUser;
                this.updateUserDisplay();
            } else {
                // Listen for auth state changes
                firebase.auth().onAuthStateChanged((user) => {
                    if (user) {
                        this.currentUser = user;
                        this.updateUserDisplay();
                    }
                });
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    updateUserDisplay() {
        const userName = document.getElementById('userName');
        const avatarPlaceholder = document.querySelector('.avatar-placeholder');
        
        if (this.currentUser) {
            // Update user name
            if (userName) {
                userName.textContent = this.currentUser.displayName || 
                                     this.currentUser.email?.split('@')[0] || 
                                     'User';
            }
            
            // Update avatar
            if (avatarPlaceholder) {
                const initials = this.getInitials(this.currentUser.displayName || 
                                                this.currentUser.email);
                avatarPlaceholder.textContent = initials;
            }
        }
    }

    getInitials(name) {
        if (!name) return 'U';
        return name.split(' ')
                  .map(word => word.charAt(0))
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();
    }

    setupNavigation() {
        // Setup user menu dropdown
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userDropdown = document.getElementById('userDropdown');
        
        if (userMenuBtn && userDropdown) {
            userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('active');
            });
            
            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                userDropdown.classList.remove('active');
            });
        }

        // Setup logout functionality
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        }

        // Setup hamburger menu for mobile
        const hamburger = document.querySelector('.hamburger');
        const navLinks = document.querySelector('.nav-links');
        
        if (hamburger && navLinks) {
            hamburger.addEventListener('click', () => {
                navLinks.classList.toggle('active');
                hamburger.classList.toggle('active');
            });
        }
    }

    setActiveNavItem() {
        // Get current page
        const currentPage = window.location.pathname.split('/').pop();
        
        // Define navigation mapping
        const navMapping = {
            'photographer-dashboard.html': 'Dashboard',
            'client-management.html': 'Clients',
            'analytics.html': 'Analytics',
            'account-settings.html': 'Account Settings'
        };
        
        // Remove active class from all nav items
        document.querySelectorAll('.user-dropdown a').forEach(link => {
            link.classList.remove('active');
        });
        
        // Add active class to current page
        if (navMapping[currentPage]) {
            const activeLink = Array.from(document.querySelectorAll('.user-dropdown a'))
                                   .find(link => link.textContent.trim() === navMapping[currentPage]);
            if (activeLink) {
                activeLink.classList.add('active');
            }
        }
    }

    setupNotifications() {
        // Initialize notification system if available
        if (window.NotificationSystem) {
            window.NotificationSystem.initialize();
        }
        
        // Setup notification button
        const notificationBtn = document.getElementById('notificationBtn');
        const notificationDropdown = document.getElementById('notificationDropdown');
        
        if (notificationBtn && notificationDropdown) {
            notificationBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                notificationDropdown.classList.toggle('active');
                
                // Mark notifications as read when opened
                if (window.NotificationSystem) {
                    window.NotificationSystem.markAllAsRead();
                }
            });
            
            // Close notification dropdown when clicking outside
            document.addEventListener('click', () => {
                notificationDropdown.classList.remove('active');
            });
        }
    }

    async handleLogout() {
        try {
            await firebase.auth().signOut();
            window.location.href = '../index.html';
        } catch (error) {
            console.error('Error signing out:', error);
            if (window.NotificationSystem) {
                window.NotificationSystem.showNotification('error', 'Error', 'Failed to sign out');
            }
        }
    }

    // Method to update notification count
    updateNotificationCount(count) {
        const notificationCount = document.getElementById('notificationCount');
        if (notificationCount) {
            notificationCount.textContent = count;
            notificationCount.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    // Method to add notification badge animation
    animateNotificationBadge() {
        const notificationBtn = document.getElementById('notificationBtn');
        if (notificationBtn) {
            notificationBtn.classList.add('notification-pulse');
            setTimeout(() => {
                notificationBtn.classList.remove('notification-pulse');
            }, 1000);
        }
    }
}

// Initialize header manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.headerManager = new HeaderManager();
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeaderManager;
}
