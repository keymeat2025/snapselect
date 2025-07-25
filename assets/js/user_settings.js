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
        firebase.firestore().collection('photographer')
            .get()
            .then((snapshot) => {
                if (snapshot.empty) {
                    console.log("No photographers found in collection");
                    return;
                }
                
                // Find the photographer with matching UID
                let photographerData = null;
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.uid === userId) {
                        console.log("Found matching photographer:", data);
                        photographerData = data;
                        photographerData.id = doc.id; // Store document ID for updates
                    }
                });
                
                if (photographerData) {
                    // Populate Step 2 fields with existing data
                    studioNameField.value = photographerData.studioName || '';
                    ownerNameField.value = photographerData.ownerName || '';
                    ownerEmailField.value = photographerData.ownerEmail || '';
                    ownerNumberField.value = photographerData.ownerNumber || '';
                    studioAddressField.value = photographerData.studioAddress || '';
                    studioPincodeField.value = photographerData.studioPincode || '';
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
            uid: user.uid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // First check if a profile exists
        firebase.firestore().collection('photographer')
            .get()
            .then(snapshot => {
                if (snapshot.empty) {
                    console.log("No photographers found, creating new profile");
                    // Add registration date for new profiles
                    profileData.registrationDate = firebase.firestore.FieldValue.serverTimestamp();
                    
                    return firebase.firestore().collection('photographer')
                        .add(profileData);
                }
                
                // Find the photographer with matching UID
                let existingDoc = null;
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.uid === user.uid) {
                        existingDoc = doc;
                    }
                });
                
                if (existingDoc) {
                    // Update existing document
                    console.log("Found existing photographer document with ID:", existingDoc.id);
                    return firebase.firestore().collection('photographer')
                        .doc(existingDoc.id)
                        .update(profileData);
                } else {
                    // Create new document
                    console.log("No matching photographer found, creating new profile");
                    // Add registration date for new profiles
                    profileData.registrationDate = firebase.firestore.FieldValue.serverTimestamp();
                    
                    return firebase.firestore().collection('photographer')
                        .add(profileData);
                }
            })
            .then(() => {
                // Show success screen
                step2Screen.classList.remove('active');
                successScreen.classList.add('active');
                
                // Handle auto-redirect if return URL exists
                handleAutoRedirectAfterSuccess();
            })
            .catch(error => {
                console.error("Error updating profile:", error);
                alert("Failed to update profile information: " + error.message);
                
                // Reset button state
                updateProfileBtn.disabled = false;
                updateProfileBtn.innerHTML = '<i class="fas fa-save" style="margin-right:8px;"></i>Save Changes';
            });
    });
    
    // Handle return URL for back to dashboard button
    handleReturnUrlAfterUpdate();
    
    // Function to handle return URL for the dashboard button
    function handleReturnUrlAfterUpdate() {
        // Add event listener to back-to-dashboard-btn
        if (backToDashboardBtn) {
            backToDashboardBtn.addEventListener('click', function(e) {
                // Get the return URL from query parameters
                const urlParams = new URLSearchParams(window.location.search);
                const returnUrl = urlParams.get('return');
                
                if (returnUrl) {
                    e.preventDefault();
                    // Redirect to the return URL
                    window.location.href = decodeURIComponent(returnUrl);
                } else {
                    // Default behavior, go to dashboard
                    window.location.href = 'dashboard.html';
                }
            });
            
            // Change button text if return URL exists
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('return')) {
                backToDashboardBtn.innerHTML = '<i class="fas fa-arrow-left" style="margin-right:8px"></i>Return to Gallery';
            }
        }
    }
    
    // Function to handle auto-redirect after successful profile update
    function handleAutoRedirectAfterSuccess() {
        // Get the return URL from query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const returnUrl = urlParams.get('return');
        
        if (returnUrl) {
            // Auto-redirect after a short delay
            setTimeout(() => {
                window.location.href = decodeURIComponent(returnUrl);
            }, 1500); // Delay to show success message
        }
    }
});
