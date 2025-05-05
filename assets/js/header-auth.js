// header-auth.js
// Integrates Firebase Authentication with the website header

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const guestNav = document.getElementById('guestNav');
    const userNav = document.getElementById('userNav');
    const userName = document.getElementById('userName');
    const userAvatar = document.querySelector('.avatar-placeholder');
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Check if this is a protected page
    checkProtectedPage();
    
    // Wait for Firebase initialization
    waitForFirebase();
    
    // Set up header UI interactions
    setupHeaderInteractions();
    
    // Set up secure navigation
    setupSecureNavigation();
    
    // Check if current page requires authentication
    function checkProtectedPage() {
        console.log("Checking if current page is protected");
        
        const isProtectedPage = window.location.pathname.includes('/pages/') && 
                               !window.location.pathname.includes('login') &&
                               !window.location.pathname.includes('register');
        
        if (isProtectedPage) {
            console.log("Current page is protected");
            
            // Check if user previously logged out
            const userLoggedOut = sessionStorage.getItem('userLoggedOut') === 'true';
            if (userLoggedOut) {
                // If user intentionally logged out and is trying to use back button
                console.log("User previously logged out - preventing access via back button");
                sessionStorage.removeItem('userLoggedOut'); // Clear the flag
                window.location.replace('studiopanel-login.html'); // Use replace to avoid adding to history
                return;
            }
            
            // Check for authorization flag
            const hasAuthorizationFlag = sessionStorage.getItem('authorizedAccess') === 'true';
            console.log("Authorization flag:", hasAuthorizationFlag);
            
            if (!hasAuthorizationFlag) {
                // No authorization flag - redirect to login
                console.log("No authorization flag found - redirecting to login");
                window.location.replace('studiopanel-login.html');
                return;
            }
            
            // Also check for Firebase auth if available
            if (firebase && firebase.auth) {
                console.log("Firebase auth is available, checking current user");
                
                // Don't redirect immediately, use onAuthStateChanged to ensure it's initialized
                firebase.auth().onAuthStateChanged(function(user) {
                    if (!user) {
                        console.log("No authenticated user found - redirecting to login");
                        // Clear authorization flag
                        sessionStorage.removeItem('authorizedAccess');
                        sessionStorage.removeItem('authTimestamp');
                        
                        // Redirect to login
                        window.location.replace('studiopanel-login.html');
                    } else {
                        console.log("User authenticated:", user.email);
                    }
                });
            }
        } else {
            console.log("Current page is not protected");
        }
    }
    
    // Wait for Firebase to initialize
    function waitForFirebase() {
        if (typeof window.firebaseServices === 'undefined' || 
            typeof window.firebaseAuth === 'undefined') {
            console.log("Waiting for Firebase to initialize...");
            setTimeout(waitForFirebase, 100);
            return;
        }
        
        console.log("Firebase initialized, setting up auth observer");
        // Firebase is ready, set up auth observer
        setupAuthObserver();
    }
    
    // Set up Firebase auth state observer
    function setupAuthObserver() {
        console.log("Setting up auth observer");
        
        window.firebaseAuth.setupAuthObserver(
            // User logged in
            async function(user) {
                console.log("User is logged in:", user.email);
                
                // Update UI for authenticated user
                updateUIForUser(user);
                
                // Fetch additional user data if needed
                try {
                    const db = window.firebaseServices.db;
                    // Important: Query the document based on the current user's ID
                    const querySnapshot = await db.collection('photographer')
                        .where('uid', '==', user.uid)
                        .limit(1)
                        .get();
                    
                    if (!querySnapshot.empty) {
                        const userData = querySnapshot.docs[0].data();
                        // Update display name if available
                        if (userData.ownerName) {
                            if (userName) {
                                userName.textContent = userData.ownerName.split(' ')[0];
                            }
                            if (userAvatar) {
                                userAvatar.textContent = userData.ownerName.charAt(0).toUpperCase();
                            }
                        }
                    } else {
                        // If no photographer profile found, use email
                        if (userName) {
                            userName.textContent = user.email.split('@')[0];
                        }
                        if (userAvatar) {
                            userAvatar.textContent = user.email.charAt(0).toUpperCase();
                        }
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    // Fallback to email if there's an error
                    if (userName) {
                        userName.textContent = user.email.split('@')[0];
                    }
                    if (userAvatar) {
                        userAvatar.textContent = user.email.charAt(0).toUpperCase();
                    }
                }
            },
            // User logged out
            function() {
                console.log("User is logged out");
                updateUIForGuest();
                
                // Check if we're on a protected page
                const isProtectedPage = window.location.pathname.includes('/pages/') && 
                                      !window.location.pathname.includes('login') &&
                                      !window.location.pathname.includes('register');
                
                if (isProtectedPage) {
                    // Clear authorization flag
                    sessionStorage.removeItem('authorizedAccess');
                    sessionStorage.removeItem('authTimestamp');
                    
                    // Set logout flag
                    sessionStorage.setItem('userLoggedOut', 'true');
                    
                    // Redirect to login
                    console.log("User logged out while on protected page - redirecting to login");
                    window.location.replace('studiopanel-login.html');
                } else {
                    // Force immediate UI update
                    setTimeout(() => {
                        if (guestNav && userNav) {
                            guestNav.style.display = 'block';
                            userNav.style.display = 'none';
                        }
                    }, 100);
                }
            }
        );
    }
    
    // Update UI for logged in user
    function updateUIForUser(user) {
        console.log("Updating UI for logged in user");
        
        if (guestNav) guestNav.style.display = 'none';
        if (userNav) userNav.style.display = 'block';
        
        // Display user's name
        if (userName) {
            if (user.displayName) {
                userName.textContent = user.displayName.split(' ')[0];
            } else {
                userName.textContent = user.email.split('@')[0];
            }
        }
        
        // Display user's avatar
        if (userAvatar) {
            userAvatar.textContent = user.email.charAt(0).toUpperCase();
        }
    }
    
    // Update UI for logged out user
    function updateUIForGuest() {
        console.log("Updating UI for guest user");
        
        if (guestNav) guestNav.style.display = 'block';
        if (userNav) userNav.style.display = 'none';
        
        // Clear user data from UI
        if (userName) userName.textContent = 'User';
        if (userAvatar) userAvatar.textContent = 'U';
        
        // Close dropdown if open
        if (userDropdown) {
            userDropdown.classList.remove('active');
        }
    }
    
    // Set up header UI interactions
    function setupHeaderInteractions() {
        // Handle user menu dropdown toggle
        if (userMenuBtn) {
            userMenuBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                userDropdown.classList.toggle('active');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', function(e) {
                if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                    userDropdown.classList.remove('active');
                }
            });
        }
        
        // Handle logout button click
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Close the dropdown
                userDropdown.classList.remove('active');
                
                // Show confirmation dialog
                showLogoutConfirmation();
            });
        }
    }
    
    // Set up secure navigation for dashboard and other protected pages
    function setupSecureNavigation() {
        console.log("Setting up secure navigation");
        
        // Apply to dashboard link in user dropdown
        const dashboardLink = document.querySelector('.user-dropdown a[href*="dashboard"]');
        if (dashboardLink) {
            console.log("Found dashboard link in dropdown, setting up secure navigation");
            // Update the href to prevent direct access
            dashboardLink.href = '#';
            
            // Add secure navigation
            dashboardLink.addEventListener('click', navigateToDashboard);
        }
        
        // Also handle any other dashboard links on the page
        const allDashboardLinks = document.querySelectorAll('a[href*="dashboard"]');
        allDashboardLinks.forEach(link => {
            // Check if it's not the dropdown link (already handled)
            if (!link.closest('.user-dropdown')) {
                console.log("Found additional dashboard link, setting up secure navigation");
                link.href = '#';
                link.addEventListener('click', navigateToDashboard);
            }
        });
    }
    
    // Function to authorize dashboard access
    function navigateToDashboard(event) {
        event.preventDefault();
        console.log("Dashboard link clicked");
        
        // Check if user is authenticated
        const auth = window.firebaseServices?.auth;
        const user = auth?.currentUser;
        
        if (user) {
            console.log("User authenticated, setting authorization flag");
            
            // Set authorization flag for dashboard access - make sure to set this BEFORE navigation
            sessionStorage.setItem('authorizedAccess', 'true');
            sessionStorage.setItem('authTimestamp', Date.now().toString());
            
            // Verify the flag was set properly
            console.log("Authorization flag check:", sessionStorage.getItem('authorizedAccess'));
            
            // Small delay to ensure flag is set before navigation
            setTimeout(() => {
                // Determine correct path based on current location
                let dashboardPath;
                if (window.location.pathname.includes('/pages/')) {
                    dashboardPath = 'photographer-dashboard.html';
                } else {
                    dashboardPath = 'pages/photographer-dashboard.html';
                }
                
                console.log("Navigating to dashboard:", dashboardPath);
                window.location.href = dashboardPath;
            }, 100);
        } else {
            console.log("User not authenticated, redirecting to login");
            // Redirect to login if not authenticated
            window.location.href = window.location.pathname.includes('/pages/') ? 
                                  'studiopanel-login.html' : 
                                  'pages/studiopanel-login.html';
        }
    }
    
    // Show logout confirmation dialog
    function showLogoutConfirmation() {
        // Create confirmation dialog if it doesn't exist
        if (!document.getElementById('logoutConfirm')) {
            const confirmDialog = document.createElement('div');
            confirmDialog.id = 'logoutConfirm';
            confirmDialog.className = 'logout-confirm';
            confirmDialog.innerHTML = `
                <div class="logout-confirm-content">
                    <h3>Logout Confirmation</h3>
                    <p>Are you sure you want to log out of SnapSelect?</p>
                    <div class="logout-confirm-buttons">
                        <button class="btn-cancel" id="cancelLogout">Cancel</button>
                        <button class="btn-logout" id="confirmLogout">Logout</button>
                    </div>
                </div>
            `;
            document.body.appendChild(confirmDialog);
            
            // Add event listeners
            document.getElementById('cancelLogout').addEventListener('click', function() {
                confirmDialog.classList.remove('active');
            });
            
            document.getElementById('confirmLogout').addEventListener('click', function() {
                // Show loading state
                const confirmBtn = this;
                const originalText = confirmBtn.textContent;
                confirmBtn.innerHTML = '<span class="loading-spinner"></span>Logging out...';
                confirmBtn.disabled = true;
                
                // Perform logout
                performLogout()
                    .then(() => {
                        // Success - dialog will be hidden by auth state change
                    })
                    .catch(error => {
                        console.error("Logout error:", error);
                        // Reset button
                        confirmBtn.innerHTML = originalText;
                        confirmBtn.disabled = false;
                        // Show error message
                        alert("Logout failed. Please try again.");
                    });
            });
            
            // Close when clicking outside
            confirmDialog.addEventListener('click', function(e) {
                if (e.target === confirmDialog) {
                    confirmDialog.classList.remove('active');
                }
            });
        }
        
        // Show the dialog
        document.getElementById('logoutConfirm').classList.add('active');
    }
    
    // Perform the actual logout
    async function performLogout() {
        if (!window.firebaseAuth) {
            throw new Error("Firebase Auth not initialized");
        }
        
        try {
            // Clear authorization flag immediately before logout
            console.log("Clearing authorization flags");
            sessionStorage.removeItem('authorizedAccess');
            sessionStorage.removeItem('authTimestamp');
            
            // Set logout flag in sessionStorage instead of manipulating history
            sessionStorage.setItem('userLoggedOut', 'true');
            
            // Clear any unsaved changes or local state if needed
            clearLocalState();
            
            // Sign out from Firebase
            await window.firebaseAuth.signOut();
            console.log("Firebase sign out completed");
            
            // Close confirmation dialog
            const confirmDialog = document.getElementById('logoutConfirm');
            if (confirmDialog) {
                confirmDialog.classList.remove('active');
            }
            
            // Update UI immediately before redirect
            updateUIForGuest();
            
            // Redirect to home page
            console.log("Redirecting after logout");
            const currentPath = window.location.pathname;
            
            if (currentPath.includes('index.html') || currentPath === '/' || currentPath === '/snapselect/') {
                // Force reload to reset state
                window.location.reload();
            } else {
                // Use relative path for GitHub Pages
                // If we're in a subdirectory, go up to the root
                let redirectPath = '';
                
                // If we're in the 'pages' directory, go up one level
                if (currentPath.includes('/pages/')) {
                    redirectPath = '../index.html';
                } else {
                    // Otherwise, just use the root path
                    redirectPath = 'index.html';
                }
                
                console.log("Redirecting to:", redirectPath);
                // Use replace instead of href to avoid adding to history stack
                window.location.replace(redirectPath);
            }
            
            return true;
        } catch (error) {
            console.error("Logout error:", error);
            throw error;
        }
    }
    



    // Clear any local state
    function clearLocalState() {
        // Clear any localStorage items that are not related to Firebase
        // but are used by your application
        localStorage.removeItem('snapselect_preferences');
        localStorage.removeItem('snapselect_recent_galleries');
        localStorage.removeItem('snapselect_draft_uploads');
        
        // Clear all session storage except the logout flag
        const logoutFlag = sessionStorage.getItem('userLoggedOut');
        
        // Clear all items from sessionStorage
        sessionStorage.clear();
        
        // Restore the logout flag if it was set
        if (logoutFlag) {
            sessionStorage.setItem('userLoggedOut', logoutFlag);
        }
        
        // Clear cookies related to the application
        // (but not Firebase Auth cookies, those will be handled by Firebase)
        const appCookies = ['snapselect_preferences', 'snapselect_lastVisited', 'snapselect_theme'];
        appCookies.forEach(cookieName => {
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        });
        
        console.log("Local application state cleared");
    }
    
    // Special handling for cache control
    function setupCacheControl() {
        // Add no-cache headers for protected pages
        if (window.location.pathname.includes('/pages/') && 
            !window.location.pathname.includes('login') &&
            !window.location.pathname.includes('register')) {
            
            // Add meta tags to prevent caching
            const metaNoCache = document.createElement('meta');
            metaNoCache.setAttribute('http-equiv', 'Cache-Control');
            metaNoCache.setAttribute('content', 'no-cache, no-store, must-revalidate');
            document.head.appendChild(metaNoCache);
            
            const metaNoStore = document.createElement('meta');
            metaNoStore.setAttribute('http-equiv', 'Pragma');
            metaNoStore.setAttribute('content', 'no-cache');
            document.head.appendChild(metaNoStore);
            
            const metaExpires = document.createElement('meta');
            metaExpires.setAttribute('http-equiv', 'Expires');
            metaExpires.setAttribute('content', '0');
            document.head.appendChild(metaExpires);
            
            console.log("Cache control headers added to protected page");
        }
    }
    
    // Setup cache control when the page loads
    setupCacheControl();
    
    // Handle browser navigation events
    function setupNavigationHandling() {
        // Listen for popstate event (user pressing back or forward buttons)
        window.addEventListener('popstate', function(event) {
            console.log("Navigation event detected");
            
            // Check if we're on a protected page
            const isProtectedPage = window.location.pathname.includes('/pages/') && 
                                   !window.location.pathname.includes('login') &&
                                   !window.location.pathname.includes('register');
            
            if (isProtectedPage) {
                // Re-verify authorization on navigation events
                const hasAuthorizationFlag = sessionStorage.getItem('authorizedAccess') === 'true';
                const userLoggedOut = sessionStorage.getItem('userLoggedOut') === 'true';
                
                if (!hasAuthorizationFlag || userLoggedOut) {
                    console.log("Invalid session state after navigation - redirecting to login");
                    // Clear flags
                    sessionStorage.removeItem('userLoggedOut');
                    
                    // Redirect
                    window.location.replace('studiopanel-login.html');
                }
            }
        });
        
        // Handle page visibility changes
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'visible') {
                console.log("Page became visible - verifying session");
                
                // Check if we're on a protected page
                const isProtectedPage = window.location.pathname.includes('/pages/') && 
                                       !window.location.pathname.includes('login') &&
                                       !window.location.pathname.includes('register');
                
                if (isProtectedPage) {
                    // Re-verify authorization
                    const hasAuthorizationFlag = sessionStorage.getItem('authorizedAccess') === 'true';
                    const userLoggedOut = sessionStorage.getItem('userLoggedOut') === 'true';
                    
                    if (!hasAuthorizationFlag || userLoggedOut) {
                        console.log("Invalid session state when returning to page - redirecting to login");
                        // Clear flags
                        sessionStorage.removeItem('userLoggedOut');
                        
                        // Redirect
                        window.location.replace('studiopanel-login.html');
                    }
                }
            }
        });
    }
    
    // Setup navigation event handling
    setupNavigationHandling();
    });
