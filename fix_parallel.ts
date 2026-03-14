import { readFileSync, writeFileSync } from 'fs';

const pathStr = './src/pages/ProspectFinder.tsx';
let code = readFileSync(pathStr, 'utf8');

// 1. Prepare logic for aggregated progress
const stateInit = `  const [channelProgress, setChannelProgress] = useState<Record<string, number>>({});`;
if (!code.includes('channelProgress')) {
    code = code.replace('const [scrapeProgress, setScrapeProgress] = useState', `${stateInit}\n  const [scrapeProgress, setScrapeProgress] = useState`);
}

// 2. Refactor loop to Promise.all
const startMarker = '// --- EXÉCUTION SÉQUENTIELLE PAR CANAL (Temps Réel) ---';
const endMarker = '// --- FINALISATION ---';
const startIndex = code.indexOf(startMarker);
const endIndex = code.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    const loopContent = `
      // Initialiser la progression de chaque canal à 0
      const initialProgress = {};
      filters.channels.forEach(c => initialProgress[c] = 0);
      setChannelProgress(initialProgress);

      const channelPromises = filters.channels.map(async (channel) => {
        if (searchAbortController.current?.signal.aborted) return;

        return new Promise<void>(async (resolveChannel) => {
          // Helper local pour mettre à jour la progression d'un canal spécifique
          const updateChannelPct = (pct: number, msg: string) => {
            setChannelProgress(prev => {
              const next = { ...prev, [channel]: pct };
              // Calcul de la moyenne globale
              const values = Object.values(next);
              const avg = Math.round(values.reduce((a, b) => a + b, 0) / filters.channels.length);
              setScrapeProgress({ percentage: avg, message: \`[\${channel.toUpperCase()}] \${msg}\` });
              return next;
            });
          };

          if (channel === "govcon") {
            try {
              addLog("🔎 Recherche d'opportunités fédérales (GovCon)...", "system");
              const queryToHash = \`govcon|\${searchQueryString}|\${locationQuery}\`;
              const queryHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(queryToHash.toLowerCase()))
                .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));

              let govData = null;
              const { data: cachedSearch } = await sb.from('cached_searches').select('id').eq('query_hash', queryHash).single();
              if (cachedSearch) {
                const { data: cachedResults } = await sb.from('cached_results').select('data').eq('search_id', cachedSearch.id).single();
                if (cachedResults) { govData = cachedResults.data; addLog("⚡ GovCon (Cache).", "success"); }
              }

              if (!govData) {
                const n8nRes = await triggerN8nWorkflow("GOVCON", commonPayload);
                if (n8nRes.success && n8nRes.data?.data) govData = n8nRes.data.data;
              }

              if (govData && govData.length > 0) {
                const mappedResults = govData.map((item: any) => ({
                  id: item.notice_id, name: item.contact_name || item.agency,
                  initials: (item.agency?.[0] || "G").toUpperCase(),
                  position: item.title, company: item.agency, source: "govcon",
                  score: calculateInitialScore(item), email: item.contact_email,
                  website: item.sam_url, city: item.performance_city_name,
                  tags: [item.naics].flat(), contractDetails: item
                }));
                
                setPendingProspects(prev => [...prev, ...mappedResults]);
                setSelectedProspectIds(prev => {
                  const newSet = new Set(prev);
                  mappedResults.forEach((p: any) => newSet.add(p.id));
                  return newSet;
                });
                addLog(\`🏛️ \${govData.length} opportunités GovCon identifiées.\`, "success");
              }
              updateChannelPct(100, "Scan GovCon terminé");
            } catch (err) { addLog("❌ GovCon Error.", "error"); }
            resolveChannel();
          } 
          else if (channel === "google_maps") {
            addLog("🛰️ Scan Google Maps en cours...", "system");
            const url = \`/api/scrape/gmaps?q=\${encodeURIComponent(filters.keyword)}&l=\${encodeURIComponent(filters.city || filters.country || 'Antananarivo')}&limit=\${filters.channelLimits.google_maps}&userId=\${user?.id || ""}&type=\${filters.type}\`;
            const es = new EventSource(url);
            activeEventSources.current.push(es);
            es.onmessage = (e) => {
              let d;
              try { d = JSON.parse(e.data); } catch(err) { addLog(\`⚙️ \${e.data}\`, 'process'); return; }
              if (d.message && d.percentage === undefined && !d.error && !d.result) { addLog(\`⚙️ \${d.message}\`, 'process'); }
              if (d.percentage !== undefined) updateChannelPct(d.percentage, d.message || "");
              if (d.error && typeof d.error === 'string') addLog(\`❌ Erreur: \${d.error}\`, 'error');
              if (d.result) {
                const mapped = {
                  id: \`gmap_\${Math.random().toString(36).substr(2, 9)}\`,
                  name: d.result.name, initials: (d.result.name?.[0] || "G").toUpperCase(),
                  position: d.result.category, company: d.result.name, source: "google_maps",
                  score: calculateInitialScore(d.result), email: d.result.phone ? "Extraction..." : "",
                  phone: d.result.phone || "", website: d.result.website || "",
                  city: filters.city || "", tags: [d.result.category].filter(Boolean),
                  contractDetails: d.result
                };
                setPendingProspects(prev => {
                   if (prev.some(p => p.name === mapped.name && p.company === mapped.company)) return prev;
                   return [...prev, mapped];
                });
                setSelectedProspectIds(prev => new Set(prev).add(mapped.id));
                addLog(\`📍 Maps: \${mapped.name}\`, 'success');
              }
              if (d.percentage === 100 || d.error) { es.close(); resolveChannel(); }
            };
            es.onerror = () => { es.close(); resolveChannel(); };
          }
          else if (channel === "linkedin") {
            addLog("🛡️ Protocoles LinkedIn...", "system");
            const url = \`/api/scrape/linkedin?email=\${encodeURIComponent(linkedinCredentials.email)}&password=\${encodeURIComponent(linkedinCredentials.password)}&q=\${encodeURIComponent(searchQueryString)}&maxProfiles=\${filters.channelLimits.linkedin}&type=\${filters.type}\`;
            const es = new EventSource(url);
            activeEventSources.current.push(es);
            es.onmessage = (e) => {
              let d;
              try { d = JSON.parse(e.data); } catch(err) { addLog(\`⚙️ \${e.data}\`, 'process'); return; }
              if (d.message && d.percentage === undefined && !d.error && !d.result) { addLog(\`⚙️ \${d.message}\`, 'process'); }
              if (d.percentage !== undefined) updateChannelPct(d.percentage, d.message || "");
              if (d.error && typeof d.error === 'string') addLog(\`❌ Erreur: \${d.error}\`, 'error');
              if (d.result) {
                const r = d.result;
                setPendingProspects(prev => {
                  if (prev.some(p => p.socialLinks?.linkedin && p.socialLinks.linkedin === r.socialLinks?.linkedin)) return prev;
                  return [...prev, r];
                });
                setSelectedProspectIds(prev => new Set(prev).add(r.id));
                addLog(\`👤 LinkedIn: \${r.name}\`, 'success');
              }
              if (d.percentage === 100 || d.error) { es.close(); resolveChannel(); }
            };
            es.onerror = () => { es.close(); resolveChannel(); };
          }
          else if (channel === "pages_jaunes") {
             addLog("📖 Pages Jaunes France...", "system");
             const url = \`/api/scrape/pj?q=\${encodeURIComponent(filters.keyword)}&l=\${encodeURIComponent(filters.city)}&limit=\${filters.channelLimits.pages_jaunes}&userId=\${user?.id || ""}&type=\${filters.type}\`;
             const es = new EventSource(url);
             activeEventSources.current.push(es);
             es.onmessage = (e) => {
               let d;
               try { d = JSON.parse(e.data); } catch(err) { addLog(\`⚙️ \${e.data}\`, 'process'); return; }
               if (d.message && d.percentage === undefined && !d.error && !d.result) { addLog(\`⚙️ \${d.message}\`, 'process'); }
               if (d.percentage !== undefined) updateChannelPct(d.percentage, d.message || "");
               if (d.error && typeof d.error === 'string') addLog(\`❌ Erreur: \${d.error}\`, 'error');
               if (d.result) {
                 setPendingProspects(prev => {
                   if (prev.some(p => p.name === d.result.name && p.company === d.result.company)) return prev;
                   return [...prev, d.result];
                 });
                 setSelectedProspectIds(prev => new Set(prev).add(d.result.id));
                 addLog(\`�� PJ: \${d.result.name}\`, 'success');
               }
               if (d.percentage === 100 || d.error) { es.close(); resolveChannel(); }
             };
             es.onerror = () => { es.close(); resolveChannel(); };
          }
          else if (channel === "pappers") {
            addLog("📥 Pappers.fr...", "system");
            const url = \`/api/scrape/pappers?q=\${encodeURIComponent(filters.keyword)}&l=\${encodeURIComponent(filters.city || filters.country || '')}&limit=\${filters.channelLimits.pappers}&userId=\${user?.id || ""}&type=\${filters.type}\`;
            const es = new EventSource(url);
            activeEventSources.current.push(es);
            es.onmessage = (e) => {
              let d;
              try { d = JSON.parse(e.data); } catch(err) { addLog(\`⚙️ \${e.data}\`, 'process'); return; }
              if (d.message && d.percentage === undefined && !d.error && !d.result) { addLog(\`⚙️ \${d.message}\`, 'process'); }
              if (d.percentage !== undefined) updateChannelPct(d.percentage, d.message || "");
              if (d.error && typeof d.error === 'string') addLog(\`❌ Erreur: \${d.error}\`, 'error');
              if (d.result) {
                setPendingProspects(prev => {
                  if (prev.some(p => p.contractDetails?.siren === d.result.contractDetails?.siren)) return prev;
                  return [...prev, d.result];
                });
                setSelectedProspectIds(prev => new Set(prev).add(d.result.id));
                addLog(\`🏢 Pappers: \${d.result.name}\`, 'success');
              }
              if (d.percentage === 100 || d.error) { es.close(); resolveChannel(); }
            };
            es.onerror = () => { es.close(); resolveChannel(); };
          }
          else if (channel === "societe") {
            addLog("💼 Societe.com...", "system");
            const url = \`/api/scrape/societe?q=\${encodeURIComponent(filters.keyword)}&limit=\${filters.channelLimits.societe}&type=\${filters.type}\`;
            const es = new EventSource(url);
            activeEventSources.current.push(es);
            es.onmessage = (e) => {
              let d;
              try { d = JSON.parse(e.data); } catch(err) { addLog(\`⚙️ \${e.data}\`, 'process'); return; }
              if (d.message && d.percentage === undefined && !d.error && !d.result) { addLog(\`⚙️ \${d.message}\`, 'process'); }
              if (d.percentage !== undefined) updateChannelPct(d.percentage, d.message || "");
              if (d.error && typeof d.error === 'string') addLog(\`❌ Erreur: \${d.error}\`, 'error');
              if (d.result) {
                setPendingProspects(prev => {
                  if (prev.some(p => p.contractDetails?.siren === d.result.contractDetails?.siren)) return prev;
                  return [...prev, d.result];
                });
                setSelectedProspectIds(prev => new Set(prev).add(d.result.id));
                addLog(\`�� Societe: \${d.result.name}\`, 'success');
              }
              if (d.percentage === 100 || d.error) { es.close(); resolveChannel(); }
            };
            es.onerror = () => { es.close(); resolveChannel(); };
          }
          else if (channel === "infogreffe") {
            addLog("📜 Infogreffe...", "system");
            const url = \`/api/scrape/infogreffe?q=\${encodeURIComponent(filters.keyword)}&limit=\${filters.channelLimits.infogreffe}&type=\${filters.type}\`;
            const es = new EventSource(url);
            activeEventSources.current.push(es);
            es.onmessage = (e) => {
              let d;
              try { d = JSON.parse(e.data); } catch(err) { addLog(\`⚙️ \${e.data}\`, 'process'); return; }
              if (d.message && d.percentage === undefined && !d.error && !d.result) { addLog(\`⚙️ \${d.message}\`, 'process'); }
              if (d.percentage !== undefined) updateChannelPct(d.percentage, d.message || "");
              if (d.error && typeof d.error === 'string') addLog(\`❌ Erreur: \${d.error}\`, 'error');
              if (d.result) {
                setPendingProspects(prev => {
                  if (prev.some(p => p.contractDetails?.siren === d.result.contractDetails?.siren)) return prev;
                  return [...prev, d.result];
                });
                setSelectedProspectIds(prev => new Set(prev).add(d.result.id));
                addLog(\`📜 Infogreffe: \${d.result.name}\`, 'success');
              }
              if (d.percentage === 100 || d.error) { es.close(); resolveChannel(); }
            };
            es.onerror = () => { es.close(); resolveChannel(); };
          }
          else if (channel === "facebook") {
            if (!facebookCredentials.email || !facebookCredentials.password) {
              addLog("⚠️ Credentials Facebook manquants — canal ignoré.", "warn");
              resolveChannel();
            } else {
              addLog("📘 Scan Facebook en cours...", "system");
              const url = \`/api/scrape/facebook?email=\${encodeURIComponent(facebookCredentials.email)}&password=\${encodeURIComponent(facebookCredentials.password)}&q=\${encodeURIComponent(searchQueryString)}&limit=\${filters.channelLimits.facebook}&type=\${filters.type}\`;
              const es = new EventSource(url);
              activeEventSources.current.push(es);
              es.onmessage = (e) => {
                let d;
                try { d = JSON.parse(e.data); } catch(err) { addLog(\`⚙️ \${e.data}\`, 'process'); return; }
                if (d.message && d.percentage === undefined && !d.error && !d.result) { addLog(\`⚙️ \${d.message}\`, 'process'); }
                if (d.percentage !== undefined) updateChannelPct(d.percentage, d.message || "");
                if (d.error && typeof d.error === 'string') addLog(\`❌ Erreur: \${d.error}\`, 'error');
                if (d.result) {
                  const r = d.result;
                  setPendingProspects(prev => {
                    if (prev.some(p => p.socialLinks?.facebook && p.socialLinks.facebook === r.socialLinks?.facebook)) return prev;
                    return [...prev, r];
                  });
                  setSelectedProspectIds(prev => new Set(prev).add(r.id));
                  addLog(\`📘 Facebook: \${r.name}\`, 'success');
                }
                if (d.percentage === 100 || d.error) { es.close(); resolveChannel(); }
              };
              es.onerror = () => { es.close(); resolveChannel(); };
            }
          }
        });
      });

      await Promise.all(channelPromises);
`;
    code = code.substring(0, startIndex) + loopContent + code.substring(endIndex);
}

fs.writeFileSync(pathStr, code);
console.log('Fixed ProspectFinder.tsx for parallel execution and aggregated progress');
