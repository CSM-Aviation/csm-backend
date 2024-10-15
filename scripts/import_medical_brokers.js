const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { connectToDatabase, getDb } = require('../services/dbService');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function importMedicalBrokers() {
    const results = [];

    await new Promise((resolve, reject) => {
        fs.createReadStream(path.resolve(__dirname, 'CSM_Medical_Brokers(csm_fleet).csv'))
            .pipe(csv({
                mapValues: ({ header, index, value }) => value.trim(),
                mapHeaders: ({ header }) => header.trim()
            }))
            .on('data', (data) => {
                results.push(data);
            })
            .on('end', resolve)
            .on('error', reject);
    });

    function cleanInput(input) {
        return input ? input.trim() : '';
    }

    function getField(row, fieldName) {
        const normalizedFieldName = fieldName.toLowerCase().replace(/\s+/g, '');
        for (const [key, value] of Object.entries(row)) {
            if (key.toLowerCase().replace(/\s+/g, '') === normalizedFieldName) {
                return value;
            }
        }
        return undefined;
    }

    try {
        await connectToDatabase();
        const db = getDb();

        for (const row of results) {
            const companyName = cleanInput(getField(row, 'Company Name'));
            const emails = cleanInput(getField(row, 'Main Email')).split(',').map(email => email.trim());
            const mainPhone = cleanInput(getField(row, 'Main Phone'));

            const user = {
                username: emails[0] || companyName.toLowerCase().replace(/\s+/g, '_'),
                password: bcrypt.hashSync('temporaryPassword123', 10),
                userType: 'medicalBroker',
                email: emails[0],
                companyName: companyName,
                additionalEmails: emails.slice(1),
                phoneNumber: mainPhone,
                marketingPreferences: {
                    emailSubscribed: true,
                    smsSubscribed: Boolean(mainPhone),
                    preferredContactMethod: 'email'
                },
                notes: `Medical Broker: ${companyName}`,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            try {
                const result = await db.collection('users').insertOne(user);
                console.log(`Medical Broker processed: ${user.companyName}`);
                console.log('Inserted document:', result.insertedId);
            } catch (error) {
                console.error(`Failed to process medical broker: ${user.companyName}`);
                console.error('Error details:', error.message);
                if (error.errInfo && error.errInfo.details) {
                    console.error('Validation errors:', JSON.stringify(error.errInfo.details, null, 2));
                }
            }
        }
    } catch (error) {
        console.error('Database connection error:', error);
    } finally {
        console.log('Import process completed');
    }
}

importMedicalBrokers().catch(console.error);