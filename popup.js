// Erado Gmail Export - Popup Script
console.log('Erado Gmail Export popup script loaded');

// State
let currentEmailData = null;
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

// Check if folder is already selected
async function checkFolderStatus() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getFolderStatus' });
        
        if (response && response.success && response.folderName) {
            selectedFolder = response.folderName;
            isFolderSelected = true;
            updateFolderButton();
        }
    } catch (error) {
        console.log('No folder selected yet, will use default Downloads folder');
    }
}

// Select folder
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
            showStatus(`Folder selected: ${response.folderName}`, 'success');
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

// Detect email
async function detectEmail() {
    detectEmailBtn.disabled = true;
    showStatus('Detecting email...', 'info');
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getOpenEmail' });
        
        if (response.success) {
            currentEmailData = response;
            updateEmailUI(response);
            showStatus('Email detected successfully', 'success');
        } else {
            showStatus(`Error: ${response.error}`, 'error');
        }
    } catch (error) {
        console.error('Error detecting email:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
    
    detectEmailBtn.disabled = false;
}

// Update email UI
function updateEmailUI(emailData) {
    emailSubject.textContent = emailData.subject;
    emailSender.textContent = emailData.sender;
    emailDate.textContent = emailData.date;
    emailAttachments.textContent = emailData.attachments ? emailData.attachments.length : 0;
    
    // Enable export buttons
    exportEmailBtn.disabled = false;
    exportAttachmentsBtn.disabled = !emailData.attachments || emailData.attachments.length === 0;
    exportAllBtn.disabled = false;
}

// Export email as PDF
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
        } else {
            showStatus(`PDF export failed: ${response?.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Error exporting PDF:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
    
    exportEmailBtn.disabled = false;
}

// Export attachments
async function exportAttachments() {
    if (!currentEmailData) {
        showStatus('Please detect an email first', 'error');
        return;
    }
    
    if (!currentEmailData.attachments || currentEmailData.attachments.length === 0) {
        showStatus('No attachments found in selected email', 'info');
        return;
    }
    
    exportAttachmentsBtn.disabled = true;
    showStatus('Authenticating...', 'info');
    
    try {
        // Authenticate first
        const authResult = await authenticate();
        if (!authResult.success) {
            showStatus(`Authentication failed: ${authResult.error}`, 'error');
            exportAttachmentsBtn.disabled = false;
            return;
        }
        
        showStatus('Downloading attachments...', 'info');
        
        // Download attachments
        const response = await chrome.runtime.sendMessage({
            action: 'downloadAttachments',
            emailData: currentEmailData
        });
        
        if (response.success) {
            showStatus(`Downloaded ${currentEmailData.attachments.length} attachments successfully`, 'success');
        } else {
            showStatus(`Download failed: ${response?.error || 'Unknown error'}`, 'error');
        }
    } catch (error) {
        console.error('Error downloading attachments:', error);
        showStatus(`Error: ${error.message}`, 'error');
    }
    
    exportAttachmentsBtn.disabled = false;
}

// Export all (PDF + attachments)
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