const { Client } = require("@microsoft/microsoft-graph-client");
const { TokenCredentialAuthenticationProvider } = require("@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials");
const { ClientSecretCredential } = require("@azure/identity");
const { getDb } = require('../services/dbService');

// Initialize the Microsoft Graph client
// const credential = new ClientSecretCredential(
//     process.env.TENANT_ID,
//     process.env.CLIENT_ID,
//     process.env.CLIENT_SECRET
// );

// const authProvider = new TokenCredentialAuthenticationProvider(credential, {
//     scopes: ['https://graph.microsoft.com/.default']
// });

// const client = Client.initWithMiddleware({ authProvider });

// // Function to send email using Microsoft Graph API
// async function sendEmail(subject, content, recipient) {
//     const message = {
//         subject: subject,
//         body: {
//             contentType: 'HTML',
//             content: content
//         },
//         toRecipients: [
//             {
//                 emailAddress: {
//                     address: recipient
//                 }
//             }
//         ]
//     };

//     try {
//         await client.api('/users/gkallem@csmaviation.com/sendMail')
//             .post({ message });
//         console.log('Email sent successfully');
//     } catch (error) {
//         console.error('Error sending email:', error);
//         throw error;
//     }
// }

// Updated trip request submission function
exports.submitTripRequest = async (req, res) => {
    try {
        const db = getDb();
        const tripRequest = {
            ...req.body,
            createdAt: new Date()
        };
        const result = await db.collection('trip_requests').insertOne(tripRequest);

        // Prepare email content
        const emailContent = `
            <h1>New Trip Request</h1>
            <p><strong>Name:</strong> ${tripRequest.firstName} ${tripRequest.lastName}</p>
            <p><strong>Email:</strong> ${tripRequest.email}</p>
            <p><strong>Phone:</strong> ${tripRequest.phone}</p>
            <p><strong>Aircraft Type:</strong> ${tripRequest.aircraftType}</p>
            <p><strong>Trip Type:</strong> ${tripRequest.tripType}</p>
            <p><strong>Departure:</strong> ${tripRequest.departureLocation} on ${tripRequest.startDate} at ${tripRequest.departureTime}</p>
            <p><strong>Destination:</strong> ${tripRequest.destinationLocation}</p>
            ${tripRequest.returnDate ? `<p><strong>Return:</strong> on ${tripRequest.returnDate} at ${tripRequest.returnTime}</p>` : ''}
            <p><strong>Trip Details:</strong> ${tripRequest.tripDetails}</p>
        `;

        // Send email notification
        // await sendEmail(
        //     "New Trip Request Submitted",
        //     emailContent,
        //     process.env.EMAIL_TO
        // );

        res.status(201).json({ message: 'Trip request submitted successfully', id: result.insertedId });
    } catch (error) {
        console.error('Error saving trip request or sending email:', error);
        res.status(500).json({ error: 'Server error' });
    }
};