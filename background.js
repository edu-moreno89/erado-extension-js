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
            handleExportEmailPDF(message.emailData, sendResponse);
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

// Export email as PDF
async function handleExportEmailPDF(emailData, sendResponse) {
    try {
        console.log('Exporting email as PDF:', emailData.subject);
        
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab) {
            sendResponse({ error: 'No active tab found' });
            return;
        }
        
        // Send message to content script to generate PDF
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'generatePDF',
            data: emailData
        });
        
        if (response && response.success) {
            sendResponse({ success: true, filename: response.filename });
        } else {
            sendResponse({ error: response?.error || 'PDF generation failed' });
        }
        
    } catch (error) {
        console.error('Error exporting email PDF:', error);
        sendResponse({ error: error.message });
    }
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

// Export all (email + attachments)
async function handleExportAll(emailData, sendResponse) {
    try {
        console.log('Exporting all for:', emailData.subject);
        
        // Export email first
        const emailResult = await handleExportEmailPDF(emailData, (response) => response);
        
        if (!emailResult.success) {
            sendResponse({ error: emailResult.error });
            return;
        }
        
        // Then download attachments if any
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
