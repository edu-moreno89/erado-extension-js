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
        console.log('Detecting email...');
        
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
                console.log('Found subject:', subject);
                break;
            }
        }
        
        // Extract sender - FIXED VERSION with better Gmail selectors
        let sender = 'Unknown Sender';
        
        console.log('Starting sender detection...');
        
        // Method 1: Look for sender in Gmail's email header area
        const senderSelectors = [
            '.gD .g2 span[email]',           // Gmail sender email attribute
            '.gD .g2 .email',                // Gmail sender email class
            '.gD .g2',                       // Gmail sender container
            '.gD span[email]',               // Gmail sender span
            '.gD .email',                    // Gmail sender email
            '.gD'                            // Gmail sender area
        ];
        
        for (const selector of senderSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                // Try to get email from attribute first
                let email = element.getAttribute('email');
                
                // If no email attribute, try text content
                if (!email) {
                    const text = element.textContent?.trim();
                    if (text && text.includes('@') && !text.includes('noreply') && !text.includes('no-reply')) {
                        email = text;
                    }
                }
                
                if (email && email.includes('@') && email !== 'Unknown Sender') {
                    sender = email;
                    console.log('Found sender via selector:', selector, sender);
                    break;
                }
            }
        }
        
        // Method 2: If still no sender, look for email patterns in the page
        if (sender === 'Unknown Sender') {
            console.log('No sender found via selectors, trying email pattern search...');
            const pageText = document.body.textContent;
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const emails = pageText.match(emailRegex);
            
            if (emails && emails.length > 0) {
                // Filter out system emails
                const filteredEmails = emails.filter(email => 
                    !email.includes('noreply') && 
                    !email.includes('no-reply') && 
                    !email.includes('mail.google.com') &&
                    !email.includes('gmail.com') &&
                    !email.includes('google.com') &&
                    !email.includes('freelancer.com') &&
                    email.length < 50
                );
                
                if (filteredEmails.length > 0) {
                    sender = filteredEmails[0];
                    console.log('Found sender via email regex:', sender);
                }
            }
        }
        
        console.log('Final sender detected:', sender);
        
        // Extract date - FIXED VERSION with better Gmail selectors
        let date = 'Unknown Date';
        
        console.log('Starting date detection...');
        
        // Method 1: Look for date in Gmail's email header area
        const dateSelectors = [
            '.gH .gK .g3',                   // Gmail thread date (most specific)
            '.gH .gK .g4',                   // Gmail thread date alternative
            '.h5 .gK .g3',                   // Gmail expanded email date
            '.h5 .gK .g4',                   // Gmail expanded email date alternative
            '.gH .gK',                       // Gmail date container
            '.h5 .gK',                       // Gmail date container alternative
            '.g2 .gK',                       // Gmail date (fallback)
            '.yW .gK'                        // Gmail date (fallback)
        ];
        
        for (const selector of dateSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                const dateText = element.textContent.trim();
                
                // Validate that it looks like a date, not sender info
                if (dateText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}:\d{2}\s*(AM|PM)|Yesterday|Today|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i)) {
                    date = dateText;
                    console.log('Found date via selector:', selector, date);
                    break;
                } else {
                    console.log(`Skipping "${dateText}" from selector "${selector}" - doesn't look like a date`);
                }
            }
        }
        
        // Method 2: If still no date, try to find any date-like text in the page
        if (date === 'Unknown Date') {
            console.log('No date found via selectors, trying date pattern search...');
            const pageText = document.body.textContent;
            const dateRegex = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}|(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{1,2}:\d{2}\s*(AM|PM)/g;
            const dates = pageText.match(dateRegex);
            if (dates && dates.length > 0) {
                date = dates[0];
                console.log('Found date via regex:', date);
            }
        }
        
        console.log('Final date detected:', date);
        
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
        
        // Extract attachments - IMPROVED VERSION
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
            
            return { name, size, type };
        });
        
        console.log("Email detected:", { subject, sender, date, attachments: attachments.length });
        
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

// Add this function after getOpenEmail() function

function getAllEmailsInThread() {
    try {
        console.log('Detecting all emails in conversation thread...');
        
        // Use only .adn selector for Gmail email elements
        const emailElements = document.querySelectorAll('.adn');
        console.log(`Found ${emailElements.length} email elements with .adn selector`);
        
        if (emailElements.length === 0) {
            console.log('No .adn elements found in conversation thread');
            return {
                success: true,
                emails: [],
                totalCount: 0
            };
        }
        
        const validElements = Array.from(emailElements);
        
        console.log(`After filtering: ${validElements.length} valid email elements`);
        
        // Extract email data from each element
        const emails = validElements.map((element, index) => {
            return extractEmailFromElement(element, index);
        }).filter(email => email && email.sender !== 'Unknown Sender'); // Filter out invalid emails
        
        console.log(`Detected ${emails.length} emails in thread:`, emails.map(e => ({ 
            sender: e.sender, 
            date: e.date, 
            attachments: e.attachmentCount 
        })));
        
        return {
            success: true,
            emails: emails,
            totalCount: emails.length
        };
        
    } catch (error) {
        console.error('Error detecting thread emails:', error);
        return { success: false, error: error.message };
    }
}

// Helper function to extract email data from a specific element
function extractEmailFromElement(element, index) {
    try {
        console.log(`Extracting email data from .adn element ${index}:`, element.textContent?.substring(0, 100));
        
        // Extract sender from this specific .adn element
        let sender = 'Unknown Sender';
        let senderName = 'Unknown Name';
        
        // Use .gD selector for sender information
        const senderEl = element.querySelector('.gD');
        if (senderEl) {
            // Get sender's email
            const email = senderEl.getAttribute('email');
            if (email && email.includes('@') && !email.includes('noreply') && !email.includes('no-reply')) {
                sender = email;
                console.log(`Found sender email: ${sender}`);
            }
            
            // Get sender's full name
            const name = senderEl.getAttribute('name');
            if (name && name.trim()) {
                senderName = name.trim();
                console.log(`Found sender name: ${senderName}`);
            }
        }
        
        // Extract date from this specific .adn element
        let date = 'Unknown Date';
        
        // Use .gH .gK .g3 selector for formatted date
        const dateEl = element.querySelector('.gH .gK .g3');
        if (dateEl && dateEl.textContent.trim()) {
            date = dateEl.textContent.trim();
            console.log(`Found date: ${date}`);
        }
        
        // Extract subject (should be same for all emails in thread)
        let subject = 'No Subject';
        const subjectEl = document.querySelector('h2[data-thread-perm-id], .hP, .thread-subject');
        if (subjectEl) {
            subject = subjectEl.textContent?.trim() || 'No Subject';
        }
        
        // Extract body preview from this .adn element using .a3s
        let bodyPreview = 'No content';
        const bodyEl = element.querySelector('.a3s');
        if (bodyEl) {
            const bodyText = bodyEl.textContent?.trim();
            bodyPreview = bodyText ? bodyText.substring(0, 100) + '...' : 'No content';
            console.log(`Found body via .a3s:`, bodyText?.substring(0, 200));
        } else {
            // Fallback to element's text content
            const elementText = element.textContent?.trim() || '';
            if (elementText.length > 50) {
                bodyPreview = elementText.substring(0, 100) + '...';
            }
        }
        
        // Extract attachment count from this .adn element using .aZo
        const attachmentContainers = element.querySelectorAll('.aZo');
        const attachmentCount = attachmentContainers.length;
        
        console.log(`Email ${index} has ${attachmentCount} attachments`);
        
        // Extract attachment details for debugging
        if (attachmentCount > 0) {
            console.log(`Attachment details for email ${index}:`);
            attachmentContainers.forEach((container, attIndex) => {
                // Get download URL from .aZo element
                const downloadUrl = container.getAttribute('download_url');
                
                // Get filename from .aV3 element
                const filenameEl = container.querySelector('.aV3');
                const filename = filenameEl?.textContent?.trim();
                
                console.log(`  Attachment ${attIndex}:`, {
                    filename: filename,
                    downloadUrl: downloadUrl,
                    container: container.className
                });
            });
        }
        
        const emailData = {
            index: index,
            sender: sender,
            senderName: senderName,  // Add sender's full name
            date: date,
            subject: subject,
            bodyPreview: bodyPreview,
            attachmentCount: attachmentCount,
            element: element // Store reference to DOM element for later use
        };
        
        console.log(`Extracted email ${index}:`, emailData);
        return emailData;
        
    } catch (error) {
        console.error('Error extracting email from element:', error);
        return null;
    }
}

// Function to get selected email data
function getSelectedEmailData(selectedIndex) {
    try {
        console.log(`Getting data for selected email index: ${selectedIndex}`);
        
        const threadResult = getAllEmailsInThread();
        if (!threadResult.success || !threadResult.emails[selectedIndex]) {
            return { success: false, error: 'Selected email not found' };
        }
        
        const selectedEmail = threadResult.emails[selectedIndex];
        const element = selectedEmail.element;
        
        // Get full body content from .a3s element
        let body = 'No content found';
        const bodyEl = element.querySelector('.a3s');
        if (bodyEl) {
            body = bodyEl.textContent?.trim() || 'No content found';
            console.log(`Found full body via .a3s:`, body.substring(0, 200));
        }
        
        // Get attachments from this specific .adn element
        const attachmentContainers = element.querySelectorAll('.aZo');
        const attachments = Array.from(attachmentContainers).map((container, index) => {
            let name = 'Unknown Attachment';
            let downloadUrl = null;
            
            // Get filename from .aV3
            const filenameEl = container.querySelector('.aV3');
            if (filenameEl) {
                name = filenameEl.textContent?.trim() || 'Unknown Attachment';
            }
            
            // Get download URL from .aZo element
            downloadUrl = container.getAttribute('download_url');
            
            return { 
                name, 
                downloadUrl,
                container: container
            };
        });
        
        return {
            success: true,
            subject: selectedEmail.subject,
            sender: selectedEmail.sender,
            date: selectedEmail.date,
            body: body,
            attachments: attachments,
            url: window.location.href
        };
        
    } catch (error) {
        console.error('Error getting selected email data:', error);
        return { success: false, error: error.message };
    }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Content script received message:", message.action);
    
    switch (message.action) {
        case 'getOpenEmail':
            const result = getOpenEmail();
            sendResponse(result);
            break;
            
        case 'getAllEmailsInThread':
            const threadResult = getAllEmailsInThread();
            sendResponse(threadResult);
            break;
            
        case 'getSelectedEmailData':
            const selectedResult = getSelectedEmailData(message.selectedIndex);
            sendResponse(selectedResult);
            break;
            
        case 'generatePDF':
            generatePDFDirectly(message.data).then(result => {
                sendResponse(result);
            });
            return true; // Keep message channel open for async response
            
        case 'selectFolder':
            selectFolder().then(result => {
                sendResponse(result);
            });
            return true; // Keep message channel open for async response
            
        case 'saveAttachmentToFolder':
            saveAttachmentToFolder(message.attachment, message.blob).then(result => {
                sendResponse(result);
            });
            return true; // Keep message channel open for async response
            
        default:
            sendResponse({ error: 'Unknown action' });
    }
    
    return true; // Keep message channel open
});

// Utility function to sanitize filename
function sanitizeFilename(filename) {
    return filename
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 50);
}
