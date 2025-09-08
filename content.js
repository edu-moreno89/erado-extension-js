// Erado Gmail Export - Content Script (Debug Version)
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
            return { error: "No email container found - please open an email" };
        }

        // Try multiple selectors for subject
        let subject = null;
        const subjectSelectors = [
            "h2.hP",
            "[data-legacy-thread-id] h2",
            ".thread-subject",
            "h1",
            ".subject"
        ];
        
        for (const selector of subjectSelectors) {
            const element = document.querySelector(selector);
            if (element && element.innerText.trim()) {
                subject = element.innerText.trim();
                console.log("Found subject with selector:", selector, subject);
                break;
            }
        }

        // Try multiple selectors for sender
        let sender = null;
        const senderSelectors = [
            ".gD",
            ".yW span[email]",
            ".sender-name",
            "[data-email]"
        ];
        
        for (const selector of senderSelectors) {
            const element = document.querySelector(selector);
            if (element && element.innerText.trim()) {
                sender = element.innerText.trim();
                console.log("Found sender with selector:", selector, sender);
                break;
            }
        }

        // Get email body
        let body = "";
        const bodySelectors = [
            ".a3s.aiL",
            ".email-body",
            "[role='listitem'] .a3s"
        ];
        
        for (const selector of bodySelectors) {
            const element = document.querySelector(selector);
            if (element) {
                body = element.innerText || element.innerHTML;
                console.log("Found body with selector:", selector);
                break;
            }
        }

        // Get attachments
        const attachmentElements = document.querySelectorAll(".aZo, .attachment");
        const attachments = Array.from(attachmentElements).map(att => ({
            name: att.querySelector(".aZo-name, .attachment-name")?.innerText || "Unknown",
            size: att.querySelector(".aZo-size, .attachment-size")?.innerText || "",
            type: att.querySelector(".aZo-type, .attachment-type")?.innerText || ""
        }));

        console.log("Found attachments:", attachments.length);

        const result = {
            subject: subject || "No subject found",
            sender: sender || "Unknown sender",
            recipient: "",
            date: new Date().toLocaleDateString(),
            body: body || "No body found",
            attachments: attachments,
            emailId: "debug-" + Date.now(),
            url: window.location.href,
            timestamp: new Date().toISOString()
        };

        console.log("Email data extracted:", result);
        return result;
        
    } catch (error) {
        console.error("Error in getOpenEmail:", error);
        return { error: error.message };
    }
}

// Message listener with better error handling
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("Content script received message:", msg);
    
    try {
        switch (msg.action) {
            case "getEmail":
                console.log("Processing getEmail request");
                const emailData = getOpenEmail();
                console.log("Sending response:", emailData);
                sendResponse(emailData);
                break;
                
            case "checkGmailPage":
                const isGmail = window.location.hostname === 'mail.google.com';
                const hasEmail = !!document.querySelector('[role="main"]');
                console.log("Page check - isGmail:", isGmail, "hasEmail:", hasEmail);
                sendResponse({ isGmail, hasEmail });
                break;
                
            case "getPageInfo":
                const pageInfo = {
                    url: window.location.href,
                    title: document.title,
                    isGmail: window.location.hostname === 'mail.google.com'
                };
                console.log("Page info:", pageInfo);
                sendResponse(pageInfo);
                break;
                
            case "generatePDF":
                // Generate PDF directly
                generatePDFDirectly(msg.emailData)
                    .then(result => {
                        console.log('PDF generation result:', result);
                        sendResponse(result);
                    })
                    .catch(error => {
                        console.error('PDF generation error:', error);
                        sendResponse({ success: false, error: error.message });
                    });
                return true; // Keep message channel open for async response
                break;
                
            default:
                console.log("Unknown action:", msg.action);
                sendResponse({ error: "Unknown action: " + msg.action });
        }
    } catch (error) {
        console.error("Error in message listener:", error);
        sendResponse({ error: error.message });
    }
    
    return true; // Keep message channel open
});

// Test function that can be called from console
window.testEradoExtension = function() {
    console.log("Testing Erado extension...");
    const result = getOpenEmail();
    console.log("Test result:", result);
    return result;
};

// Real PDF Generation using jsPDF
async function generatePDFDirectly(emailData) {
    try {
        console.log('Generating real PDF for:', emailData.subject);
        
        // Use the PDF generator
        await window.pdfGenerator.generatePDF(emailData);
        
        return { success: true };
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
}

// Helper function to sanitize filename
function sanitizeFilename(filename) {
    return filename
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 50);
}

console.log("Content script setup complete");
