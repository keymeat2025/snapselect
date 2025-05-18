/**
 * security-manager.js
 * Enhanced security measures for SnapSelect with Razorpay integration
 */

const SecurityManager = {
    init() {
        console.log('Security manager initializing...');
        // Setup input validation for all forms
        this.setupInputValidation();
        
        // Setup CSRF protection
        this.setupCSRFProtection();
        
        // Setup rate limiting
        this.setupRateLimiting();
        
        // Setup data sanitization
        this.setupDataSanitization();
        
        // Setup payment security
        this.enhancePaymentSecurity();
        
        console.log('Security manager initialized');
    },

    /**
     * Setup input validation for forms
     */
    setupInputValidation() {
        // Gallery creation form validation
        const createGalleryForm = document.getElementById('createGalleryForm');
        if (createGalleryForm) {
            createGalleryForm.addEventListener('submit', (e) => {
                if (!this.validateGalleryForm()) {
                    e.preventDefault();
                    return false;
                }
            });
        }
        
        // Payment form validation
        const paymentForm = document.getElementById('paymentForm');
        if (paymentForm) {
            paymentForm.addEventListener('submit', (e) => {
                if (!this.validatePaymentForm()) {
                    e.preventDefault();
                    return false;
                }
            });
        }
        
        // Add validation to all form inputs
        this.setupLiveValidation();
    },

    /**
     * Validate gallery creation form
     */
    validateGalleryForm() {
        const galleryName = document.getElementById('galleryName');
        const clientEmail = document.getElementById('clientEmail');
        const maxSelections = document.getElementById('maxSelections');
        const expiryDate = document.getElementById('galleryExpiryDate');
        
        let isValid = true;
        
        // Validate gallery name (required, no special chars)
        if (!galleryName || !galleryName.value.trim()) {
            this.showValidationError(galleryName, 'Gallery name is required');
            isValid = false;
        } else if (!/^[a-zA-Z0-9 \-_]+$/.test(galleryName.value.trim())) {
            this.showValidationError(galleryName, 'Gallery name contains invalid characters');
            isValid = false;
        } else {
            this.clearValidationError(galleryName);
        }
        
        // Validate client email (required, valid email format)
        if (clientEmail) {
            if (!clientEmail.value.trim()) {
                this.showValidationError(clientEmail, 'Client email is required');
                isValid = false;
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.value.trim())) {
                this.showValidationError(clientEmail, 'Please enter a valid email address');
                isValid = false;
            } else {
                this.clearValidationError(clientEmail);
            }
        }
        
        // Validate max selections (positive number)
        if (maxSelections && maxSelections.value && parseInt(maxSelections.value) <= 0) {
            this.showValidationError(maxSelections, 'Maximum selections must be a positive number');
            isValid = false;
        } else if (maxSelections) {
            this.clearValidationError(maxSelections);
        }
        
        // Validate expiry date (future date)
        if (expiryDate && expiryDate.value) {
            const selectedDate = new Date(expiryDate.value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (selectedDate < today) {
                this.showValidationError(expiryDate, 'Expiry date must be in the future');
                isValid = false;
            } else {
                this.clearValidationError(expiryDate);
            }
        }
        
        return isValid;
    },

    /**
     * Validate payment form
     */
    validatePaymentForm() {
        // For Razorpay integration, we don't need to validate card details directly
        // Since Razorpay handles the payment UI, just validate that a plan is selected
        
        const activeTab = document.querySelector('.plan-tab.active');
        if (!activeTab) {
            if (window.NotificationSystem) {
                window.NotificationSystem.showNotification('error', 'Validation Error', 'Please select a plan to continue.');
            } else {
                alert('Please select a plan to continue.');
            }
            return false;
        }
        
        // Check rate limiting for payment actions
        if (this.rateLimiter && !this.rateLimiter.checkLimit('payment_create')) {
            if (window.NotificationSystem) {
                window.NotificationSystem.showNotification('error', 'Rate Limit', 'Too many payment attempts. Please try again later.');
            } else {
                alert('Too many payment attempts. Please try again later.');
            }
            return false;
        }
        
        return true;
    },

    /**
     * Validate order creation parameters
     */
    validateOrderCreation(planType, amount) {
        // Validate plan type
        if (!window.SUBSCRIPTION_PLANS || !window.SUBSCRIPTION_PLANS[planType]) {
            return {
                valid: false,
                message: 'Invalid plan selected.'
            };
        }
        
        // Validate amount matches plan price
        const expectedPrice = window.SUBSCRIPTION_PLANS[planType].price;
        if (amount !== expectedPrice) {
            return {
                valid: false,
                message: 'Price mismatch. Please refresh and try again.'
            };
        }
        
        // Check rate limiting
        if (this.rateLimiter && !this.rateLimiter.checkLimit('payment_create')) {
            return {
                valid: false,
                message: 'Too many payment attempts. Please try again later.'
            };
        }
        
        return { valid: true };
    },

    /**
     * Validate payment verification parameters
     */
    validatePaymentVerification(orderId, paymentId, signature) {
        // Basic validation
        if (!orderId || !paymentId || !signature) {
            return {
                valid: false,
                message: 'Missing payment details.'
            };
        }
        
        // Signature format validation (Razorpay signatures are hex strings)
        if (!/^[a-f0-9]+$/i.test(signature)) {
            return {
                valid: false,
                message: 'Invalid signature format.'
            };
        }
        
        // Check rate limiting
        if (this.rateLimiter && !this.rateLimiter.checkLimit('payment_verify')) {
            return {
                valid: false,
                message: 'Too many verification attempts. Please try again later.'
            };
        }
        
        return { valid: true };
    },

    /**
     * Show validation error for input
     */
    showValidationError(input, message) {
        if (!input) return;
        
        // Clear any existing error
        this.clearValidationError(input);
        
        // Add error class to input
        input.classList.add('error');
        
        // Create error message element
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = message;
        
        // Insert error message after input
        input.parentNode.insertBefore(errorMessage, input.nextSibling);
    },

    /**
     * Clear validation error for input
     */
    clearValidationError(input) {
        if (!input) return;
        
        // Remove error class from input
        input.classList.remove('error');
        
        // Remove any existing error message
        const parent = input.parentNode;
        if (parent) {
            const errorMessage = parent.querySelector('.error-message');
            if (errorMessage) {
                parent.removeChild(errorMessage);
            }
        }
    },

    /**
     * Setup live validation for form inputs
     */
    setupLiveValidation() {
        // Validate gallery name on input
        const galleryNameInput = document.getElementById('galleryName');
        if (galleryNameInput) {
            galleryNameInput.addEventListener('input', () => {
                if (!galleryNameInput.value.trim()) {
                    this.showValidationError(galleryNameInput, 'Gallery name is required');
                } else if (!/^[a-zA-Z0-9 \-_]+$/.test(galleryNameInput.value.trim())) {
                    this.showValidationError(galleryNameInput, 'Gallery name contains invalid characters');
                } else {
                    this.clearValidationError(galleryNameInput);
                }
            });
        }
        
        // Validate client email on input
        const clientEmailInput = document.getElementById('clientEmail');
        if (clientEmailInput) {
            clientEmailInput.addEventListener('input', () => {
                if (!clientEmailInput.value.trim()) {
                    this.showValidationError(clientEmailInput, 'Client email is required');
                } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmailInput.value.trim())) {
                    this.showValidationError(clientEmailInput, 'Please enter a valid email address');
                } else {
                    this.clearValidationError(clientEmailInput);
                }
            });
        }
    },

    /**
     * Setup CSRF protection
     */
    setupCSRFProtection() {
        // Generate CSRF token
        const csrfToken = this.generateCSRFToken();
        
        // Store token in session storage
        sessionStorage.setItem('csrfToken', csrfToken);
        
        // Add token to all forms
        this.addCSRFTokenToForms(csrfToken);
        
        // Add token to all fetch/XHR requests
        this.setupFetchInterceptor(csrfToken);
    },

    /**
     * Enhance payment security
     */
    enhancePaymentSecurity() {
        // Add specific protection for payment endpoints
        const originalFetch = window.fetch;
        window.fetch = (url, options = {}) => {
            // Add additional headers for payment-related endpoints
            if (url.includes('payment') || url.includes('razorpay')) {
                options.headers = options.headers || {};
                options.headers['X-Payment-Request'] = this.generateNonce();
                
                // Ensure asia-south1 region for payment-related cloud functions
                if (url.includes('functions') && !url.includes('asia-south1')) {
                    // Modify URL to include asia-south1 region if not already present
                    url = url.replace(/\/functions\//, '/functions/asia-south1/');
                }
            }
            
            return originalFetch.call(window, url, options);
        };
    },

    /**
     * Generate a nonce for payment operations
     */
    generateNonce() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    /**
     * Generate a CSRF token
     */
    generateCSRFToken() {
        // Generate a random token
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0,
                v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * Add CSRF token to all forms
     */
    addCSRFTokenToForms(token) {
        // Add hidden input with CSRF token to all forms
        const forms = document.querySelectorAll('form');
        
        forms.forEach(form => {
            // Check if form already has token
            let tokenInput = form.querySelector('input[name="csrfToken"]');
            
            if (!tokenInput) {
                // Create hidden input
                tokenInput = document.createElement('input');
                tokenInput.type = 'hidden';
                tokenInput.name = 'csrfToken';
                tokenInput.value = token;
                
                // Add to form
                form.appendChild(tokenInput);
            } else {
                // Update existing token
                tokenInput.value = token;
            }
        });
    },

    /**
     * Setup fetch interceptor to add CSRF token to all requests
     */
    setupFetchInterceptor(token) {
        // Save original fetch
        const originalFetch = window.fetch;
        
        // Override fetch to add headers
        window.fetch = function(url, options = {}) {
            // Ensure options.headers exists
            options.headers = options.headers || {};
            
            // Add CSRF token to headers
            options.headers['X-CSRF-Token'] = token;
            
            // Call original fetch with modified options
            return originalFetch.call(this, url, options);
        };
    },

    /**
     * Setup rate limiting to prevent abuse
     */
    setupRateLimiting() {
        // Track user actions
        const actionLimits = {
            gallery_create: { count: 0, limit: 5, resetTime: 60000 }, // 5 per minute
            photo_upload: { count: 0, limit: 100, resetTime: 60000 }, // 100 per minute
            client_invite: { count: 0, limit: 10, resetTime: 60000 }, // 10 per minute
            api_request: { count: 0, limit: 50, resetTime: 60000 },    // 50 per minute
            payment_create: { count: 0, limit: 5, resetTime: 300000 },  // 5 per 5 minutes
            payment_verify: { count: 0, limit: 10, resetTime: 300000 }, // 10 per 5 minutes
            plan_change: { count: 0, limit: 3, resetTime: 3600000 }     // 3 per hour
        };
        
        // Create rate limiter instance
        this.rateLimiter = {
            actionLimits: actionLimits,
            
            /**
             * Check if action is allowed
             * @param {string} action - Action type
             * @returns {boolean} - Whether action is allowed
             */
            checkLimit: function(action) {
                if (!actionLimits[action]) {
                    return true; // No limit for this action
                }
                
                const limit = actionLimits[action];
                
                // Check if count exceeds limit
                if (limit.count >= limit.limit) {
                    console.warn(`Rate limit exceeded for ${action}`);
                    return false;
                }
                
                // Increment count
                limit.count++;
                
                // Set timeout to decrement count
                setTimeout(() => {
                    limit.count = Math.max(0, limit.count - 1);
                }, limit.resetTime);
                
                return true;
            },
            
            /**
             * Reset rate limits
             */
            resetLimits: function() {
                Object.keys(actionLimits).forEach(key => {
                    actionLimits[key].count = 0;
                });
            }
        };
    },

    /**
     * Setup data sanitization to prevent XSS and injection attacks
     */
    setupDataSanitization() {
        // Create sanitization utility
        this.sanitizer = {
            /**
             * Sanitize text to prevent XSS
             * @param {string} text - Text to sanitize
             * @returns {string} - Sanitized text
             */
            sanitizeText: function(text) {
                if (!text) return '';
                
                // Create a temporary element
                const temp = document.createElement('div');
                
                // Set text as textContent (which escapes HTML)
                temp.textContent = text;
                
                // Return sanitized text
                return temp.innerHTML;
            },
            
            /**
             * Sanitize HTML to allow only safe tags
             * @param {string} html - HTML to sanitize
             * @returns {string} - Sanitized HTML
             */
            sanitizeHTML: function(html) {
                if (!html) return '';
                
                // Create a temporary element
                const temp = document.createElement('div');
                
                // Set HTML content
                temp.innerHTML = html;
                
                // Remove potentially dangerous elements and attributes
                const dangerous = ['script', 'iframe', 'object', 'embed', 'form'];
                
                // Remove dangerous elements
                dangerous.forEach(tag => {
                    const elements = temp.querySelectorAll(tag);
                    elements.forEach(el => el.remove());
                });
                
                // Remove dangerous attributes
                const allElements = temp.querySelectorAll('*');
                allElements.forEach(el => {
                    // Remove event handlers and javascript: URLs
                    const attrs = el.attributes;
                    for (let i = attrs.length - 1; i >= 0; i--) {
                        const attrName = attrs[i].name;
                        const attrValue = attrs[i].value;
                        
                        // Remove on* attributes
                        if (attrName.startsWith('on')) {
                            el.removeAttribute(attrName);
                        }
                        
                        // Remove javascript: URLs
                        if ((attrName === 'href' || attrName === 'src') && 
                            attrValue.toLowerCase().startsWith('javascript:')) {
                            el.removeAttribute(attrName);
                        }
                    }
                });
                
                // Return sanitized HTML
                return temp.innerHTML;
            },
            
            /**
             * Sanitize file name to prevent path traversal
             * @param {string} fileName - File name to sanitize
             * @returns {string} - Sanitized file name
             */
            sanitizeFileName: function(fileName) {
                if (!fileName) return '';
                
                // Remove path components and non-allowed characters
                return fileName
                    .replace(/\\/g, '') // Remove backslashes
                    .replace(/\//g, '') // Remove forward slashes
                    .replace(/\.\./g, '') // Remove double dots
                    .replace(/[<>:"|?*]/g, '') // Remove other invalid chars
                    .trim();
            },
            
            /**
             * Sanitize payment data to prevent tampering
             * @param {Object} data - Payment data to sanitize
             * @returns {Object} - Sanitized payment data
             */
            sanitizePaymentData: function(data) {
                if (!data) return {};
                
                const safeData = {};
                
                // Only allow specific fields
                const allowedFields = ['planType', 'amount', 'orderId', 'paymentId', 'signature', 'clientId'];
                
                allowedFields.forEach(field => {
                    if (data[field] !== undefined) {
                        // Sanitize string values
                        if (typeof data[field] === 'string') {
                            safeData[field] = this.sanitizeText(data[field]);
                        } else {
                            safeData[field] = data[field];
                        }
                    }
                });
                
                return safeData;
            }
        };
    },

    /**
     * Log security events
     */
    logSecurityEvent(event, details) {
        console.log(`Security event: ${event}`, details);
        
        // Log to Firebase if available
        if (firebase && firebase.firestore && firebase.auth().currentUser) {
            firebase.firestore().collection('security_logs').add({
                event: event,
                details: details,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                userId: firebase.auth().currentUser.uid,
                userAgent: navigator.userAgent,
                ip: null // Will be captured by server
            }).catch(err => console.error('Error logging security event:', err));
        }
    },

    /**
     * Public methods and properties
     */
    validateInput(input) {
        if (!input) return '';
        return String(input).replace(/[<>]/g, '');
    },
    
    validateEmail(email) {
        if (!email) return false;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(String(email));
    }
};

// Initialize on document ready
document.addEventListener('DOMContentLoaded', () => {
    SecurityManager.init();
    
    // Expose SecurityManager for use in other files
    window.SecurityManager = SecurityManager;
});
