// login-page.js
// Connects the SnapSelect login page UI with authentication

// Brute force protection settings
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes in milliseconds
let loginAttempts = 0;
let lockoutUntil = 0;

document.addEventListener('DOMContentLoaded', function() {
    // Clear any stored form data
    clearFormData();
    
    // Setup security enhancements
    setupFormSecurity();
    
    // Setup navigation protection
    setupNavigationProtection();
    
    // Wait for Auth to initialize
    initializeAuth();
});

function initializeAuth() {
    // Check if firebaseAuth is available
    if (typeof window.firebaseAuth === 'undefined') {
        // Auth not loaded yet, try again in a moment
        setTimeout(initializeAuth, 100);
        return;
    }
    
    // Check for existing lockout
    checkForExistingLockout();
    
    // Set up form event listeners
    setupLoginForm();
    
    // Setup auth state observer
    setupAuthObserver();
}

function clearFormData() {
    const emailField = document.getElementById('email');
    const passwordField = document.getElementById('password');
    
    if (emailField) {
        emailField.value = '';
        emailField.setAttribute('value', '');
    }
    if (passwordField) {
        passwordField.value = '';
        passwordField.setAttribute('value', '');
    }
    
    // Clear browser autocomplete storage
    if (window.localStorage) {
        localStorage.removeItem('savedEmail');
        localStorage.removeItem('savedPassword');
    }
}

function setupFormSecurity() {
    const form = document.getElementById('login-form');
    const emailField = document.getElementById('email');
    const passwordField = document.getElementById('password');
    
    if (form) {
        // Disable form autocomplete
        form.setAttribute('autocomplete', 'off');
        
        // Set unique names to prevent browser saving
        const timestamp = Date.now();
        emailField.setAttribute('name', `email_${timestamp}`);
        passwordField.setAttribute('name', `password_${timestamp}`);
        
        // Additional security attributes
        emailField.setAttribute('autocomplete', 'off');
        emailField.setAttribute('autocorrect', 'off');
        emailField.setAttribute('autocapitalize', 'off');
        emailField.setAttribute('spellcheck', 'false');
        
        passwordField.setAttribute('autocomplete', 'new-password');
        passwordField.setAttribute('autocorrect', 'off');
        passwordField.setAttribute('autocapitalize', 'off');
        passwordField.setAttribute('spellcheck', 'false');
        
        // Clear fields on focus
        emailField.addEventListener('focus', function() {
            if (this.hasAttribute('readonly')) {
                this.removeAttribute('readonly');
            }
        });
        
        passwordField.addEventListener('focus', function() {
            if (this.hasAttribute('readonly')) {
                this.removeAttribute('readonly');
            }
        });
        
        // Add readonly initially to prevent autocomplete
        emailField.setAttribute('readonly', true);
        passwordField.setAttribute('readonly', true);
        
        // Remove readonly after page load
        setTimeout(() => {
            emailField.removeAttribute('readonly');
            passwordField.removeAttribute('readonly');
        }, 1000);
    }
}

function setupNavigationProtection() {
    // Clear browser history to prevent back navigation after logout
    if (window.history && window.history.pushState) {
        window.history.pushState(null, '', window.location.href);
        window.onpopstate = function() {
            window.history.pushState(null, '', window.location.href);
            
            // Check if user was logged out
            const wasLoggedOut = sessionStorage.getItem('userLoggedOut');
            if (wasLoggedOut) {
                clearFormData();
                sessionStorage.removeItem('userLoggedOut');
                
                // Show logout message
                const errorElement = document.getElementById('auth-error');
                if (errorElement) {
                    errorElement.textContent = 'You have been successfully logged out.';
                    errorElement.style.display = 'block';
                    errorElement.style.color = '#28a745'; // Success color
                    
                    setTimeout(() => {
                        errorElement.style.display = 'none';
                        errorElement.style.color = ''; // Reset color
                    }, 3000);
                }
            }
        };
    }
    
    // Disable page caching
    window.addEventListener('pageshow', function(event) {
        if (event.persisted) {
            // Page was loaded from cache
            clearFormData();
        }
    });
}

function checkForExistingLockout() {
    const storedLockout = localStorage.getItem('lockoutUntil');
    if (storedLockout) {
        lockoutUntil = parseInt(storedLockout);
        
        // Clear expired lockouts
        if (new Date().getTime() > lockoutUntil) {
            localStorage.removeItem('lockoutUntil');
            lockoutUntil = 0;
        }
    }
    
    // Also retrieve stored login attempts
    const storedAttempts = localStorage.getItem('loginAttempts');
    if (storedAttempts) {
        loginAttempts = parseInt(storedAttempts);
    }
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
            
            // Reset login attempts on successful sign-in
            resetLoginAttempts();
            
            // Clear any saved form data before redirect
            clearFormData();
            
            // Redirect based on user type
            if (window.location.pathname.includes('/pages/')) {
                window.location.replace('../index.html');
            } else {
                window.location.replace('index.html');
            }
        },
        function() {
            // User is signed out, stay on login page
            console.log('User is signed out');
            
            // Clear form data for security
            clearFormData();
        }
    );
}

// Reset login attempts counter
function resetLoginAttempts() {
    loginAttempts = 0;
    localStorage.removeItem('loginAttempts');
    localStorage.removeItem('lockoutUntil');
}

// Handle email/password login
async function handleEmailLogin(event) {
    event.preventDefault();
    
    // Clear any cached credentials
    clearFormData();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('auth-error');
    const rememberMe = document.getElementById('remember').checked;
    
    // Clear previous errors
    errorElement.style.display = 'none';
    
    // Check if account is currently locked out
    const currentTime = new Date().getTime();
    if (currentTime < lockoutUntil) {
        const minutesLeft = Math.ceil((lockoutUntil - currentTime) / 60000);
        errorElement.textContent = `Too many failed login attempts. Please try again in ${minutesLeft} minute(s).`;
        errorElement.style.display = 'block';
        return;
    }
    
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
        
        // Reset login attempts on success
        resetLoginAttempts();
        
        // Clear form data after successful login
        clearFormData();
        
        // Redirect will happen automatically from the auth observer
    } catch (error) {
        console.error('Login error code:', error.code);
        console.error('Login error message:', error.message);
        
        // If system error or network issue, don't count toward attempts
        if (!error.code.includes('auth/user-not-found') && 
            !error.code.includes('auth/wrong-password') && 
            !error.code.includes('auth/invalid-credential') && 
            !error.code.includes('auth/invalid-login-credentials') && 
            !error.code.includes('auth/invalid-password')) {
            
            errorElement.textContent = getAuthErrorMessage(error.code, error.message);
            errorElement.style.display = 'block';
            return;
        }
        
        // Increment failed login attempts for authentication failures
        loginAttempts++;
        localStorage.setItem('loginAttempts', loginAttempts);
        
        // Check if max attempts reached
        if (loginAttempts >= MAX_ATTEMPTS) {
            lockoutUntil = new Date().getTime() + LOCKOUT_TIME;
            localStorage.setItem('lockoutUntil', lockoutUntil);
            
            errorElement.textContent = `Too many failed login attempts. Your account is locked for 15 minutes.`;
            errorElement.style.display = 'block';
            return;
        }
        
        // Show error message
        errorElement.textContent = getAuthErrorMessage(error.code, error.message);
        errorElement.style.display = 'block';
        
        // Clear password field after error
        document.getElementById('password').value = '';
    }
}

// Handle Google sign-in
async function handleGoogleLogin() {
    const errorElement = document.getElementById('auth-error');
    
    // Clear previous errors
    errorElement.style.display = 'none';
    
    // Check if account is currently locked out (applies to all login methods)
    const currentTime = new Date().getTime();
    if (currentTime < lockoutUntil) {
        const minutesLeft = Math.ceil((lockoutUntil - currentTime) / 60000);
        errorElement.textContent = `Too many failed login attempts. Please try again in ${minutesLeft} minute(s).`;
        errorElement.style.display = 'block';
        return;
    }
    
    try {
        const user = await window.firebaseAuth.signInWithGoogle();
        console.log('Google sign-in successful:', user.email);
        
        // Reset login attempts on success
        resetLoginAttempts();
        
        // Clear form data after successful login
        clearFormData();
        
        // Redirect will happen automatically from the auth observer
    } catch (error) {
        console.error('Google sign-in error code:', error.code);
        console.error('Google sign-in error message:', error.message);
        
        // Only increment failed attempts for credential errors, not for popup closed or cancelled
        if (error.code.includes('credential') || error.code.includes('account-exists')) {
            loginAttempts++;
            localStorage.setItem('loginAttempts', loginAttempts);
            
            // Check if max attempts reached
            if (loginAttempts >= MAX_ATTEMPTS) {
                lockoutUntil = new Date().getTime() + LOCKOUT_TIME;
                localStorage.setItem('lockoutUntil', lockoutUntil);
                
                errorElement.textContent = `Too many failed login attempts. Your account is locked for 15 minutes.`;
                errorElement.style.display = 'block';
                return;
            }
        }
        
        // Show error message
        errorElement.textContent = getAuthErrorMessage(error.code, error.message);
        errorElement.style.display = 'block';
    }
}

// Get user-friendly error messages
function getAuthErrorMessage(errorCode, errorMessage) {
    // Unregistered user or wrong password cases
    if (errorCode.includes('user-not-found') || 
        errorCode.includes('wrong-password') || 
        errorCode.includes('invalid-credential') || 
        errorCode.includes('invalid-login-credentials') || 
        errorCode.includes('invalid-password') ||
        (errorMessage && (
            errorMessage.includes('user-not-found') ||
            errorMessage.includes('password is invalid') ||
            errorMessage.includes('invalid-credential') ||
            errorMessage.includes('credential is invalid')
        ))) {
        return 'Invalid email or password.';
    }
    
    // Other specific cases
    switch (true) {
        case errorCode.includes('invalid-email'):
            return 'Invalid email address format.';
        case errorCode.includes('user-disabled'):
            return 'This account has been disabled.';
        case errorCode.includes('too-many-requests'):
            return 'Too many failed login attempts. Please try again later.';
        case errorCode.includes('popup-closed'):
        case errorCode.includes('cancelled-popup'):
            return 'Sign-in popup was closed before completing the sign-in.';
        case errorCode.includes('popup-blocked'):
            return 'Sign-in popup was blocked by your browser. Please allow popups for this site.';
        case errorCode.includes('network-request-failed'):
            return 'Network error. Please check your internet connection.';
        case errorCode.includes('account-exists-with-different-credential'):
            return 'An account already exists with the same email address but different sign-in credentials.';
        case errorCode.includes('operation-not-allowed'):
            return 'This login method is not currently available.';
        default:
            // For any unhandled errors, check the error message content
            if (errorMessage && errorMessage.includes('email') && errorMessage.includes('password')) {
                return 'Invalid email or password.';
            } else {
                return 'Authentication failed. Please try again.';
            }
    }
}

// Clear form fields on window unload
window.addEventListener('unload', function() {
    clearFormData();
});
