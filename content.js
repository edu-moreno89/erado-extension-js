// Erado Gmail Export - Content Script
console.log("Erado Gmail Export content script loaded");

// Enhanced email detection with better selectors
function getOpenEmail() {
    try {
        // Wait for Gmail to load
        const emailContainer = document.querySelector('[role="main"]');
        if (!emailContainer) {
            return { error: "No email container found" };
        }

        // Extract email data with multiple selector fallbacks
        const subject = document.querySelector("h2.hP")?.innerText || 
                       document.querySelector("[data-legacy-thread-id] h2")?.innerText ||
                       document.querySelector(".thread-subject")?.innerText;

        const sender = document.querySelector(".gD")?.innerText ||
                      document.querySelector(".yW span[email]")?.innerText ||
                      document.querySelector(".sender-name")?.innerText;

        const recipient = document.querySelector(".y2")?.innerText ||
                         document.querySelector(".recipient")?.innerText;

        const date = document.querySelector(".g3")?.innerText ||
                    document.querySelector(".date")?.innerText;

        // Get email body with better handling
        const bodyElement = document.querySelector(".a3s.aiL") ||
                           document.querySelector(".email-body") ||
                           document.querySelector("[role='listitem'] .a3s");
        
        const body = bodyElement?.innerHTML || bodyElement?.innerText;

        // Get attachments
        const attachmentElements = document.querySelectorAll(".aZo, .attachment");
        const attachments = Array.from(attachmentElements).map(att => ({
            name: att.querySelector(".aZo-name, .attachment-name")?.innerText || "Unknown",
            size: att.querySelector(".aZo-size, .attachment-size")?.innerText || "",
            type: att.querySelector(".aZo-type, .attachment-type")?.innerText || ""
        }));

        // Get email ID from URL or data attributes
        const urlParams = new URLSearchParams(window.location.search);
        const emailId = urlParams.get('th') || 
                       document.querySelector('[data-legacy-thread-id]')?.getAttribute('data-legacy-thread-id');

        return {
            subject: subject || "No subject",
            sender: sender || "Unknown sender",
            recipient: recipient || "",
            date: date || "",
            body: body || "",
            attachments: attachments,
            emailId: emailId,
            url: window.location.href,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error("Error extracting email data:", error);
        return { error: error.message };
    }
}

// Enhanced message listener
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("Content script received message:", msg);
    
    switch (msg.action) {
        case "getEmail":
            const emailData = getOpenEmail();
            sendResponse(emailData);
            break;
            
        case "checkGmailPage":
            const isGmail = window.location.hostname === 'mail.google.com';
            const hasEmail = !!document.querySelector('[role="main"]');
            sendResponse({ isGmail, hasEmail });
            break;
            
        case "getPageInfo":
            sendResponse({
                url: window.location.href,
                title: document.title,
                isGmail: window.location.hostname === 'mail.google.com'
            });
            break;
            
        default:
            sendResponse({ error: "Unknown action" });
    }
    
    return true; // Keep message channel open for async response
});

// Auto-detect when user opens an email
let lastEmailId = null;
const observer = new MutationObserver(() => {
    const currentEmail = getOpenEmail();
    if (currentEmail.emailId && currentEmail.emailId !== lastEmailId) {
        lastEmailId = currentEmail.emailId;
        console.log("New email detected:", currentEmail.subject);
        
        // Notify background script of new email
        chrome.runtime.sendMessage({
            action: "emailOpened",
            emailData: currentEmail
        });
    }
});

// Start observing when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, { childList: true, subtree: true });
    });
} else {
    observer.observe(document.body, { childList: true, subtree: true });
}
