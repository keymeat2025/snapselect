// user_settings.js - Script for handling existing user profile updates

document.addEventListener('DOMContentLoaded', function() {
    // Get all necessary elements
    const step1Screen = document.getElementById('step-1-screen');
    const step2Screen = document.getElementById('step-2-screen');
    const successScreen = document.getElementById('success-screen');
    
    const step1Indicator = document.getElementById('step-1-indicator');
    const step2Indicator = document.getElementById('step-2-indicator');
    
    const toStep2Btn = document.getElementById('to-step-2-btn');
    const backToStep1Btn = document.getElementById('back-to-step-1-btn');
    const updateProfileBtn = document.getElementById('update-profile-btn');
    const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
    
    // Form fields - Step 1
    const emailField = document.getElementById('email');
    
    // Form fields - Step 2
    const studioNameField = document.getElementById('studio-name');
    const ownerNameField = document.getElementById('owner-name');
    const ownerEmailField = document.getElementById('owner-email');
    const ownerNumberField = document.getElementById('owner-number');
    const studioAddressField = document.getElementById('studio-address');
    const studioPincodeField = document.getElementById('studio-pincode');
    
    // Auth state change listener
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            // User is signed in, fetch their profile data
            loadUserData(user.uid);
            // Set the email field with the current user's email
            emailField.value = user.email || '';
        } else {
            // User is not signed in, redirect to login page
            window.location.href = 'login.html';
        }
    });
    
    // Load user data from Firestore
    function loadUserData(userId) {
        firebase.firestore().collection('photographers').doc(userId)
            .get()
            .then((doc) => {
                if (doc.exists) {
                    const data = doc.data();
                    
                    // Populate Step 2 fields with existing data
                    studioNameField.value = data.studioName || '';
                    ownerNameField.value = data.ownerName || '';
                    ownerEmailField.value = data.ownerEmail || '';
                    ownerNumberField.value = data.ownerNumber || '';
                    studioAddressField.value = data.studioAddress || '';
                    studioPincodeField.value = data.studioPincode || '';
                } else {
                    console.log("No profile data found!");
                }
            })
            .catch((error) => {
                console.error("Error getting document:", error);
                alert("Failed to load your profile data. Please try again later.");
            });
    }
    
    // Step navigation
    toStep2Btn.addEventListener('click', function() {
        // Move to Step 2
        step1Screen.classList.remove('active');
        step2Screen.classList.add('active');
        
        step1Indicator.classList.remove('active');
        step2Indicator.classList.add('active');
    });
    
    backToStep1Btn.addEventListener('click', function() {
        // Move back to Step 1
        step2Screen.classList.remove('active');
        step1Screen.classList.add('active');
        
        step2Indicator.classList.remove('active');
        step1Indicator.classList.add('active');
    });
    
    // Update profile button
    updateProfileBtn.addEventListener('click', function() {
        // Validate Step 2 form
        const step2Form = document.getElementById('step-2-form');
        if (!step2Form.checkValidity()) {
            step2Form.reportValidity();
            return;
        }
        
        // Get current user
        const user = firebase.auth().currentUser;
        if (!user) {
            alert("You must be logged in to update your profile.");
            window.location.href = 'login.html';
            return;
        }
        
        // Show loading state (could add a spinner or disable button)
        updateProfileBtn.disabled = true;
        updateProfileBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
        
        // No password update needed
        
        // Prepare profile data to update
        const profileData = {
            studioName: studioNameField.value,
            ownerName: ownerNameField.value,
            ownerEmail: ownerEmailField.value,
            ownerNumber: ownerNumberField.value,
            studioAddress: studioAddressField.value,
            studioPincode: studioPincodeField.value,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Update Firestore document
        const firestoreUpdatePromise = firebase.firestore().collection('photographers').doc(user.uid)
            .update(profileData)
            .catch(error => {
                console.error("Error updating profile:", error);
                alert("Failed to update profile information: " + error.message);
                throw error; // Rethrow to catch in the Promise.all
            });
        
        // Process the Firestore update
        firestoreUpdatePromise
            .then(() => {
                // Show success screen
                step2Screen.classList.remove('active');
                successScreen.classList.add('active');
            })
            .catch(() => {
                // Error already handled in the promise
                updateProfileBtn.disabled = false;
                updateProfileBtn.innerHTML = '<i class="fas fa-save" style="margin-right:8px;"></i>Save Changes';
            });
    });
    
    // Back to dashboard button
    backToDashboardBtn.addEventListener('click', function() {
        window.location.href = 'dashboard.html';
    });
});
