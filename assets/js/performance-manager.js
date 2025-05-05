/**
 * performance-manager.js
 * Performance optimization utilities for SnapSelect
 */

const PerformanceManager = {
  init() {
    console.log('Performance manager initializing...');
    this.initLazyLoading();
    this.setupCacheCleaning();
    console.log('Performance manager initialized');
  },

  /**
   * Initialize lazy loading for images
   */
  initLazyLoading() {
    if ('IntersectionObserver' in window) {
      const images = document.querySelectorAll('img[data-src]');
      if (images.length === 0) return;
      
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        });
      });
      
      images.forEach(img => imageObserver.observe(img));
    } else {
      // Fallback for browsers without IntersectionObserver
      document.querySelectorAll('img[data-src]').forEach(img => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    }
  },

  /**
   * Setup periodic cache cleaning
   */
  setupCacheCleaning() {
    // Clean expired cache items once a day
    const lastCacheCleaning = localStorage.getItem('lastCacheCleaning');
    const now = Date.now();
    
    if (!lastCacheCleaning || (now - parseInt(lastCacheCleaning)) > 86400000) {
      this.cleanExpiredCache();
      localStorage.setItem('lastCacheCleaning', now.toString());
    }
  },

  /**
   * Clean expired cache items
   */
  cleanExpiredCache() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache_')) {
          try {
            const item = JSON.parse(localStorage.getItem(key));
            if (item && item.expires && item.expires < Date.now()) {
              localStorage.removeItem(key);
            }
          } catch (e) {
            // Invalid JSON, remove the item
            localStorage.removeItem(key);
          }
        }
      }
    } catch (e) {
      console.warn('Error cleaning cache:', e);
    }
  },

  /**
   * Cache data with expiration
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} ttl - Time to live in milliseconds (default: 5 minutes)
   */
  cacheData(key, data, ttl = 300000) {
    try {
      if (!key || data === undefined) return;
      
      // Add cache_ prefix to avoid conflicts
      const cacheKey = key.startsWith('cache_') ? key : `cache_${key}`;
      
      const cacheItem = {
        data: data,
        created: Date.now(),
        expires: Date.now() + ttl
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
    } catch (e) {
      console.warn('Error caching data:', e);
    }
  },

  /**
   * Get cached data
   * @param {string} key - Cache key
   * @returns {any} - Cached data or null
   */
  getCachedData(key) {
    try {
      if (!key) return null;
      
      // Add cache_ prefix to avoid conflicts
      const cacheKey = key.startsWith('cache_') ? key : `cache_${key}`;
      
      const cachedItem = localStorage.getItem(cacheKey);
      if (!cachedItem) return null;
      
      try {
        const item = JSON.parse(cachedItem);
        
        // Check if expired
        if (item.expires && item.expires < Date.now()) {
          localStorage.removeItem(cacheKey);
          return null;
        }
        
        return item.data;
      } catch (e) {
        // Invalid JSON
        localStorage.removeItem(cacheKey);
        return null;
      }
    } catch (e) {
      console.warn('Error getting cached data:', e);
      return null;
    }
  },

  /**
   * Clear all cached data
   */
  clearCache() {
    try {
      const keysToRemove = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cache_')) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keysToRemove.length} cache items`);
    } catch (e) {
      console.warn('Error clearing cache:', e);
    }
  },

  /**
   * Optimize images before upload
   * @param {File} file - Image file
   * @param {number} maxWidth - Maximum width
   * @param {number} maxHeight - Maximum height
   * @param {number} quality - Image quality (0-1)
   * @returns {Promise<Blob>} - Optimized image blob
   */
  async optimizeImage(file, maxWidth = 1920, maxHeight = 1080, quality = 0.8) {
    return new Promise((resolve, reject) => {
      // Check if file is an image
      if (!file || !file.type.startsWith('image/')) {
        return resolve(file);
      }
      
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          // Check if image needs resizing
          if (img.width <= maxWidth && img.height <= maxHeight && file.type === 'image/jpeg') {
            return resolve(file);
          }
          
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          // Calculate new dimensions
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
          
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to blob
          canvas.toBlob(function(blob) {
            resolve(blob);
          }, 'image/jpeg', quality);
        };
        
        img.onerror = function() {
          reject(new Error('Failed to load image for optimization'));
        };
        
        img.src = e.target.result;
      };
      
      reader.onerror = function() {
        reject(new Error('Failed to read file for optimization'));
      };
      
      reader.readAsDataURL(file);
    });
  },

  /**
   * Preload critical resources
   * @param {Array<string>} urls - URLs to preload
   */
  preloadResources(urls) {
    if (!urls || !Array.isArray(urls)) return;
    
    urls.forEach(url => {
      if (!url) return;
      
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;
      
      // Set appropriate as attribute based on file extension
      const ext = url.split('.').pop().toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
        link.as = 'image';
      } else if (['css'].includes(ext)) {
        link.as = 'style';
      } else if (['js'].includes(ext)) {
        link.as = 'script';
      } else if (['woff', 'woff2', 'ttf', 'otf'].includes(ext)) {
        link.as = 'font';
        link.crossOrigin = 'anonymous';
      }
      
      document.head.appendChild(link);
    });
  },

  /**
   * Measure operation timing
   * @param {string} operationName - Name of the operation
   * @returns {function} - Function to end timing
   */
  startTiming(operationName) {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      console.log(`${operationName} took ${duration.toFixed(2)}ms`);
      
      // Log slow operations (over 1 second)
      if (duration > 1000) {
        console.warn(`Slow operation detected: ${operationName} took ${(duration / 1000).toFixed(2)}s`);
        
        // Log to analytics if available
        if (window.logAnalyticsEvent) {
          window.logAnalyticsEvent('performance_issue', {
            operation: operationName,
            duration: duration,
            browser: navigator.userAgent
          });
        }
      }
      
      return duration;
    };
  }
};

// Initialize on document ready
document.addEventListener('DOMContentLoaded', () => {
  PerformanceManager.init();
  
  // Make available globally
  window.PerformanceManager = PerformanceManager;
});
