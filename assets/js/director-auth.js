// director-auth.js
// Place this in your assets/js directory

document.addEventListener('DOMContentLoaded', function() {
    // Reference to the login form
    const loginForm = document.getElementById('directorLoginForm');
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const toastContainer = document.getElementById('toastContainer');

    // Check if already logged in - for testing we'll add a parameter to avoid redirect loop
    const urlParams = new URLSearchParams(window.location.search);
    const testMode = urlParams.get('test') === 'true';
    
    if (!testMode) {
        checkAuthState();
    }
    
    // Handle form submission
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get input values
            const email = document.getElementById('userEmail').value;
            const password = document.getElementById('userPassword').value;
            const accessCode = document.getElementById('accessCode').value;
            
            // Show loading overlay
            loadingOverlay.style.display = 'flex';
            
            // For testing purposes, we can bypass the actual Firebase authentication
            if (testMode) {
                console.log('Test mode active - simulating authentication');
                
                // Simulate authentication delay
                setTimeout(() => {
                    // Hide loading overlay
                    loadingOverlay.style.display = 'none';
                    
                    // Show success message
                    showToast('success', 'Authentication Successful', 'Welcome to SnapSelect Director Portal');
                    
                    // Simulate successful authentication storage
                    sessionStorage.setItem('directorAuthenticated', 'true');
                    sessionStorage.setItem('authTimestamp', Date.now());
                    
                    // After a delay, redirect to dashboard
                    setTimeout(() => {
                        window.location.href = 'nexus-dashboard.html';
                    }, 2000);
                }, 1500);
                
                return;
            }
            
            // Real authentication flow
            firebase.auth().signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    // Step 2: Verify the provided access code against Firestore
                    return verifyAccessCode(accessCode);
                })
                .then((isValidAccessCode) => {
                    if (!isValidAccessCode) {
                        throw new Error('Invalid access code');
                    }
                    
                    // Step 3: Verify if the user is a director in Firestore
                    return checkDirectorStatus(firebase.auth().currentUser.uid);
                })
                .then((isDirector) => {
                    if (!isDirector) {
                        throw new Error('Not authorized as Director');
                    }
                    
                    // All checks passed, proceed to director dashboard
                    // Hide loading overlay
                    loadingOverlay.style.display = 'none';
                    
                    // Show success message
                    showToast('success', 'Authentication Successful', 'Welcome to SnapSelect Director Portal');
                    
                    // Store authentication state
                    sessionStorage.setItem('directorAuthenticated', 'true');
                    sessionStorage.setItem('authTimestamp', Date.now());
                    
                    // Redirect to dashboard after a short delay to show the success message
                    setTimeout(() => {
                        window.location.href = 'nexus-dashboard.html';
                    }, 2000);
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
    }
    
    // Function to verify the access code
    function verifyAccessCode(providedCode) {
        // During development, you can use a hardcoded code for testing
        if (providedCode === 'test-director-code') {
            return Promise.resolve(true);
        }
        
        return firebase.firestore().collection('system_settings')
            .doc('director_access')
            .get()
            .then((doc) => {
                if (doc.exists && doc.data()) {
                    // Compare the provided code with the stored one
                    return doc.data().accessCode === providedCode;
                }
                return false;
            })
            .catch((error) => {
                console.error('Error verifying access code:', error);
                return false;
            });
    }
    
    // Function to check if the user is a director
    function checkDirectorStatus(userId) {
        // During development, you can hardcode this for certain test users
        if (userId === 'test-director-id' || firebase.auth().currentUser.email === 'director@example.com') {
            return Promise.resolve(true);
        }
        
        return firebase.firestore().collection('directors')
            .doc(userId)
            .get()
            .then((doc) => {
                return doc.exists && doc.data().active === true;
            })
            .catch((error) => {
                console.error('Error checking director status:', error);
                return false;
            });
    }
    
    // Function to get user-friendly error message
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
    
    // Check if user is already authenticated and redirect if needed
    function checkAuthState() {
        // Check for session storage auth state
        const directorAuthenticated = sessionStorage.getItem('directorAuthenticated');
        const authTimestamp = sessionStorage.getItem('authTimestamp');
        
        // If authenticated and timestamp is recent (within 4 hours)
        if (directorAuthenticated === 'true' && authTimestamp && 
            (Date.now() - parseInt(authTimestamp)) < 4 * 60 * 60 * 1000) {
            
            // Check if still logged in with Firebase
            firebase.auth().onAuthStateChanged(function(user) {
                if (user) {
                    // Redirect to dashboard if already authenticated
                    window.location.href = 'nexus-dashboard.html';
                }
            });
        }
    }
    
    // Toast notification function
    function showToast(type, title, message) {
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
    if (document.getElementById('forgotPasswordLink')) {
        document.getElementById('forgotPasswordLink').addEventListener('click', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('userEmail').value;
            
            if (!email) {
                showToast('error', 'Email Required', 'Please enter your email address first');
                return;
            }
            
            loadingOverlay.style.display = 'flex';
            
            // For test mode, just simulate the process
            if (testMode) {
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                    showToast('success', 'Password Reset Email Sent', 'Please check your email to reset your password');
                }, 1500);
                return;
            }
            
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
    }
});
