// Erado Gmail Export - Popup Script
console.log('Erado Gmail Export popup script loaded');

// State
let currentEmailData = null;
let selectedFolderHandle = null;

// DOM elements - will be initialized after DOM loads
let detectEmailBtn, exportEmailBtn, exportAttachmentsBtn, exportAllBtn, statusDiv, emailInfoDiv, loadingDiv;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup initialized');
    
    // Initialize DOM elements AFTER DOM is loaded
    detectEmailBtn = document.getElementById('detectEmail');
    exportEmailBtn = document.getElementById('exportEmail');
    exportAttachmentsBtn = document.getElementById('exportAttachments');
    exportAllBtn = document.getElementById('exportAll');
    statusDiv = document.getElementById('status');
    emailInfoDiv = document.getElementById('emailInfo');
    loadingDiv = document.getElementById('loading');
    
    // Check if elements were found
    if (!detectEmailBtn || !exportEmailBtn || !exportAttachmentsBtn || !exportAllBtn) {
        console.error('Could not find required DOM elements');
        return;
    }
    
    console.log('DOM elements found:', {
        detectEmail: !!detectEmailBtn,
        exportEmail: !!exportEmailBtn,
        exportAttachments: !!exportAttachmentsBtn,
        exportAll: !!exportAllBtn
    });
    
    updateUI();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Detect email button
    detectEmailBtn.addEventListener('click', async () => {
        detectEmailBtn.disabled = true;
        showLoading(true);
        showStatus('Detecting email...', 'info');
        
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('mail.google.com')) {
                showStatus('Please open Gmail first', 'error');
                showLoading(false);
                detectEmailBtn.disabled = false;
                return;
            }
            
            // Send message to content script
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'getOpenEmail'
            });
            
            if (response.success) {
                currentEmailData = response;
                updateUI();
                showStatus('Email detected successfully!', 'success');
            } else {
                showStatus(`Error detecting email: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error detecting email:', error);
            showStatus('Error detecting email', 'error');
        }
        
        showLoading(false);
        detectEmailBtn.disabled = false;
    });

    // Export email as PDF
    exportEmailBtn.addEventListener('click', async () => {
        if (!currentEmailData) {
            showStatus('Please detect an email first', 'error');
            return;
        }
        
        // Disable button immediately to prevent multiple clicks
        exportEmailBtn.disabled = true;
        showLoading(true);
        showStatus('Exporting email as PDF...', 'info');
        
        try {
            // Select folder first
            const folderSelected = await selectFolder();
            if (!folderSelected) {
                showLoading(false);
                exportEmailBtn.disabled = false;
                return;
            }
            
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('mail.google.com')) {
                showStatus('Please open Gmail first', 'error');
                showLoading(false);
                exportEmailBtn.disabled = false;
                return;
            }
            
            console.log('Sending PDF generation request to content script');
            
            // Send message to content script WITHOUT folderHandle
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'generatePDF',
                data: currentEmailData
                // Removed: folderHandle: selectedFolderHandle
            });
            
            console.log('PDF generation response:', response);
            
            if (response.success) {
                showStatus('PDF exported to selected folder!', 'success');
            } else {
                showStatus(`Export failed: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error exporting email:', error);
            showStatus('Error exporting email', 'error');
        }
        
        showLoading(false);
        exportEmailBtn.disabled = false;
    });

    // Export attachments
    exportAttachmentsBtn.addEventListener('click', async () => {
        if (!currentEmailData) {
            showStatus('Please detect an email first', 'error');
            return;
        }
        
        // Disable button immediately to prevent multiple clicks
        exportAttachmentsBtn.disabled = true;
        showLoading(true);
        showStatus('Downloading attachments...', 'info');
        
        try {
            // Select folder first
            const folderSelected = await selectFolder();
            if (!folderSelected) {
                showLoading(false);
                exportAttachmentsBtn.disabled = false;
                return;
            }
            
            // Authenticate first - FIXED TOKEN HANDLING
            console.log('Getting authentication token...');
            const _token = await chrome.identity.getAuthToken({ interactive: true });
            const token = _token.token;
            console.log('Token received:', token ? 'success' : 'failed');
            console.log('Token type:', typeof token);
            console.log('Token length:', token ? token.length : 'undefined');
            
            if (!token) {
                showStatus('Authentication failed', 'error');
                showLoading(false);
                exportAttachmentsBtn.disabled = false;
                return;
            }
            
            // Send token to background script - FIXED
            console.log('Sending token to background script...');
            const tokenResponse = await chrome.runtime.sendMessage({
                action: 'setToken',
                token: token
            });
            console.log('Token response:', tokenResponse);
            
            // Send message to background script WITHOUT folderHandle
            console.log('Sending download request to background script...');
            const response = await chrome.runtime.sendMessage({
                action: 'downloadAttachments',
                emailData: currentEmailData
                // Removed: folderHandle: selectedFolderHandle
            });
            
            console.log('Download response:', response);
            
            if (response.success) {
                showStatus(response.message, 'success');
            } else {
                showStatus(`Download failed: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error downloading attachments:', error);
            showStatus('Error downloading attachments', 'error');
        }
        
        showLoading(false);
        exportAttachmentsBtn.disabled = false;
    });

    // Export all (email + attachments)
    exportAllBtn.addEventListener('click', async () => {
        if (!currentEmailData) {
            showStatus('Please detect an email first', 'error');
            return;
        }
        
        // Disable button immediately to prevent multiple clicks
        exportAllBtn.disabled = true;
        showLoading(true);
        showStatus('Exporting all...', 'info');
        
        try {
            // Select folder first
            const folderSelected = await selectFolder();
            if (!folderSelected) {
                showLoading(false);
                exportAllBtn.disabled = false;
                return;
            }
            
            // Export email first
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const pdfResponse = await chrome.tabs.sendMessage(tab.id, {
                action: 'generatePDF',
                data: currentEmailData
                // Removed: folderHandle: selectedFolderHandle
            });
            
            if (!pdfResponse.success) {
                showStatus(`PDF export failed: ${pdfResponse.error}`, 'error');
                showLoading(false);
                exportAllBtn.disabled = false;
                return;
            }
            
            // Then download attachments if any
            if (currentEmailData.attachments && currentEmailData.attachments.length > 0) {
                // Authenticate first - FIXED TOKEN HANDLING
                console.log('Getting authentication token...');
                const _token = await chrome.identity.getAuthToken({ interactive: true });
                const token = _token.token;
                console.log('Token received:', token ? 'success' : 'failed');
                
                if (!token) {
                    showStatus('Authentication failed', 'error');
                    showLoading(false);
                    exportAllBtn.disabled = false;
                    return;
                }
                
                // Send token to background script - FIXED
                console.log('Sending token to background script...');
                const tokenResponse = await chrome.runtime.sendMessage({
                    action: 'setToken',
                    token: token
                });
                console.log('Token response:', tokenResponse);
                
                // Send message to background script WITHOUT folderHandle
                console.log('Sending download request to background script...');
                const attachmentResponse = await chrome.runtime.sendMessage({
                    action: 'downloadAttachments',
                    emailData: currentEmailData
                    // Removed: folderHandle: selectedFolderHandle
                });
                
                console.log('Download response:', attachmentResponse);
                
                if (!attachmentResponse.success) {
                    showStatus(`Attachment download failed: ${attachmentResponse.error}`, 'error');
                    showLoading(false);
                    exportAllBtn.disabled = false;
                    return;
                }
            }
            
            showStatus('All exports completed successfully!', 'success');
        } catch (error) {
            console.error('Error exporting all:', error);
            showStatus('Error exporting all', 'error');
        }
        
        showLoading(false);
        exportAllBtn.disabled = false;
    });
}

// Update UI based on current state
function updateUI() {
    const hasEmail = currentEmailData !== null;
    const hasAttachments = hasEmail && currentEmailData.attachments && currentEmailData.attachments.length > 0;
    
    detectEmailBtn.disabled = false;
    exportEmailBtn.disabled = !hasEmail;
    exportAttachmentsBtn.disabled = !hasAttachments;
    exportAllBtn.disabled = !hasEmail;
    
    if (hasEmail) {
        updateEmailInfo(currentEmailData);
    } else {
        emailInfoDiv.style.display = 'none';
    }
}

// Update email info display
function updateEmailInfo(emailData) {
    const attachmentsHtml = emailData.attachments && emailData.attachments.length > 0 
        ? emailData.attachments.map(att => 
            `<div class="attachment-item">
                <strong>${att.name}</strong><br>
                <small>${att.size} - ${att.type}</small>
            </div>`
          ).join('')
        : '<p>No attachments</p>';
    
    emailInfoDiv.innerHTML = `
        <h3>Current Email</h3>
        <p><strong>Subject:</strong> ${emailData.subject}</p>
        <p><strong>From:</strong> ${emailData.sender}</p>
        <p><strong>Date:</strong> ${emailData.date}</p>
        <div class="attachments">
            <strong>Attachments (${emailData.attachments ? emailData.attachments.length : 0}):</strong>
            ${attachmentsHtml}
        </div>
    `;
    emailInfoDiv.style.display = 'block';
}

// Show status message
function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 5000);
}

// Show/hide loading
function showLoading(show) {
    loadingDiv.style.display = show ? 'block' : 'none';
}

// Select folder function
async function selectFolder() {
    try {
        showStatus('Please select a folder...', 'info');
        
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Send message to content script to open folder picker
        const response = await chrome.tabs.sendMessage(tab.id, {
            action: 'selectFolder'
        });
        
        if (response.success) {
            // Don't store the folderHandle here anymore - it's stored in content script
            showStatus(`Folder selected: ${response.folderName}`, 'success');
            return true;
        } else {
            showStatus('No folder selected', 'error');
            return false;
        }
    } catch (error) {
        console.error('Error selecting folder:', error);
        showStatus('Error selecting folder', 'error');
        return false;
    }
}
  