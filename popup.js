// Erado Gmail Export - Popup Script
console.log('Erado Gmail Export popup script loaded');

// State
let currentEmailData = null;
let threadEmails = [];
let selectedEmailIndex = 0;

// DOM elements - will be initialized after DOM loads
let detectEmailBtn, exportEmailBtn, exportAttachmentsBtn, exportAllBtn, statusDiv, emailInfoDiv, emailListDiv, emailItemsDiv;

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
    emailListDiv = document.getElementById('emailList');
    emailItemsDiv = document.getElementById('emailItems');
    
    // Check if elements were found
    if (!detectEmailBtn || !exportEmailBtn || !exportAttachmentsBtn || !exportAllBtn) {
        console.error('Could not find required DOM elements');
        return;
    }
    
    console.log('DOM elements found:', {
        detectEmail: !!detectEmailBtn,
        exportEmail: !!exportEmailBtn,
        exportAttachments: !!exportAttachmentsBtn,
        exportAll: !!exportAllBtn,
        emailList: !!emailListDiv,
        emailItems: !!emailItemsDiv
    });
    
    updateUI();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Detect email and thread button
    detectEmailBtn.addEventListener('click', async () => {
        detectEmailBtn.disabled = true;
        showStatus('Detecting email and thread...', 'info');
        
        try {
            // Get the active tab
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
    });

    // Export email as PDF
    exportEmailBtn.addEventListener('click', async () => {
        if (!currentEmailData) {
            showStatus('Please detect an email first', 'error');
            return;
        }
        
        exportEmailBtn.disabled = true;
        showStatus('Selecting folder for PDF export...', 'info');
        
        try {
            // Select folder first
            const folderSelected = await selectFolder();
            if (!folderSelected) {
                exportEmailBtn.disabled = false;
                return;
            }
            
            showStatus('Generating PDF...', 'info');
            
            // Get the active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            // Generate PDF
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
    });

    // Export attachments
    exportAttachmentsBtn.addEventListener('click', async () => {
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
            const authResponse = await chrome.runtime.sendMessage({ action: 'authenticate' });
            if (!authResponse || !authResponse.success) {
                showStatus(`Authentication failed: ${authResponse?.error || 'Unknown error'}`, 'error');
                exportAttachmentsBtn.disabled = false;
                return;
            }
            
            showStatus('Selecting folder for attachments...', 'info');
            
            // Select folder
            const folderSelected = await selectFolder();
            if (!folderSelected) {
                exportAttachmentsBtn.disabled = false;
                return;
            }
            
            showStatus('Downloading attachments...', 'info');
            
            // Download attachments
            const downloadResponse = await chrome.runtime.sendMessage({
                action: 'downloadAttachments',
                emailData: currentEmailData
            });
            
            if (downloadResponse && downloadResponse.success) {
                showStatus(`Downloaded ${currentEmailData.attachments.length} attachment(s)`, 'success');
            } else {
                showStatus(`Download failed: ${downloadResponse?.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('Error downloading attachments:', error);
            showStatus(`Error: ${error.message}`, 'error');
        }
        
        exportAttachmentsBtn.disabled = false;
    });

    // Export all
    exportAllBtn.addEventListener('click', async () => {
        if (!currentEmailData) {
            showStatus('Please detect an email first', 'error');
            return;
        }
        
        exportAllBtn.disabled = true;
        showStatus('Selecting folder for export...', 'info');
        
        try {
            // Select folder first
            const folderSelected = await selectFolder();
            if (!folderSelected) {
                exportAllBtn.disabled = false;
                return;
            }
            
            showStatus('Exporting email as PDF...', 'info');
            
            // Export email first
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const pdfResponse = await chrome.tabs.sendMessage(tab.id, {
                action: 'generatePDF',
                data: currentEmailData
            });
            
            if (!pdfResponse.success) {
                showStatus(`PDF export failed: ${pdfResponse.error}`, 'error');
                exportAllBtn.disabled = false;
                return;
            }
            
            showStatus('PDF exported. Now downloading attachments...', 'success');
            
            // Then download attachments if any
            if (currentEmailData.attachments && currentEmailData.attachments.length > 0) {
                const authResponse = await chrome.runtime.sendMessage({ action: 'authenticate' });
                if (authResponse && authResponse.success) {
                    const downloadResponse = await chrome.runtime.sendMessage({
                        action: 'downloadAttachments',
                        emailData: currentEmailData
                    });
                    
                    if (downloadResponse && downloadResponse.success) {
                        showStatus(`Export complete! PDF + ${currentEmailData.attachments.length} attachment(s)`, 'success');
                    } else {
                        showStatus(`PDF exported, but attachment download failed: ${downloadResponse?.error}`, 'error');
                    }
                } else {
                    showStatus(`PDF exported, but authentication failed for attachments: ${authResponse?.error}`, 'error');
                }
            } else {
                showStatus('Export complete! PDF exported (no attachments)', 'success');
            }
        } catch (error) {
            console.error('Error exporting all:', error);
            showStatus(`Error: ${error.message}`, 'error');
        }
        
        exportAllBtn.disabled = false;
    });
}

// Show email list for selection
function showEmailList(emails) {
    emailItemsDiv.innerHTML = '';
    
    emails.forEach((email, index) => {
        const emailItem = document.createElement('div');
        emailItem.className = 'email-item';
        emailItem.dataset.index = index;
        
        emailItem.innerHTML = `
            <input type="radio" name="emailSelect" class="email-checkbox" ${index === 0 ? 'checked' : ''}>
            <div class="email-details">
                <div class="email-sender">${email.sender}</div>
                <div class="email-date">${email.date}</div>
                <div class="email-preview">${email.bodyPreview}</div>
            </div>
        `;
        
        emailItem.addEventListener('click', () => selectEmail(index));
        emailItemsDiv.appendChild(emailItem);
    });
    
    emailListDiv.classList.remove('hidden');
    emailInfoDiv.classList.add('hidden');
    
    // Select first email by default
    selectEmail(0);
}

// Hide email list
function hideEmailList() {
    emailListDiv.classList.add('hidden');
    emailInfoDiv.classList.remove('hidden');
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
    document.getElementById('emailSubject').textContent = emailData.subject;
    document.getElementById('emailSender').textContent = emailData.sender;
    document.getElementById('emailDate').textContent = emailData.date;
    document.getElementById('emailAttachments').textContent = `${emailData.attachments.length} attachment(s)`;
}

// Enable/disable buttons
function enableButtons() {
    exportEmailBtn.disabled = false;
    exportAttachmentsBtn.disabled = false;
    exportAllBtn.disabled = false;
}

function disableButtons() {
    exportEmailBtn.disabled = true;
    exportAttachmentsBtn.disabled = true;
    exportAllBtn.disabled = true;
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
        showEmailInfo(currentEmailData);
    }
}

// Show status message
function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.classList.add('hidden');
        }, 3000);
    }
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
  