// Simple PDF Generator using jsPDF
class SimplePDFGenerator {
    constructor() {
        this.loaded = false;
        this.jsPDF = null;
    }
    
    async load() {
        if (this.loaded) return;
        
        try {
            // Load jsPDF from CDN
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            document.head.appendChild(script);
            
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
            });
            
            this.jsPDF = window.jsPDF;
            this.loaded = true;
            console.log('jsPDF loaded successfully');
        } catch (error) {
            console.error('Failed to load jsPDF:', error);
            throw error;
        }
    }
    
    async generatePDF(emailData) {
        await this.load();
        
        const doc = new this.jsPDF();
        
        // Set up PDF styling
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        const contentWidth = pageWidth - (margin * 2);
        let yPosition = 30;
        
        // Add Erado branding
        doc.setFontSize(24);
        doc.setTextColor(102, 126, 234); // Erado blue
        doc.text('ERADO GMAIL EXPORT', margin, yPosition);
        yPosition += 15;
        
        // Add separator line
        doc.setDrawColor(102, 126, 234);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 20;
        
        // Add email metadata
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        
        // Subject
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Subject:', margin, yPosition);
        yPosition += 8;
        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        const subjectLines = doc.splitTextToSize(emailData.subject, contentWidth);
        doc.text(subjectLines, margin + 10, yPosition);
        yPosition += (subjectLines.length * 6) + 10;
        
        // Sender
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('From:', margin, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(emailData.sender, margin + 20, yPosition);
        yPosition += 8;
        
        // Date
        doc.setFont(undefined, 'bold');
        doc.text('Date:', margin, yPosition);
        doc.setFont(undefined, 'normal');
        doc.text(emailData.date, margin + 20, yPosition);
        yPosition += 8;
        
        // URL
        doc.setFont(undefined, 'bold');
        doc.text('URL:', margin, yPosition);
        doc.setFont(undefined, 'normal');
        const urlText = emailData.url.length > 50 ? emailData.url.substring(0, 50) + '...' : emailData.url;
        doc.text(urlText, margin + 20, yPosition);
        yPosition += 15;
        
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 15;
        
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('Email Content:', margin, yPosition);
        yPosition += 10;
        
        doc.setFontSize(11);
        doc.setFont(undefined, 'normal');
        
        const cleanBody = emailData.body
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .trim();
        
        const bodyLines = doc.splitTextToSize(cleanBody, contentWidth);
        
        if (yPosition + (bodyLines.length * 5) > doc.internal.pageSize.getHeight() - 50) {
            doc.addPage();
            yPosition = 30;
        }
        
        doc.text(bodyLines, margin, yPosition);
        yPosition += (bodyLines.length * 5) + 15;
        
        if (emailData.attachments && emailData.attachments.length > 0) {
            if (yPosition + 50 > doc.internal.pageSize.getHeight() - 50) {
                doc.addPage();
                yPosition = 30;
            }
            
            doc.setFontSize(14);
            doc.setFont(undefined, 'bold');
            doc.text(`Attachments (${emailData.attachments.length}):`, margin, yPosition);
            yPosition += 10;
            
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            
            emailData.attachments.forEach((attachment, index) => {
                if (yPosition + 10 > doc.internal.pageSize.getHeight() - 50) {
                    doc.addPage();
                    yPosition = 30;
                }
                
                const attachmentText = `• ${attachment.name}${attachment.size ? ` (${attachment.size})` : ''}${attachment.type ? ` - ${attachment.type}` : ''}`;
                doc.text(attachmentText, margin + 10, yPosition);
                yPosition += 6;
            });
        }
        
        doc.setFontSize(10);
        doc.setTextColor(128, 128, 128);
        doc.text(`Exported by Erado Gmail Export on ${new Date().toLocaleString()}`, margin, doc.internal.pageSize.getHeight() - 20);
        
        const pdfBlob = doc.output('blob');
        
        const url = URL.createObjectURL(pdfBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `erado-export-${sanitizeFilename(emailData.subject)}.pdf`;
        downloadLink.style.display = 'none';
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
        
        return { success: true };
    }
}

window.pdfGenerator = new SimplePDFGenerator();
