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
            accessToken = message.token;
            console.log('Token set in background script, length:', accessToken ? accessToken.length : 'undefined');
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

// Download real attachments using Gmail API - SIMPLIFIED VERSION
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
        
        // Get email details from Gmail API using search
        const emailDetails = await getEmailDetailsFromAPI(emailData, accessToken);
        
        if (!emailDetails.success) {
            sendResponse({ error: emailDetails.error });
            return;
        }
        
        const realAttachments = emailDetails.attachments;
        console.log('Found real attachments from API:', realAttachments.length);
        
        // Download each real attachment to content script (which will save to selected folder)
        for (const attachment of realAttachments) {
            await downloadRealAttachmentToContentScript(emailDetails.emailId, attachment, accessToken);
        }
        
        sendResponse({ success: true, message: `Downloaded ${realAttachments.length} real attachments` });
        
    } catch (error) {
        console.error('Error downloading real attachments:', error);
        sendResponse({ error: error.message });
    }
}

// Download real attachment and send to content script
async function downloadRealAttachmentToContentScript(messageId, attachment, token) {
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
        const blob = await processAttachmentData(attachmentData, attachment);
        
        // Send attachment to content script for saving
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await chrome.tabs.sendMessage(tab.id, {
            action: 'saveAttachmentToFolder',
            attachment: attachment,
            blob: blob
        });
        
    } catch (error) {
        console.error('Error downloading real attachment:', error);
        throw error;
    }
}

// Helper function to process attachment data
async function processAttachmentData(attachmentData, attachment) {
    const decodedData = atob(attachmentData.data.replace(/-/g, '+').replace(/_/g, '/'));
    
    // Convert to blob
    const bytes = new Uint8Array(decodedData.length);
    for (let i = 0; i < decodedData.length; i++) {
        bytes[i] = decodedData.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: attachment.mimeType || 'application/octet-stream' });
}

// Get email details from Gmail API - SIMPLIFIED VERSION
async function getEmailDetailsFromAPI(emailData, token) {
    try {
        console.log('Searching for email:', emailData);
        
        // Use Gmail search - much more reliable than trying to extract message IDs
        const searchQuery = `subject:"${emailData.subject}" from:${emailData.sender}`;
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
        if (!searchData.messages || searchData.messages.length === 0) {
            throw new Error('Email not found via search');
        }
        
        const messageId = searchData.messages[0].id;
        console.log('Found message ID via search:', messageId);
        
        // Get full email details using the found message ID
        const response = await fetch(`${GMAIL_API_BASE}/messages/${messageId}?format=full`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gmail API fetch error:', response.status, errorText);
            throw new Error(`Gmail API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        return processEmailDetails(data, messageId);
        
    } catch (error) {
        console.error('Error getting email details from API:', error);
        return { success: false, error: error.message };
    }
}

// Process email details from Gmail API response
function processEmailDetails(data, messageId) {
    try {
        const headers = data.payload.headers;
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const sender = headers.find(h => h.name === 'From')?.value || 'Unknown Sender';
        const date = headers.find(h => h.name === 'Date')?.value || 'Unknown Date';
        
        // Extract attachments
        const attachments = [];
        if (data.payload.parts) {
            data.payload.parts.forEach(part => {
                if (part.filename && part.body.attachmentId) {
                    attachments.push({
                        filename: part.filename,
                        mimeType: part.mimeType,
                        size: part.body.size,
                        attachmentId: part.body.attachmentId
                    });
                }
            });
        }
        
        console.log('Processed email details:', { subject, sender, attachments: attachments.length });
        
        return {
            success: true,
            emailId: messageId,
            subject,
            sender,
            date,
            attachments
        };
        
    } catch (error) {
        console.error('Error processing email details:', error);
        return { success: false, error: error.message };
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
