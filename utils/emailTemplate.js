const jwt = require('jsonwebtoken');

/**
 * Email template generator for vendor form submissions
 * This module creates an email with all the vendor form data for admin notifications
 */

/**
 * Generates email options for vendor form submissions
 * @param {Object} vendorForm - The vendor form submission data
 * @param {Object} transporter - Nodemailer transporter object
 * @returns {Object} Email options for nodemailer
 */
const generateEmailTemplate = (vendorForm, vendorId) => {
  // Format dates for better readability
  const formatDate = (dateString) => {
    if (!dateString) return 'Not provided';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateString || 'Not provided';
    }
  };

  function generateSignedUrl(vendorId, action) {
    return jwt.sign(
      {
        vendorId,
        action,
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days expiration
      },
      process.env.JWT_SECRET
    );
  }

  const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
  const approveToken = generateSignedUrl(vendorId, 'approve');
  const rejectToken = generateSignedUrl(vendorId, 'reject');

  const approveUrl = `${baseUrl}/api/vendor-form/approve/${approveToken}`;
  const rejectUrl = `${baseUrl}/api/vendor-form/reject-form/${rejectToken}`;

  const rejectButtonHtml = `
    <a href="${rejectUrl}" 
      style="background-color: #dc3545; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
      REJECT VENDOR
    </a>
    `;

  // Get document URLs (if available)
  const getDocumentLinks = () => {
    if (!vendorForm.documents) return '';

    let docLinks = '';
    const documents = {
      'Part 135 Air Carrier Certificate': vendorForm.documents.certificate,
      'SMS Manual': vendorForm.documents.smsManual,
      'Operations Specifications': vendorForm.documents.opsSpec,
      'Certificate of Insurance': vendorForm.documents.insurance,
      'Additional Certifications': vendorForm.documents.additionalCerts
    };

    for (const [name, url] of Object.entries(documents)) {
      if (url) {
        docLinks += `
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
                <strong>${name}</strong>
              </td>
              <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">
                <a href="${url}" style="color: #3182ce; text-decoration: underline;">View Document</a>
              </td>
            </tr>
          `;
      }
    }

    return docLinks ? `
        <div style="margin-top: 30px; margin-bottom: 30px;">
          <h3 style="color: #004080; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #004080; padding-bottom: 8px;">Uploaded Documents</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              ${docLinks}
            </tbody>
          </table>
        </div>
      ` : '';
  };

  // Prepare the email HTML content
  const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Vendor Submission</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
        <div style="background-color: #004080; padding: 20px; text-align: center; color: white; border-radius: 5px 5px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">New Vendor Submission</h1>
          <p style="margin: 5px 0 0 0; font-size: 16px;">CSM Aviation Vendor Registration</p>
        </div>
        
        <div style="background-color: white; padding: 30px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
          <p style="margin-top: 0; font-size: 16px;">A new vendor has submitted their information for approval. Please review the details below:</p>
          
          <div style="margin-top: 30px;">
            <h3 style="color: #004080; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #004080; padding-bottom: 8px;">Company Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; width: 40%;"><strong>Company Name / DBA</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.companyName || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Email</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.email || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Phone</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.phone || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Submission Date</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${formatDate(vendorForm.submittedAt)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div style="margin-top: 30px;">
            <h3 style="color: #004080; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #004080; padding-bottom: 8px;">Safety Status</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; width: 40%;"><strong>ARGUS Status</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.argusStatus || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Last ARGUS Audit Date</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${formatDate(vendorForm.argusAuditDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Wyvern Status</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.wyvernStatus || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Last Wyvern Audit Date</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${formatDate(vendorForm.wyvernAuditDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>ISBAO Status</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.isbaoStatus || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Last ISBAO Audit Date</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${formatDate(vendorForm.isbaoAuditDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Alternative Certification</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.alternativeCertification || 'Not provided'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div style="margin-top: 30px;">
            <h3 style="color: #004080; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #004080; padding-bottom: 8px;">SMS Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; width: 40%;"><strong>Director of SMS Name</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.smsDirectorName || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Director of SMS Phone</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.smsDirectorPhone || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Crew Members Receive Motion Sim Training</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.hasMotionSimTraining || 'Not provided'}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div style="margin-top: 30px;">
            <h3 style="color: #004080; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #004080; padding-bottom: 8px;">Safety History</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; width: 40%;"><strong>Accidents/Incidents in Last 10 Years</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.hasAccidents || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Fatality Accidents</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.hasFatalAccident || 'Not provided'}</td>
                </tr>
                ${vendorForm.accidentDetails ? `
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Accident Details</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.accidentDetails}</td>
                </tr>
                ` : ''}
              </tbody>
            </table>
          </div>
          
          <div style="margin-top: 30px;">
            <h3 style="color: #004080; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #004080; padding-bottom: 8px;">Signatures</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; width: 40%;"><strong>Signer Name (Crew Quals)</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.signerName || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Signer Title</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.signerTitle || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Final Signer Name</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.finalSignerName || 'Not provided'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;"><strong>Final Signer Title</strong></td>
                  <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${vendorForm.finalSignerTitle || 'Not provided'}</td>
                </tr>
              </tbody>
            </table>
            
            ${vendorForm.crewQualSignature ? `
            <div style="margin-top: 20px;">
              <p><strong>Crew Qualification Agreement Signature:</strong></p>
              <img src="${vendorForm.crewQualSignature}" alt="Crew Qualification Signature" style="max-width: 100%; max-height: 150px; border: 1px solid #e2e8f0;">
            </div>
            ` : ''}
            
            ${vendorForm.finalSignature ? `
            <div style="margin-top: 20px;">
              <p><strong>Final Agreement Signature:</strong></p>
              <img src="${vendorForm.finalSignature}" alt="Final Agreement Signature" style="max-width: 100%; max-height: 150px; border: 1px solid #e2e8f0;">
            </div>
            ` : ''}
          </div>
          
          ${getDocumentLinks()}
          
          <div style="margin-top: 30px; background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <p style="margin: 0; color: #004080;"><strong>Action Required:</strong> Please review this vendor submission and approve or reject as appropriate.</p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <div style="margin-bottom: 20px;">
                <a href="${approveUrl}" 
                style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block;">
                    APPROVE VENDOR
                 </a>
             </div>
          <div>
            ${rejectButtonHtml}
          </div>
          </div>
          
          <div style="margin-top: 30px; text-align: center; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <img src="https://www.csmaviation.com/images/whitebgcsmlogo.png" alt="CSM Aviation Logo" style="max-width: 120px; margin-bottom: 10px;">
            <p style="margin: 5px 0; font-size: 14px; color: #718096;">CSM Aviation</p>
            <p style="margin: 5px 0; font-size: 14px; color: #718096;">Central California's Premier Private Aviation Management</p>
            <p style="margin: 5px 0; font-size: 14px; color: #718096;"><a href="https://www.csmaviation.com" style="color: #3182ce; text-decoration: none;">www.csmaviation.com</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

  // Prepare signature attachments
  const attachments = [];

  // Add signature images as attachments
  if (vendorForm.crewQualSignature) {
    attachments.push({
      filename: 'crew-qualification-signature.png',
      path: vendorForm.crewQualSignature,
      cid: 'crew-qual-signature' // Content ID for referencing in the email
    });
  }

  if (vendorForm.finalSignature) {
    attachments.push({
      filename: 'final-agreement-signature.png',
      path: vendorForm.finalSignature,
      cid: 'final-signature' // Content ID for referencing in the email
    });
  }

  // Return email options
  return {
    from: process.env.GMAIL_USER,
    to: process.env.ADMIN_EMAIL,
    subject: `New Vendor Registration: ${vendorForm.companyName}`,
    html: htmlContent,
    attachments: attachments
  };
};

module.exports = { generateEmailTemplate };