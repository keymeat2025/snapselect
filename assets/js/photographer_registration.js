// photographer_registration.js
// Handles the SnapSelect registration process

// Form data storage
let formData = {
    email: '', 
    password: '', 
    studioName: '', 
    ownerName: '', 
    ownerEmail: '', 
    ownerNumber: '',
    studioAddress: '',
    studioPincode: '',
    registrationDate: null
};

// DOM elements
const screens = document.querySelectorAll('.form-screen');
const indicators = document.querySelectorAll('.step');

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', () => {
    // Initialize event listeners
    setupFormListeners();
    
    // Check authentication state
    checkAuthState();
});

// Check authentication state
function checkAuthState() {
    if (window.firebaseAuth) {
        window.firebaseAuth.setupAuthObserver(
            (user) => {
                // User is signed in
                console.log('User is signed in:', user.email);
                // Check if registration is complete and redirect if needed
                checkRegistrationComplete(user.uid);
            },
            () => {
                // User is signed out, stay on registration page
                console.log('User is signed out');
            }
        );
    } else {
        // Firebase Auth not loaded yet, try again in a moment
        setTimeout(checkAuthState, 500);
    }
}

// Check if registration is complete
async function checkRegistrationComplete(userId) {
    try {
        // Get photographer document
        const docRef = await db.collection('photographer').doc('photographer_main').get();
        if (docRef.exists && docRef.data().uid === userId) {
            // Registration is complete, redirect to dashboard
            window.location.href = '../index.html';
        }
    } catch (error) {
        console.error('Error checking registration status:', error);
    }
}

// Test Firestore connection
function testFirestoreConnection() {
  const db = window.firebaseServices?.db;
  if (db) {
    console.log("Testing Firestore connection...");
    db.collection('test').doc('test-doc').set({
      test: 'This is a test',
      timestamp: new Date()
    })
    .then(() => {
      console.log("Firestore connection successful!");
    })
    .catch((error) => {
      console.error("Firestore connection failed:", error);
    });
  } else {
    console.error("Firestore not initialized");
  }
}

// Call the test function after a short delay to ensure Firebase is initialized
setTimeout(testFirestoreConnection, 2000);

// Set up event listeners with null checks
function setupFormListeners() {
    // Helper function to safely add event listeners
    const safeAddListener = (id, event, handler) => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, handler);
        } else {
            console.warn(`Element with ID "${id}" not found in the document.`);
        }
    };
    
    // Step 1 to Step 2
    safeAddListener('to-step-2-btn', 'click', () => {
        const email = document.getElementById('email')?.value;
        const password = document.getElementById('password')?.value;
        const confirmPassword = document.getElementById('confirm-password')?.value;
        
        if (!email || !password) {
            alert('Please fill in all required fields.');
            return;
        }
        
        if (password !== confirmPassword) {
            alert('Passwords do not match.');
            return;
        }
        
        formData.email = email;
        formData.password = password;
        
        goToStep(2);
        
        const ownerEmailField = document.getElementById('owner-email');
        if (ownerEmailField) ownerEmailField.value = email;
    });
    
    // Final step (complete registration)
    safeAddListener('complete-registration-btn', 'click', handleRegistrationCompletion);
    
    // Back buttons
    safeAddListener('back-to-step-1-btn', 'click', () => goToStep(1));
    
    // Google Sign In
    safeAddListener('google-signin-btn', 'click', handleGoogleSignIn);
    
    // Dashboard button (after successful registration)
    safeAddListener('go-to-dashboard-btn', 'click', () => {
        window.location.href = '/dashboard.html';
    });
}

// Navigate between steps
function goToStep(step) {
    screens.forEach(s => s.classList.remove('active'));
    indicators.forEach(i => i.classList.remove('active'));
    screens[step-1].classList.add('active');
    indicators[step-1].classList.add('active');
}

// Validate form inputs
function validateForm(formId, requiredFields) {
    // Check required fields
    if (requiredFields.some(id => !document.getElementById(id)?.value)) {
        alert('Please fill in all required fields.');
        return false;
    }
    
    // India-specific validations
    const pincode = document.getElementById('studio-pincode')?.value;
    if (pincode && !/^[1-9][0-9]{5}$/.test(pincode)) {
        alert('Please enter a valid 6-digit Indian PIN code.');
        return false;
    }
    
    const phone = document.getElementById('owner-number')?.value;
    if (phone && !/^[6-9][0-9]{9}$/.test(phone)) {
        alert('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
        return false;
    }
    
    return true;
}

// Save form data
function saveFormData() {
    const studioNameElement = document.getElementById('studio-name');
    const ownerNameElement = document.getElementById('owner-name');
    const ownerEmailElement = document.getElementById('owner-email');
    const ownerNumberElement = document.getElementById('owner-number');
    const studioAddressElement = document.getElementById('studio-address');
    const studioPincodeElement = document.getElementById('studio-pincode');
    
    if (studioNameElement) formData.studioName = studioNameElement.value;
    if (ownerNameElement) formData.ownerName = ownerNameElement.value;
    if (ownerEmailElement) formData.ownerEmail = ownerEmailElement.value;
    if (ownerNumberElement) formData.ownerNumber = ownerNumberElement.value;
    if (studioAddressElement) formData.studioAddress = studioAddressElement.value;
    if (studioPincodeElement) formData.studioPincode = studioPincodeElement.value;
    formData.registrationDate = new Date();
}

// Handle Google sign-in
async function handleGoogleSignIn() {
    try {
        if (!window.firebaseAuth) {
            alert('Firebase authentication is not initialized yet. Please try again in a moment.');
            return;
        }
        
        const user = await window.firebaseAuth.signInWithGoogle();
        
        // Pre-fill form with Google account info
        formData.email = user.email;
        formData.password = 'google-auth'; // Just a placeholder
        
        // Extract name from email or displayName
        if (user.displayName) {
            formData.ownerName = user.displayName;
        } else {
            // If no display name, use email username part
            formData.ownerName = user.email.split('@')[0];
        }
        
        formData.ownerEmail = user.email;
        
        // Move to step 2 and pre-fill fields
        goToStep(2);
        
        const ownerNameElement = document.getElementById('owner-name');
        const ownerEmailElement = document.getElementById('owner-email');
        
        if (ownerNameElement) ownerNameElement.value = formData.ownerName;
        if (ownerEmailElement) ownerEmailElement.value = formData.ownerEmail;
    } catch (error) {
        console.error('Google sign-in error:', error);
        alert(`Sign-in error: ${error.message}`);
    }
}

// Handle registration completion
async function handleRegistrationCompletion() {
    if (!validateForm('step-2-form', [
        'studio-name', 
        'owner-name', 
        'owner-email', 
        'owner-number', 
        'studio-address', 
        'studio-pincode'
    ])) {
        return;
    }
    
    saveFormData();
    
    // Show loading state
    const completeButton = document.getElementById('complete-registration-btn');
    if (!completeButton) {
        console.error('Complete registration button not found');
        return;
    }
    
    completeButton.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>Processing...';
    completeButton.disabled = true;
    
    try {
        // Wait for Firebase Auth to be ready
        if (!window.firebaseAuth) {
            setTimeout(() => {
                alert('Firebase services are not ready. Please try again.');
                completeButton.innerHTML = '<i class="fas fa-check-circle" style="margin-right:8px;"></i>Complete Registration';
                completeButton.disabled = false;
            }, 1000);
            return;
        }
        
        // Check if user is already authenticated via Google
        let user = window.firebaseAuth.getCurrentUser();
        
        if (!user) {
            // Create new user with email/password
            user = await window.firebaseAuth.registerWithEmail(
                formData.email,
                formData.password
            );
        }
        
        // Create photographer profile in Firestore
        await window.firebaseAuth.createPhotographerProfile(
            user.uid,
            {
                studioName: formData.studioName,
                ownerName: formData.ownerName,
                ownerEmail: formData.ownerEmail,
                ownerNumber: formData.ownerNumber,
                studioAddress: formData.studioAddress,
                studioPincode: formData.studioPincode
            }
        );
        
        // Show success UI
        const registrationScreen = document.getElementById('step-2-screen');
        const successScreen = document.getElementById('success-screen');
        
        if (registrationScreen) registrationScreen.style.display = 'none';
        if (successScreen) successScreen.style.display = 'block';
        
        // Update step indicator to show completion
        const stepIndicator = document.getElementById('step-2-indicator');
        if (stepIndicator) {
            stepIndicator.innerHTML = `
                <div class="step-number" style="background-color:var(--success);border-color:var(--success);">
                    <i class="fas fa-check" style="color:white;"></i>
                </div>
                <div class="step-label" style="color:var(--success);">Completed</div>
            `;
        }
        
    } catch (error) {
        console.error('Registration error:', error);
        alert(`Registration error: ${error.message}`);
        
        // Reset button state
        completeButton.innerHTML = '<i class="fas fa-check-circle" style="margin-right:8px;"></i>Complete Registration';
        completeButton.disabled = false;
    }
}
