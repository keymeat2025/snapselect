/**
 * Performance optimization utilities  performance-manager.js
 */
const PerformanceManager = {
  init() {
    console.log('Performance manager initialized');
    this.initLazyLoading();
  },
  
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
  
  cacheData(key, data, ttl = 300000) {
    try {
      const cacheItem = {
        data: data,
        timestamp: Date.now(),
        ttl: ttl
      };
      localStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (e) {
      console.warn('Cache error:', e);
    }
  },
  
  getCachedData(key) {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      
      const item = JSON.parse(cached);
      if (Date.now() - item.timestamp > item.ttl) {
        localStorage.removeItem(key);
        return null;
      }
      
      return item.data;
    } catch (e) {
      console.warn('Cache retrieval error:', e);
      return null;
    }
  }
};

// Initialize on document ready
document.addEventListener('DOMContentLoaded', () => {
  PerformanceManager.init();
});
