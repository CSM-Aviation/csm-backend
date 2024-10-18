const { getDb } = require('../services/dbService');
const nodemailer = require('nodemailer');

// Create a transporter using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

exports.submitContact = async (req, res) => {
  try {
    const { firstName, lastName, email, message } = req.body;
    const db = getDb();
    const result = await db.collection('contacts').insertOne({
      firstName,
      lastName,
      email,
      message,
      createdAt: new Date()
    });

    // Prepare email content
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: 'New Contact Form Submission',
      html: `
          <h1>New Contact Form Submission</h1>
          <p><strong>Name:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong> ${message}</p>
        `
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.status(201).json({ message: 'Contact form submitted successfully', id: result.insertedId });
  } catch (error) {
    console.error('Error saving contact form or sending email:', error);
    res.status(500).json({ error: 'Server error' });
  }
};