// Erado Gmail Export - Background Service Worker
console.log('Erado Gmail Export background script loaded');

// Gmail API configuration
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
let accessToken = null;

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.action);
    
    switch (message.action) {
        case 'authenticate':
            handleAuthentication(sendResponse);
            break;
            
        case 'exportEmailPDF':
            // Completely ignore PDF generation - handled by content script
            console.log('PDF generation ignored by background script');
            sendResponse({ error: 'PDF generation handled by content script' });
            break;
            
        case 'downloadAttachments':
            handleDownloadAttachments(message.emailData, sendResponse);
            break;
            
        case 'exportAll':
            handleExportAll(message.emailData, sendResponse);
            break;
            
        default:
            sendResponse({ error: 'Unknown action' });
    }
    
    return true; // Keep message channel open
});

// Handle authentication
async function handleAuthentication(sendResponse) {
    try {
        const token = await chrome.identity.getAuthToken({ interactive: true });
        accessToken = token;
        sendResponse({ success: true, token: token });
    } catch (error) {
        console.error('Authentication error:', error);
        sendResponse({ error: error.message });
    }
}

// Export email as PDF - DISABLED to prevent double windows
async function handleExportEmailPDF(emailData, sendResponse) {
    // This function is disabled to prevent double windows
    // PDF generation is now handled directly by content script
    console.log('PDF generation bypassed - handled by content script');
    sendResponse({ error: 'PDF generation handled by content script' });
}

// Download attachments
async function handleDownloadAttachments(emailData, sendResponse) {
    try {
        console.log('Downloading attachments for:', emailData.subject);
        
        if (!emailData.attachments || emailData.attachments.length === 0) {
            sendResponse({ error: 'No attachments found' });
            return;
        }
        
        // Create placeholder files for attachments
        for (const attachment of emailData.attachments) {
            const content = `Placeholder for attachment: ${attachment.name}\nSize: ${attachment.size}\nType: ${attachment.type}`;
            const blob = new Blob([content], { type: 'text/plain' });
            
            // Convert blob to data URL
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
        
        sendResponse({ success: true });
        
    } catch (error) {
        console.error('Error downloading attachments:', error);
        sendResponse({ error: error.message });
    }
}

// Export all (email + attachments) - Updated to skip PDF
async function handleExportAll(emailData, sendResponse) {
    try {
        console.log('Exporting all for:', emailData.subject);
        
        // Skip PDF generation - handled by content script
        console.log('PDF generation skipped - handled by content script');
        
        // Only download attachments if any
        if (emailData.attachments && emailData.attachments.length > 0) {
            const attachmentResult = await handleDownloadAttachments(emailData, (response) => response);
            
            if (!attachmentResult.success) {
                sendResponse({ error: attachmentResult.error });
                return;
            }
        }
        
        sendResponse({ success: true });
        
    } catch (error) {
        console.error('Error exporting all:', error);
        sendResponse({ error: error.message });
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
chrome.runtime.onInstalled.addListener(() => {
    console.log('Erado Gmail Export extension installed');
});
