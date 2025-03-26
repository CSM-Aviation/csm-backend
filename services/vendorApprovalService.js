// services/vendorApprovalService.js

const { getDb } = require('./dbService');
const nodemailer = require('nodemailer');
const microsoftService = require('./microsoftService');
const { ObjectId } = require('mongodb');

/**
 * Email transporter for sending notifications
 */
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

/**
 * Service to handle vendor approval and document management
 */
const vendorApprovalService = {
    /**
     * Process vendor approval
     * @param {string} vendorId - Vendor ID
     * @param {string} status - New status (Approved, Rejected, Pending)
     * @param {string} rejectReason - Reason for rejection (if rejected)
     * @returns {Promise<Object>} Result of the approval process
     */
    async processVendorApproval(vendorId, status, rejectReason) {
        const db = getDb();
        const vendor = await db.collection('vendor_form').findOne({
            _id: new ObjectId(vendorId)
        });

        if (!vendor) {
            throw new Error('Vendor not found');
        }

        // Update vendor status
        const updateData = { status };
        if (status === 'Rejected' && rejectReason) {
            updateData.rejectReason = rejectReason;
        }

        const result = await db.collection('vendor_form').updateOne(
            { _id: new ObjectId(vendorId) },
            { $set: updateData }
        );

        // If vendor is approved, sync documents to OneDrive
        let syncResult = null;
        if (status === 'Approved') {
            try {
                // Sync vendor documents to OneDrive
                syncResult = await this.syncVendorDocumentsToOneDrive(vendor);

                // Save the sync result in the vendor record for reference
                await db.collection('vendor_form').updateOne(
                    { _id: new ObjectId(vendorId) },
                    {
                        $set: {
                            oneDriveSyncStatus: 'completed',
                            oneDriveFolderPath: syncResult.folderPath
                        }
                    }
                );
            } catch (error) {
                console.error('Error syncing vendor documents to OneDrive:', error);

                // Update vendor record with sync failure
                await db.collection('vendor_form').updateOne(
                    { _id: new ObjectId(vendorId) },
                    {
                        $set: {
                            oneDriveSyncStatus: 'failed',
                            oneDriveSyncError: error.message
                        }
                    }
                );
            }
        }

        // Send email notifications based on the status change
        await this.sendStatusChangeNotifications(vendor, status, rejectReason);

        return {
            status: status,
            vendorId: vendorId,
            syncResult: syncResult,
            updated: result.modifiedCount > 0
        };
    },

    /**
     * Sync vendor documents to OneDrive
     * @param {Object} vendor - Vendor data
     * @returns {Promise<Object>} Result of the sync operation
     */
    async syncVendorDocumentsToOneDrive(vendor) {
        try {
            // Call the Microsoft service to sync documents
            const result = await microsoftService.syncVendorDocumentsToOneDrive(vendor);

            // Log the sync operation
            this.logDocumentSync(vendor._id, 'onedrive', result);

            return result;
        } catch (error) {
            console.error('Error in syncVendorDocumentsToOneDrive:', error);

            // Log the failure
            this.logDocumentSync(vendor._id, 'onedrive', { success: false, error: error.message });

            throw error;
        }
    },

    /**
     * Log document sync operations
     * @param {string} vendorId - Vendor ID
     * @param {string} destination - Sync destination (e.g., 'onedrive')
     * @param {Object} result - Sync result
     */
    async logDocumentSync(vendorId, destination, result) {
        try {
            const db = getDb();
            await db.collection('document_sync_logs').insertOne({
                vendorId: vendorId,
                destination: destination,
                result: result,
                timestamp: new Date()
            });
        } catch (error) {
            console.error('Error logging document sync:', error);
        }
    },

    /**
     * Send email notifications when vendor status changes
     * @param {Object} vendor - Vendor data
     * @param {string} status - New status (Approved, Rejected, Pending)
     * @param {string} rejectReason - Reason for rejection (if rejected)
     */
    async sendStatusChangeNotifications(vendor, status, rejectReason) {
        // Send notification to vendor if email is available
        if (vendor.email) {
            if (status === 'Approved') {
                await this.sendApprovalEmail(vendor);
            } else if (status === 'Rejected') {
                await this.sendRejectionEmail(vendor, rejectReason);
            }
        }

        // Send notification to admin
        if (status === 'Rejected') {
            await this.sendAdminNotificationEmail(vendor, rejectReason);
        }
    },

    /**
     * Send approval email to vendor
     * @param {Object} vendor - Vendor data
     */
    async sendApprovalEmail(vendor) {
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: vendor.email,
            subject: 'Your Vendor Registration Has Been Approved',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #004080;">Thank You for Your Vendor Registration</h1>
          <p>Dear ${vendor.companyName},</p>
          <p>We're pleased to inform you that your vendor registration has been approved. Your company is now a registered vendor with CSM Aviation.</p>
          <p>Our team will be in touch with you for further collaboration and opportunities.</p>
          <br>
          <p>Best regards,</p>
          <p>CSM Aviation Team</p>
        </div>
      `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Approval email sent to vendor: ${vendor.companyName}`);
        } catch (error) {
            console.error('Error sending approval email:', error);
        }
    },

    /**
     * Send rejection email to vendor
     * @param {Object} vendor - Vendor data
     * @param {string} rejectReason - Reason for rejection
     */
    async sendRejectionEmail(vendor, rejectReason) {
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: vendor.email,
            subject: 'Regarding Your CSM Aviation Vendor Registration',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #004080;">Vendor Registration Status</h1>
          <p>Dear ${vendor.companyName},</p>
          <p>Thank you for your interest in becoming a vendor with CSM Aviation. We have reviewed your submission and regret to inform you that we are unable to approve your vendor registration at this time.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Reason:</strong></p>
            <p>${rejectReason || 'No specific reason provided.'}</p>
          </div>
          
          <p>If you believe this decision was made in error or if you would like to address the concerns mentioned above, please feel free to contact us.</p>
          <p>We appreciate your understanding and wish you success in your future endeavors.</p>
          <br>
          <p>Best regards,</p>
          <p>CSM Aviation Team</p>
        </div>
      `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Rejection email sent to vendor: ${vendor.companyName}`);
        } catch (error) {
            console.error('Error sending rejection email:', error);
        }
    },

    /**
     * Send notification email to admin
     * @param {Object} vendor - Vendor data
     * @param {string} rejectReason - Reason for rejection
     */
    async sendAdminNotificationEmail(vendor, rejectReason) {
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: process.env.ADMIN_EMAIL,
            subject: `Vendor Rejected: ${vendor.companyName}`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #dc3545;">Vendor Submission Rejected</h1>
          <p><strong>Company:</strong> ${vendor.companyName}</p>
          <p><strong>Email:</strong> ${vendor.email}</p>
          <p><strong>Rejection Reason:</strong></p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">
            ${rejectReason || 'No specific reason provided.'}
          </div>
          <p>This information has been recorded in the database.</p>
        </div>
      `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`Admin notification email sent for vendor: ${vendor.companyName}`);
        } catch (error) {
            console.error('Error sending admin notification email:', error);
        }
    }
};

module.exports = vendorApprovalService;