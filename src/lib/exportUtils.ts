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
 * Export prospects to Excel (XLSX) with full branding
 */
export const exportToExcel = async (data: ExportData[], filename?: string) => {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Prospects', {
        views: [{ showGridLines: false }] // Hide gridlines for a cleaner look
    });

    const defaultFilename = filename || `prospecta_prospects_${new Date().toISOString().split('T')[0]}.xlsx`;

    // ── LOGO ──────────────────────────────────────────────────────────────────
    try {
        const logoBase64 = await getBase64ImageFromUrl('/logo_prospecta_dark.png');
        const imageId = workbook.addImage({
            base64: logoBase64,
            extension: 'png',
        });
        
        // Add logo at the top
        worksheet.addImage(imageId, {
            tl: { col: 0.1, row: 0.2 },
            ext: { width: 100, height: 35 }
        });
    } catch (e) {
        console.warn('Could not add logo to Excel', e);
    }

    // ── HEADER INFO ───────────────────────────────────────────────────────────
    // We'll place the title and date in a cleaner way without massive merged cells
    worksheet.getCell('C1').value = 'Rapport de Prospection — Prospecta';
    worksheet.getCell('C1').font = { name: 'Arial Black', size: 14, color: { argb: 'FF0A192F' } };
    
    worksheet.getCell('C2').value = `Généré le ${new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })} · ${data.length} prospects`;
    worksheet.getCell('C2').font = { name: 'Arial', size: 10, color: { argb: 'FF64748B' } };

    // Leave space for the header
    const startRow = 5;

    // ── TABLE DEFINITION ──────────────────────────────────────────────────────
    const columns = [
        { header: 'Nom',       key: 'name',    width: 30 },
        { header: 'Entreprise',key: 'company', width: 40 },
        { header: 'Email',     key: 'email',   width: 40 },
        { header: 'Téléphone', key: 'phone',   width: 25 },
        { header: 'Source',    key: 'source',  width: 20 },
        { header: 'Score',     key: 'score',   width: 12 },
        { header: 'Date Ajout',key: 'date',    width: 18 },
    ];

    worksheet.getRow(startRow).values = columns.map(c => c.header);
    worksheet.columns = columns;

    // Style the header row
    const headerRow = worksheet.getRow(startRow);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
        cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0A192F' } // Midnight Blue
        };
        cell.font = {
            bold: true,
            color: { argb: 'FFFFFFFF' },
            size: 11
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
            bottom: { style: 'medium', color: { argb: 'FF10B981' } } // Emerald accent
        };
    });

    // ── ADD DATA ──────────────────────────────────────────────────────────────
    data.forEach((p, index) => {
        const rowData = {
            name:    p.name    || '—',
            company: p.company || '—',
            email:   p.email   || '—',
            phone:   p.phone   || '—',
            source:  p.source  || '—',
            score:   p.score ? `${p.score}%` : '—',
            date:    p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '—',
        };
        
        const row = worksheet.addRow(rowData);
        row.height = 20;
        
        // Alternating row colors
        if (index % 2 !== 0) {
            row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF8FAFC' } // Slate-50
            };
        }

        // Apply borders and alignment to cells
        row.eachCell((cell) => {
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            cell.border = {
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };
        });
        
        // Specific styling for quality columns
        row.getCell('score').alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell('date').alignment = { vertical: 'middle', horizontal: 'center' };
        row.getCell('score').font = { bold: true, color: { argb: 'FF059669' } };
    });

    // Write to buffer and download
    const buffer = await workbook.xlsx.writeBuffer();
    downloadFile(
        buffer as any, 
        defaultFilename, 
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
};

// ─── Brand Colors ───────────────────────────────────────────────────────────
const COLOR_MIDNIGHT     = [10, 25, 47]   as [number, number, number]; // #0A192F
const COLOR_EMERALD      = [16, 185, 129] as [number, number, number]; // #10B981
const COLOR_EMERALD_DARK = [5,  150, 105] as [number, number, number]; // #059669
const COLOR_LIGHT        = [240, 253, 249] as [number, number, number]; // #F0FDF9
const COLOR_GRAY         = [100, 116, 139] as [number, number, number]; // slate-500
const COLOR_WHITE        = [255, 255, 255] as [number, number, number];

/**
 * Helper to fetch image and convert to base64
 */
const getBase64ImageFromUrl = async (url: string): Promise<string> => {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

/**
 * Export prospects to a branded Prospecta PDF
 */
export const exportToPDF = async (data: ExportData[], filename?: string) => {
    // Dynamic import so bundle stays lean when PDF is not used
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const defaultFilename = filename || `prospecta_prospects_${new Date().toISOString().split('T')[0]}.pdf`;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;

    // ── HEADER BANNER ─────────────────────────────────────────────────────────
    doc.setFillColor(...COLOR_MIDNIGHT);
    doc.rect(0, 0, pageW, 30, 'F');

    // Gradient accent strip
    doc.setFillColor(...COLOR_EMERALD);
    doc.rect(0, 26, pageW, 4, 'F');

    // Logo Image
    try {
        const logoBase64 = await getBase64ImageFromUrl('/logo_prospecta_claire.png');
        // Icon is square-ish, making it slightly larger and higher up
        doc.addImage(logoBase64, 'PNG', margin, 6, 14, 14);
    } catch (e) {
        // Fallback if logo fails to load
        doc.setFillColor(...COLOR_EMERALD);
        doc.circle(margin + 5, 14, 7, 'F');
        doc.setTextColor(...COLOR_MIDNIGHT);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('P', margin + 5, 17, { align: 'center' });
    }

    // App name
    doc.setTextColor(...COLOR_EMERALD);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Prospecta', margin + 17, 17);

    // Tagline
    doc.setTextColor(...COLOR_WHITE);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Intelligence Commerciale · Automatisation Premium', margin + 17, 22);

    // Report title on the right
    doc.setTextColor(...COLOR_WHITE);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Rapport Prospects', pageW - margin, 13, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 220, 200);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageW - margin, 19, { align: 'right' });
    doc.text(`${data.length} prospect${data.length > 1 ? 's' : ''}`, pageW - margin, 24, { align: 'right' });

    // ── STATS ROW ─────────────────────────────────────────────────────────────
    const withEmail = data.filter(p => p.email).length;
    const withPhone = data.filter(p => p.phone).length;
    const avgScore  = data.length > 0 ? Math.round(data.reduce((s, p) => s + (p.score || 0), 0) / data.length) : 0;

    doc.setFillColor(...COLOR_LIGHT);
    doc.rect(0, 30, pageW, 18, 'F');

    const statsY = 41;
    const statItems = [
        { label: 'Total Prospects', value: String(data.length) },
        { label: 'Avec Email',      value: String(withEmail) },
        { label: 'Avec Téléphone',  value: String(withPhone) },
        { label: 'Score Moyen',     value: `${avgScore}%` },
    ];
    const colW = (pageW - margin * 2) / statItems.length;

    statItems.forEach((item, i) => {
        const x = margin + colW * i + colW / 2;
        doc.setTextColor(...COLOR_EMERALD_DARK);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(item.value, x, statsY, { align: 'center' });
        doc.setTextColor(...COLOR_GRAY);
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text(item.label, x, statsY + 5, { align: 'center' });

        // Separator
        if (i < statItems.length - 1) {
            doc.setDrawColor(...COLOR_EMERALD);
            doc.setLineWidth(0.3);
            doc.line(margin + colW * (i + 1), 33, margin + colW * (i + 1), 46);
        }
    });

    // ── DATA TABLE ────────────────────────────────────────────────────────────
    const tableColumns = [
        { header: 'Nom',       dataKey: 'name'    },
        { header: 'Entreprise',dataKey: 'company' },
        { header: 'Email',     dataKey: 'email'   },
        { header: 'Téléphone', dataKey: 'phone'   },
        { header: 'Source',    dataKey: 'source'  },
        { header: 'Score',     dataKey: 'score'   },
        { header: 'Date Ajout',dataKey: 'date'    },
    ];

    const tableRows = data.map(p => ({
        name:    p.name    || '—',
        company: p.company || '—',
        email:   p.email   || '—',
        phone:   p.phone   || '—',
        source:  p.source  || '—',
        score:   p.score ? `${p.score}%` : '—',
        date:    p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '—',
    }));

    autoTable(doc, {
        startY: 52,
        margin: { left: margin, right: margin },
        columns: tableColumns,
        body: tableRows,
        theme: 'grid',
        styles: {
            fontSize: 7.5,
            cellPadding: 2.5,
            textColor: [30, 41, 59],
            overflow: 'linebreak', // Allow text to wrap
        },
        headStyles: {
            fillColor: COLOR_MIDNIGHT,
            textColor: COLOR_WHITE,
            fontStyle: 'bold',
            fontSize: 8.5,
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252],
        },
        columnStyles: {
            name:    { cellWidth: 40 },
            company: { cellWidth: 60 },
            email:   { cellWidth: 50 },
            phone:   { cellWidth: 35 },
            source:  { cellWidth: 25 },
            score:   { cellWidth: 15, halign: 'center', fontStyle: 'bold', textColor: COLOR_EMERALD_DARK },
            date:    { cellWidth: 25, halign: 'center' },
        },
        didDrawPage: (hookData: any) => {
            // ── FOOTER on every page ──
            const pn = hookData.pageNumber;
            const total = (doc as any).internal.getNumberOfPages?.() ?? pn;

            // Footer bar
            doc.setFillColor(...COLOR_MIDNIGHT);
            doc.rect(0, pageH - 14, pageW, 14, 'F');

            // Accent line above footer
            doc.setFillColor(...COLOR_EMERALD);
            doc.rect(0, pageH - 15, pageW, 1, 'F');

            // Left: brand signature
            doc.setTextColor(...COLOR_EMERALD);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text('Prospecta', margin, pageH - 7);
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(180, 200, 200);
            doc.text(' · Intelligence Commerciale Automatisée · prospecta.soamibango.com', margin + 20, pageH - 7);

            // Center: confidentiality
            doc.setTextColor(180, 200, 200);
            doc.setFontSize(6);
            doc.text('Document confidentiel — usage interne uniquement', pageW / 2, pageH - 7, { align: 'center' });

            // Right: page number
            doc.setTextColor(...COLOR_EMERALD);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(`${pn} / ${total}`, pageW - margin, pageH - 7, { align: 'right' });
        },
    });

    doc.save(defaultFilename);
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
            exportToExcel(data);
            break;
        case 'pdf':
            exportToPDF(data);
            break;
        default:
            throw new Error(`Unsupported format: ${format}`);
    }
};
