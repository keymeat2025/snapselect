// login-page.js
// Connects the SnapSelect login page UI with Firebase authentication

document.addEventListener('DOMContentLoaded', function() {
    // Wait for Firebase Auth to initialize
    initializeAuth();
});

function initializeAuth() {
    // Check if firebaseAuth is available
    if (typeof window.firebaseAuth === 'undefined') {
        // Firebase Auth not loaded yet, try again in a moment
        setTimeout(initializeAuth, 100);
        return;
    }
    
    // Set up form event listeners
    setupLoginForm();
    
    // Setup auth state observer
    setupAuthObserver();
}

function setupLoginForm() {
    // Email/password login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleEmailLogin);
    }
    
    // Google sign-in button
    const googleBtn = document.getElementById('google-signin-btn');
    if (googleBtn) {
        googleBtn.addEventListener('click', handleGoogleLogin);
    }
}

function setupAuthObserver() {
    // Check if user is already logged in
    window.firebaseAuth.setupAuthObserver(
        function(user) {
            // User is signed in, redirect to dashboard
            console.log('User is signed in:', user.email);
            window.location.href = 'studiopanel-dashboard.html';
        },
        function() {
            // User is signed out, stay on login page
            console.log('User is signed out');
        }
    );
}

// Handle email/password login
async function handleEmailLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('auth-error');
    const rememberMe = document.getElementById('remember').checked;
    
    // Clear previous errors
    errorElement.style.display = 'none';
    
    try {
        // Set persistence based on "remember me" checkbox
        if (rememberMe) {
            // Keep user signed in even after browser restarts
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } else {
            // Sign out when browser window is closed
            await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
        }
        
        // Attempt login
        const user = await window.firebaseAuth.signInWithEmail(email, password);
        console.log('Login successful:', user.email);
        
        // Redirect will happen automatically from the auth observer
    } catch (error) {
        console.error('Login error:', error);
        
        // Show error message
        errorElement.textContent = getAuthErrorMessage(error.code);
        errorElement.style.display = 'block';
    }
}

// Handle Google sign-in
async function handleGoogleLogin() {
    const errorElement = document.getElementById('auth-error');
    
    // Clear previous errors
    errorElement.style.display = 'none';
    
    try {
        const user = await window.firebaseAuth.signInWithGoogle();
        console.log('Google sign-in successful:', user.email);
        
        // Redirect will happen automatically from the auth observer
    } catch (error) {
        console.error('Google sign-in error:', error);
        
        // Show error message
        errorElement.textContent = getAuthErrorMessage(error.code);
        errorElement.style.display = 'block';
    }
}

// Get user-friendly error messages
function getAuthErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'Invalid email address format.';
        case 'auth/user-disabled':
            return 'This account has been disabled.';
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return 'Invalid email or password.';
        case 'auth/too-many-requests':
            return 'Too many failed login attempts. Please try again later.';
        case 'auth/popup-closed-by-user':
            return 'Sign-in popup was closed before completing the sign-in.';
        case 'auth/cancelled-popup-request':
            return 'Sign-in canceled. Please try again.';
        case 'auth/popup-blocked':
            return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
        default:
            return 'An error occurred during sign-in. Please try again.';
    }
}
