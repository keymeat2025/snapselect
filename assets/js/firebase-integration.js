// firebase-integration.js
// Integration of Firebase with SnapSelect signup form

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Firebase services
  setupFirebaseServices();
  
  // Add event listeners for the form
  setupFormListeners();
  
  // Check for existing user session
  checkAuthState();
});

// Initialize Firebase services
function setupFirebaseServices() {
  // Load Firebase scripts if not already loaded
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded. Make sure to include the Firebase scripts.');
    return;
  }
  
  // Add script tags for Firebase files if they haven't been added yet
  const requiredScripts = [
    'firebase-config.js',
    'firebase-auth.js',
    'firebase-db.js',
    'firebase-storage.js'
  ];
  
  requiredScripts.forEach(script => {
    if (!document.querySelector(`script[src="assets/js/${script}"]`)) {
      const scriptTag = document.createElement('script');
      scriptTag.src = `assets/js/${script}`;
      document.head.appendChild(scriptTag);
    }
  });
}

// Setup form event listeners
function setupFormListeners() {
  // Step 1 form (Account creation)
  const toStep2Btn = document.getElementById('to-step-2-btn');
  if (toStep2Btn) {
    toStep2Btn.addEventListener('click', handleStep1);
  }
  
  // Google sign-in button
  const googleSignInBtn = document.getElementById('google-signin-btn');
  if (googleSignInBtn) {
    googleSignInBtn.addEventListener('click', handleGoogleSignIn);
  }
  
  // Step 2 form (Studio info)
  const toStep3Btn = document.getElementById('to-step-3-btn');
  if (toStep3Btn) {
    toStep3Btn.addEventListener('click', handleStep2);
  }
  
  // Step 3 form (Plan selection)
  const startTrialBtn = document.getElementById('start-trial-btn');
  if (startTrialBtn) {
    startTrialBtn.addEventListener('click', handleRegistrationSubmit);
  }
  
  // Initialize tier selection
  document.querySelectorAll('.tier-card').forEach(card => {
    card.addEventListener('click', () => {
      const tierName = card.getAttribute('data-tier');
      formData.selectedTier = tierName;
      selectTier(tierName);
    });
  });
}

// Check authentication state
function checkAuthState() {
  if (window.firebaseAuth) {
    window.firebaseAuth.setupAuthObserver(
      (user) => {
        // User is signed in
        console.log('User is signed in:', user.email);
        // Redirect to dashboard if registration is complete
        checkRegistrationComplete(user.uid);
      },
      () => {
        // User is signed out
        console.log('User is signed out');
        // Stay on registration page
      }
    );
  } else {
    // Firebase Auth not loaded yet, try again in a moment
    setTimeout(checkAuthState, 500);
  }
}

// Check if user has completed registration
async function checkRegistrationComplete(userId) {
  try {
    // Wait for Firestore to be ready
    if (!window.firebaseDb) {
      setTimeout(() => checkRegistrationComplete(userId), 500);
      return;
    }
    
    const userProfile = await window.firebaseDb.getUserProfile(userId);
    if (userProfile && userProfile.studioName && userProfile.subscriptionTier) {
      // User has completed registration, redirect to dashboard
      window.location.href = '/dashboard.html';
    }
  } catch (error) {
    console.error('Error checking registration status:', error);
  }
}

// Handle Step 1 submission
async function handleStep1() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  
  if (!email || !password) {
    alert('Please fill in all required fields.');
    return;
  }
  
  if (password !== confirmPassword) {
    alert('Passwords do not match.');
    return;
  }
  
  try {
    // Save form data
    formData.email = email;
    formData.password = password;
    
    // Proceed to next step without creating account yet
    goToStep(2);
    
    // Pre-fill email in step 2
    document.getElementById('owner-email').value = email;
    
  } catch (error) {
    alert(`Error: ${error.message}`);
  }
}

// Handle Google Sign-in
async function handleGoogleSignIn() {
  try {
    // Wait for Firebase Auth to load
    if (!window.firebaseAuth) {
      setTimeout(handleGoogleSignIn, 500);
      return;
    }
    
    const { user, firstName, lastName, email } = await window.firebaseAuth.loginWithGoogle();
    
    // Save form data
    formData.email = email;
    formData.ownerName = `${firstName} ${lastName}`.trim();
    formData.ownerEmail = email;
    formData.password = 'google-auth'; // Just a placeholder, not actually used
    
    // Proceed to step 2
    goToStep(2);
    
    // Pre-fill form fields
    document.getElementById('owner-name').value = formData.ownerName;
    document.getElementById('owner-email').value = formData.ownerEmail;
    
  } catch (error) {
    alert(`Google sign-in error: ${error.message}`);
  }
}

// Handle Step 2 submission
function handleStep2() {
  const studioName = document.getElementById('studio-name').value;
  const ownerName = document.getElementById('owner-name').value;
  const ownerEmail = document.getElementById('owner-email').value;
  const ownerNumber = document.getElementById('owner-number').value;
  
  if (!studioName || !ownerName || !ownerEmail || !ownerNumber) {
    alert('Please fill in all required fields.');
    return;
  }
  
  // Save form data
  formData.studioName = studioName;
  formData.ownerName = ownerName;
  formData.ownerEmail = ownerEmail;
  formData.ownerNumber = ownerNumber;
  
  // Proceed to next step
  goToStep(3);
  
  // Preselect tier
  selectTier(formData.selectedTier);
}

// Handle final registration submission
async function handleRegistrationSubmit(event) {
  event.preventDefault();
  
  // Check terms agreement
  if (!document.getElementById('terms').checked) {
    alert('Please agree to the Terms of Service and Privacy Policy.');
    return;
  }
  
  try {
    // Show loading state
    const startTrialBtn = document.getElementById('start-trial-btn');
    const originalText = startTrialBtn.textContent;
    startTrialBtn.textContent = 'Processing...';
    startTrialBtn.disabled = true;
    
    // Wait for Firebase to be ready
    if (!window.firebaseAuth) {
      alert('Firebase is not initialized yet. Please try again.');
      startTrialBtn.textContent = originalText;
      startTrialBtn.disabled = false;
      return;
    }
    
    // Complete the registration process
    const user = await window.firebaseAuth.completeRegistration(
      formData.email,
      formData.password,
      {
        studioName: formData.studioName,
        ownerName: formData.ownerName,
        ownerEmail: formData.ownerEmail,
        ownerNumber: formData.ownerNumber
      },
      formData.selectedTier
    );
    
    // Show success message
    const tierName = document.querySelector('.tier-card.selected .tier-name').textContent;
    alert(`Registration successful! Your SnapSelect journey started with ${tierName} plan.`);
    
    // Redirect to dashboard
    window.location.href = '/dashboard.html';
    
  } catch (error) {
    alert(`Registration error: ${error.message}`);
    
    // Reset button state
    const startTrialBtn = document.getElementById('start-trial-btn');
    startTrialBtn.textContent = 'Start Trial';
    startTrialBtn.disabled = false;
  }
}
