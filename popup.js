// Erado Gmail Export - Popup Script
document.addEventListener('DOMContentLoaded', function() {
    const statusDiv = document.getElementById('status');
    const emailInfoDiv = document.getElementById('emailInfo');
    const emailSubject = document.getElementById('emailSubject');
    const emailSender = document.getElementById('emailSender');
    const emailDate = document.getElementById('emailDate');
    const attachmentsDiv = document.getElementById('attachments');
    const attachmentList = document.getElementById('attachmentList');
    const detectBtn = document.getElementById('detectEmail');
    const exportEmailBtn = document.getElementById('exportEmail');
    const exportAttachmentsBtn = document.getElementById('exportAttachments');
    const exportAllBtn = document.getElementById('exportAll');
    const loadingDiv = document.getElementById('loading');
    
    let currentEmailData = null;
    
    // Show status message
    function showStatus(message, type = 'info') {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        statusDiv.style.display = 'block';
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }
    }
    
    // Show loading state
    function showLoading(show = true) {
        loadingDiv.style.display = show ? 'block' : 'none';
        [detectBtn, exportEmailBtn, exportAttachmentsBtn, exportAllBtn].forEach(btn => {
            btn.disabled = show;
        });
    }
    
    // Update email info display
    function updateEmailInfo(emailData) {
        if (emailData.error) {
            showStatus(`Error: ${emailData.error}`, 'error');
            emailInfoDiv.style.display = 'none';
            return;
        }
        
        currentEmailData = emailData;
        
        emailSubject.textContent = `Subject: ${emailData.subject}`;
        emailSender.textContent = `From: ${emailData.sender}`;
        emailDate.textContent = `Date: ${emailData.date}`;
        
        // Show attachments if any
        if (emailData.attachments && emailData.attachments.length > 0) {
            attachmentList.innerHTML = '';
            emailData.attachments.forEach(att => {
                const attDiv = document.createElement('div');
                attDiv.className = 'attachment-item';
                attDiv.textContent = `${att.name} (${att.size})`;
                attachmentList.appendChild(attDiv);
            });
            attachmentsDiv.style.display = 'block';
        } else {
            attachmentsDiv.style.display = 'none';
        }
        
        emailInfoDiv.style.display = 'block';
        exportEmailBtn.disabled = false;
        exportAttachmentsBtn.disabled = emailData.attachments.length === 0;
        exportAllBtn.disabled = false;
        
        showStatus('Email detected successfully!', 'success');
    }
    
    // Detect email button
    detectBtn.addEventListener('click', async () => {
        showLoading(true);
        showStatus('Detecting email...', 'info');
        
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab.url.includes('mail.google.com')) {
                showStatus('Please open Gmail first', 'error');
                showLoading(false);
                return;
            }
            
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getEmail' });
            
            if (response) {
                updateEmailInfo(response);
            } else {
                showStatus('No email detected. Please open an email in Gmail.', 'error');
            }
        } catch (error) {
            console.error('Error detecting email:', error);
            showStatus('Error detecting email. Please refresh the page and try again.', 'error');
        }
        
        showLoading(false);
    });
    
    // Export email as PDF
    exportEmailBtn.addEventListener('click', async () => {
        if (!currentEmailData) {
            showStatus('Please detect an email first', 'error');
            return;
        }
        
        showLoading(true);
        showStatus('Exporting email as PDF...', 'info');
        
        try {
            // Send to background script for processing
            const response = await chrome.runtime.sendMessage({
                action: 'exportEmailPDF',
                emailData: currentEmailData
            });
            
            if (response.success) {
                showStatus('Email exported successfully!', 'success');
            } else {
                showStatus(`Export failed: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error exporting email:', error);
            showStatus('Error exporting email', 'error');
        }
        
        showLoading(false);
    });
    
    // Export attachments
    exportAttachmentsBtn.addEventListener('click', async () => {
        if (!currentEmailData || !currentEmailData.attachments.length) {
            showStatus('No attachments to download', 'error');
            return;
        }
        
        showLoading(true);
        showStatus('Downloading attachments...', 'info');
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'downloadAttachments',
                emailData: currentEmailData
            });
            
            if (response.success) {
                showStatus('Attachments downloaded successfully!', 'success');
            } else {
                showStatus(`Download failed: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error downloading attachments:', error);
            showStatus('Error downloading attachments', 'error');
        }
        
        showLoading(false);
    });
    
    // Export all (email + attachments)
    exportAllBtn.addEventListener('click', async () => {
        if (!currentEmailData) {
            showStatus('Please detect an email first', 'error');
            return;
        }
        
        showLoading(true);
        showStatus('Exporting email and attachments...', 'info');
        
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'exportAll',
                emailData: currentEmailData
            });
            
            if (response.success) {
                showStatus('Export completed successfully!', 'success');
            } else {
                showStatus(`Export failed: ${response.error}`, 'error');
            }
        } catch (error) {
            console.error('Error exporting all:', error);
            showStatus('Error exporting all', 'error');
        }
        
        showLoading(false);
    });
    
    // Auto-detect email on popup open
    detectBtn.click();
});
  