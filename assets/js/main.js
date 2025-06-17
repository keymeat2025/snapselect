/**
 * SnapSelect Main JavaScript
 * Controls mobile menu toggle and other interactive elements
 */

document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    // Add to main.js
    const PerformanceManager = {
      initLazyLoading() {
        const images = document.querySelectorAll('img[data-src]');
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
      },
      
      cacheData(key, data, ttl = 300000) {
        const cacheItem = {
          data: data,
          timestamp: Date.now(),
          ttl: ttl
        };
        localStorage.setItem(key, JSON.stringify(cacheItem));
      },
      
      getCachedData(key) {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        
        const item = JSON.parse(cached);
        if (Date.now() - item.timestamp > item.ttl) {
          localStorage.removeItem(key);
          return null;
        }
        
        return item.data;
      }
    };
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', function() {
            navLinks.classList.toggle('active');
        });
    }
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        if (navLinks && navLinks.classList.contains('active') && !navLinks.contains(event.target) && !hamburger.contains(event.target)) {
            navLinks.classList.remove('active');
        }
    });
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80, // Adjust for header height
                    behavior: 'smooth'
                });
                
                // Close mobile menu after clicking
                if (navLinks && navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                }
            }
        });
    });


    // SnapSelect Hero Slides Functionality
    let heroCurrentSlide = 0;
    const heroTotalSlides = 3;
    
    function heroUpdateSlidePosition() {
        const wrapper = document.getElementById('heroSlidesWrapper');
        const dots = document.querySelectorAll('.hero-nav-dot');
        
        if (wrapper) {
            wrapper.style.transform = `translateX(-${heroCurrentSlide * 33.333}%)`;
        }
        
        // Update dots
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === heroCurrentSlide);
        });
    }
    
    function heroSlideMoveNext() {
        heroCurrentSlide = (heroCurrentSlide + 1) % heroTotalSlides;
        heroUpdateSlidePosition();
    }
    
    function heroSlideMovePrev() {
        heroCurrentSlide = (heroCurrentSlide - 1 + heroTotalSlides) % heroTotalSlides;
        heroUpdateSlidePosition();
    }
    
    function heroSlideMoveTo(slideIndex) {
        heroCurrentSlide = slideIndex;
        heroUpdateSlidePosition();
    }
    
    // Initialize hero slides when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        // Auto-advance functionality
        let heroAutoSlide = setInterval(() => {
            heroSlideMoveNext();
        }, 5000);
        
        // Pause on hover
        const container = document.getElementById('heroIntegratedSlides');
        if (container) {
            container.addEventListener('mouseenter', () => {
                clearInterval(heroAutoSlide);
            });
            
            container.addEventListener('mouseleave', () => {
                clearInterval(heroAutoSlide);
                heroAutoSlide = setInterval(() => {
                    heroSlideMoveNext();
                }, 5000);
            });
        }
        
        // Touch/swipe support for mobile
        let startX = 0;
        let endX = 0;
        
        if (container) {
            container.addEventListener('touchstart', (e) => {
                startX = e.touches[0].clientX;
            });
            
            container.addEventListener('touchend', (e) => {
                endX = e.changedTouches[0].clientX;
                const diff = startX - endX;
                
                if (Math.abs(diff) > 50) { // Minimum swipe distance
                    if (diff > 0) {
                        heroSlideMoveNext(); // Swipe left
                    } else {
                        heroSlideMovePrev(); // Swipe right
                    }
                }
            });
        }
    });
});
