/**
 * Snap Select - Authentication JavaScript
 * Handles user authentication, role verification, and session management
 * 
 * For Photographer/Studio Owner Dashboard authentication
 */

/**
 * Authentication state management
 * In a real app, this would interact with a backend API
 */
const auth = {
    // Check if user is authenticated
    isAuthenticated: function() {
        return localStorage.getItem('snapselect_authenticated') === 'true';
    },
    
    // Get user role (photographer, client, admin)
    getUserRole: function() {
        return localStorage.getItem('snapselect_role') || '';
    },
    
    // Get user data
    getUserData: function() {
        const userData = localStorage.getItem('snapselect_user');
        return userData ? JSON.parse(userData) : null;
    },
    
    // Login function
    login: function(email, password) {
        return new Promise((resolve, reject) => {
            // Simulate API call
            setTimeout(() => {
                // Mock authentication logic - in production this would be an API call
                if (email === 'photographer@example.com' && password === 'password123') {
                    // Set user as authenticated
                    localStorage.setItem('snapselect_authenticated', 'true');
                    localStorage.setItem('snapselect_role', 'photographer');
                    
                    // Store user data
                    const userData = {
                        id: 1,
                        name: 'John Doe',
                        email: 'photographer@example.com',
                        role: 'photographer',
                        studio: 'John Doe Photography',
                        subscription: 'pro',
                        avatar: '../assets/images/placeholder-avatar.jpg'
                    };
                    
                    localStorage.setItem('snapselect_user', JSON.stringify(userData));
                    resolve(userData);
                } else if (email === 'client@example.com' && password === 'password123') {
                    // Client user
                    localStorage.setItem('snapselect_authenticated', 'true');
                    localStorage.setItem('snapselect_role', 'client');
                    
                    const userData = {
                        id: 2,
                        name: 'Sarah Johnson',
                        email: 'client@example.com',
                        role: 'client',
                        avatar: '../assets/images/placeholder-client-avatar.jpg'
                    };
                    
                    localStorage.setItem('snapselect_user', JSON.stringify(userData));
                    resolve(userData);
                } else {
                    reject(new Error('Invalid email or password'));
                }
            }, 1000);
        });
    },
    
    // Register function
    register: function(userData) {
        return new Promise((resolve, reject) => {
            // Simulate API call
            setTimeout(() => {
                // In a real app, this would send data to a server
                if (userData.email && userData.password) {
                    // Set user as authenticated
                    localStorage.setItem('snapselect_authenticated', 'true');
                    localStorage.setItem('snapselect_role', userData.role || 'photographer');
                    
                    // Add ID and other defaults
                    userData.id = Date.now();
                    userData.subscription = 'free';
                    userData.avatar = '../assets/images/placeholder-avatar.jpg';
                    
                    localStorage.setItem('snapselect_user', JSON.stringify(userData));
                    resolve(userData);
                } else {
                    reject(new Error('Missing required fields'));
                }
            }, 1500);
        });
    },
    
    // Logout function
    logout: function() {
        localStorage.removeItem('snapselect_authenticated');
        localStorage.removeItem('snapselect_role');
        localStorage.removeItem('snapselect_user');
        
        // Redirect to login page
        window.location.href = '../pages/login.html';
    },
    
    // Verify user has required role
    verifyRole: function(requiredRole) {
        if (!this.isAuthenticated()) {
            return false;
        }
        
        const userRole = this.getUserRole();
        
        // Admin can access everything
        if (userRole === 'admin') {
            return true;
        }
        
        // Check if user has the required role
        return userRole === requiredRole;
    },
    
    // Verify photographer/studio owner access
    verifyPhotographerAccess: function() {
        return this.verifyRole('photographer');
    },
    
    // Verify client access
    verifyClientAccess: function() {
        return this.verifyRole('client');
    }
};

/**
 * Initialize authentication on page load
 */
document.addEventListener('DOMContentLoaded', function() {
    // Check if we're on a protected page (dashboard)
    if (window.location.pathname.includes('/dashboard.html')) {
        // Verify photographer/studio owner access
        if (!auth.verifyPhotographerAccess()) {
            // Show authentication overlay
            const authOverlay = document.getElementById('authOverlay');
            if (authOverlay) {
                authOverlay.style.display = 'flex';
                
                // Initially show verifying message
                document.getElementById('authVerifying').style.display = 'block';
                document.getElementById('authError').style.display = 'none';
                
                // After a delay, show error if authentication failed
                setTimeout(function() {
                    if (!auth.verifyPhotographerAccess()) {
                        document.getElementById('authVerifying').style.display = 'none';
                        document.getElementById('authError').style.display = 'block';
                        
                        // Set appropriate error message
                        const errorMessage = document.getElementById('errorMessage');
                        if (auth.isAuthenticated()) {
                            errorMessage.textContent = 'You need Photographer or Studio Owner privileges to access this dashboard.';
                        } else {
                            errorMessage.textContent = 'Please log in to access this area.';
                        }
                        
                        // Set up login button
                        document.getElementById('loginBtn').addEventListener('click', function() {
                            window.location.href = '../pages/login.html';
                        });
                    }
                }, 1500);
            } else {
                // If overlay doesn't exist, redirect to login
                window.location.href = '../pages/login.html';
            }
        } else {
            // User is authenticated and has correct role
            // Load user data into the dashboard
            const userData = auth.getUserData();
            if (userData) {
                // Update profile elements
                const userNameElement = document.getElementById('userName');
                const profileNameElement = document.getElementById('profileName');
                const userAvatarElement = document.getElementById('userAvatar');
                
                if (userNameElement) userNameElement.textContent = userData.name.split(' ')[0];
                if (profileNameElement) profileNameElement.textContent = userData.name;
                if (userAvatarElement) userAvatarElement.src = userData.avatar;
            }
        }
    }
    
    // Check if we're on the login page
    if (window.location.pathname.includes('/login.html')) {
        // If already authenticated, redirect to dashboard
        if (auth.isAuthenticated()) {
            const userRole = auth.getUserRole();
            
            if (userRole === 'photographer') {
                window.location.href = '../pages/dashboard.html';
            } else if (userRole === 'client') {
                window.location.href = '../pages/client-gallery.html';
            }
        }
        
        // Set up login form submission
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', function(e) {
                e.preventDefault();
                
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const errorElement = document.getElementById('loginError');
                
                // Clear previous errors
                if (errorElement) errorElement.style.display = 'none';
                
                // Show loading
                const loginButton = document.getElementById('loginButton');
                if (loginButton) {
                    loginButton.disabled = true;
                    loginButton.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Logging in...';
                }
                
                // Attempt login
                auth.login(email, password)
                    .then(userData => {
                        // Redirect based on role
                        if (userData.role === 'photographer') {
                            window.location.href = '../pages/dashboard.html';
                        } else {
                            window.location.href = '../pages/client-gallery.html';
                        }
                    })
                    .catch(error => {
                        // Show error
                        if (errorElement) {
                            errorElement.textContent = error.message;
                            errorElement.style.display = 'flex';
                        }
                        
                        // Reset button
                        if (loginButton) {
                            loginButton.disabled = false;
                            loginButton.innerHTML = 'Log In';
                        }
                    });
            });
        }
    }
    
    // Set up logout functionality on all pages
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            auth.logout();
        });
    }
});
