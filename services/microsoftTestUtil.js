// utils/microsoftTestUtil.js
// This is a utility to test your Microsoft Graph API integration

const microsoftService = require('../services/microsoftService');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables
dotenv.config();

/**
 * Test Microsoft Graph API integration
 */
async function testMicrosoftIntegration() {
  try {
    console.log('Testing Microsoft Graph API integration with OneDrive...');

    // Step 1: Test initialization
    console.log('\nStep 1: Testing initialization...');
    const client = microsoftService.initialize();
    console.log('✅ Microsoft Graph client initialized successfully');

    // Step 2: Test authentication by getting OneDrive info
    console.log('\nStep 2: Testing authentication by getting OneDrive info...');
    const drive = await client.api('/me/drive').get();
    console.log('✅ Authentication successful');
    console.log(`Drive name: ${drive.name}`);
    console.log(`Drive ID: ${drive.id}`);
    console.log(`Drive owner: ${drive.owner.user.displayName}`);

    // Step 3: Test folder creation in personal OneDrive
    console.log('\nStep 3: Testing folder creation in OneDrive...');
    const testFolderPath = 'OPERATORS/test_folder_' + Date.now();
    
    // Use OneDrive API
    const driveAPI = client.api('/me/drive');
    console.log('Using personal OneDrive');

    // Create test folder
    const folderRef = await microsoftService.ensureFolderPath(driveAPI, testFolderPath);
    console.log(`✅ Test folder created: ${testFolderPath}`);

    // Step 4: Test file upload to OneDrive
    console.log('\nStep 4: Testing file upload to OneDrive...');

    // Create a simple test file
    const testFilePath = path.join(__dirname, 'test-file.txt');
    fs.writeFileSync(testFilePath, 'This is a test file created by CSM Aviation Microsoft integration test.');

    const fileContent = fs.readFileSync(testFilePath);
    const fileName = 'test-file.txt';

    // Prepare file data for upload
    const fileData = {
      content: fileContent,
      name: fileName,
      contentType: 'text/plain'
    };

    // Prepare destination information for OneDrive
    const destination = {
      // No siteId or driveId needed for personal OneDrive
      folderPath: testFolderPath
    };

    // Upload the file
    const uploadResult = await microsoftService.uploadFile(fileData, destination);
    console.log(`✅ Test file uploaded successfully: ${fileName}`);
    console.log(`File URL: ${uploadResult.webUrl}`);

    // Clean up test file
    fs.unlinkSync(testFilePath);

    // Step 5: Test vendor document sync simulation with OneDrive
    console.log('\nStep 5: Testing vendor document sync simulation with OneDrive...');

    // Create a mock vendor with documents
    const mockVendor = {
      _id: 'test123',
      companyName: 'Test Vendor Company',
      email: 'test@example.com',
      documents: {
        certificate: 'https://example.com/test-certificate.pdf',
        insurance: 'https://example.com/test-insurance.pdf'
      }
    };

    // Mock the downloadFileFromUrl method to avoid actual downloads
    const originalDownloadMethod = microsoftService.downloadFileFromUrl;
    microsoftService.downloadFileFromUrl = async (url, docType) => {
      console.log(`Simulating download of ${docType} from ${url}`);
      return {
        content: Buffer.from(`Mock content for ${docType}`),
        name: `${docType}_test.pdf`,
        contentType: 'application/pdf'
      };
    };

    try {
      // Run the sync operation with our mock
      const syncResult = await microsoftService.syncVendorDocumentsToOneDrive(mockVendor);
      console.log('✅ Document sync simulation successful');
      console.log(`Folder path: ${syncResult.folderPath}`);
      console.log(`Success count: ${syncResult.results.success.length}`);
      console.log(`Failed count: ${syncResult.results.failed.length}`);
    } catch (error) {
      console.error('❌ Document sync simulation failed:', error.message);
    }

    // Restore the original method
    microsoftService.downloadFileFromUrl = originalDownloadMethod;

    console.log('\n✅ Microsoft Graph API OneDrive integration test completed successfully');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('Error details:', error.stack);

    // Check for common errors and provide helpful messages
    if (error.statusCode === 401) {
      console.error('\nAuthentication error: Please check your TENANT_ID, CLIENT_ID, and CLIENT_SECRET.');
      console.error('For personal OneDrive, make sure your Microsoft account has the right permissions.');
    } else if (error.statusCode === 403) {
      console.error('\nPermission error: The application does not have sufficient permissions.');
      console.error('Please ensure you\'ve granted consent for "Files.ReadWrite.All" permission in the Azure Portal.');
    } else if (error.message && error.message.includes('TENANT_ID')) {
      console.error('\nMissing environment variables: Please check your .env file.');
    }
  }
}

// Main function to run the test
async function main() {
  console.log('Microsoft OneDrive API Test Utility');
  console.log('=================================');

  // Check required environment variables
  const requiredVars = ['TENANT_ID', 'CLIENT_ID', 'CLIENT_SECRET'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error(`\n❌ Error: Missing required environment variables: ${missingVars.join(', ')}`);
    console.error('Please add these to your .env file.');
    process.exit(1);
  }

  await testMicrosoftIntegration();
}

// Run the test if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { testMicrosoftIntegration };