// Erado Gmail Export - Content Script
console.log("Erado Gmail Export content script loaded at:", new Date().toISOString());

// Simple email detection function
function getOpenEmail() {
    console.log("getOpenEmail() called");
    
    try {
        // Check if we're on Gmail
        if (window.location.hostname !== 'mail.google.com') {
            console.log("Not on Gmail domain");
            return { error: "Not on Gmail domain" };
        }

        // Wait a bit for Gmail to load
        const emailContainer = document.querySelector('[role="main"]');
        console.log("Email container found:", !!emailContainer);
        
        if (!emailContainer) {
            console.log("No email container found");
            return { error: "No email container found - please open an email" };
        }

        // Try multiple selectors for email content
        let emailContent = null;
        const contentSelectors = [
            '.a3s.aiL', // Gmail email body
            '[role="listitem"] .a3s', // Alternative email body
            '.email-body', // Generic email body
            '.message-content', // Generic message content
            '[data-thread-id] .a3s', // Thread-based email body
            '.thread-content', // Thread content
            '.email-content', // Generic email content
            '.yW .y2', // Gmail content area
            '.yW .yP' // Gmail content area alternative
        ];
        
        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                emailContent = element;
                console.log("Found email content with selector:", selector);
                break;
            }
        }
        
        if (!emailContent) {
            console.log("No email content found with any selector");
            // Try to get any text content from the main area
            const mainArea = document.querySelector('[role="main"]');
            if (mainArea && mainArea.textContent.trim()) {
                emailContent = mainArea;
                console.log("Using main area as email content");
            } else {
                return { error: "No email content found" };
            }
        }

        // Try multiple selectors for subject
        let subject = 'No Subject';
        const subjectSelectors = [
            'h2.hP', // Gmail subject
            '[data-legacy-thread-id] h2', // Alternative subject
            '.thread-subject', // Thread subject
            'h1', // Generic heading
            '.subject', // Generic subject
            '[data-thread-perm-id] h2', // Thread perm ID subject
            '.yW h2', // Gmail subject alternative
            '.yW .yP' // Gmail subject area
        ];
        
        for (const selector of subjectSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                subject = element.textContent.trim();
                console.log("Found subject with selector:", selector, subject);
                break;
            }
        }

        // Try multiple selectors for sender
        let sender = 'Unknown Sender';
        const senderSelectors = [
            '.gD', // Gmail sender
            '.yW span[email]', // Alternative sender
            '.sender-name', // Generic sender name
            '[data-email]', // Data email attribute
            '[data-sender-name]', // Data sender name
            '.yW .yP', // Gmail sender name
            '.yW .y2', // Gmail sender email
            '.yW span' // Gmail sender span
        ];
        
        for (const selector of senderSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                sender = element.textContent.trim();
                console.log("Found sender with selector:", selector, sender);
                break;
            }
        }

        // Try multiple selectors for date
        let date = new Date().toLocaleDateString();
        const dateSelectors = [
            '.date', // Generic date
            '[data-date]', // Data date attribute
            '.yW .y2', // Gmail date
            '.yW .yP', // Gmail date alternative
            '.thread-date' // Thread date
        ];
        
        for (const selector of dateSelectors) {
            const element = document.querySelector(selector);
            if (element && element.textContent.trim()) {
                date = element.textContent.trim();
                console.log("Found date with selector:", selector, date);
                break;
            }
        }

        // Get email body
        const body = emailContent.textContent?.trim() || 'No content found';
        
        // Extract attachments
        const attachmentElements = document.querySelectorAll('.aZo, .attachment, .file-attachment, [data-attachment-id]');
        const attachments = Array.from(attachmentElements).map(el => ({
            name: el.querySelector('.aZo-name, .attachment-name')?.textContent?.trim() || 
                  el.textContent?.trim() || 'Unknown Attachment',
            size: el.querySelector('.aZo-size, .attachment-size')?.textContent?.trim() || 
                  el.getAttribute('data-size') || 'Unknown Size',
            type: el.querySelector('.aZo-type, .attachment-type')?.textContent?.trim() || 
                  el.getAttribute('data-type') || 'Unknown Type'
        }));

        console.log("Email detected:", { subject, sender, date, attachments: attachments.length });
        
        return {
            success: true,
            subject: subject,
            sender: sender,
            date: date,
            body: body,
            attachments: attachments,
            url: window.location.href
        };
        
    } catch (error) {
        console.error("Error in getOpenEmail:", error);
        return { error: error.message };
    }
}

// Generate PDF using Chrome's native print functionality
async function generatePDFDirectly(emailData) {
    try {
        console.log("Generating PDF for:", emailData.subject);
        
        // Create a new window with styled content
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        
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
        .status {
            position: fixed;
            top: 20px;
            left: 20px;
            background: #f0f8ff;
            border: 2px solid #667eea;
            padding: 15px;
            border-radius: 5px;
            font-size: 14px;
            z-index: 1000;
            max-width: 300px;
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
    
    <div class="status" id="status">
        <strong>📄 Auto-Exporting PDF...</strong><br><br>
        Please wait while we prepare your PDF...
    </div>
</body>
</html>`;
        
        // Write content to new window
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Auto-print after content loads
        printWindow.addEventListener('load', function() {
            console.log('Window loaded, starting auto-print');
            
            // Update status
            const statusDiv = printWindow.document.getElementById('status');
            if (statusDiv) {
                statusDiv.innerHTML = '<strong>🖨️ Printing PDF...</strong><br><br>Print dialog will open automatically...';
            }
            
            // Wait a bit for content to render, then auto-print
            setTimeout(() => {
                try {
                    console.log('Triggering auto-print');
                    printWindow.print();
                    
                    // Update status
                    if (statusDiv) {
                        statusDiv.innerHTML = '<strong>✅ PDF Export Complete!</strong><br><br>Window will close automatically...';
                    }
                    
                    // Close window after print
                    setTimeout(() => {
                        console.log('Closing window');
                        printWindow.close();
                    }, 2000);
                    
                } catch (error) {
                    console.error('Auto-print failed:', error);
                    if (statusDiv) {
                        statusDiv.innerHTML = '<strong>❌ Auto-print failed</strong><br><br>Please use Ctrl+P to print manually.';
                    }
                }
            }, 1000);
        });
        
        return { success: true, filename: `erado-export-${sanitizeFilename(emailData.subject)}.pdf` };
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        return { error: error.message };
    }
}

// Sanitize filename
function sanitizeFilename(filename) {
    return filename
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 50);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Content script received message:", message.action);
    
    try {
        if (message.action === 'getOpenEmail' || message.action === 'getEmail') {
            console.log("Processing email detection request");
            const result = getOpenEmail();
            console.log("Sending response:", result);
            sendResponse(result);
        } else if (message.action === 'generatePDF' || message.action === 'generatePDFFromContent') {
            console.log("Processing PDF generation request");
            generatePDFDirectly(message.data)
                .then(result => {
                    console.log("PDF generation result:", result);
                    sendResponse(result);
                })
                .catch(error => {
                    console.error("PDF generation error:", error);
                    sendResponse({ error: error.message });
                });
            return true; // Keep message channel open
        } else {
            console.log("Unknown action:", message.action);
            sendResponse({ error: "Unknown action: " + message.action });
        }
    } catch (error) {
        console.error("Error in message listener:", error);
        sendResponse({ error: error.message });
    }
    
    return true; // Keep message channel open
});
