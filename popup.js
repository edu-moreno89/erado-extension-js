// Erado Gmail Export - Popup Script
console.log('Erado Gmail Export popup script loaded');

// State
let currentEmailData = null;
let threadEmails = [];
let selectedEmailIndex = 0;
let selectedFolder = null;
let isFolderSelected = false;

// DOM elements
let selectFolderBtn, emailInfo, emailSubject, emailSender, emailDate, emailAttachments,
    emailList, emailItems, detectEmailBtn, exportEmailBtn, exportAttachmentsBtn, 
    exportAllBtn, statusDiv;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup initialized');
    
    // Initialize DOM elements
    selectFolderBtn = document.getElementById('selectFolder');
    emailInfo = document.getElementById('emailInfo');
    emailSubject = document.getElementById('emailSubject');
    emailSender = document.getElementById('emailSender');
    emailDate = document.getElementById('emailDate');
    emailAttachments = document.getElementById('emailAttachments');
    emailList = document.getElementById('emailList');
    emailItems = document.getElementById('emailItems');
    detectEmailBtn = document.getElementById('detectEmail');
    exportEmailBtn = document.getElementById('exportEmail');
    exportAttachmentsBtn = document.getElementById('exportAttachments');
    exportAllBtn = document.getElementById('exportAll');
    statusDiv = document.getElementById('status');
    
    // Add event listeners
    selectFolderBtn.addEventListener('click', selectFolder);
    detectEmailBtn.addEventListener('click', detectEmail);
    exportEmailBtn.addEventListener('click', exportEmail);
    exportAttachmentsBtn.addEventListener('click', exportAttachments);
    exportAllBtn.addEventListener('click', exportAll);
    
    // Check if folder is already selected
    checkFolderStatus();
});

// Update the checkFolderStatus function to show full path
async function checkFolderStatus() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getFolderStatus' });
        
        if (response && response.success && response.folderName) {
            selectedFolder = response.folderName;
            isFolderSelected = true;
            updateFolderButton();
            showStatus(`Using folder: ${selectedFolder}`, 'info');
        } else {
            selectedFolder = null;
            isFolderSelected = false;
            updateFolderButton();
        }
    } catch (error) {
        console.log('No folder selected yet');
        selectedFolder = null;
        isFolderSelected = false;
        updateFolderButton();
    }
}

// Update the selectFolder function to show full path
async function selectFolder() {
    selectFolderBtn.disabled = true;
    showStatus('Selecting folder...', 'info');
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'selectFolder' });
        
        if (response.success) {
            selectedFolder = response.folderName;
            isFolderSelected = true;
            updateFolderButton();
            showStatus(`Using folder: ${selectedFolder}`, 'success');
        } else {
            showStatus(`Error: ${response.error}`, 'error');
        }
    } catch (error) {
        console.error('Error selecting folder:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
    
    selectFolderBtn.disabled = false;
}

// Update folder button text
function updateFolderButton() {
    if (isFolderSelected) {
        selectFolderBtn.textContent = 'Change Extract Path';
    } else {
        selectFolderBtn.textContent = 'Select Extract Path';
    }
}

// Detect email and thread
async function detectEmail() {
    detectEmailBtn.disabled = true;
    showStatus('Detecting email and thread...', 'info');
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab.url.includes('mail.google.com')) {
            showStatus('Please open Gmail first', 'error');
            detectEmailBtn.disabled = false;
            return;
        }
        
        // Detect all emails in thread
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getAllEmailsInThread' });
        
        if (response && response.success) {
            threadEmails = response.emails;
            console.log('Thread emails detected:', threadEmails);
            
            if (threadEmails.length === 1) {
                // Single email - no selection needed
                currentEmailData = await getSelectedEmailData(0);
                showEmailInfo(currentEmailData);
                hideEmailList();
                enableButtons();
                showStatus(`Single email detected: ${currentEmailData.sender}`, 'success');
            } else if (threadEmails.length > 1) {
                // Multiple emails - show selection UI
                showEmailList(threadEmails);
                showStatus(`${threadEmails.length} emails found in thread. Please select one.`, 'info');
            } else {
                showStatus('No emails found in thread', 'error');
            }
        } else {
            showStatus(`Error detecting thread: ${response?.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Error detecting email:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
    
    detectEmailBtn.disabled = false;
}

// Show email list for selection
function showEmailList(emails) {
    emailItems.innerHTML = '';
    
    emails.forEach((email, index) => {
        const emailItem = document.createElement('div');
        emailItem.className = 'email-item';
        emailItem.dataset.index = index;
        
        emailItem.innerHTML = `
            <input type="radio" name="emailSelect" class="email-checkbox" ${index === 0 ? 'checked' : ''}>
            <div class="email-details">
                <div class="email-sender">${email.sender} ${email.attachmentCount > 0 ? `(${email.attachmentCount} attachments)` : ''}</div>
                <div class="email-date">${email.date}</div>
                <div class="email-preview">${email.bodyPreview}</div>
            </div>
        `;
        
        emailItem.addEventListener('click', () => selectEmail(index));
        emailItems.appendChild(emailItem);
    });
    
    emailList.classList.remove('hidden');
    emailInfo.classList.add('hidden');
    
    // Select first email by default
    selectEmail(0);
}

// Hide email list
function hideEmailList() {
    emailList.classList.add('hidden');
    emailInfo.classList.remove('hidden');
}

// Select email from list
async function selectEmail(index) {
    selectedEmailIndex = index;
    
    // Update UI
    document.querySelectorAll('.email-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('selected');
            item.querySelector('input[type="radio"]').checked = true;
        } else {
            item.classList.remove('selected');
            item.querySelector('input[type="radio"]').checked = false;
        }
    });
    
    // Get selected email data
    currentEmailData = await getSelectedEmailData(index);
    showStatus(`Selected email: ${currentEmailData.sender}`, 'success');
    enableButtons();
}

// Get selected email data
async function getSelectedEmailData(index) {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, { 
            action: 'getSelectedEmailData', 
            selectedIndex: index 
        });
        
        if (response && response.success) {
            return response;
        } else {
            throw new Error(response?.error || 'Failed to get email data');
        }
    } catch (error) {
        console.error('Error getting selected email data:', error);
        throw error;
    }
}

// Show email info
function showEmailInfo(emailData) {
    emailSubject.textContent = emailData.subject;
    emailSender.textContent = emailData.sender;
    emailDate.textContent = emailData.date;
    emailAttachments.textContent = `${emailData.attachments ? emailData.attachments.length : 0} attachment(s)`;
}

// Enable/disable buttons
function enableButtons() {
    exportEmailBtn.disabled = false;
    exportAttachmentsBtn.disabled = !currentEmailData.attachments || currentEmailData.attachments.length === 0;
    exportAllBtn.disabled = false;
}

// Update the exportEmail function to show progress notifications
async function exportEmail() {
    if (!currentEmailData) {
        showStatus('Please detect an email first', 'error');
        return;
    }
    
    exportEmailBtn.disabled = true;
    showStatus('Generating PDF...', 'info');
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'generatePDF',
            data: currentEmailData
        });
        
        if (response.success) {
            showStatus(`PDF exported successfully: ${response.filename}`, 'success');
            
            // Show folder notification after successful export
            setTimeout(async () => {
                await checkFolderStatus();
                if (isFolderSelected) {
                    showStatus(`Using folder: ${selectedFolder}`, 'info');
                }
            }, 2000);
        } else {
            showStatus(`PDF export failed: ${response?.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Error exporting PDF:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
    
    exportEmailBtn.disabled = false;
}

// Update the exportAttachments function with better debugging
async function exportAttachments() {
    if (!currentEmailData) {
        showStatus('Please detect an email first', 'error');
        return;
    }
    
    if (!currentEmailData.attachments || currentEmailData.attachments.length === 0) {
        showStatus('No attachments found in selected email', 'info');
        return;
    }
    
    console.log('Starting attachment download for:', currentEmailData.attachments);
    
    exportAttachmentsBtn.disabled = true;
    showStatus('Downloading attachments...', 'info');
    
    try {
        // First authenticate to ensure we have a token
        console.log('Authenticating...');
        const authResult = await authenticate();
        if (!authResult.success) {
            showStatus(`Authentication failed: ${authResult.error}`, 'error');
            exportAttachmentsBtn.disabled = false;
            return;
        }
        
        console.log('Authentication successful, starting download...');
        
        // Try direct download through content script
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('Sending message to content script...');
        
        const directResponse = await chrome.tabs.sendMessage(tab.id, {
            action: 'downloadAttachmentsDirectly',
            attachments: currentEmailData.attachments
        });
        
        console.log('Content script response:', directResponse);
        
        if (directResponse.success) {
            showStatus(`Downloaded ${currentEmailData.attachments.length} attachments successfully`, 'success');
            
            // Show folder notification after successful download
            setTimeout(async () => {
                await checkFolderStatus();
                if (isFolderSelected) {
                    showStatus(`Using folder: ${selectedFolder}`, 'info');
                }
            }, 2000);
        } else {
            showStatus(`Download failed: ${directResponse?.error || 'Unknown error'}`, 'error');
        }
        
    } catch (error) {
        console.error('Error downloading attachments:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
    
    exportAttachmentsBtn.disabled = false;
}

// Update the exportAll function to show progress notifications
async function exportAll() {
    if (!currentEmailData) {
        showStatus('Please detect an email first', 'error');
        return;
    }
    
    exportAllBtn.disabled = true;
    showStatus('Exporting all...', 'info');
    
    try {
        // Export PDF first
        await exportEmail();
        
        // Then download attachments if any
        if (currentEmailData.attachments && currentEmailData.attachments.length > 0) {
            await exportAttachments();
        }
        
        showStatus('All exports completed successfully', 'success');
        
        // Show final folder notification
        setTimeout(async () => {
            await checkFolderStatus();
            if (isFolderSelected) {
                showStatus(`Using folder: ${selectedFolder}`, 'info');
            }
        }, 3000);
    } catch (error) {
        console.error('Error exporting all:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
    
    exportAllBtn.disabled = false;
}

// Authentication function
async function authenticate() {
    try {
        const token = await chrome.identity.getAuthToken({ interactive: true });
        if (token) {
            // Send token to background script
            await chrome.runtime.sendMessage({
                action: 'setToken',
                token: token
            });
            return { success: true };
        } else {
            return { success: false, error: 'No token received' };
        }
    } catch (error) {
        console.error('Authentication error:', error);
        return { success: false, error: error.message };
    }
}

// Show status message
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');
    
    // Auto-hide after 5 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 5000);
    }
}