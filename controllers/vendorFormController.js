const { getDb } = require('../services/dbService');
const nodemailer = require('nodemailer');
const { uploadToS3 } = require('../utils/aws/uploadToS3');
const { generateS3Url } = require('../utils/aws/s3Utils');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { generateEmailTemplate } = require('../utils/emailTemplate');
const { ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const vendorApprovalService = require('../services/vendorApprovalService');



// Create a transporter using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});


exports.uploadDocument = async (req, res) => {
  try {
    // Validate file presence
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        error: 'No file was uploaded. Make sure the file is provided with the field name "file".'
      });
    }

    const file = req.files.file;
    const fieldName = req.body.fieldName || 'document';
    const vendorName = req.body.vendorName || 'unknown-vendor';

    // Perform basic validation
    if (file.size > 25 * 1024 * 1024) { // 25MB limit
      return res.status(400).json({ error: 'File size exceeds 25MB limit.' });
    }

    // Get file extension and validate file type
    const fileExtension = path.extname(file.name).toLowerCase();
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];

    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({
        error: `Invalid file type. Allowed types: ${allowedExtensions.join(', ')}`
      });
    }

    // Sanitize vendor name and fieldName for use in S3 path
    const sanitizedVendorName = vendorName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase()
      .substring(0, 50); // Limit length

    const sanitizedFieldName = fieldName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toLowerCase();

    // Create a unique filename to prevent collisions
    const uniqueFilename = `${Date.now()}_${uuidv4().substring(0, 8)}${fileExtension}`;

    // Create the S3 key (path)
    const s3Key = `vendors/${sanitizedVendorName}/${sanitizedFieldName}/${uniqueFilename}`;

    // Custom params for uploadToS3 function
    const uploadParams = {
      Key: s3Key,
      Metadata: {
        'vendor-name': sanitizedVendorName,
        'document-type': sanitizedFieldName,
        'original-filename': file.name
      }
    };

    // Upload file to S3
    const uploadResult = await uploadToS3(file, uploadParams);

    if (!uploadResult || !uploadResult.Key) {
      throw new Error('S3 upload failed to return file information');
    }

    // Generate a pre-signed URL (valid for 24 hours)
    const fileUrl = await generateS3Url(uploadResult.Key, 24 * 60 * 60);

    // Add upload record to database for tracking
    const db = getDb();
    await db.collection('vendor_documents').insertOne({
      vendorName: sanitizedVendorName,
      originalVendorName: vendorName,
      documentType: sanitizedFieldName,
      filename: file.name,
      s3Key: uploadResult.Key,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date()
    });

    // Return success response with file information
    res.status(200).json({
      status: 'success',
      message: 'Document uploaded successfully',
      fileUrl: fileUrl,
      key: uploadResult.Key,
      expiresIn: '24 hours'
    });

  } catch (error) {
    console.error('Error in document upload:', error);

    // Provide appropriate error response based on error type
    if (error.code === 'AccessDenied') {
      return res.status(403).json({
        error: 'Access denied. Check S3 bucket permissions.'
      });
    }

    if (error.code === 'NoSuchBucket') {
      return res.status(500).json({
        error: 'S3 bucket does not exist. Check S3 configuration.'
      });
    }

    res.status(500).json({
      error: 'Server error during file upload',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


exports.submitVendorForm = async (req, res) => {
  try {

    const db = getDb();
    const vendorForm = {
      ...req.body,
      status: 'Pending',
      createdAt: new Date()
    };
    const result = await db.collection('vendor_form').insertOne(vendorForm);

    res.status(201).json({
      status: 'success',
      message: 'Vendor form submitted successfully',
      id: result.insertedId
    });
    // Send email
    try {
      const emailOptions = generateEmailTemplate(vendorForm, result.insertedId.toString());
      await transporter.sendMail(emailOptions);
      console.log('Vendor form notification email sent successfully');
    } catch (emailError) {
      console.error('Error sending vendor form notification email:', emailError);
    }


  } catch (error) {
    console.error('Error saving Vendor form or sending email:', error);
    res.status(500).json({ error: 'Server error' });
  }
};


// New admin controller methods
exports.getAllVendors = async (req, res) => {
  try {
    const db = getDb();
    const vendors = await db.collection('vendor_form')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(vendors);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getVendorById = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();

    const vendor = await db.collection('vendor_form').findOne({
      _id: new ObjectId(id)
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.json(vendor);
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateVendorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectReason } = req.body;

    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be Pending, Approved, or Rejected' });
    }

    const db = getDb();
    const vendor = await db.collection('vendor_form').findOne({
      _id: new ObjectId(id)
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Use the vendor approval service to process the status change
    const approvalResult = await vendorApprovalService.processVendorApproval(
      id,
      status,
      status === 'Rejected' ? rejectReason : null
    );

    res.json({
      message: `Vendor status updated to ${status} successfully`,
      updated: approvalResult.updated,
      syncResult: status === 'Approved' ? approvalResult.syncResult : null
    });
  } catch (error) {
    console.error('Error updating vendor status:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Update the showRejectionForm function with a better form submission script
exports.showRejectionForm = async (req, res) => {
  try {
    const { token } = req.params;

    // Verify and decode the token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error('Error verifying token:', err);
      return res.send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; text-align: center;">
          <h1 style="color: #dc3545;">Invalid or Expired Link</h1>
          <p>This rejection link has expired or is invalid. Please request a new one.</p>
        </div>
      `);
    }

    if (decoded.action !== 'reject') {
      return res.send('<h1>Invalid action</h1>');
    }

    const db = getDb();
    const vendorForm = await db.collection('vendor_form').findOne({
      _id: new ObjectId(decoded.vendorId)
    });

    if (!vendorForm) {
      return res.send('<h1>Vendor submission not found</h1>');
    }

    if (vendorForm.status !== 'Pending') {
      return res.send('<h1>This Vendor submission has already been processed</h1>');
    }

    // Get the base URL from the request or environment
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // Render the rejection form with direct form submission (no AJAX)
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reject Vendor</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 {
            color: #dc3545;
          }
          .card {
            border: 1px solid #ddd;
            border-radius: 5px;
            padding: 20px;
            margin-bottom: 20px;
            background-color: #f9f9f9;
          }
          .form-group {
            margin-bottom: 15px;
          }
          label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
          }
          textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            resize: vertical;
            min-height: 100px;
          }
          .btn {
            display: inline-block;
            padding: 10px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin-right: 10px;
          }
          .btn-primary {
            background-color: #dc3545;
            color: white;
          }
          .btn-secondary {
            background-color: #6c757d;
            color: white;
          }
          .error-message {
            color: #dc3545;
            margin-top: 15px;
            display: none;
          }
          .loading {
            display: none;
            text-align: center;
            margin-top: 15px;
          }
          .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(0,0,0,0.1);
            border-radius: 50%;
            border-top-color: #dc3545;
            animation: spin 1s ease-in-out infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <h1>Reject Vendor Submission</h1>
        
        <div class="card">
          <h2>Vendor Details</h2>
          <p><strong>Company:</strong> ${vendorForm.companyName}</p>
          <p><strong>Email:</strong> ${vendorForm.email}</p>
          <p><strong>Submission Date:</strong> ${new Date(vendorForm.createdAt).toLocaleDateString()}</p>
        </div>

        <!-- Use a regular form with POST method instead of AJAX -->
        <form method="POST" action="${baseUrl}/api/vendor-form/reject/${token}">
          <div class="form-group">
            <label for="rejectReason">Rejection Reason:</label>
            <textarea 
              id="rejectReason" 
              name="rejectReason" 
              placeholder="Please provide a reason for rejecting this vendor submission..."
              required
            ></textarea>
          </div>
          
          <button type="submit" class="btn btn-primary" id="submitBtn">Confirm Rejection</button>
          <a href="${process.env.FRONTEND_URL || 'https://www.csmaviation.com'}" class="btn btn-secondary">Cancel</a>
          <div class="loading" id="loadingIndicator">
            <span class="spinner"></span> Processing...
          </div>
        </form>

        <script>
          document.querySelector('form').addEventListener('submit', function() {
            // Show loading indicator
            document.getElementById('loadingIndicator').style.display = 'block';
            document.getElementById('submitBtn').disabled = true;
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error showing rejection form:', error);
    res.status(500).send('<h1>An error occurred while processing the request</h1>');
  }
};

// Update the handleApproval method to handle form data
exports.handleApproval = async (req, res) => {
  try {
    const { token } = req.params;
    const isApproval = req.path.includes('/approve/');

    // Get rejection reason from either JSON body or form data
    let rejectReason = 'No reason provided';
    if (req.method === 'POST') {
      if (req.body && req.body.rejectReason) {
        rejectReason = req.body.rejectReason;
      }
    }

    console.log("Request method:", req.method);
    console.log("Request path:", req.path);
    console.log("Request body:", req.body);
    console.log("Is approval:", isApproval);
    console.log("Reject reason:", rejectReason);

    // Verify and decode the token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Token decoded successfully:", decoded);
    } catch (err) {
      console.error('Error verifying token:', err);
      return res.send(`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; text-align: center;">
          <h1 style="color: #dc3545;">Invalid or Expired Link</h1>
          <p>This link has expired or is invalid. Please request a new one.</p>
        </div>
      `);
    }

    if (decoded.action !== (isApproval ? 'approve' : 'reject')) {
      console.error("Action mismatch:", decoded.action, isApproval ? 'approve' : 'reject');
      return res.send('<h1>Invalid action</h1>');
    }

    const db = getDb();
    const vendorForm = await db.collection('vendor_form').findOne({
      _id: new ObjectId(decoded.vendorId)
    });

    if (!vendorForm) {
      console.error("Vendor not found:", decoded.vendorId);
      return res.send('<h1>Vendor submission not found</h1>');
    }

    if (vendorForm.status !== 'Pending') {
      console.log("Vendor already processed:", vendorForm.status);
      return res.send('<h1>This Vendor submission has already been processed</h1>');
    }

    // Use the new vendor approval service to process the status change
    const status = isApproval ? 'Approved' : 'Rejected';
    const approvalResult = await vendorApprovalService.processVendorApproval(
      decoded.vendorId,
      status,
      isApproval ? null : rejectReason
    );

    console.log("Approval result:", approvalResult);

    // Prepare response message
    let syncMessage = '';
    if (isApproval && approvalResult.syncResult) {
      if (approvalResult.syncResult.results.failed.length > 0) {
        syncMessage = `<p>Note: ${approvalResult.syncResult.results.failed.length} documents could not be synced to OneDrive.</p>`;
      } else {
        syncMessage = `<p>${approvalResult.syncResult.results.success.length} documents were successfully synced to OneDrive.</p>`;
      }
    }

    res.send(`
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; text-align: center;">
        <h1 style="color: ${isApproval ? '#28a745' : '#dc3545'};">
          Vendor Submission ${isApproval ? 'Approved' : 'Rejected'} Successfully
        </h1>
        <p>The Vendor Submission has been ${isApproval ? 'approved' : 'rejected'} 
        ${!isApproval ? 'with the provided reason' : ''}
        and notification emails have been sent to the appropriate parties.</p>
        ${syncMessage}
      </div>
    `);

  } catch (error) {
    console.error('Error handling approval/rejection:', error);
    res.status(500).send('<h1>An error occurred while processing the request</h1>');
  }
};