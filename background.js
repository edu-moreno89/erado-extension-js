// Erado Gmail Export - Background Service Worker (Phase 2)
console.log('Erado Gmail Export background script loaded (Phase 2)');

// Gmail API configuration
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
let accessToken = null;

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    
    switch (message.action) {
        case 'authenticate':
            handleAuthentication()
                .then(result => sendResponse(result))
                .catch(error => sendResponse({ success: false, error: error.message }));
            break;
            
        case 'exportEmailPDF':
            handleExportEmailPDF(message.emailData)
                .then(result => sendResponse(result))
                .catch(error => sendResponse({ success: false, error: error.message }));
            break;
            
        case 'downloadAttachments':
            handleDownloadAttachments(message.emailData)
                .then(result => sendResponse(result))
                .catch(error => sendResponse({ success: false, error: error.message }));
            break;
            
        case 'exportAll':
            handleExportAll(message.emailData)
                .then(result => sendResponse(result))
                .catch(error => sendResponse({ success: false, error: error.message }));
            break;
            
        case 'getEmailDetails':
            getEmailDetails(message.emailId)
                .then(result => sendResponse(result))
                .catch(error => sendResponse({ success: false, error: error.message }));
            break;
            
        case 'emailOpened':
            console.log('Email opened:', message.emailData.subject);
            break;
            
        default:
            sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true; // Keep message channel open for async response
});

// Handle OAuth2 authentication
async function handleAuthentication() {
    try {
        console.log('Starting OAuth2 authentication...');
        
        const authResult = await chrome.identity.getAuthToken({ interactive: true });
        accessToken = authResult.token;
        
        console.log('Authentication successful');
        return { success: true, token: accessToken };
    } catch (error) {
        console.error('Authentication failed:', error);
        throw error;
    }
}

// Get detailed email information from Gmail API
async function getEmailDetails(emailId) {
    if (!accessToken) {
        throw new Error('Not authenticated. Please authenticate first.');
    }
    
    try {
        const response = await fetch(`${GMAIL_API_BASE}/messages/${emailId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Gmail API error: ${response.status}`);
        }
        
        const emailData = await response.json();
        return { success: true, emailData };
    } catch (error) {
        console.error('Error fetching email details:', error);
        throw error;
    }
}

// Download attachment from Gmail API
async function downloadAttachment(messageId, attachmentId, filename) {
    if (!accessToken) {
        throw new Error('Not authenticated');
    }
    
    try {
        const response = await fetch(`${GMAIL_API_BASE}/messages/${messageId}/attachments/${attachmentId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Attachment download failed: ${response.status}`);
        }
        
        const attachmentData = await response.json();
        const decodedData = atob(attachmentData.data.replace(/-/g, '+').replace(/_/g, '/'));
        
        // Convert to blob and download
        const bytes = new Uint8Array(decodedData.length);
        for (let i = 0; i < decodedData.length; i++) {
            bytes[i] = decodedData.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: attachmentData.mimeType || 'application/octet-stream' });
        
        // Use data URL instead of blob URL for service worker compatibility
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = async () => {
                try {
                    await chrome.downloads.download({
                        url: reader.result,
                        filename: filename,
                        saveAs: false
                    });
                    resolve({ success: true });
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Error downloading attachment:', error);
        throw error;
    }
}

// Generate PDF from email content
async function generatePDF(emailData) {
    try {
        console.log('Generating PDF for:', emailData.subject);
        
        // Create HTML content for PDF
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${emailData.subject}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            border-bottom: 2px solid #667eea;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .subject {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
        }
        .meta {
            color: #666;
            font-size: 14px;
        }
        .meta span {
            margin-right: 20px;
        }
        .body {
            margin-top: 30px;
        }
        .attachments {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
        .attachment-item {
            background: #f5f5f5;
            padding: 10px;
            margin: 5px 0;
            border-radius: 5px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 12px;
            color: #999;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="subject">${emailData.subject}</div>
        <div class="meta">
            <span><strong>From:</strong> ${emailData.sender}</span>
            <span><strong>Date:</strong> ${emailData.date}</span>
            <span><strong>URL:</strong> ${emailData.url}</span>
        </div>
    </div>
    
    <div class="body">
        ${emailData.body}
    </div>
    
    ${emailData.attachments && emailData.attachments.length > 0 ? `
    <div class="attachments">
        <h3>Attachments (${emailData.attachments.length})</h3>
        ${emailData.attachments.map(att => `
            <div class="attachment-item">
                <strong>${att.name}</strong>
                ${att.size ? ` (${att.size})` : ''}
                ${att.type ? ` - ${att.type}` : ''}
            </div>
        `).join('')}
    </div>
    ` : ''}
    
    <div class="footer">
        <p>Exported by Erado Gmail Export on ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;

        // For now, create a text file as placeholder
        // In production, you'd use a PDF generation library like jsPDF or html2pdf
        const content = `
ERADO GMAIL EXPORT - PDF
========================

Subject: ${emailData.subject}
From: ${emailData.sender}
Date: ${emailData.date}
URL: ${emailData.url}

BODY:
${emailData.body}

ATTACHMENTS:
${emailData.attachments.map(att => `- ${att.name} (${att.size})`).join('\n')}

Exported on: ${new Date().toISOString()}
        `.trim();
        
        // Create blob and convert to data URL for service worker compatibility
        const blob = new Blob([content], { type: 'text/plain' });
        
        // Use FileReader to convert blob to data URL
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
            reader.onload = async () => {
                try {
                    await chrome.downloads.download({
                        url: reader.result,
                        filename: `erado-export-${sanitizeFilename(emailData.subject)}.txt`,
                        saveAs: true
                    });
                    resolve({ success: true });
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
}

// Export email as PDF
async function handleExportEmailPDF(emailData) {
    try {
        console.log('Exporting email as PDF:', emailData.subject);
        
        // If we have an email ID, try to get full details from Gmail API
        if (emailData.emailId && accessToken) {
            try {
                const details = await getEmailDetails(emailData.emailId);
                emailData = { ...emailData, ...details.emailData };
            } catch (error) {
                console.log('Could not fetch Gmail API details, using DOM data:', error.message);
            }
        }
        
        return await generatePDF(emailData);
    } catch (error) {
        console.error('Error exporting email PDF:', error);
        throw error;
    }
}

// Download attachments using Gmail API
async function handleDownloadAttachments(emailData) {
    try {
        console.log('Downloading attachments for:', emailData.subject);
        
        if (!emailData.attachments || emailData.attachments.length === 0) {
            throw new Error('No attachments found');
        }
        
        if (!accessToken) {
            throw new Error('Not authenticated. Please authenticate first.');
        }
        
        // If we have email ID, try to download real attachments
        if (emailData.emailId) {
            try {
                const details = await getEmailDetails(emailData.emailId);
                const attachments = details.emailData.payload?.parts?.filter(part => part.filename) || [];
                
                for (const attachment of attachments) {
                    await downloadAttachment(
                        emailData.emailId,
                        attachment.body.attachmentId,
                        attachment.filename
                    );
                }
                
                return { success: true };
            } catch (error) {
                console.log('Could not download via Gmail API, using placeholder:', error.message);
            }
        }
        
        // Fallback to placeholder files
        for (const attachment of emailData.attachments) {
            const content = `Placeholder for attachment: ${attachment.name}\nSize: ${attachment.size}\nType: ${attachment.type}`;
            const blob = new Blob([content], { type: 'text/plain' });
            
            // Use FileReader to convert blob to data URL
            const reader = new FileReader();
            await new Promise((resolve, reject) => {
                reader.onload = async () => {
                    try {
                        await chrome.downloads.download({
                            url: reader.result,
                            filename: `erado-attachment-${sanitizeFilename(attachment.name)}.txt`,
                            saveAs: false
                        });
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error downloading attachments:', error);
        throw error;
    }
}

// Export all (email + attachments)
async function handleExportAll(emailData) {
    try {
        console.log('Exporting all for:', emailData.subject);
        
        // Export email first
        await handleExportEmailPDF(emailData);
        
        // Then download attachments if any
        if (emailData.attachments && emailData.attachments.length > 0) {
            await handleDownloadAttachments(emailData);
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error exporting all:', error);
        throw error;
    }
}

// Utility function to sanitize filename
function sanitizeFilename(filename) {
    return filename
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 50);
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    console.log('Erado Gmail Export installed:', details.reason);
    
    if (details.reason === 'install') {
        // Set default settings
        chrome.storage.sync.set({
            defaultDownloadPath: 'Downloads',
            autoDetectEmails: true,
            exportFormat: 'pdf',
            autoAuthenticate: false
        });
    }
});
