const axios = require('axios');
const cheerio = require('cheerio');
const pLimit = require('p-limit');
const { URL } = require('url');

/**
 * Universal Crawler (Cheerio-based)
 * High performance contact extraction from websites.
 */
class CheerioCrawler {
  constructor({ maxPages = 5, concurrency = 3, timeout = 10000 }) {
    this.maxPages = maxPages;
    this.limit = pLimit(concurrency);
    this.timeout = timeout;
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  }

  isValidEmail(email) {
    if (!email) return false;
    const IGNORED = ["google", "sentry", "example", "test", "noreply", "no-reply", "postmaster", "webmaster"];
    return !IGNORED.some(ig => email.toLowerCase().includes(ig));
  }

  cleanPhone(raw) {
    return raw.replace(/[^\d+\s\-().]/g, "").trim();
  }

  async scrape(baseUrl) {
    if (!baseUrl || !baseUrl.startsWith('http')) return null;

    const domain = new URL(baseUrl).hostname;
    const visited = new Set();
    const queue = [baseUrl];
    const results = {
      emails: new Set(),
      phones: new Set(),
      socials: new Map(),
      textSnippet: "",
      services: new Set(),
      pagesScraped: 0
    };

    while (queue.length > 0 && visited.size < this.maxPages) {
      const url = queue.shift();
      if (visited.has(url)) continue;
      visited.add(url);

      try {
        const response = await axios.get(url, {
          timeout: this.timeout,
          headers: { 'User-Agent': this.userAgent }
        });

        if (!response.headers['content-type']?.includes('text/html')) continue;
        results.pagesScraped++;

        const $ = cheerio.load(response.data);
        $('script, style, noscript, iframe').remove();

        const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
        if (results.pagesScraped === 1) {
          results.textSnippet = bodyText.substring(0, 500);
        }

        // --- Emails ---
        // mailto
        $('a[href^="mailto:"]').each((_, el) => {
          const email = $(el).attr('href').replace('mailto:', '').split('?')[0].trim();
          if (this.isValidEmail(email)) results.emails.add(email.toLowerCase());
        });
        // regex
        const emailsFound = bodyText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
        emailsFound.forEach(e => { if (this.isValidEmail(e)) results.emails.add(e.toLowerCase()); });

        // --- Phones ---
        // tel
        $('a[href^="tel:"]').each((_, el) => {
          const p = this.cleanPhone($(el).attr('href').replace('tel:', ''));
          if (p.length > 7) results.phones.add(p);
        });
        // regex (generic)
        const phonesFound = bodyText.match(/(?:\+?\d[\d\s\-().]{7,18}\d)/g) || [];
        phonesFound.forEach(p => {
          const cleaned = this.cleanPhone(p);
          if (cleaned.length >= 8 && cleaned.length <= 15) results.phones.add(cleaned);
        });

        // --- Socials ---
        const socialDomains = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'youtube.com', 'wa.me'];
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          try {
            const linkUrl = new URL(href, url);
            const host = linkUrl.hostname.toLowerCase();
            const platform = socialDomains.find(d => host.includes(d));
            if (platform) {
              const cleanPlatform = platform.split('.')[0];
              if (!results.socials.has(cleanPlatform)) {
                results.socials.set(cleanPlatform, linkUrl.origin + linkUrl.pathname);
              }
            } else if (host === domain && visited.size < this.maxPages) {
              // Internal link
              const cleanLink = linkUrl.origin + linkUrl.pathname;
              if (!visited.has(cleanLink) && !queue.includes(cleanLink)) {
                // Prioritize contact/about pages
                if (/contact|about|propos|mentions|legal/i.test(cleanLink)) {
                  queue.unshift(cleanLink);
                } else {
                  queue.push(cleanLink);
                }
              }
            }
          } catch (e) {}
        });

        // --- Services/Keywords (Basic) ---
        const serviceKws = ['hotel', 'restaurant', 'spa', 'piscine', 'pool', 'wifi', 'parking', 'climatisation', 'ac', 'navette', 'tour'];
        serviceKws.forEach(kw => {
          if (new RegExp(`\\b${kw}\\b`, 'i').test(bodyText)) results.services.add(kw);
        });

      } catch (err) {
        // console.error(`Error crawling ${url}: ${err.message}`);
      }
    }

    return {
      emails: [...results.emails],
      phones: [...results.phones],
      social_links: Object.fromEntries(results.socials),
      services: [...results.services],
      summary: results.textSnippet,
      pagesTotal: results.pagesScraped
    };
  }
}

module.exports = CheerioCrawler;
