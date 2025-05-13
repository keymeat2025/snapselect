// director-auth.js - Place this in your assets/js folder

document.addEventListener('DOMContentLoaded', function() {
    // Reference to the login form
    const loginForm = document.getElementById('directorLoginForm');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const loadingOverlay = document.getElementById('loadingOverlay');
    
    // Initialize Firebase with your existing config
    // (This will use the firebase-config.js you already have)
    
    // Handle form submission
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('userEmail').value;
        const password = document.getElementById('userPassword').value;
        const accessCode = document.getElementById('accessCode').value;
        
        // Show loading overlay
        loadingOverlay.style.display = 'flex';
        
        // Step 1: Authenticate with Firebase
        firebase.auth().signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                // Step 2: Verify the provided access code against a secure one in Firestore
                return verifyAccessCode(userCredential.user.uid, accessCode);
            })
            .then((isValidAccessCode) => {
                if (!isValidAccessCode) {
                    throw new Error('Invalid access code');
                }
                
                // Step 3: Verify if the user has director custom claims
                return checkDirectorClaims();
            })
            .then((isDirector) => {
                if (!isDirector) {
                    throw new Error('Not authorized as Director');
                }
                
                // All checks passed, redirect to director dashboard
                showToast('success', 'Authentication Successful', 'Welcome to SnapSelect Nexus Director Portal');
                
                // Wait a moment to show the success message, then redirect
                setTimeout(() => {
                    window.location.href = 'director-dashboard.html';
                }, 1500);
            })
            .catch((error) => {
                // Hide loading overlay
                loadingOverlay.style.display = 'none';
                
                // Show appropriate error message
                errorText.textContent = getErrorMessage(error);
                errorMessage.style.display = 'block';
                
                console.error('Authentication error:', error);
            });
    });
    
    // Function to verify the access code
    function verifyAccessCode(userId, providedCode) {
        return firebase.firestore().collection('system_settings')
            .doc('director_access')
            .get()
            .then((doc) => {
                if (doc.exists && doc.data()) {
                    // Compare the provided code with the stored one
                    // Using a hash comparison would be more secure in production
                    return doc.data().accessCode === providedCode;
                }
                return false;
            })
            .catch((error) => {
                console.error('Error verifying access code:', error);
                return false;
            });
    }
    
    // Function to check if the current user has director claims
    function checkDirectorClaims() {
        return new Promise((resolve, reject) => {
            // Get the current user
            const user = firebase.auth().currentUser;
            
            if (!user) {
                resolve(false);
                return;
            }
            
            // Get the ID token with fresh claims
            user.getIdTokenResult(true)
                .then((idTokenResult) => {
                    // Check if the user has the director claim
                    if (idTokenResult.claims.director === true) {
                        resolve(true);
                    } else {
                        // Alternative check: look for the user in a specific directors collection
                        firebase.firestore().collection('directors')
                            .doc(user.uid)
                            .get()
                            .then((doc) => {
                                resolve(doc.exists && doc.data().active === true);
                            })
                            .catch((error) => {
                                console.error('Error checking director status:', error);
                                resolve(false);
                            });
                    }
                })
                .catch((error) => {
                    console.error('Error getting ID token:', error);
                    resolve(false);
                });
        });
    }
    
    // Function to get a user-friendly error message
    function getErrorMessage(error) {
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                return 'Invalid email or password';
            case 'auth/too-many-requests':
                return 'Too many failed login attempts. Please try again later';
            default:
                return error.message || 'Authentication failed. Please try again';
        }
    }
    
    // Toast notification function
    function showToast(type, title, message) {
        const toastContainer = document.getElementById('toastContainer');
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconClass = 'fa-info-circle';
        if (type === 'success') iconClass = 'fa-check-circle';
        if (type === 'error') iconClass = 'fa-exclamation-circle';
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="fas ${iconClass}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        toastContainer.appendChild(toast);
        
        // Remove toast after animation completes (6 seconds)
        setTimeout(() => {
            toast.remove();
        }, 6000);
        
        // Add click event for close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
    }
    
    // Forgot password link handler
    document.getElementById('forgotPasswordLink').addEventListener('click', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('userEmail').value;
        
        if (!email) {
            showToast('error', 'Email Required', 'Please enter your email address first');
            return;
        }
        
        loadingOverlay.style.display = 'flex';
        
        firebase.auth().sendPasswordResetEmail(email)
            .then(() => {
                loadingOverlay.style.display = 'none';
                showToast('success', 'Password Reset Email Sent', 'Please check your email to reset your password');
            })
            .catch((error) => {
                loadingOverlay.style.display = 'none';
                showToast('error', 'Reset Failed', getErrorMessage(error));
            });
    });
});
