// Erado Gmail Export - Content Script
console.error('Erado Gmail Export content script loaded');

// Generate PDF using Chrome's native print functionality
let isGeneratingPDF = false; // Prevent multiple PDF generations
let currentFolderHandle = null; // Store the FileSystemDirectoryHandle here

// Replace the generatePDFDirectly function with jsPDF implementation
async function generatePDFDirectly(emailData) {
    // Prevent multiple PDF generations
    if (isGeneratingPDF) {
        console.error('PDF generation already in progress, ignoring duplicate request');
        return { success: false, error: 'PDF generation already in progress' };
    }
    
    // If no custom folder selected, show folder picker
    if (!currentFolderHandle) {
        console.log('No custom folder selected, showing folder picker...');
        const folderResult = await selectFolder();
        if (!folderResult.success) {
            return { success: false, error: 'No folder selected' };
        }
    }
    
    isGeneratingPDF = true;
    
    try {
        console.log("Generating PDF for:", emailData.subject);
        
        // Load jsPDF library dynamically
        await loadJsPDFLibrary();
        
        // Generate PDF using jsPDF
        const pdfBlob = await generatePDFWithJsPDF(emailData);
        
        // Generate filename with date and time (MM-DD-YYYY_HHMMSS_mmm)
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
        const day = String(now.getDate()).padStart(2, '0'); // DD
        const year = now.getFullYear(); // YYYY
        const hours = String(now.getHours()).padStart(2, '0'); // HH
        const minutes = String(now.getMinutes()).padStart(2, '0'); // MM
        const seconds = String(now.getSeconds()).padStart(2, '0'); // SS
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0'); // mmm
        
        const dateTimeStr = `${month}${day}${year}-${hours}${minutes}${seconds}${milliseconds}`;
        
        const filename = `erado-email-${sanitizeFilename(emailData.subject)}-${dateTimeStr}.pdf`;
        const fileHandle = await currentFolderHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(pdfBlob);
        await writable.close();
        
        console.log(`PDF saved: ${filename}`);
        return { success: true, filename: filename };
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        return { success: false, error: error.message };
    } finally {
        isGeneratingPDF = false;
    }
}

function loadJsPDFLibrary() {
    return new Promise((resolve) => {
        if (window.jspdf) {
            console.log('jsPDF library already loaded');
            resolve();
            return;
        }
        
        const checkJsPDF = () => {
            if (window.jspdf) {
                console.log('jsPDF library loaded successfully');
                resolve();
            } else {
                console.log('Waiting for jsPDF library to load...');
                setTimeout(checkJsPDF, 100);
            }
        };
        
        checkJsPDF();
    });
}

async function generatePDFWithJsPDF(emailData) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Set up PDF styling
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = 20;
    
    // Helper function to add text with word wrapping
    function addText(text, fontSize = 12, isBold = false, color = '#000000') {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setTextColor(color);
        
        const lines = doc.splitTextToSize(text, contentWidth);
        doc.text(lines, margin, yPosition);
        yPosition += lines.length * (fontSize * 0.4) + 5;
        
        // Check if we need a new page
        if (yPosition > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            yPosition = 20;
        }
    }
    
    // Add header
    addText('ERADO EMAIL EXPORT', 18, true, '#667eea');
    addText(`Generated on ${new Date().toLocaleString()}`, 10, false, '#666666');
    
    // Add separator line
    yPosition += 10;
    doc.setDrawColor(102, 126, 234);
    doc.setLineWidth(2);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;
    
    // Add email information
    addText('EMAIL INFORMATION', 14, true, '#333333');
    yPosition += 5;
    
    addText(`Subject: ${emailData.subject || 'No Subject'}`, 12, true);
    addText(`From: ${emailData.sender || 'Unknown Sender'}`, 12, true);
    addText(`Date: ${emailData.date || 'Unknown Date'}`, 12, true);
    addText(`URL: ${emailData.url || 'N/A'}`, 10, false, '#666666');
    
    yPosition += 10;
    
    // Add email body
    addText('EMAIL CONTENT', 14, true, '#333333');
    yPosition += 5;
    
    // Strip HTML tags and clean up the body content
    let bodyText = emailData.body || 'No content found';
    bodyText = bodyText.replace(/<[^>]*>/g, ''); // Remove HTML tags
    bodyText = bodyText.replace(/&nbsp;/g, ' '); // Replace &nbsp; with spaces
    bodyText = bodyText.replace(/&amp;/g, '&'); // Replace &amp; with &
    bodyText = bodyText.replace(/&lt;/g, '<'); // Replace &lt; with <
    bodyText = bodyText.replace(/&gt;/g, '>'); // Replace &gt; with >
    bodyText = bodyText.replace(/&quot;/g, '"'); // Replace &quot; with "
    bodyText = bodyText.replace(/&#39;/g, "'"); // Replace &#39; with '
    
    addText(bodyText, 11, false);
    
    // Add attachments if any
    if (emailData.attachments && emailData.attachments.length > 0) {
        yPosition += 15;
        addText('ATTACHMENTS', 14, true, '#333333');
        yPosition += 5;
        
        emailData.attachments.forEach((attachment, index) => {
            addText(`${index + 1}. ${attachment.name}`, 11, true);
            if (attachment.downloadUrl) {
                addText(`   Download URL: ${attachment.downloadUrl}`, 9, false, '#666666');
            }
        });
    }
    
    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor('#999999');
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 10);
    }
    
    // Generate PDF blob
    return doc.output('blob');
}

// Select folder function
async function selectFolder() {
    try {
        console.log('Opening folder picker...');
        
        const folderHandle = await window.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents'
        });
        
        if (folderHandle) {
            currentFolderHandle = folderHandle; // Store the handle internally
            console.log('Folder selected:', currentFolderHandle.name);
            return { success: true, folderName: currentFolderHandle.name };
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
    // If no custom folder selected, show folder picker
    if (!currentFolderHandle) {
        console.log('No custom folder selected, showing folder picker...');
        const folderResult = await selectFolder();
        if (!folderResult.success) {
            return { success: false, error: 'No folder selected' };
        }
    }
    
    try {
        console.log('Saving attachment:', attachment.name);
        
        // Generate filename with date and time (MM-DD-YYYY_HHMMSS_mmm)
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
        const day = String(now.getDate()).padStart(2, '0'); // DD
        const year = now.getFullYear(); // YYYY
        const hours = String(now.getHours()).padStart(2, '0'); // HH
        const minutes = String(now.getMinutes()).padStart(2, '0'); // MM
        const seconds = String(now.getSeconds()).padStart(2, '0'); // SS
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0'); // mmm
        
        const dateTimeStr = `${month}-${day}-${year}_${hours}${minutes}${seconds}_${milliseconds}`;
        
        // Get file extension from original attachment name
        const fileExtension = attachment.name.split('.').pop() || 'file';
        const baseName = attachment.name.replace(/\.[^/.]+$/, ''); // Remove extension
        
        const filename = `erado-${sanitizeFilename(baseName)}-${dateTimeStr}.${fileExtension}`;
        const fileHandle = await currentFolderHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        console.log('Attachment saved:', filename);
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
        
        // Get full body content from .a3s element, specifically looking for LTR div
        let body = 'No content found';
        const bodyEl = element.querySelector('.a3s');
        if (bodyEl) {
            // Look for the LTR div within .a3s
            const ltrDiv = bodyEl.querySelector('div[dir="ltr"]');
            if (ltrDiv) {
                body = ltrDiv.innerHTML; // Use innerHTML to preserve formatting
                console.log(`Found LTR div content:`, body.substring(0, 200));
            } else {
                // Fallback to full .a3s content if no LTR div found
                body = bodyEl.innerHTML;
                console.log(`No LTR div found, using full .a3s content:`, body.substring(0, 200));
            }
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
            
        case 'getFolderStatus':
            const folderStatus = getFolderStatus();
            sendResponse(folderStatus);
            break;
            
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

// Add this function to content.js to set default Downloads folder
function setDefaultDownloadsFolder() {
    // Set default to Downloads folder if no folder is selected
    if (!currentFolderHandle) {
        // We'll use the browser's default download behavior
        // The folder selection will be handled by the File System Access API
        console.log('Using default Downloads folder for exports');
        return true;
    }
    return false;
}

// Update the generatePDFDirectly function to show folder modal when needed
async function generatePDFDirectly(emailData) {
    // Prevent multiple PDF generations
    if (isGeneratingPDF) {
        console.error('PDF generation already in progress, ignoring duplicate request');
        return { success: false, error: 'PDF generation already in progress' };
    }
    
    // If no custom folder selected, show folder picker
    if (!currentFolderHandle) {
        console.log('No custom folder selected, showing folder picker...');
        const folderResult = await selectFolder();
        if (!folderResult.success) {
            return { success: false, error: 'No folder selected' };
        }
    }
    
    isGeneratingPDF = true;
    
    try {
        console.log("Generating PDF for:", emailData.subject);
        
        // Load jsPDF library dynamically
        await loadJsPDFLibrary();
        
        // Generate PDF using jsPDF
        const pdfBlob = await generatePDFWithJsPDF(emailData);
        
        // Generate filename with date and time (MM-DD-YYYY_HHMMSS_mmm)
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
        const day = String(now.getDate()).padStart(2, '0'); // DD
        const year = now.getFullYear(); // YYYY
        const hours = String(now.getHours()).padStart(2, '0'); // HH
        const minutes = String(now.getMinutes()).padStart(2, '0'); // MM
        const seconds = String(now.getSeconds()).padStart(2, '0'); // SS
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0'); // mmm
        
        const dateTimeStr = `${month}-${day}-${year}_${hours}${minutes}${seconds}_${milliseconds}`;
        
        const filename = `erado-email-${sanitizeFilename(emailData.subject)}-${dateTimeStr}.pdf`;
        const fileHandle = await currentFolderHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(pdfBlob);
        await writable.close();
        
        console.log(`PDF saved: ${filename}`);
        return { success: true, filename: filename };
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        return { success: false, error: error.message };
    } finally {
        isGeneratingPDF = false;
    }
}

// Update the selectFolder function to return full path
async function selectFolder() {
    try {
        console.log('Opening folder picker...');
        
        const folderHandle = await window.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents'
        });
        
        if (folderHandle) {
            currentFolderHandle = folderHandle; // Store the handle internally
            
            // Get the full path by traversing up the directory tree
            let fullPath = folderHandle.name;
            try {
                // Try to get the full path by checking the handle's path
                // Note: This is a simplified approach - in reality, we'd need to traverse up
                const pathParts = [folderHandle.name];
                let currentHandle = folderHandle;
                
                // Try to get parent directory (this might not work in all browsers)
                try {
                    while (currentHandle && currentHandle.parent) {
                        currentHandle = currentHandle.parent;
                        if (currentHandle.name) {
                            pathParts.unshift(currentHandle.name);
                        }
                    }
                } catch (e) {
                    // If we can't traverse up, just use the folder name
                    console.log('Could not get full path, using folder name only');
                }
                
                fullPath = pathParts.join('/');
            } catch (error) {
                console.log('Using folder name as path:', folderHandle.name);
                fullPath = folderHandle.name;
            }
            
            console.log('Folder selected:', fullPath);
            return { success: true, folderName: fullPath };
        } else {
            return { success: false, error: 'No folder selected' };
        }
    } catch (error) {
        console.error('Error selecting folder:', error);
        return { success: false, error: error.message };
    }
}

// Add getFolderStatus function
function getFolderStatus() {
    if (currentFolderHandle) {
        // Try to reconstruct the full path
        let fullPath = currentFolderHandle.name;
        try {
            // This is a simplified approach - in practice, getting full path from FileSystemDirectoryHandle
            // is limited by browser security. We'll use the folder name for now.
            fullPath = currentFolderHandle.name;
        } catch (error) {
            fullPath = currentFolderHandle.name;
        }
        
        return {
            success: true,
            folderName: fullPath
        };
    } else {
        return {
            success: true,
            folderName: null
        };
    }
}

// Add a helper function to generate clean date string
function getDateString() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
    const day = String(now.getDate()).padStart(2, '0'); // DD
    const year = now.getFullYear(); // YYYY
    return `${month}-${day}-${year}`;
}

// Update the helper function to include time and milliseconds
function getDateTimeString() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // MM
    const day = String(now.getDate()).padStart(2, '0'); // DD
    const year = now.getFullYear(); // YYYY
    const hours = String(now.getHours()).padStart(2, '0'); // HH
    const minutes = String(now.getMinutes()).padStart(2, '0'); // MM
    const seconds = String(now.getSeconds()).padStart(2, '0'); // SS
    const milliseconds = String(now.getMilliseconds()).padStart(3, '0'); // mmm
    
    return `${month}-${day}-${year}_${hours}${minutes}${seconds}_${milliseconds}`;
}
