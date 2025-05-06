// plan-validator.js
/**
 * Plan validation middleware for SnapSelect
 * Checks if a user has access to features based on plan status
 */

class PlanValidator {
  constructor() {
    this.cache = {}; // In-memory cache for plan validation results
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache
    this.initialized = false;
  }
  
  /**
   * Initialize the plan validator
   */
  init() {
    if (this.initialized) return;
    
    // Clear cache periodically
    setInterval(() => {
      this.clearExpiredCache();
    }, 10 * 60 * 1000); // Clear every 10 minutes
    
    this.initialized = true;
    console.log("Plan validator initialized");
  }
  
  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    Object.keys(this.cache).forEach(key => {
      if (this.cache[key].expires < now) {
        delete this.cache[key];
      }
    });
  }
  
  /**
   * Check if a user has access to a feature based on their plan
   * @param {string} userId - User ID
   * @param {string} clientId - Optional client ID for client-specific plans
   * @param {string} feature - Feature to check access for
   * @param {boolean} useCache - Whether to use cached results (default: true)
   * @returns {Promise<Object>} - Access status and plan details
   */
  async checkFeatureAccess(userId, clientId, feature, useCache = true) {
    if (!userId) {
      return { allowed: false, reason: 'User ID is required' };
    }
    
    if (!feature) {
      return { allowed: false, reason: 'Feature is required' };
    }
    
    // Check cache first if enabled
    const cacheKey = `${userId}_${clientId || 'default'}_${feature}`;
    if (useCache && this.cache[cacheKey] && this.cache[cacheKey].expires > Date.now()) {
      return this.cache[cacheKey].result;
    }
    
    try {
      // Call the Firebase function to check plan access
      const functions = firebase.functions().region('asia-south1');
      const checkPlanAccess = functions.httpsCallable('checkPlanAccess');
      
      const result = await checkPlanAccess({
        clientId: clientId || null
      });
      
      const planAccess = result.data;
      
      // If plan is not valid, deny access
      if (!planAccess.valid) {
        const response = {
          allowed: false,
          reason: 'No active plan',
          planStatus: planAccess.status || 'unknown',
          planType: planAccess.planType || 'none'
        };
        
        // Cache the result
        this.cacheResult(cacheKey, response);
        return response;
      }
      
      // Check if feature is allowed for this plan
      const allowed = this.checkPlanFeature(planAccess.planType, feature, planAccess.limits);
      
      const response = {
        allowed: allowed.access,
        reason: allowed.reason,
        planStatus: planAccess.status,
        planType: planAccess.planType,
        validUntil: planAccess.validUntil,
        limits: planAccess.limits
      };
      
      // Cache the result
      this.cacheResult(cacheKey, response);
      return response;
    } catch (error) {
      console.error('Error checking feature access:', error);
      
      // On error, allow access by default in development, deny in production
      const isProduction = window.location.hostname !== 'localhost';
      return {
        allowed: !isProduction, // Fail open in development, fail closed in production
        reason: `Error checking access: ${error.message}`,
        error: true
      };
    }
  }
  
  /**
   * Cache a validation result
   * @param {string} key - Cache key
   * @param {Object} result - Validation result
   */
  cacheResult(key, result) {
    this.cache[key] = {
      result: result,
      timestamp: Date.now(),
      expires: Date.now() + this.cacheExpiry
    };
  }
  
  /**
   * Check if a feature is allowed for a plan type
   * @param {string} planType - Plan type (lite, basic, pro, etc.)
   * @param {string} feature - Feature to check
   * @param {Object} limits - Plan limits
   * @returns {Object} - Access status and reason
   */
  checkPlanFeature(planType, feature, limits) {
    // Features allowed for all active plans
    const universalFeatures = [
      'view_gallery',
      'basic_selection',
      'download_selected'
    ];
    
    if (universalFeatures.includes(feature)) {
      return { access: true, reason: 'Basic feature' };
    }
    
    // Plan-specific features
    const planFeatures = {
      lite: [
        'basic_uploads',
        'client_selection',
        'basic_sharing',
        'mobile_gallery'
      ],
      mini: [
        'basic_uploads',
        'client_selection',
        'basic_sharing',
        'mobile_gallery',
        'favorites',
        'basic_customization'
      ],
      basic: [
        'advanced_uploads',
        'client_selection',
        'password_protection',
        'mobile_gallery',
        'favorites',
        'custom_branding',
        'basic_analytics'
      ],
      pro: [
        'advanced_uploads',
        'client_selection',
        'password_protection',
        'mobile_gallery',
        'favorites',
        'advanced_customization',
        'client_comments',
        'detailed_analytics'
      ],
      premium: [
        'advanced_uploads',
        'client_selection',
        'password_protection',
        'mobile_gallery',
        'favorites',
        'complete_customization',
        'client_comments',
        'detailed_analytics',
        'priority_support'
      ],
      ultimate: [
        'advanced_uploads',
        'client_selection',
        'password_protection',
        'mobile_gallery',
        'favorites',
        'white_label',
        'client_comments',
        'advanced_analytics',
        'priority_phone_support'
      ]
    };
    
    // Check plan-specific features
    if (planFeatures[planType] && planFeatures[planType].includes(feature)) {
      return { access: true, reason: `Included in ${planType} plan` };
    }
    
    // Feature is not included in the plan
    return { 
      access: false, 
      reason: `Feature '${feature}' is not available in your current plan`
    };
  }
  
  /**
   * Log usage of a feature for monitoring
   * @param {string} userId - User ID
   * @param {string} clientId - Optional client ID
   * @param {string} feature - Feature being used
   * @param {boolean} allowed - Whether access was allowed
   */
  async logFeatureUsage(userId, clientId, feature, allowed) {
    try {
      // Call the Firebase function to log usage
      const functions = firebase.functions().region('asia-south1');
      const validatePlanUsage = functions.httpsCallable('validatePlanUsage');
      
      await validatePlanUsage({
        action: `feature_${feature}`,
        planId: clientId ? `${userId}_${clientId}` : null,
        allowed: allowed
      });
    } catch (error) {
      console.warn('Error logging feature usage:', error);
      // Non-critical error, continue execution
    }
  }
}

// Create global instance
window.PlanValidator = new PlanValidator();

// Initialize on document ready
document.addEventListener('DOMContentLoaded', function() {
  if (window.PlanValidator) {
    window.PlanValidator.init();
  }
});
