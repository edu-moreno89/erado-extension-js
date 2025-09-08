// PDF Generator Content Script
async function generatePDFFromContent(emailData) {
    try {
        // Create HTML content
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${emailData.subject}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            border-bottom: 2px solid #667eea;
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

        // Use browser's print functionality to generate PDF
        const printWindow = window.open('', '_blank');
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Trigger print (which saves as PDF)
        printWindow.print();
        
        return { success: true };
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
}

// Listen for PDF generation requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'generatePDF') {
        generatePDFFromContent(message.emailData)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});
