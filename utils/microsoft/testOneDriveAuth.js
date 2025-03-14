// utils/testOneDriveAuth.js

const microsoftService = require('../../services/microsoftService');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

/**
 * Test Microsoft OneDrive authentication
 */
async function testOneDriveAuth() {
    try {
        console.log('Testing Microsoft OneDrive Authentication...');

        // Step 1: Initialize MSAL client
        console.log('\nStep 1: Initializing MSAL client...');
        microsoftService.initMsal();
        console.log('✅ MSAL client initialized successfully');

        // Step 2: Get authorization URL
        console.log('\nStep 2: Generating authorization URL...');
        const authUrl = await microsoftService.getAuthUrl();
        console.log('✅ Authorization URL generated successfully');
        console.log('\n==== AUTHORIZATION URL ====');
        console.log(authUrl);
        console.log('\nPlease open this URL in your browser, sign in with your Microsoft account,');
        console.log('and authorize the application. After authorization, you will be redirected to your configured redirect URI.');
        console.log('\nMake sure your redirect URI is correctly configured in your Azure app registration and in your .env file.');
        console.log('\nAfter successful authentication, check the .token-cache.json file in the project root directory.');
        console.log('If the file exists and contains tokens, then authentication was successful.');

        console.log('\nOnce authenticated, you can run the following script to test the OneDrive connection:');
        console.log('\n    node utils/testOneDriveConnection.js');

    } catch (error) {
        console.error('\n❌ Error:', error);
        console.error('Error details:', error.stack);
    }
}

// Main function to run the test
async function main() {
    console.log('Microsoft OneDrive Authentication Test Utility');
    console.log('==========================================');

    // Check required environment variables
    const requiredVars = ['TENANT_ID', 'CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
        console.error(`\n❌ Error: Missing required environment variables: ${missingVars.join(', ')}`);
        console.error('Please add these to your .env file.');
        process.exit(1);
    }

    await testOneDriveAuth();
}

// Run the test if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { testOneDriveAuth };