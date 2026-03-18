// /src/utils/scoring.ts

export interface ProspectScoringContext {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  website_url?: string;
  websiteUrl?: string;
  social_links?: { linkedin?: string };
  socialLinks?: { linkedin?: string };
  source?: string;
}

/**
 * Calculates a prospect score based on available contact information.
 * Max score is 100%.
 * 
 * Logic:
 * - Base (Name or Company): 20%
 * - Email: 40% (Most valuable)
 * - Phone: 20%
 * - Website: 10%
 * - LinkedIn: 10%
 */
export function calculateProspectScore(prospect: ProspectScoringContext | any): number {
  if (!prospect) return 0;
  
  let score = 0;

  // Base Info (20%)
  if (prospect.name || prospect.company || prospect.initials) {
    score += 20;
  }

  // Email (40%)
  const hasEmail = prospect.email && prospect.email.trim() !== '' && prospect.email.trim().toLowerCase() !== "pas d'email";
  if (hasEmail) score += 40;

  // Phone (20%)
  const hasPhone = prospect.phone && prospect.phone.trim() !== '';
  if (hasPhone) score += 20;

  // Website (10%)
  const hasWebsite = (prospect.website_url && prospect.website_url.trim() !== '') || 
                     (prospect.websiteUrl && prospect.websiteUrl.trim() !== '');
  if (hasWebsite) score += 10;

  // LinkedIn (10%)
  const hasLinkedin = (prospect.social_links && prospect.social_links.linkedin) ||
                      (prospect.socialLinks && prospect.socialLinks.linkedin) ||
                      (typeof prospect.linkedin_url === 'string' && prospect.linkedin_url.trim() !== '') ||
                      (prospect.source && prospect.source.toLowerCase().includes('linkedin'));
  
  if (hasLinkedin) score += 10;

  // Ensure score doesn't exceed 100% (just in case)
  return Math.min(score, 100);
}
