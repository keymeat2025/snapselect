// firebase-auth.js
// Comprehensive Authentication Module for SnapSelect

// Registration Stages Enum
const REGISTRATION_STAGES = {
    INITIAL: 'initial',
    GOOGLE_AUTHENTICATED: 'google_auth',
    STUDIO_INFO_ENTERED: 'studio_info',
    PAYMENT_COMPLETE: 'payment_complete'
};

// Authentication Module
(function(window) {
    // Private variables
    let auth = null;
    let db = null;

    // Initialize Firebase Services
    function initializeFirebaseServices() {
        if (!window.firebaseServices) {
            console.error("Firebase services not configured");
            return false;
        }
        
        auth = window.firebaseServices.auth;
        db = window.firebaseServices.db;
        
        return auth && db;
    }

    // User Registration with Email
    function registerWithEmail(email, password) {
        if (!auth) {
            throw new Error("Authentication not initialized");
        }
        
        return auth.createUserWithEmailAndPassword(email, password)
            .then(userCredential => {
                console.log("User registered successfully");
                return userCredential.user;
            })
            .catch(error => {
                console.error("Registration error:", error.message);
                throw error;
            });
    }

    // User Sign In with Email
    function signInWithEmail(email, password) {
        if (!auth) {
            throw new Error("Authentication not initialized");
        }
        
        return auth.signInWithEmailAndPassword(email, password)
            .then(userCredential => {
                console.log("User signed in successfully");
                return userCredential.user;
            })
            .catch(error => {
                console.error("Sign in error:", error.message);
                throw error;
            });
    }

    // Google Sign In
    function signInWithGoogle() {
        if (!auth) {
            throw new Error("Authentication not initialized");
        }
        
        const provider = new firebase.auth.GoogleAuthProvider();
        
        return auth.signInWithPopup(provider)
            .then(async (result) => {
                const user = result.user;
                
                // Create or update user document with initial stage
                await updateRegistrationStage(user.uid, REGISTRATION_STAGES.GOOGLE_AUTHENTICATED);
                
                console.log("Google sign-in successful");
                return user;
            })
            .catch(error => {
                console.error("Google sign-in error:", error.message);
                throw error;
            });
    }

    // Sign Out
    function signOut() {
        if (!auth) {
            throw new Error("Authentication not initialized");
        }
        
        return auth.signOut()
            .then(() => {
                console.log("User signed out successfully");
                // Additional sign-out cleanup can be added here
            })
            .catch(error => {
                console.error("Sign out error:", error.message);
                throw error;
            });
    }

    // Password Reset
    function resetPassword(email) {
        if (!auth) {
            throw new Error("Authentication not initialized");
        }
        
        return auth.sendPasswordResetEmail(email)
            .then(() => {
                console.log("Password reset email sent");
            })
            .catch(error => {
                console.error("Password reset error:", error.message);
                throw error;
            });
    }

    // Update Registration Stage
    function updateRegistrationStage(userId, stage) {
        if (!db) {
            throw new Error("Firestore not initialized");
        }
        
        return db.collection('users').doc(userId).set({
            registrationStage: stage,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }

    // Get Registration Stage
    function getRegistrationStage(userId) {
        if (!db) {
            throw new Error("Firestore not initialized");
        }
        
        return db.collection('users').doc(userId).get()
            .then(doc => {
                return doc.exists ? doc.data().registrationStage : REGISTRATION_STAGES.INITIAL;
            })
            .catch(error => {
                console.error("Error fetching registration stage:", error);
                return REGISTRATION_STAGES.INITIAL;
            });
    }

    // Complete Registration
    function completeRegistration(email, password, studioData, transactionID) {
        if (!auth || !db) {
            throw new Error("Firebase services not initialized");
        }
        
        return registerWithEmail(email, password)
            .then(user => 
                createPhotographerProfile(user.uid, studioData)
                    .then(() => recordPayment(2, transactionID))
                    .then(() => updateRegistrationStage(user.uid, REGISTRATION_STAGES.PAYMENT_COMPLETE))
                    .then(() => user)
            )
            .catch(error => {
                console.error("Complete registration error:", error);
                throw error;
            });
    }

    // Create Photographer Profile
    function createPhotographerProfile(userId, studioData) {
        if (!db) {
            throw new Error("Firestore not initialized");
        }
        
        return db.collection('photographer').doc(userId).set({
            studioName: studioData.studioName,
            ownerName: studioData.ownerName,
            ownerEmail: studioData.ownerEmail,
            ownerNumber: studioData.ownerNumber,
            studioAddress: studioData.studioAddress,
            studioPincode: studioData.studioPincode,
            registrationDate: firebase.firestore.FieldValue.serverTimestamp(),
            uid: userId
        })
        .then(() => 
            updateRegistrationStage(userId, REGISTRATION_STAGES.STUDIO_INFO_ENTERED)
        )
        .then(() => 
            db.collection('subscription').doc(userId).set({
                planType: 'free',
                storageQuota: 1,
                startDate: firebase.firestore.FieldValue.serverTimestamp(),
                endDate: null,
                autoRenew: false,
                features: ['basic_uploads', 'limited_clients']
            })
        );
    }

    // Record Payment
    function recordPayment(amount, transactionID) {
        if (!db) {
            throw new Error("Firestore not initialized");
        }
        
        const timestamp = Date.now();
        const paymentID = `pay_${timestamp}_razorpay`;
        
        const gst = (amount * 0.18).toFixed(2);
        const totalAmount = (parseFloat(amount) + parseFloat(gst)).toFixed(2);
        
        return db.collection('payments').doc(paymentID).set({
            amount: amount,
            GST: gst,
            totalAmount: totalAmount,
            invoiceNumber: `INV-${timestamp}`,
            transactionID: transactionID,
            status: 'completed',
            date: firebase.firestore.FieldValue.serverTimestamp(),
            purpose: 'registration',
            paymentMethod: 'razorpay',
            receiptURL: null
        });
    }

    // Authentication State Observer
    function setupAuthObserver(onUserLoggedIn, onUserLoggedOut, onPartialRegistration) {
        if (!auth || !db) {
            console.error("Auth or Firestore not initialized");
            return;
        }
        
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    const stage = await getRegistrationStage(user.uid);
                    
                    switch (stage) {
                        case REGISTRATION_STAGES.PAYMENT_COMPLETE:
                            if (onUserLoggedIn) onUserLoggedIn(user);
                            break;
                        case REGISTRATION_STAGES.GOOGLE_AUTHENTICATED:
                        case REGISTRATION_STAGES.STUDIO_INFO_ENTERED:
                            if (onPartialRegistration) onPartialRegistration(user, stage);
                            break;
                        default:
                            if (onPartialRegistration) onPartialRegistration(user, REGISTRATION_STAGES.INITIAL);
                    }
                } catch (error) {
                    console.error("Error checking registration status:", error);
                    if (onUserLoggedOut) onUserLoggedOut();
                }
            } else {
                if (onUserLoggedOut) onUserLoggedOut();
            }
        });
    }

    // Get Current User
    function getCurrentUser() {
        return auth ? auth.currentUser : null;
    }

    // Initialize Module on Load
    function initialize() {
        // Attempt to initialize Firebase services
        if (!initializeFirebaseServices()) {
            console.error("Failed to initialize Firebase services");
            return;
        }

        // Expose methods to global window object
        window.firebaseAuth = {
            REGISTRATION_STAGES,
            registerWithEmail,
            signInWithEmail,
            signInWithGoogle,
            signOut,
            resetPassword,
            completeRegistration,
            createPhotographerProfile,
            getCurrentUser,
            setupAuthObserver,
            updateRegistrationStage,
            getRegistrationStage
        };

        console.log("Firebase Authentication Module Initialized");
    }

    // Run initialization
    initialize();
})(window);
