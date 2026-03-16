/**
 * proxycurl_enricher.cjs
 *
 * Enrichit les prospects LinkedIn avec leurs données complètes
 * via l'API ProxyCurl — zéro scraping direct, zéro risque de ban.
 *
 * Appelé par le backend quand l'utilisateur clique "✨ Enrichir les données"
 *
 * Usage :
 *   node proxycurl_enricher.cjs '[{"profileUrl":"https://linkedin.com/in/...","id":"li_123"}]'
 *
 * Env requis :
 *   PROXYCURL_API_KEY  (https://nubela.co/proxycurl)
 */

'use strict';

const https = require('https');

const PROXYCURL_API_KEY      = process.env.PROXYCURL_API_KEY || '';
const DELAY_BETWEEN_CALLS_MS = 1200; // respecter les rate limits ProxyCurl

// ─── Helpers SSE ──────────────────────────────────────────────────────────────

function emitLog(msg, pct) {
  process.stdout.write(`PROGRESS:${JSON.stringify({ percentage: pct, message: msg })}\n`);
}
function emitResult(payload) {
  process.stdout.write(`RESULT:${JSON.stringify(payload)}\n`);
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Appel API ProxyCurl ──────────────────────────────────────────────────────

function fetchProxyCurl(endpoint, params = {}) {
  return new Promise((resolve) => {
    const query = new URLSearchParams(params).toString();
    const options = {
      hostname: 'nubela.co',
      path:     `/proxycurl/api/${endpoint}?${query}`,
      method:   'GET',
      headers:  { Authorization: `Bearer ${PROXYCURL_API_KEY}` },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); } catch { resolve(null); }
        } else if (res.statusCode === 429) {
          emitLog('⚠️  Rate limit ProxyCurl — pause 10s...', undefined);
          setTimeout(() => resolve(null), 10000);
        } else {
          emitLog(`⚠️  ProxyCurl HTTP ${res.statusCode}`, undefined);
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

// ─── Appels métier ────────────────────────────────────────────────────────────

const enrichPerson = (url) => fetchProxyCurl('v2/linkedin', {
  url,
  personal_email:          'include',
  personal_contact_number: 'include',
  extra:                   'include',
  skills:                  'include',
  use_cache:               'if-present',
  fallback_to_cache:       'on-error',
});

const enrichCompany = (url) => fetchProxyCurl('linkedin/company', {
  url,
  extra:     'include',
  use_cache: 'if-present',
});

const findWorkEmail = (firstName, lastName, domain) =>
  fetchProxyCurl('linkedin/profile/email', {
    first_name: firstName, last_name: lastName, company_domain: domain,
  }).then(r => r?.email || null);

// ─── Mapping ProxyCurl → Prospecta ───────────────────────────────────────────

function mapPerson(original, d) {
  if (!d) return null;
  const fullName  = `${d.first_name || ''} ${d.last_name || ''}`.trim() || original.name;
  const currentExp = d.experiences?.find(e => !e.ends_at) || d.experiences?.[0] || {};
  return {
    ...original,
    name:     fullName,
    initials: fullName[0]?.toUpperCase() || 'L',
    position: d.headline            || currentExp.title  || original.position,
    company:  currentExp.company    || original.company,
    email:    d.personal_emails?.[0] || d.personal_email || original.email || '',
    phone:    d.personal_numbers?.[0] || original.phone  || '',
    website:  d.extra?.website      || original.website  || '',
    photo:    d.profile_pic_url     || original.photo    || '',
    address:  d.city ? `${d.city}${d.country ? ', ' + d.country : ''}` : original.address,
    tags:     d.skills?.slice(0, 5) || [],
    socialLinks: {
      linkedin: original.profileUrl || '',
      twitter:  d.extra?.twitter_profile_id ? `https://twitter.com/${d.extra.twitter_profile_id}` : '',
    },
    contractDetails: {
      about:          d.summary       || '',
      headline:       d.headline      || '',
      location:       d.city          || '',
      followers:      d.follower_count?.toString() || '',
      experiences:    (d.experiences || []).map(e => ({
        role:     e.title    || '',
        company:  e.company  || '',
        duration: e.starts_at ? `${e.starts_at.year} — ${e.ends_at?.year || 'présent'}` : '',
        location: e.location || '',
      })),
      education: (d.education || []).map(e => ({
        school: e.school      || '',
        degree: e.degree_name || '',
        years:  e.starts_at?.year ? `${e.starts_at.year} — ${e.ends_at?.year || '?'}` : '',
      })),
      certifications: (d.certifications || []).map(c => ({
        name: c.name || '', issuer: c.authority || '', date: c.starts_at?.year?.toString() || '',
      })),
      skills: d.skills || [],
      photo:  d.profile_pic_url || original.photo || '',
    },
    enrichmentStatus: 'done',
    enrichmentSource: 'proxycurl',
  };
}

function mapCompany(original, d) {
  if (!d) return null;
  const name = d.name || original.name;
  return {
    ...original,
    name,
    initials: name[0]?.toUpperCase() || 'C',
    position: d.tagline             || '',
    company:  name,
    email:    d.extra?.email        || original.email   || '',
    phone:    d.extra?.phone        || original.phone   || '',
    website:  d.extra?.website      || original.website || '',
    photo:    d.profile_pic_url     || original.photo   || '',
    address:  d.hq ? `${d.hq.city || ''}, ${d.hq.country || ''}`.replace(/^, |, $/, '') : original.address,
    tags:     d.specialities?.slice(0, 5) || [],
    socialLinks: {
      linkedin: original.profileUrl || `https://linkedin.com/company/${d.universal_name_id}`,
      twitter:  d.extra?.twitter    || '',
    },
    contractDetails: {
      about:       d.description              || '',
      headline:    d.tagline                  || '',
      location:    d.hq?.city                 || '',
      followers:   d.follower_count?.toString() || '',
      industry:    d.industry                 || '',
      companySize: d.company_size             || '',
      foundedYear: d.founded_year?.toString() || '',
      specialties: d.specialities             || [],
      photo:       d.profile_pic_url          || original.photo || '',
    },
    enrichmentStatus: 'done',
    enrichmentSource: 'proxycurl',
  };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!PROXYCURL_API_KEY) {
    emitLog("ERROR: PROXYCURL_API_KEY manquante. Ajoute-la dans ton fichier .env.", undefined);
    process.exit(1);
  }

  let prospects = [];
  try { prospects = JSON.parse(process.argv[2] || '[]'); }
  catch { emitLog('ERROR: JSON invalide en argument.', undefined); process.exit(1); }

  if (!prospects.length) { emitLog('⚠️  Aucun prospect à enrichir.', 100); process.exit(0); }

  emitLog(`🚀 ProxyCurl — enrichissement de ${prospects.length} prospect(s)`, 0);

  for (let i = 0; i < prospects.length; i++) {
    const p   = prospects[i];
    const pct = Math.round((i / prospects.length) * 95);

    if (!p.profileUrl) {
      emitLog(`⚠️  [${i+1}/${prospects.length}] ${p.name} — URL manquante, ignoré`, pct);
      continue;
    }

    emitLog(`🔍 [${i+1}/${prospects.length}] ${p.name}...`, pct);

    try {
      let enriched = null;

      if (p.source === 'linkedin_company') {
        enriched = mapCompany(p, await enrichCompany(p.profileUrl));
      } else {
        const data = await enrichPerson(p.profileUrl);
        enriched = mapPerson(p, data);

        // Fallback email pro si toujours vide
        if (enriched && !enriched.email) {
          const parts  = enriched.name.split(' ');
          const domain = enriched.website?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || '';
          if (parts.length >= 2 && domain) {
            const email = await findWorkEmail(parts[0], parts.slice(1).join(' '), domain);
            if (email) { enriched.email = email; emitLog(`   📧 Email trouvé : ${email}`, undefined); }
          }
        }
      }

      if (enriched) {
        emitResult(enriched);
        emitLog(`   ✅ email:${enriched.email ? '✓' : '✗'} tél:${enriched.phone ? '✓' : '✗'} site:${enriched.website ? '✓' : '✗'}`, pct);
      } else {
        emitResult({ ...p, enrichmentStatus: 'not_found', enrichmentSource: 'proxycurl' });
        emitLog(`   ⚠️  Aucune donnée trouvée`, pct);
      }
    } catch (err) {
      emitLog(`   ❌ Erreur : ${err.message}`, pct);
      emitResult({ ...p, enrichmentStatus: 'error', enrichmentSource: 'proxycurl' });
    }

    if (i < prospects.length - 1) await sleep(DELAY_BETWEEN_CALLS_MS);
  }

  emitLog('🏁 Enrichissement ProxyCurl terminé', 100);
}

main().catch(err => { emitLog(`ERROR: ${err.message}`, undefined); process.exit(1); });
