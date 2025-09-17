// Erado Gmail Export - Content Script
console.error('Erado Gmail Export content script loaded');

// Generate PDF using Chrome's native print functionality
let isGeneratingPDF = false; // Prevent multiple PDF generations
let currentFolderHandle = null; // Store the FileSystemDirectoryHandle here

async function generatePDFDirectly(emailData) {
    // Prevent multiple PDF generations
    if (isGeneratingPDF) {
        console.error('PDF generation already in progress, ignoring duplicate request');
        return { success: false, error: 'PDF generation already in progress' };
    }
    
    if (!currentFolderHandle) {
        console.error('No folder selected for PDF generation');
        return { success: false, error: 'No folder selected. Please select a folder first.' };
    }
    
    isGeneratingPDF = true;
    
    try {
        console.error("Generating PDF for:", emailData.subject);
        
        // Create HTML content for PDF
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${emailData.subject}</title>
    <style>
        @page {
            margin: 20mm;
            size: A4;
        }
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
        }
        .header {
            border-bottom: 3px solid #667eea;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .brand {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 10px;
            text-align: center;
        }
        .subject {
            font-size: 18px;
            font-weight: bold;
            color: #333;
            margin-bottom: 15px;
        }
        .meta {
            color: #666;
            font-size: 12px;
            margin-bottom: 10px;
        }
        .meta-row {
            margin-bottom: 5px;
        }
        .meta-label {
            font-weight: bold;
            display: inline-block;
            width: 60px;
        }
        .body {
            margin-top: 30px;
            font-size: 12px;
            line-height: 1.5;
            white-space: pre-wrap;
        }
        .attachments {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
        .attachment-item {
            background: #f5f5f5;
            padding: 8px;
            margin: 5px 0;
            border-radius: 4px;
            font-size: 11px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            font-size: 10px;
            color: #999;
            text-align: center;
        }
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="brand">ERADO GMAIL EXPORT</div>
        <div class="subject">${emailData.subject}</div>
        <div class="meta">
            <div class="meta-row">
                <span class="meta-label">From:</span> ${emailData.sender}
            </div>
            <div class="meta-row">
                <span class="meta-label">Date:</span> ${emailData.date}
            </div>
            <div class="meta-row">
                <span class="meta-label">URL:</span> ${emailData.url}
            </div>
        </div>
    </div>
    
    <div class="body">
        <strong>Email Content:</strong><br><br>
        ${emailData.body}
    </div>
    
    ${emailData.attachments && emailData.attachments.length > 0 ? `
    <div class="attachments">
        <strong>Attachments (${emailData.attachments.length}):</strong><br><br>
        ${emailData.attachments.map(att => `
            <div class="attachment-item">
                • ${att.name}${att.size ? ` (${att.size})` : ''}${att.type ? ` - ${att.type}` : ''}
            </div>
        `).join('')}
    </div>
    ` : ''}
    
    <div class="footer">
        Exported by Erado Gmail Export on ${new Date().toLocaleString()}
    </div>
</body>
</html>`;
        
        // Create blob from HTML content
        const blob = new Blob([htmlContent], { type: 'text/html' });
        
        // Save to user-selected folder using the stored handle
        const filename = `erado-export-${sanitizeFilename(emailData.subject)}.html`;
        const fileHandle = await currentFolderHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        console.error('PDF saved to user-selected folder:', filename);
        
        return { success: true, filename: filename };
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        return { error: error.message };
    } finally {
        // Reset the flag after a delay
        setTimeout(() => {
            isGeneratingPDF = false;
        }, 3000);
    }
}

// Select folder function
async function selectFolder() {
    try {
        console.error('Opening folder picker...');
        
        const folderHandle = await window.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents'
        });
        
        if (folderHandle) {
            currentFolderHandle = folderHandle; // Store the handle internally
            console.error('Folder selected:', currentFolderHandle.name);
            return { success: true, folderName: currentFolderHandle.name }; // Return name, not the handle itself
        } else {
            return { success: false, error: 'No folder selected' };
        }
    } catch (error) {
        console.error('Error selecting folder:', error);
        return { success: false, error: error.message };
    }
}

// Save attachment to user-selected folder
async function saveAttachmentToFolder(attachment, blob) {
    if (!currentFolderHandle) {
        console.error('No folder selected for attachment saving');
        return { success: false, error: 'No folder selected. Please select a folder first.' };
    }

    try {
        console.error('Saving attachment to user-selected folder:', attachment.filename);
        
        // Save file to selected folder
        const filename = `erado-${sanitizeFilename(attachment.filename)}`;
        const fileHandle = await currentFolderHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        console.error('Attachment saved successfully:', filename);
        return { success: true, filename: filename };
        
    } catch (error) {
        console.error('Error saving attachment:', error);
        return { success: false, error: error.message };
    }
}

// Get open email data - SIMPLIFIED VERSION
function getOpenEmail() {
    try {
        console.error('Detecting email...');
        
        // Extract subject
        const subjectSelectors = [
            'h2[data-thread-perm-id]',
            '.hP',
            '.thread-subject',
            '[data-thread-id] h2',
            '.mail-subject'
        ];
        
        let subject = 'No Subject';
        for (const selector of subjectSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                subject = element.textContent?.trim() || 'No Subject';
                break;
            }
        }
        
        // Extract sender - SIMPLE AND RELIABLE APPROACH
        let sender = 'Unknown Sender';
        
        console.error('Starting sender detection...');

        if (sender === 'Unknown Sender') {
            const senderSelectors = [
                '.yW span[email]',
                '.yW .email',
                '.gD .g2 span[email]',
                '.gD .g2 .email',
                '.sender-name',
                '.from-name'
            ];
            
            for (const selector of senderSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const email = element.getAttribute('email') || element.textContent?.trim();
                    if (email && email.includes('@') && email !== 'Unknown Sender') {
                        sender = email;
                        console.error('Found sender via selector:', selector, sender);
                        // break;
                    }
                }
            }
        }
        
        console.error('Final sender detected:', sender);
        
        // Extract date - SIMPLE AND RELIABLE APPROACH
        const dateSelectors = [
            '.g2 .gK',
            '.date',
            '.received-date',
            '.gD .gK',
            '.yW .gK'
        ];
        
        let date = 'Unknown Date';
        for (const selector of dateSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const dateText = element.textContent?.trim();
                if (dateText && dateText !== 'Unknown Date' && dateText.length > 0) {
                    date = dateText;
                    console.error('Found date via selector:', selector, date);
                    break;
                }
            }
        }
        
        // If still no date, try to find any date-like text
        if (date === 'Unknown Date') {
            const pageText = document.body.textContent;
            const dateRegex = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}/g;
            const dates = pageText.match(dateRegex);
            if (dates && dates.length > 0) {
                date = dates[0];
                console.error('Found date via regex:', date);
            }
        }
        
        console.error('Final date detected:', date);
        
        // Extract body
        const bodySelectors = [
            '.a3s',
            '.email-body',
            '.message-body',
            '.mail-message'
        ];
        
        let body = 'No content found';
        for (const selector of bodySelectors) {
            const element = document.querySelector(selector);
            if (element) {
                body = element.textContent?.trim() || 'No content found';
                break;
            }
        }
        
        // Extract attachments - SIMPLIFIED VERSION
        const attachmentElements = document.querySelectorAll('.aZo, .attachment, .file-attachment, [data-attachment-id]');
        const attachments = Array.from(attachmentElements).map(el => {
            // Try to get clean filename from specific selectors
            let name = 'Unknown Attachment';
            let size = 'Unknown Size';
            let type = 'Unknown Type';
            
            // Try different selectors for filename
            const nameSelectors = [
                '.aZo-name',           // Gmail attachment name
                '.attachment-name',    // Generic attachment name
                '[data-attachment-name]', // Data attribute
                '.filename',            // Generic filename
                'span[title]'           // Title attribute
            ];
            
            for (const selector of nameSelectors) {
                const nameEl = el.querySelector(selector);
                if (nameEl) {
                    const text = nameEl.textContent?.trim() || nameEl.getAttribute('title') || '';
                    if (text && text.length < 100) { // Avoid very long concatenated text
                        name = text;
                        break;
                    }
                }
            }
            
            // If still no good name, try to extract from the element's text content
            if (name === 'Unknown Attachment') {
                const fullText = el.textContent?.trim() || '';
                // Look for common file extensions to extract filename
                const fileMatch = fullText.match(/([a-zA-Z0-9_\-\.\s]+\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|jpg|jpeg|png|gif|zip|rar|mp4|mp3|avi|mov))\s/i);
                if (fileMatch) {
                    name = fileMatch[1].trim();
                } else if (fullText.length < 50) {
                    // If text is short, use it as filename
                    name = fullText;
                }
            }
            
            // Try different selectors for size
            const sizeSelectors = [
                '.aZo-size',           // Gmail attachment size
                '.attachment-size',     // Generic attachment size
                '[data-attachment-size]' // Data attribute
            ];
            
            for (const selector of sizeSelectors) {
                const sizeEl = el.querySelector(selector);
                if (sizeEl) {
                    const sizeText = sizeEl.textContent?.trim();
                    if (sizeText && sizeText.match(/\d+.*[KMG]?B/i)) {
                        size = sizeText;
                        break;
                    }
                }
            }
            
            // Try different selectors for type
            const typeSelectors = [
                '.aZo-type',           // Gmail attachment type
                '.attachment-type',     // Generic attachment type
                '[data-attachment-type]' // Data attribute
            ];
            
            for (const selector of typeSelectors) {
                const typeEl = el.querySelector(selector);
                if (typeEl) {
                    const typeText = typeEl.textContent?.trim();
                    if (typeText && typeText.length < 20) {
                        type = typeText;
                        break;
                    }
                }
            }
            
            return { name, size, type };
        });
        
        console.error("Email detected:", { subject, sender, date, attachments: attachments.length });
        
        return {
            success: true,
            subject,
            sender,
            date,
            body,
            attachments,
            url: window.location.href
        };
        
    } catch (error) {
        console.error('Error detecting email:', error);
        return { success: false, error: error.message };
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.error("Content script received message:", message.action);
    
    if (message.action === 'getOpenEmail' || message.action === 'getEmail') {
        const result = getOpenEmail();
        sendResponse(result);
    } else if (message.action === 'generatePDF' || message.action === 'generatePDFFromContent') {
        generatePDFDirectly(message.data) // Don't pass folderHandle here
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Keep message channel open
    } else if (message.action === 'selectFolder') {
        selectFolder()
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Keep message channel open
    } else if (message.action === 'saveAttachmentToFolder') {
        saveAttachmentToFolder(message.attachment, message.blob) // Don't pass folderHandle here
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Keep message channel open
    }
});

// Utility function to sanitize filename
function sanitizeFilename(filename) {
    return filename
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 50);
}
