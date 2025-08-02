# Duplicate URL Solution for La Villa Paris

## Problem Summary
Google Search Console shows "Duplicate without user-selected canonical" for URLs like:
- `https://la-villa-paris.com/index.html`
- `https://la-villa-paris.com/?sa=X&ved=...`
- `https://www.la-villa-paris.com/?sa=X&ved=...`

## Root Cause
Multiple versions of the same page exist:
1. **Protocol variations**: HTTP vs HTTPS
2. **Domain variations**: www vs non-www
3. **Tracking parameters**: ?gclid=, ?sa=, ?ved=, etc.
4. **Old language URLs**: index_en.html, index_de.html

## Solution Implemented

### 1. Canonical URL System
- **Server-side**: Jekyll generates proper canonical URLs
- **All pages** now point to `https://la-villa-paris.com/` (canonical)

### 2. Redirect Rules (_redirects file)
```
# Force canonical domain
http://www.la-villa-paris.com/* → https://la-villa-paris.com/:splat 301
https://www.la-villa-paris.com/* → https://la-villa-paris.com/:splat 301
http://la-villa-paris.com/* → https://la-villa-paris.com/:splat 301

# Remove tracking parameters (serve page directly)
/*?gclid=* → /:splat 200
/*?sa=* → /:splat 200
/*?ved=* → /:splat 200
```

### 3. Hreflang Tags
Added for international SEO:
```html
<link rel="alternate" hreflang="fr" href="https://la-villa-paris.com/" />
<link rel="alternate" hreflang="en" href="https://la-villa-paris.com/" />
<link rel="alternate" hreflang="x-default" href="https://la-villa-paris.com/" />
```

## Expected Results

### Immediate (After Deployment)
- ✅ All URLs redirect to canonical version
- ✅ Tracking parameters stripped
- ✅ Proper canonical tags on all pages

### 1-2 Weeks
- ✅ Google starts recognizing canonical URLs
- ✅ Reduced duplicate content warnings

### 1-2 Months
- ✅ Duplicate URLs consolidated
- ✅ Improved search rankings
- ✅ Clean Search Console reports

## Monitoring Steps

### 1. Test Redirects Manually
Visit these URLs to verify they redirect properly:
```
http://www.la-villa-paris.com/ → https://la-villa-paris.com/
https://www.la-villa-paris.com/?sa=X&ved=... → https://la-villa-paris.com/
https://la-villa-paris.com/index.html → https://la-villa-paris.com/
```

### 2. Check Canonical Tags
View page source on any page, look for:
```html
<link rel="canonical" href="https://la-villa-paris.com/" />
```

### 3. Monitor Google Search Console
- Go to "Coverage" report
- Look for "Duplicate without user-selected canonical" status
- Should decrease over time

### 4. Use Google's URL Inspection Tool
- Test individual URLs
- Verify canonical URLs are correct
- Check for redirect chains

## Files Modified

1. **`_redirects`** - Netlify redirect rules (simplified)
2. **`netlify.toml`** - Netlify configuration (simplified)
3. **`_includes/head.html`** - Canonical and hreflang tags
4. **`sitemap.xml`** - Updated with canonical URLs

## Troubleshooting

### If Duplicates Persist
1. **Check redirect chains**: Use Google's URL Inspection Tool
2. **Verify canonical tags**: View page source
3. **Test manually**: Visit problematic URLs
4. **Wait for Google**: Can take 1-2 months for full resolution

### Common Issues
- **Old cached versions**: Clear browser cache
- **CDN caching**: May need to purge CDN cache
- **Google's crawl delay**: Takes time to re-crawl pages

## Success Metrics

- [ ] No "Duplicate without user-selected canonical" in Search Console
- [ ] All URLs redirect to canonical version
- [ ] Canonical tags present on all pages
- [ ] Improved search rankings
- [ ] Clean URL structure in analytics

## Next Steps

1. **Deploy changes** to Netlify
2. **Test redirects** manually
3. **Monitor Search Console** weekly
4. **Submit sitemap** to Google Search Console
5. **Request re-indexing** of canonical URLs 