// Erado Gmail Export - Background Service Worker
console.log('Erado Gmail Export background script loaded');

// Gmail API configuration
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
let accessToken = null;

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.action);
    
    switch (message.action) {
        case 'setToken':
            // Store the token properly
            accessToken = message.token;
            console.log('Token stored in background script');
            sendResponse({ success: true });
            break;
            
        case 'downloadAttachments':
            handleDownloadAttachments(message.emailData, sendResponse);
            break;
            
        default:
            sendResponse({ error: 'Unknown action' });
    }
    
    return true; // Keep message channel open
});

// Download attachments using Chrome tabs
async function handleDownloadAttachments(emailData, sendResponse) {
    try {
        console.log('Downloading attachments for:', emailData.subject);
        console.log('Email data:', emailData);
        
        if (!emailData.attachments || emailData.attachments.length === 0) {
            sendResponse({ error: 'No attachments found' });
            return;
        }
        
        console.log(`Opening ${emailData.attachments.length} attachment(s) in new tabs for download`);
        
        const openedTabs = [];

        // Open each attachment URL in a new tab
        for (const attachment of emailData.attachments) {
            if (attachment.downloadUrl) {
                try {
                    console.log(`Opening attachment: ${attachment.name} - ${attachment.downloadUrl}`);
                    
                    const url = cleanAttachmentUrl(attachment.downloadUrl);
                    console.log(`Cleaned URL: ${url}`);

                    const tab = await chrome.tabs.create({
                        url: url,
                        active: false
                    });

                    openedTabs.push(tab.id);
                    
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } catch (error) {
                    console.error(`Error opening tab for ${attachment.name}:`, error);
                }
            } else {
                console.warn(`No download URL for attachment: ${attachment.name}`);
            }
        }

        // Auto-close tabs after 3 seconds
        setTimeout(async () => {
            for (const tabId of openedTabs) {
                try {
                    await chrome.tabs.remove(tabId);
                    console.log(`Closed tab ${tabId}`);
                } catch (error) {
                    console.log(`Tab ${tabId} already closed or couldn't be closed`);
                }
            }
        }, 3000);
        
        sendResponse({ success: true, message: `Opened ${emailData.attachments.length} attachment(s) in new tabs` });
        
    } catch (error) {
        console.error('Error downloading attachments:', error);
        sendResponse({ error: error.message });
    }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('Erado Gmail Export extension installed');
});

// Add a helper function to clean attachment URLs
function cleanAttachmentUrl(url) {
    if (!url) return null;
    
    const urlMatch = url.match(/^[^:]+:[^:]+:(https?:\/\/.+)$/);

    if (urlMatch) {
        url = urlMatch[1];
    }

    if (url.includes('https://mail.google.com/mail/u/0/https://mail.google.com/mail/u/0')) {
        url = url.replace('https://mail.google.com/mail/u/0/https://mail.google.com/mail/u/0', 'https://mail.google.com/mail/u/0');
        console.log('Fixed double prefix:', url);
    }
    
    return url;
}