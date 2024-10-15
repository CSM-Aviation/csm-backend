const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { connectToDatabase, getDb } = require('../services/dbService');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function importUsers() {
    const results = [];

    // Read the raw buffer first
    const rawBuffer = fs.readFileSync(path.resolve(__dirname, 'contacts.csv'));
    // console.log('Raw buffer:', rawBuffer);
    // console.log('Raw buffer as string:', rawBuffer.toString());

    await new Promise((resolve, reject) => {
        fs.createReadStream(path.resolve(__dirname, 'contacts.csv'))
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

    // console.log('Raw results:', JSON.stringify(results, null, 2));

    try {
        await connectToDatabase();
        const db = getDb();

        results.forEach(async (row, index) => {
            // console.log(`\nProcessing row ${index + 1}:`);
            // console.log('Row data:', JSON.stringify(row, null, 2));
            // console.log('Row keys:', Object.keys(row));

            // // Debug: Log each field individually
            // console.log('First Name:', getField(row, 'First Name'));
            // console.log('Last Name:', getField(row, 'Last Name'));
            // console.log('Email 1:', getField(row, 'Email 1'));
            // console.log('Phone 1:', getField(row, 'Phone 1'));

            // Additional debugging
            // console.log('All fields:');
            for (const [key, value] of Object.entries(row)) {
                // console.log(`  ${key}: ${value}`);
            }

            const user = {
                username: cleanInput(getField(row, 'Email 1')) || `${cleanInput(getField(row, 'First Name'))}${cleanInput(getField(row, 'Last Name'))}`.toLowerCase(),
                password: bcrypt.hashSync('temporaryPassword123', 10),
                userType: 'individual',
                email: cleanInput(getField(row, 'Email 1')),
                firstName: cleanInput(getField(row, 'First Name')),
                lastName: cleanInput(getField(row, 'Last Name')),
                phoneNumber: cleanInput(getField(row, 'Phone 1')),
                flightFrequency: 'rarely',
                preferredAircraftTypes: [],
                marketingPreferences: {
                    emailSubscribed: Boolean(cleanInput(getField(row, 'Email 1'))),
                    smsSubscribed: Boolean(cleanInput(getField(row, 'Phone 1'))),
                    preferredContactMethod: cleanInput(getField(row, 'Email 1')) ? 'email' : (cleanInput(getField(row, 'Phone 1')) ? 'phone' : 'email')
                },
                notes: `Source: ${cleanInput(getField(row, 'Source'))}, Labels: ${cleanInput(getField(row, 'Labels')) || 'N/A'}`,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // console.log('User object:', JSON.stringify(user, null, 2));

            try {
                // Uncomment the next line when ready to insert into the database
                const result = await db.collection('users').insertOne(user);
                console.log(`User processed: ${user.firstName} ${user.lastName}`);
                console.log('Inserted document:', result.insertedId);
            } catch (error) {
                console.error(`Failed to process user: ${user.username}`);
                console.error('Error details:', error.message);
                if (error.errInfo && error.errInfo.details) {
                    console.error('Validation errors:', JSON.stringify(error.errInfo.details, null, 2));
                }
            }
        });
    } catch (error) {
        console.error('Database connection error:', error);
    } finally {
        console.log('Import process completed');
    }
}

importUsers().catch(console.error);