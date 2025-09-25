console.error('Erado Gmail Export content script loaded');

let isGeneratingPDF = false;
let currentFolderHandle = null;

async function generatePDFDirectly(emailData) {
    if (isGeneratingPDF) {
        console.error('PDF generation already in progress, ignoring duplicate request');
        return { success: false, error: 'PDF generation already in progress' };
    }
    
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
        
        await loadJsPDFLibrary();
        
        const pdfBlob = await generatePDFWithJsPDF(emailData);
        
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
        
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
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let yPosition = 20;
    
    function addText(text, fontSize = 12, isBold = false, color = '#000000') {
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', isBold ? 'bold' : 'normal');
        doc.setTextColor(color);
        
        const lines = doc.splitTextToSize(text, contentWidth);
        doc.text(lines, margin, yPosition);
        yPosition += lines.length * (fontSize * 0.4) + 5;
        
        if (yPosition > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            yPosition = 20;
        }
    }
    
    addText('ERADO EMAIL EXPORT', 18, true, '#667eea');
    addText(`Generated on ${new Date().toLocaleString()}`, 10, false, '#666666');
    
    yPosition += 10;
    doc.setDrawColor(102, 126, 234);
    doc.setLineWidth(2);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 15;
    
    addText('EMAIL INFORMATION', 14, true, '#333333');
    yPosition += 5;
    
    addText(`Subject: ${emailData.subject || 'No Subject'}`, 12, true);
    addText(`From: ${emailData.sender || 'Unknown Sender'}`, 12, true);
    addText(`Date: ${emailData.date || 'Unknown Date'}`, 12, true);
    addText(`URL: ${emailData.url || 'N/A'}`, 10, false, '#666666');
    
    yPosition += 10;
    
    addText('EMAIL CONTENT', 14, true, '#333333');
    yPosition += 5;
    
    let bodyText = emailData.body || 'No content found';
    bodyText = bodyText.replace(/<[^>]*>/g, '');
    bodyText = bodyText.replace(/&nbsp;/g, ' ');
    bodyText = bodyText.replace(/&amp;/g, '&');
    bodyText = bodyText.replace(/&lt;/g, '<');
    bodyText = bodyText.replace(/&gt;/g, '>');
    bodyText = bodyText.replace(/&quot;/g, '"');
    bodyText = bodyText.replace(/&#39;/g, "'");
    
    addText(bodyText, 11, false);
    
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
    
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor('#999999');
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 10);
    }
    
    return doc.output('blob');
}

async function selectFolder() {
    try {
        console.log('Opening folder picker...');
        
        const folderHandle = await window.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents'
        });
        
        if (folderHandle) {
            currentFolderHandle = folderHandle;
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

async function saveAttachmentToFolder(attachment, blob) {
    if (!currentFolderHandle) {
        console.log('No custom folder selected, showing folder picker...');
        const folderResult = await selectFolder();
        if (!folderResult.success) {
            return { success: false, error: 'No folder selected' };
        }
    }
    
    try {
        console.log('Saving attachment:', attachment.name);
        
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
        
        const dateTimeStr = `${month}-${day}-${year}_${hours}${minutes}${seconds}_${milliseconds}`;
        
        const fileExtension = attachment.name.split('.').pop() || 'file';
        const baseName = attachment.name.replace(/\.[^/.]+$/, '');
        
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

function getOpenEmail() {
    try {
        console.log('Detecting email...');
        
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
        
        let sender = 'Unknown Sender';
        
        console.log('Starting sender detection...');
        
        const senderSelectors = [
            '.gD .g2 span[email]',
            '.gD .g2 .email',
            '.gD .g2',
            '.gD span[email]',
            '.gD .email',
            '.gD'
        ];
        
        for (const selector of senderSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                let email = element.getAttribute('email');
                
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
        
        if (sender === 'Unknown Sender') {
            console.log('No sender found via selectors, trying email pattern search...');
            const pageText = document.body.textContent;
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            const emails = pageText.match(emailRegex);
            
            if (emails && emails.length > 0) {
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
        
        let date = 'Unknown Date';
        
        console.log('Starting date detection...');
        
        const dateSelectors = [
            '.gH .gK .g3',
            '.gH .gK .g4',
            '.h5 .gK .g3',
            '.h5 .gK .g4',
            '.gH .gK',
            '.h5 .gK',
            '.g2 .gK',
            '.yW .gK'
        ];
        
        for (const selector of dateSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                const dateText = element.textContent.trim();
                
                if (dateText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}:\d{2}\s*(AM|PM)|Yesterday|Today|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i)) {
                    date = dateText;
                    console.log('Found date via selector:', selector, date);
                    break;
                } else {
                    console.log(`Skipping "${dateText}" from selector "${selector}" - doesn't look like a date`);
                }
            }
        }
        
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
        
        const attachmentElements = document.querySelectorAll('.aZo, .attachment, .file-attachment, [data-attachment-id]');
        const attachments = Array.from(attachmentElements).map(el => {
            let name = 'Unknown Attachment';
            let size = 'Unknown Size';
            let type = 'Unknown Type';
            
            const nameSelectors = [
                '.aZo-name',
                '.attachment-name',
                '[data-attachment-name]',
                '.filename',
                'span[title]'
            ];
            
            for (const selector of nameSelectors) {
                const nameEl = el.querySelector(selector);
                if (nameEl) {
                    const text = nameEl.textContent?.trim() || nameEl.getAttribute('title') || '';
                    if (text && text.length < 100) {
                        name = text;
                        break;
                    }
                }
            }
            
            if (name === 'Unknown Attachment') {
                const fullText = el.textContent?.trim() || '';
                const fileMatch = fullText.match(/([a-zA-Z0-9_\-\.\s]+\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|jpg|jpeg|png|gif|zip|rar|mp4|mp3|avi|mov))\s/i);
                if (fileMatch) {
                    name = fileMatch[1].trim();
                } else if (fullText.length < 50) {
                    name = fullText;
                }
            }
            
            const sizeSelectors = [
                '.aZo-size',
                '.attachment-size',
                '[data-attachment-size]'
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

function getAllEmailsInThread() {
    try {
        console.log('Detecting all emails in conversation thread...');
        
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
        
        const emails = validElements.map((element, index) => {
            return extractEmailFromElement(element, index);
        }).filter(email => email && email.sender !== 'Unknown Sender');
        
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

function extractEmailFromElement(element, index) {
    try {
        console.log(`Extracting email data from .adn element ${index}:`, element.textContent?.substring(0, 100));
        
        let sender = 'Unknown Sender';
        let senderName = 'Unknown Name';
        
        const senderEl = element.querySelector('.gD');
        if (senderEl) {
            const email = senderEl.getAttribute('email');
            if (email && email.includes('@') && !email.includes('noreply') && !email.includes('no-reply')) {
                sender = email;
                console.log(`Found sender email: ${sender}`);
            }
            
            const name = senderEl.getAttribute('name');
            if (name && name.trim()) {
                senderName = name.trim();
                console.log(`Found sender name: ${senderName}`);
            }
        }
        
        let date = 'Unknown Date';
        
        const dateEl = element.querySelector('.gH .gK .g3');
        if (dateEl && dateEl.textContent.trim()) {
            date = dateEl.textContent.trim();
            console.log(`Found date: ${date}`);
        }
        
        let subject = 'No Subject';
        const subjectEl = document.querySelector('h2[data-thread-perm-id], .hP, .thread-subject');
        if (subjectEl) {
            subject = subjectEl.textContent?.trim() || 'No Subject';
        }
        
        let bodyPreview = 'No content';
        const bodyEl = element.querySelector('.a3s');
        if (bodyEl) {
            const bodyText = bodyEl.textContent?.trim();
            bodyPreview = bodyText ? bodyText.substring(0, 100) + '...' : 'No content';
            console.log(`Found body via .a3s:`, bodyText?.substring(0, 200));
        } else {
            const elementText = element.textContent?.trim() || '';
            if (elementText.length > 50) {
                bodyPreview = elementText.substring(0, 100) + '...';
            }
        }
        
        const attachmentContainers = element.querySelectorAll('.aZo');
        const attachmentCount = attachmentContainers.length;
        
        console.log(`Email ${index} has ${attachmentCount} attachments`);
        
        if (attachmentCount > 0) {
            console.log(`Attachment details for email ${index}:`);
            attachmentContainers.forEach((container, attIndex) => {
                const downloadUrl = container.getAttribute('download_url');
                
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
            senderName: senderName,
            date: date,
            subject: subject,
            bodyPreview: bodyPreview,
            attachmentCount: attachmentCount,
            element: element
        };
        
        console.log(`Extracted email ${index}:`, emailData);
        return emailData;
        
    } catch (error) {
        console.error('Error extracting email from element:', error);
        return null;
    }
}

function getSelectedEmailData(selectedIndex) {
    try {
        console.log(`Getting data for selected email index: ${selectedIndex}`);
        
        const threadResult = getAllEmailsInThread();
        if (!threadResult.success || !threadResult.emails[selectedIndex]) {
            return { success: false, error: 'Selected email not found' };
        }
        
        const selectedEmail = threadResult.emails[selectedIndex];
        const element = selectedEmail.element;
        
        let body = 'No content found';
        const bodyEl = element.querySelector('.a3s');
        if (bodyEl) {
            const ltrDiv = bodyEl.querySelector('div[dir="ltr"]');
            if (ltrDiv) {
                body = ltrDiv.innerHTML;
                console.log(`Found LTR div content:`, body.substring(0, 200));
            } else {
                body = bodyEl.innerHTML;
                console.log(`No LTR div found, using full .a3s content:`, body.substring(0, 200));
            }
        }
        
        const attachmentContainers = element.querySelectorAll('.aZo');
        const attachments = Array.from(attachmentContainers).map((container, index) => {
            let name = 'Unknown Attachment';
            let downloadUrl = null;
            
            const filenameEl = container.querySelector('.aV3');
            if (filenameEl) {
                name = filenameEl.textContent?.trim() || 'Unknown Attachment';
            }
            
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

async function downloadAttachmentsDirectly(attachments) {
    if (!attachments || attachments.length === 0) {
        return { success: false, error: 'No attachments found' };
    }
    
    if (!currentFolderHandle) {
        console.log('No custom folder selected, showing folder picker...');
        const folderResult = await selectFolder();
        if (!folderResult.success) {
            return { success: false, error: 'No folder selected' };
        }
    }
    
    try {
        console.log('Starting direct attachment download for', attachments.length, 'attachments');
        
        const response = await chrome.runtime.sendMessage({
            action: 'downloadAttachments',
            emailData: { attachments: attachments }
        });
        
        if (response.success) {
            console.log('All attachments downloaded successfully');
            return { success: true };
        } else {
            console.error('Background download failed:', response.error);
            return { success: false, error: response.error };
        }
        
    } catch (error) {
        console.error('Error downloading attachments:', error);
        return { success: false, error: error.message };
    }
}

async function downloadAttachmentsToCustomFolder(attachments, customFolderPath) {
    try {
        console.log(`Downloading ${attachments.length} attachments directly to custom folder`);
        
        if (!currentFolderHandle) {
            console.log('No custom folder selected, showing folder picker...');
            const folderResult = await selectFolder();
            if (!folderResult.success) {
                return { success: false, error: 'No folder selected' };
            }
        }
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const attachment of attachments) {
            if (attachment.downloadUrl) {
                try {
                    console.log(`Downloading attachment: ${attachment.name}`);
                    
                    const cleanedUrl = cleanAttachmentUrl(attachment.downloadUrl);
                    console.log(`Cleaned URL: ${cleanedUrl}`);
                    
                    if (!cleanedUrl) {
                        console.error(`Invalid URL for ${attachment.name}`);
                        errorCount++;
                        continue;
                    }
                    
                    const response = await fetch(cleanedUrl, {
                        method: 'GET',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    });
                    
                    if (!response.ok) {
                        console.error(`Failed to download ${attachment.name}: ${response.status} ${response.statusText}`);
                        errorCount++;
                        continue;
                    }
                    
                    const blob = await response.blob();
                    console.log(`Downloaded ${attachment.name}: ${blob.size} bytes`);
                    
                    const saveResult = await saveAttachmentToFolder(attachment, blob);
                    if (saveResult.success) {
                        successCount++;
                        console.log(`Successfully saved ${attachment.name} to custom folder`);
                    } else {
                        errorCount++;
                        console.error(`Failed to save ${attachment.name}: ${saveResult.error}`);
                    }
                    
                } catch (error) {
                    console.error(`Error downloading ${attachment.name}:`, error);
                    errorCount++;
                }
            } else {
                console.warn(`No download URL for attachment: ${attachment.name}`);
                errorCount++;
            }
        }
        
        const message = `Downloaded ${successCount} of ${attachments.length} attachments successfully`;
        console.log(message);
        
        return { 
            success: successCount > 0, 
            message: message,
            successCount: successCount,
            errorCount: errorCount
        };
        
    } catch (error) {
        console.error('Error downloading attachments to custom folder:', error);
        return { success: false, error: error.message };
    }
}

function cleanAttachmentUrl(url) {
    if (!url) return null;
    
    console.log('Cleaning URL:', url);
    
    const urlMatch = url.match(/^[^:]+:[^:]+:(https?:\/\/.+)$/);
    if (urlMatch) {
        url = urlMatch[1];
        console.log('Removed MIME type and filename prefix:', url);
    }
    
    if (url.includes('https://mail.google.com/mail/u/0/https://mail.google.com/mail/u/0')) {
        url = url.replace('https://mail.google.com/mail/u/0/https://mail.google.com/mail/u/0', 'https://mail.google.com/mail/u/0');
        console.log('Fixed double prefix:', url);
    }
    
    if (url.startsWith('http')) {
        console.log('Final cleaned URL:', url);
        return url;
    }
    
    console.log('Invalid URL after cleaning:', url);
    return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Content script received message:", message.action, message);
    
    switch (message.action) {
        case 'getFolderStatus':
            const folderStatus = getFolderStatus();
            sendResponse(folderStatus);
            break;
            
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
            return true;
            
        case 'selectFolder':
            selectFolder().then(result => {
                sendResponse(result);
            });
            return true;
            
        case 'saveAttachmentToFolder':
            saveAttachmentToFolder(message.attachment, message.blob).then(result => {
                sendResponse(result);
            });
            return true;
            
        case 'downloadAttachmentsDirectly':
            downloadAttachmentsDirectly(message.attachments).then(result => {
                sendResponse(result);
            });
            return true;
            
        case 'downloadAttachmentsToCustomFolder':
            downloadAttachmentsToCustomFolder(message.attachments, message.customFolderPath).then(result => {
                sendResponse(result);
            });
            return true;
            
        default:
            console.log('Unknown action:', message.action);
            sendResponse({ error: 'Unknown action' });
    }
    
    return true;
});

function sanitizeFilename(filename) {
    return filename
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 50);
}

function setDefaultDownloadsFolder() {
    if (!currentFolderHandle) {
        console.log('Using default Downloads folder for exports');
        return true;
    }
    return false;
}

async function generatePDFDirectly(emailData) {
    if (isGeneratingPDF) {
        console.error('PDF generation already in progress, ignoring duplicate request');
        return { success: false, error: 'PDF generation already in progress' };
    }
    
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
        
        await loadJsPDFLibrary();
        
        const pdfBlob = await generatePDFWithJsPDF(emailData);
        
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
        
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

async function selectFolder() {
    try {
        console.log('Opening folder picker...');
        
        const folderHandle = await window.showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'documents'
        });
        
        if (folderHandle) {
            currentFolderHandle = folderHandle;
            
            let fullPath = folderHandle.name;
            try {
                const pathParts = [folderHandle.name];
                let currentHandle = folderHandle;
                
                try {
                    while (currentHandle && currentHandle.parent) {
                        currentHandle = currentHandle.parent;
                        if (currentHandle.name) {
                            pathParts.unshift(currentHandle.name);
                        }
                    }
                } catch (e) {
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

function getFolderStatus() {
    if (currentFolderHandle) {
        let fullPath = currentFolderHandle.name;
        try {
            fullPath = currentFolderHandle.name;
        } catch (error) {
            fullPath = currentFolderHandle.name;
        }
        
        return {
            success: true,
            folderPath: fullPath,
            folderName: fullPath
        };
    } else {
        return {
            success: false,
            folderPath: null,
            folderName: null
        };
    }
}

function getDateString() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    return `${month}-${day}-${year}`;
}