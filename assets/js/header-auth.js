// header-auth.js
// Integrates Firebase Authentication with the website header

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const guestNav = document.getElementById('guestNav');
    const userNav = document.getElementById('userNav');
    const userName = document.getElementById('userName');
    const userAvatar = document.getElementById('userAvatar');
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Wait for Firebase initialization
    waitForFirebase();
    
    // Set up header UI interactions
    setupHeaderInteractions();
    
    // Wait for Firebase to initialize
    function waitForFirebase() {
        if (typeof window.firebaseServices === 'undefined' || 
            typeof window.firebaseAuth === 'undefined') {
            console.log("Waiting for Firebase to initialize...");
            setTimeout(waitForFirebase, 100);
            return;
        }
        
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
                    const docRef = await db.collection('photographer').doc('photographer_main').get();
                    
                    if (docRef.exists) {
                        const userData = docRef.data();
                        // Update display name if available
                        if (userData.ownerName) {
                            userName.textContent = userData.ownerName.split(' ')[0];
                        }
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                }
            },
            // User logged out
            function() {
                console.log("User is logged out");
                updateUIForGuest();
            }
        );
    }
    
    // Update UI for logged in user
    function updateUIForUser(user) {
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
            if (user.photoURL) {
                userAvatar.src = user.photoURL;
            } else {
                userAvatar.src = 'assets/images/placeholder-avatar.jpg';
            }
        }
    }
    
    // Update UI for logged out user
    function updateUIForGuest() {
        if (guestNav) guestNav.style.display = 'block';
        if (userNav) userNav.style.display = 'none';
        
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
            // Clear any unsaved changes or local state if needed
            clearLocalState();
            
            // Sign out from Firebase
            await window.firebaseAuth.signOut();
            
            // The auth observer will handle UI updates automatically
            
            // Close confirmation dialog
            const confirmDialog = document.getElementById('logoutConfirm');
            if (confirmDialog) {
                confirmDialog.classList.remove('active');
            }
            
            // Redirect to home page
            window.location.href = '/index.html';
            
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
        
        // Add any other client-side cleanup needed
        
        // Note: Firebase Auth tokens will be cleared by signOut() method
    }
});
