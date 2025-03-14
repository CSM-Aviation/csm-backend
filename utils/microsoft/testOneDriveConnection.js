// utils/testOneDriveConnection.js

const microsoftService = require('../../services/microsoftService');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

/**
 * Test Microsoft OneDrive connection
 */
async function testOneDriveConnection() {
    try {
        console.log('Testing Microsoft OneDrive Connection...');

        // Check if token cache exists
        const tokenCachePath = path.join(__dirname, '../../.token-cache.json');
        if (!fs.existsSync(tokenCachePath)) {
            console.error('\n❌ Error: Token cache not found. Please authenticate first using:');
            console.error('\n    node utils/testOneDriveAuth.js');
            process.exit(1);
        }

        // Step 1: Initialize Graph client
        console.log('\nStep 1: Initializing Microsoft Graph client...');
        const client = await microsoftService.initialize();
        console.log('✅ Microsoft Graph client initialized successfully');

        // Step 2: Get OneDrive information
        console.log('\nStep 2: Getting OneDrive information...');
        const drive = await client.api('/me/drive').get();
        console.log('✅ OneDrive information retrieved successfully');
        console.log(`Drive Name: ${drive.name}`);
        console.log(`Drive ID: ${drive.id}`);
        console.log(`Drive Owner: ${drive.owner?.user?.displayName || 'Unknown'}`);
        console.log(`Drive Type: ${drive.driveType}`);
        console.log(`Web URL: ${drive.webUrl}`);

        // Step 3: Test folder creation
        console.log('\nStep 3: Creating test folder in OneDrive...');
        const testFolderPath = `Charter_OPERATORS/Vendor_test1`;
        const folderInfo = await microsoftService.ensureFolderPath(testFolderPath);
        console.log('✅ Test folder created successfully');
        console.log(`Folder ID: ${folderInfo.folderId}`);
        console.log(`Folder Path: ${folderInfo.folderPath}`);
        console.log(`Web URL: ${folderInfo.webUrl}`);

        // Step 4: Test file upload
        console.log('\nStep 4: Uploading test file to OneDrive...');
        const testFilePath = path.join(__dirname, 'test-file.txt');
        const testContent = 'This is a test file created at ' + new Date().toISOString();
        fs.writeFileSync(testFilePath, testContent);

        const fileData = {
            content: fs.readFileSync(testFilePath),
            name: 'test-file.txt',
            contentType: 'text/plain'
        };

        const destination = {
            folderPath: testFolderPath
        };

        const uploadResult = await microsoftService.uploadFile(fileData, destination);
        console.log('✅ Test file uploaded successfully');
        console.log(`File Name: ${uploadResult.name}`);
        console.log(`File ID: ${uploadResult.id}`);
        console.log(`Web URL: ${uploadResult.webUrl}`);

        // Clean up test file
        fs.unlinkSync(testFilePath);

        console.log('\n✅ Microsoft OneDrive connection test completed successfully');

    } catch (error) {
        console.error('\n❌ Error:', error);
        
        if (error.message && error.message.includes('No authenticated accounts found')) {
            console.error('\nAuthentication required. Please run:');
            console.error('\n    node utils/testOneDriveAuth.js');
        } else if (error.statusCode === 401) {
            console.error('\nAccess token expired or invalid. Please re-authenticate by running:');
            console.error('\n    node utils/testOneDriveAuth.js');
        } else {
            console.error('Error details:', error.stack);
        }
    }
}

// Main function to run the test
async function main() {
    console.log('Microsoft OneDrive Connection Test Utility');
    console.log('=======================================');

    // Check required environment variables
    const requiredVars = ['TENANT_ID', 'CLIENT_ID', 'CLIENT_SECRET', 'REDIRECT_URI'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);

    if (missingVars.length > 0) {
        console.error(`\n❌ Error: Missing required environment variables: ${missingVars.join(', ')}`);
        console.error('Please add these to your .env file.');
        process.exit(1);
    }

    await testOneDriveConnection();
}

// Run the test if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { testOneDriveConnection };