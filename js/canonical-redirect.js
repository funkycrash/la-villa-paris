// Canonical URL redirect script
// Handles edge cases and ensures proper URL canonicalization

(function() {
    'use strict';
    
    // Get current URL
    var currentUrl = window.location.href;
    var canonicalDomain = 'https://la-villa-paris.com';
    
    // Check if we need to redirect
    var shouldRedirect = false;
    var newUrl = currentUrl;
    
    // Force HTTPS
    if (currentUrl.indexOf('http://') === 0) {
        newUrl = currentUrl.replace('http://', 'https://');
        shouldRedirect = true;
    }
    
    // Force non-www
    if (newUrl.indexOf('www.') !== -1) {
        newUrl = newUrl.replace('www.', '');
        shouldRedirect = true;
    }
    
    // Remove tracking parameters
    var urlObj = new URL(newUrl);
    var paramsToRemove = ['gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'sa', 'ved', 'yandex-source'];
    
    paramsToRemove.forEach(function(param) {
        if (urlObj.searchParams.has(param)) {
            urlObj.searchParams.delete(param);
            shouldRedirect = true;
        }
    });
    
    // Redirect old language URLs
    if (urlObj.pathname === '/index_en.html' || 
        urlObj.pathname === '/index_de.html' || 
        urlObj.pathname === '/index_fr.html' ||
        urlObj.pathname === '/index.html') {
        urlObj.pathname = '/';
        shouldRedirect = true;
    }
    
    // Redirect old photo gallery
    if (urlObj.pathname.indexOf('/Photo_Gallery/') === 0) {
        urlObj.pathname = '/photos';
        shouldRedirect = true;
    }
    
    // Perform redirect if needed
    if (shouldRedirect && newUrl !== currentUrl) {
        // Use 301 redirect for SEO
        window.location.replace(urlObj.toString());
    }
    
    // Add canonical link if not present
    if (!document.querySelector('link[rel="canonical"]')) {
        var canonicalLink = document.createElement('link');
        canonicalLink.rel = 'canonical';
        canonicalLink.href = urlObj.toString();
        document.head.appendChild(canonicalLink);
    }
    
})(); 