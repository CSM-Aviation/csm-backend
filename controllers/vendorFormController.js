const { getDb } = require('../services/dbService');
const nodemailer = require('nodemailer');
const { uploadToS3 } = require('../utils/aws/uploadToS3');
const { generateS3Url } = require('../utils/aws/s3Utils');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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
        createdAt: new Date()
    };
    const result = await db.collection('vendor_form').insertOne(vendorForm);
    // Prepare email content
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: 'New Vendoe Form Submission',
      html: `
          <h1>New Contact Form Submission</h1>
          <p><strong>Name:</strong></p>
          <p><strong>Email:</strong> </p>
          <p><strong>Message:</strong></p>
        `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.status(201).json({ status: 'success', message: 'Vendor form submitted successfully', id: result.insertedId });
  } catch (error) {
    console.error('Error saving Vendor form or sending email:', error);
    res.status(500).json({ error: 'Server error' });
  }
};