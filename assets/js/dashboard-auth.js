/**
 * Dashboard Authentication
 * Handles authentication for the photographer dashboard
 */

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication status
    checkAuthentication();
    
    // Setup logout functionality
    setupLogout();
});

/**
 * Check if the user is authenticated
 */
function checkAuthentication() {
    // Get auth overlay
    const authOverlay = document.getElementById('authCheckOverlay');
    
    // First check sessionStorage for the auth flag set from index.html
    const authorizedAccess = sessionStorage.getItem('authorizedAccess');
    
    // Then check Firebase auth status
    const auth = window.firebaseServices?.auth;
    
    if (auth) {
        // Listen for auth state changes
        auth.onAuthStateChanged(function(user) {
            if (user) {
                // User is signed in
                console.log('User authenticated:', user.email);
                
                // Hide auth overlay if it's visible
                if (authOverlay) {
                    authOverlay.style.display = 'none';
                }
                
                // Update user information in the UI
                updateUserInfo(user);
                
                // Set auth flag in case it wasn't set
                sessionStorage.setItem('authorizedAccess', 'true');
            } else {
                // User is not signed in
                console.log('User not authenticated, redirecting to login');
                
                // Clear auth flag
                sessionStorage.removeItem('authorizedAccess');
                
                // Show auth overlay for a moment before redirecting
                if (authOverlay) {
                    authOverlay.style.display = 'flex';
                    
                    // Redirect to login page after a short delay
                    setTimeout(() => {
                        window.location.href = 'studiopanel-login.html';
                    }, 1500);
                } else {
                    // No overlay, redirect immediately
                    window.location.href = 'studiopanel-login.html';
                }
            }
        });
    } else {
        // Firebase auth not available, check session flag as fallback
        if (authorizedAccess) {
            // Allow access based on session flag
            if (authOverlay) {
                authOverlay.style.display = 'none';
            }
            console.log('Access granted based on session flag');
            
            // Use placeholder user info
            updateUserInfo({
                displayName: 'Demo User',
                email: 'demo@example.com',
                photoURL: null
            });
        } else {
            // No auth and no session flag, redirect to login
            console.log('No authentication, redirecting to login');
            
            if (authOverlay) {
                authOverlay.style.display = 'flex';
                
                setTimeout(() => {
                    window.location.href = 'studiopanel-login.html';
                }, 1500);
            } else {
                window.location.href = 'studiopanel-login.html';
            }
        }
    }
}

/**
 * Update user information in the UI
 */
function updateUserInfo(user) {
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    
    if (userName) {
        userName.textContent = user.displayName || user.email || 'User';
    }
    
    if (userAvatar && user.photoURL) {
        userAvatar.src = user.photoURL;
    }
}

/**
 * Setup logout functionality
 */
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Clear session flag
            sessionStorage.removeItem('authorizedAccess');
            
            const auth = window.firebaseServices?.auth;
            if (auth) {
                // Sign out from Firebase
                auth.signOut().then(() => {
                    console.log('User signed out');
                    window.location.href = '../index.html';
                }).catch((error) => {
                    console.error('Sign out error:', error);
                    // Redirect anyway as fallback
                    window.location.href = '../index.html';
                });
            } else {
                // No Firebase, just redirect
                window.location.href = '../index.html';
            }
        });
    }
}

/**
 * Check if a user has required permissions
 * This can be expanded based on role-based access control
 */
function checkUserPermissions(user, requiredPermission) {
    // For demo purposes, we'll assume all authenticated users have all permissions
    return true;
    
    // In a real implementation, you would check user roles and permissions
    // const userRoles = user.roles || [];
    // const userPermissions = user.permissions || [];
    // return userPermissions.includes(requiredPermission) || userRoles.includes('admin');
}
