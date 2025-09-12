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
            // Receive token from popup
            accessToken = message.token;
            console.log('Token received from popup, length:', accessToken ? accessToken.length : 'undefined');
            sendResponse({ success: true });
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

// Download real attachments using Gmail API
async function handleDownloadAttachments(emailData, sendResponse) {
    try {
        console.log('Downloading real attachments for:', emailData.subject);
        
        if (!emailData.attachments || emailData.attachments.length === 0) {
            sendResponse({ error: 'No attachments found' });
            return;
        }
        
        if (!accessToken) {
            console.error('No access token available');
            sendResponse({ error: 'Authentication required. Please authenticate first.' });
            return;
        }
        
        console.log('Using token, length:', accessToken.length);
        
        // Get email details from Gmail API
        const emailDetails = await getEmailDetailsFromAPI(emailData, accessToken);
        
        if (!emailDetails.success) {
            sendResponse({ error: emailDetails.error });
            return;
        }
        
        const realAttachments = emailDetails.attachments;
        console.log('Found real attachments from API:', realAttachments.length);
        
        // Download each real attachment
        for (const attachment of realAttachments) {
            await downloadRealAttachment(emailDetails.emailId, attachment, accessToken);
        }
        
        sendResponse({ success: true, message: `Downloaded ${realAttachments.length} real attachments` });
        
    } catch (error) {
        console.error('Error downloading real attachments:', error);
        sendResponse({ error: error.message });
    }
}

// Get email details from Gmail API
async function getEmailDetailsFromAPI(emailData, token) {
    try {
        // Try to extract email ID from URL or use a search
        let emailId = emailData.emailId;
        console.log('Email ID:', emailId);
        
        if (!emailId) {
            // Search for the email by subject and sender
            const searchQuery = `subject:"${emailData.subject}" from:"${emailData.sender}"`;
            console.log('Search query:', searchQuery);
            
            const searchResponse = await fetch(`${GMAIL_API_BASE}/messages?q=${encodeURIComponent(searchQuery)}&maxResults=1`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!searchResponse.ok) {
                const errorText = await searchResponse.text();
                console.error('Gmail API search error:', searchResponse.status, errorText);
                throw new Error(`Gmail API search error: ${searchResponse.status} - ${errorText}`);
            }
            
            const searchData = await searchResponse.json();
            if (searchData.messages && searchData.messages.length > 0) {
                emailId = searchData.messages[0].id;
                console.log('Found email ID via search:', emailId);
            } else {
                throw new Error('Email not found via API search.');
            }
        }

        // Get full email details
        const response = await fetch(`${GMAIL_API_BASE}/messages/${emailId}?format=full`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gmail API fetch email details error:', response.status, errorText);
            throw new Error(`Gmail API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        return processEmailDetails(data, emailId);
        
    } catch (error) {
        console.error('Error getting email details from API:', error);
        return { success: false, error: error.message };
    }
}

// Helper function to process email details
function processEmailDetails(emailDetails, emailId) {
    // Extract attachments from email payload
    const attachments = [];
    function extractAttachments(part) {
        if (part.filename && part.body && part.body.attachmentId) {
            attachments.push({
                filename: part.filename,
                mimeType: part.mimeType,
                size: part.body.size,
                attachmentId: part.body.attachmentId
            });
        }
        if (part.parts) {
            part.parts.forEach(extractAttachments);
        }
    }
    
    if (emailDetails.payload) {
        extractAttachments(emailDetails.payload);
    }
    
    return { success: true, attachments, emailId };
}

// Download real attachment from Gmail API
async function downloadRealAttachment(messageId, attachment, token) {
    try {
        console.log('Downloading real attachment:', attachment.filename);
        
        const response = await fetch(`${GMAIL_API_BASE}/messages/${messageId}/attachments/${attachment.attachmentId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gmail API attachment download error:', response.status, errorText);
            throw new Error(`Attachment download failed: ${response.status} - ${errorText}`);
        }
        
        const attachmentData = await response.json();
        await processAttachmentDownload(attachmentData, attachment);
        
    } catch (error) {
        console.error('Error downloading real attachment:', error);
        throw error;
    }
}

// Helper function to process attachment download
async function processAttachmentDownload(attachmentData, attachment) {
    const decodedData = atob(attachmentData.data.replace(/-/g, '+').replace(/_/g, '/'));
    
    // Convert to blob and download
    const bytes = new Uint8Array(decodedData.length);
    for (let i = 0; i < decodedData.length; i++) {
        bytes[i] = decodedData.charCodeAt(i);
    }
    
    const blob = new Blob([bytes], { type: attachment.mimeType || 'application/octet-stream' });
    
    // Convert to data URL for download
    const reader = new FileReader();
    await new Promise((resolve, reject) => {
        reader.onload = async () => {
            try {
                await chrome.downloads.download({
                    url: reader.result,
                    filename: `erado-${sanitizeFilename(attachment.filename)}`,
                    saveAs: false
                });
                console.log('Downloaded real attachment:', attachment.filename);
                resolve();
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Export all (email + attachments)
async function handleExportAll(emailData, sendResponse) {
    try {
        console.log('Exporting all for:', emailData.subject);
        
        // Skip PDF generation - handled by content script
        console.log('PDF generation skipped - handled by content script');
        
        // Only download attachments if any
        if (emailData.attachments && emailData.attachments.length > 0) {
            const attachmentResult = await new Promise(resolve => {
                handleDownloadAttachments(emailData, resolve);
            });
            
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
