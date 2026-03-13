/**
 * Export Utilities for Prospecta
 * Handles CSV, JSON, and Excel exports with proper formatting
 */

interface ExportData {
    [key: string]: any;
}

/**
 * Convert array of objects to CSV string
 */
export const convertToCSV = (data: ExportData[], filters?: {
    includeScores?: boolean;
    includeSource?: boolean;
    includeDate?: boolean;
    includeTags?: boolean;
}): string => {
    if (!data || data.length === 0) {
        return '';
    }

    // Define column order and labels
    const columns: { key: string; label: string; include: boolean }[] = [
        { key: 'name', label: 'Name', include: true },
        { key: 'position', label: 'Position', include: true },
        { key: 'company', label: 'Company', include: true },
        { key: 'email', label: 'Email', include: filters?.includeTags !== false },
        { key: 'phone', label: 'Phone', include: filters?.includeTags !== false },
        { key: 'profile_url', label: 'Profile URL', include: filters?.includeTags !== false },
        { key: 'website_url', label: 'Website', include: filters?.includeTags !== false },
        { key: 'score', label: 'Quality Score', include: filters?.includeScores !== false },
        { key: 'source', label: 'Source', include: filters?.includeSource !== false },
        { key: 'created_at', label: 'Date Added', include: filters?.includeDate !== false },
    ];

    // Filter columns based on settings
    const activeColumns = columns.filter(col => col.include);

    // Create header row
    const headers = activeColumns.map(col => col.label).join(',');

    // Create data rows
    const rows = data.map(row => {
        return activeColumns.map(col => {
            let value = row[col.key] || '';

            // Format dates
            if (col.key === 'created_at' && value) {
                value = new Date(value).toLocaleDateString();
            }

            // Escape commas and quotes in CSV
            if (typeof value === 'string') {
                value = value.replace(/"/g, '""');
                if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                    value = `"${value}"`;
                }
            }

            return value;
        }).join(',');
    });

    return [headers, ...rows].join('\n');
};

/**
 * Convert data to JSON string with pretty formatting
 */
export const convertToJSON = (data: ExportData[]): string => {
    return JSON.stringify(data, null, 2);
};

/**
 * Download file to user's computer
 */
export const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

/**
 * Export prospects to CSV
 */
export const exportToCSV = (data: ExportData[], filename?: string, filters?: any) => {
    const csv = convertToCSV(data, filters);
    const defaultFilename = filename || `prospects_${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(csv, defaultFilename, 'text/csv;charset=utf-8;');
};

/**
 * Export prospects to JSON
 */
export const exportToJSON = (data: ExportData[], filename?: string) => {
    const json = convertToJSON(data);
    const defaultFilename = filename || `prospects_${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(json, defaultFilename, 'application/json;charset=utf-8;');
};

/**
 * Export prospects to Excel (XLSX)
 * Note: For now, we'll export as CSV with .xlsx extension
 * For true Excel support, consider adding the 'xlsx' library
 */
export const exportToExcel = (data: ExportData[], filename?: string, filters?: any) => {
    const csv = convertToCSV(data, filters);
    const defaultFilename = filename || `prospects_${new Date().toISOString().split('T')[0]}.xlsx`;

    // For basic Excel compatibility, we use CSV format
    // To generate true .xlsx files, you would need to add the 'xlsx' npm package
    downloadFile(csv, defaultFilename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
};

/**
 * Main export function that routes to the appropriate format
 */
export const exportProspects = (
    data: ExportData[],
    format: 'csv' | 'json' | 'xlsx' | 'pdf',
    filters?: any
) => {
    if (!data || data.length === 0) {
        throw new Error('No data to export');
    }

    switch (format) {
        case 'csv':
            exportToCSV(data, undefined, filters);
            break;
        case 'json':
            exportToJSON(data);
            break;
        case 'xlsx':
            exportToExcel(data, undefined, filters);
            break;
        case 'pdf':
            // PDF export would require a library like jsPDF
            throw new Error('PDF export not yet implemented. Please use CSV or JSON.');
        default:
            throw new Error(`Unsupported format: ${format}`);
    }
};
