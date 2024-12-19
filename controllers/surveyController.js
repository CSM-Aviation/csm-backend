const { getDb } = require('../services/dbService');
const nodemailer = require('nodemailer');
const { ObjectId } = require('mongodb');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

function generateSignedUrl(surveyId, action) {
    return jwt.sign(
        { 
            surveyId,
            action,
            exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days expiration
        },
        process.env.JWT_SECRET
    );
}

exports.submitSurvey = async (req, res) => {
    try {
        const {
            fullName,
            bookingEfficiency,
            aircraftCleanliness,
            cabinComfort,
            crewProfessionalism,
            overallSatisfaction,
            willRecommend,
            email,
            comments
        } = req.body;

        const db = getDb();

        const survey = {
            fullName,
            bookingEfficiency: parseInt(bookingEfficiency),
            aircraftCleanliness: parseInt(aircraftCleanliness),
            cabinComfort: parseInt(cabinComfort),
            crewProfessionalism: parseInt(crewProfessionalism),
            overallSatisfaction: parseInt(overallSatisfaction),
            willRecommend: willRecommend === 'Yes',
            email,
            comments,
            approved: null,
            submittedAt: new Date()
        };

        const result = await db.collection('customer_surveys').insertOne(survey);

        // Only send admin email if willRecommend is true
        if (willRecommend === 'Yes') {
            // Generate signed URLs for approval/rejection
            const baseUrl = process.env.API_BASE_URL || 'http://localhost:5000';
            const approveToken = generateSignedUrl(result.insertedId.toString(), 'approve');
            const rejectToken = generateSignedUrl(result.insertedId.toString(), 'reject');
            
            const approveUrl = `${baseUrl}/api/surveys/approve/${approveToken}`;
            const rejectUrl = `${baseUrl}/api/surveys/reject/${rejectToken}`;

            // Email template
            const mailOptions = {
                from: process.env.GMAIL_USER,
                to: process.env.ADMIN_EMAIL,
                subject: 'New Testimonial Pending Approval',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h1 style="color: #004080;">New Testimonial Submission</h1>
                        
                        <div style="margin: 20px 0; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
                            <h2 style="color: #333;">Customer Details:</h2>
                            <p><strong>Name:</strong> ${fullName}</p>
                            <p><strong>Email:</strong> ${email || 'Not provided'}</p>
                            
                            <h2 style="color: #333; margin-top: 20px;">Ratings:</h2>
                            <ul style="list-style: none; padding: 0;">
                                <li>Booking Efficiency: ${bookingEfficiency}/5</li>
                                <li>Aircraft Cleanliness: ${aircraftCleanliness}/5</li>
                                <li>Cabin Comfort: ${cabinComfort}/5</li>
                                <li>Crew Professionalism: ${crewProfessionalism}/5</li>
                                <li>Overall Satisfaction: ${overallSatisfaction}/5</li>
                            </ul>
                            
                            <h2 style="color: #333; margin-top: 20px;">Testimonial:</h2>
                            <p style="background: white; padding: 15px; border-radius: 5px;">${comments}</p>
                            
                            <p><strong>Willing to Recommend:</strong> ${willRecommend}</p>
                            <p><strong>Submitted At:</strong> ${survey.submittedAt.toLocaleString()}</p>
                        </div>
                        
                        <div style="text-align: center; margin-top: 30px;">
                            <div style="margin-bottom: 20px;">
                                <a href="${approveUrl}" 
                                style="background-color: #28a745; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin-right: 10px; display: inline-block;">
                                    PUBLISH TESTIMONIAL
                                </a>
                            </div>
                            <div>
                                <a href="${rejectUrl}" 
                                style="background-color: #dc3545; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; display: inline-block;">
                                    DON'T PUBLISH TESTIMONIAL
                                </a>
                            </div>
                        </div>
                        
                        <p style="margin-top: 30px; font-size: 12px; color: #666; text-align: center;">
                            These links will expire in 7 days for security purposes.
                        </p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);

        }

        res.status(201).json({ 
            message: 'Survey submitted successfully', 
            id: result.insertedId 
        });
    } catch (error) {
        console.error('Error saving survey or sending email:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.handleApproval = async (req, res) => {
    try {
        const { token } = req.params;
        const isApproval = req.path.includes('/approve/');

        // Verify and decode the token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.send(`
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; text-align: center;">
                    <h1 style="color: #dc3545;">Invalid or Expired Link</h1>
                    <p>This approval link has expired or is invalid. Please request a new one.</p>
                </div>
            `);
        }

        if (decoded.action !== (isApproval ? 'approve' : 'reject')) {
            return res.send('<h1>Invalid action</h1>');
        }

        const db = getDb();
        const survey = await db.collection('customer_surveys').findOne({
            _id: new ObjectId(decoded.surveyId)
        });

        if (!survey) {
            return res.send('<h1>Testimonial not found</h1>');
        }

        if (survey.approved !== null) {
            return res.send('<h1>This testimonial has already been processed</h1>');
        }

        // Update approval status
        await db.collection('customer_surveys').updateOne(
            { _id: new ObjectId(decoded.surveyId) },
            { $set: { approved: isApproval } }
        );

        // Send notification email to customer if approved
        if (isApproval && survey.email) {
            const customerMailOptions = {
                from: process.env.GMAIL_USER,
                to: survey.email,
                subject: 'Your Testimonial Has Been Approved',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h1 style="color: #004080;">Thank You for Your Testimonial</h1>
                        <p>Dear ${survey.fullName},</p>
                        <p>We're pleased to inform you that your testimonial has been approved and will be featured on our <a href="https://www.csmaviation.com/">website</a> in the Testimonials section.</p>
                        <p>Thank you for helping us share your experience with others!</p>
                        <br>
                        <p>Best regards,</p>
                        <p>CSM Aviation Team</p>
                    </div>
                `
            };
            await transporter.sendMail(customerMailOptions);
        }

        res.send(`
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 40px auto; text-align: center;">
                <h1 style="color: ${isApproval ? '#28a745' : '#dc3545'};">
                    Testimonial ${isApproval ? 'Approved' : 'Rejected'} Successfully
                </h1>
                <p>The testimonial has been ${isApproval ? 'approved' : 'rejected'} and the customer ${
                    isApproval && survey.email ? 'has been notified.' : 'will not be notified.'
                }</p>
            </div>
        `);

    } catch (error) {
        console.error('Error handling approval:', error);
        res.status(500).send('<h1>An error occurred while processing the request</h1>');
    }
};

exports.updateApprovalStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { approved } = req.body;
        
        if (typeof approved !== 'boolean') {
            return res.status(400).json({ error: 'Approved status must be a boolean' });
        }

        const db = getDb();
        const survey = await db.collection('customer_surveys').findOne({
            _id: new ObjectId(id)
        });

        if (!survey) {
            return res.status(404).json({ error: 'Survey not found' });
        }

        const result = await db.collection('customer_surveys').updateOne(
            { _id: new ObjectId(id) },
            { $set: { approved } }
        );

        // If the update was successful and there's an email address, send notification
        if (result.modifiedCount > 0 && approved && survey.email) {
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.GMAIL_USER,
                    pass: process.env.GMAIL_APP_PASSWORD,
                },
            });

            const mailOptions = {
                from: process.env.GMAIL_USER,
                to: survey.email,
                subject: 'Your Testimonial Has Been Approved',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h1 style="color: #004080;">Thank You for Your Testimonial</h1>
                        <p>Dear ${survey.fullName},</p>
                        <p>We're pleased to inform you that your testimonial has been approved and will be featured on our <a href="https://www.csmaviation.com/">website</a> in the Testimonials section..</p>
                        <p>Thank you for sharing your experience with us!</p>
                        <br>
                        <p>Best regards,</p>
                        <p>CSM Aviation Team</p>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
        }

        res.json({ 
            message: `Survey ${approved ? 'approved' : 'rejected'} successfully`,
            surveyId: id,
            approved
        });
    } catch (error) {
        console.error('Error updating survey approval status:', error);
        res.status(500).json({ error: 'Server error' });
    }
};



exports.getApprovedSurveys = async (req, res) => {
    try {
        const db = getDb();
        const surveys = await db.collection('customer_surveys')
            .find({ approved: true })
            .sort({ submittedAt: -1 })
            .toArray();

        res.json(surveys);
    } catch (error) {
        console.error('Error fetching surveys:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getAllSurveys = async (req, res) => {
    try {
        const db = getDb();
        const surveys = await db.collection('customer_surveys')
            .find({})
            .sort({ submittedAt: -1 })
            .toArray();

        res.json(surveys);
    } catch (error) {
        console.error('Error fetching surveys:', error);
        res.status(500).json({ error: 'Server error' });
    }
};