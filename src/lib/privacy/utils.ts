/**
 * Simple Privacy Utilities
 * 
 * Lightweight encryption and hashing for non-EU markets
 * Only encrypts truly sensitive data (payment info, etc.)
 */

// NOTE: Node.js 'crypto' module is not available in the browser.
// This file has been refactored to be browser-compatible.

const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || "";

if (!ENCRYPTION_KEY && import.meta.env.PROD) {
    console.warn('⚠️ CRITICAL: ENCRYPTION_KEY not set in production!');
}

/**
 * Encrypt sensitive text using Web Crypto API (Async)
 * NOT IMPLEMENTED FOR BROWSER YET - STUBBED
 */
export const encrypt = (text: string): string => {
    console.warn("encrypt() called but implementation relies on Node.js crypto. Returning empty string.");
    return "";
};

/**
 * Decrypt encrypted text
 * NOT IMPLEMENTED FOR BROWSER YET - STUBBED
 */
export const decrypt = (encryptedText: string): string => {
    console.warn("decrypt() called but implementation relies on Node.js crypto. Returning empty string.");
    return "";
};

/**
 * Hash email using SHA-256 for searchable index
 * NOT IMPLEMENTED FOR BROWSER YET - STUBBED
 * Used for server-side mostly.
 */
export const hashEmail = (email: string): string => {
    console.warn("hashEmail() called but implementation relies on Node.js crypto. Returning empty string.");
    return "";
};

/**
 * Generate secure random token (for unsubscribe links)
 * @param bytes - Number of random bytes (default: 32)
 * @returns Hex-encoded token
 */
export const generateToken = (bytes: number = 32): string => {
    const array = new Uint8Array(bytes);
    window.crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * Simple audit log helper
 * @param action - Action performed
 * @param resourceType - Type of resource
 * @param resourceId - ID of resource
 * @param userId - Optional user ID
 */
export const logSimpleAudit = async (
    action: string,
    resourceType: string,
    resourceId?: string,
    userId?: string,
    metadata?: Record<string, any>
) => {
    // Import dynamically to avoid circular dependencies
    const { supabase } = await import('@/integrations/supabase/client');

    try {
        await supabase.from('simple_audit_log').insert({
            user_id: userId,
            action,
            resource_type: resourceType,
            resource_id: resourceId,
            metadata: metadata || {},
        });
    } catch (error) {
        console.error('Audit log error:', error);
        // Don't throw - logging should not break app flow
    }
};

