console.log('Erado Gmail Export background script loaded');

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
let accessToken = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.action);
    
    switch (message.action) {
        case 'setToken':
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
    
    return true;
});

async function handleDownloadAttachments(emailData, sendResponse) {
    try {
        console.log('Downloading attachments for:', emailData.subject);
        console.log('Email data:', emailData);
        
        if (!emailData.attachments || emailData.attachments.length === 0) {
            sendResponse({ error: 'No attachments found' });
            return;
        }
        
        const tabs = await chrome.tabs.query({ url: 'https://mail.google.com/*' });
        
        if (!tabs || tabs.length === 0) {
            console.error('No Gmail tab found');
            sendResponse({ error: 'No Gmail tab found. Please open Gmail and try again.' });
            return;
        }
        
        const gmailTab = tabs[0];
        console.log('Found Gmail tab:', gmailTab.id, gmailTab.url);
        
        const folderResponse = await chrome.tabs.sendMessage(gmailTab.id, { action: 'getFolderStatus' });
        
        if (!folderResponse || !folderResponse.folderPath) {
            sendResponse({ error: 'No custom folder selected. Please select a folder first.' });
            return;
        }
        
        console.log('Custom folder path:', folderResponse.folderPath);
        
        const downloadResult = await chrome.tabs.sendMessage(gmailTab.id, {
            action: 'downloadAttachmentsToCustomFolder',
            attachments: emailData.attachments,
            customFolderPath: folderResponse.folderPath
        });
        
        if (downloadResult.success) {
            sendResponse({ 
                success: true, 
                message: `Downloaded ${emailData.attachments.length} attachment(s) to custom folder`,
                downloadCount: emailData.attachments.length
            });
        } else {
            sendResponse({ error: downloadResult.error });
        }
        
    } catch (error) {
        console.error('Error downloading attachments:', error);
        sendResponse({ error: error.message });
    }
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('Erado Gmail Export extension installed');
});