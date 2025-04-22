// photographer_registration.js
document.addEventListener('DOMContentLoaded', function() {
    // Form Elements
    const googleSigninBtn = document.getElementById('google-signin-btn');
    const toStep2Btn = document.getElementById('to-step-2-btn');
    const backToStep1Btn = document.getElementById('back-to-step-1-btn');
    const toStep3Btn = document.getElementById('to-step-3-btn');
    const backToStep2Btn = document.getElementById('back-to-step-2-btn');
    const makePaymentBtn = document.getElementById('make-payment-btn');
    const goToDashboardBtn = document.getElementById('go-to-dashboard-btn');

    // Form Screens
    const step1Screen = document.getElementById('step-1-screen');
    const step2Screen = document.getElementById('step-2-screen');
    const step3Screen = document.getElementById('step-3-screen');

    // Step Indicators
    const step1Indicator = document.getElementById('step-1-indicator');
    const step2Indicator = document.getElementById('step-2-indicator');
    const step3Indicator = document.getElementById('step-3-indicator');

    // Form Validation Helpers
    function validateEmail(email) {
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(String(email).toLowerCase());
    }

    function validatePassword(password) {
        return password.length >= 8;
    }

    // Google Sign In Handler
    function handleGoogleSignIn() {
        window.firebaseAuth.signInWithGoogle()
            .then(user => {
                console.log('Google Sign-In Successful', user);
                // Move to Studio Info Step
                step1Screen.classList.remove('active');
                step2Screen.classList.add('active');
                updateStepIndicators(2);
            })
            .catch(error => {
                console.error('Google Sign-In Error', error);
                alert('Google Sign-In Failed: ' + error.message);
            });
    }

    // Step Navigation and Validation
    function validateStep1() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (!validateEmail(email)) {
            alert('Please enter a valid email address');
            return false;
        }

        if (!validatePassword(password)) {
            alert('Password must be at least 8 characters long');
            return false;
        }

        if (password !== confirmPassword) {
            alert('Passwords do not match');
            return false;
        }

        // Move to next step
        step1Screen.classList.remove('active');
        step2Screen.classList.add('active');
        updateStepIndicators(2);
        return true;
    }

    function validateStep2() {
        const studioName = document.getElementById('studio-name').value.trim();
        const ownerName = document.getElementById('owner-name').value.trim();
        const ownerEmail = document.getElementById('owner-email').value.trim();
        const ownerNumber = document.getElementById('owner-number').value.trim();
        const studioAddress = document.getElementById('studio-address').value.trim();
        const studioPincode = document.getElementById('studio-pincode').value.trim();

        // Basic validation checks
        if (!studioName || !ownerName || !ownerEmail || !ownerNumber || !studioAddress || !studioPincode) {
            alert('Please fill in all fields');
            return false;
        }

        // Move to next step
        step2Screen.classList.remove('active');
        step3Screen.classList.add('active');
        updateStepIndicators(3);
        return true;
    }

    function completeRegistration() {
        const termsCheckbox = document.getElementById('terms');
        if (!termsCheckbox.checked) {
            alert('Please agree to the Terms of Service and Privacy Policy');
            return;
        }

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const studioData = {
            studioName: document.getElementById('studio-name').value.trim(),
            ownerName: document.getElementById('owner-name').value.trim(),
            ownerEmail: document.getElementById('owner-email').value.trim(),
            ownerNumber: document.getElementById('owner-number').value.trim(),
            studioAddress: document.getElementById('studio-address').value.trim(),
            studioPincode: document.getElementById('studio-pincode').value.trim()
        };

        // Simulate transaction ID (in real scenario, integrate with payment gateway)
        const transactionID = 'SNAP_' + Date.now();

        window.firebaseAuth.completeRegistration(email, password, studioData, transactionID)
            .then(user => {
                console.log('Registration Complete', user);
                // Show success screen
                document.getElementById('payment-screen').style.display = 'none';
                document.getElementById('success-screen').style.display = 'block';
            })
            .catch(error => {
                console.error('Registration Error', error);
                alert('Registration Failed: ' + error.message);
            });
    }

    // Step Indicator Update
    function updateStepIndicators(activeStep) {
        [step1Indicator, step2Indicator, step3Indicator].forEach((indicator, index) => {
            if (index + 1 <= activeStep) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
    }

    // Back Button Handlers
    function backToStep1() {
        step2Screen.classList.remove('active');
        step1Screen.classList.add('active');
        updateStepIndicators(1);
    }

    function backToStep2() {
        step3Screen.classList.remove('active');
        step2Screen.classList.add('active');
        updateStepIndicators(2);
    }

    // Setup Authentication Observer
    window.firebaseAuth.setupAuthObserver(
        // Fully Logged In
        (user) => {
            console.log('User fully logged in', user);
            // TODO: Redirect to dashboard or update UI
        },
        // Logged Out
        () => {
            console.log('User logged out');
            // Reset registration form or show login screen
        },
        // Partial Registration
        (user, stage) => {
            console.log('Partial registration', user, stage);
            // Handle different registration stages
            switch(stage) {
                case window.firebaseAuth.REGISTRATION_STAGES.GOOGLE_AUTHENTICATED:
                    step1Screen.classList.remove('active');
                    step2Screen.classList.add('active');
                    updateStepIndicators(2);
                    break;
                case window.firebaseAuth.REGISTRATION_STAGES.STUDIO_INFO_ENTERED:
                    step1Screen.classList.remove('active');
                    step2Screen.classList.remove('active');
                    step3Screen.classList.add('active');
                    updateStepIndicators(3);
                    break;
            }
        }
    );

    // Event Listeners
    if (googleSigninBtn) googleSigninBtn.addEventListener('click', handleGoogleSignIn);
    if (toStep2Btn) toStep2Btn.addEventListener('click', validateStep1);
    if (backToStep1Btn) backToStep1Btn.addEventListener('click', backToStep1);
    if (toStep3Btn) toStep3Btn.addEventListener('click', validateStep2);
    if (backToStep2Btn) backToStep2Btn.addEventListener('click', backToStep2);
    if (makePaymentBtn) makePaymentBtn.addEventListener('click', completeRegistration);
    if (goToDashboardBtn) goToDashboardBtn.addEventListener('click', () => {
        // TODO: Implement dashboard navigation
        window.location.href = '/dashboard.html';
    });
});
