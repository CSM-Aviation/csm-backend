// utils/testUploadToOperators.js
const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

async function testUploadToOperators() {
  try {
    console.log('Testing upload to OPERATORS folder...');

    // Step 1: Validate environment variables
    console.log('\nStep 1: Checking environment variables...');
    const requiredVars = [
      'TENANT_ID', 
      'CLIENT_ID', 
      'CLIENT_SECRET',
      'MICROSOFT_CHARTER_SITE_ID',
      'MICROSOFT_CHARTER_DRIVE_ID'
    ];
    
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    console.log('✅ Environment variables present');

    // Step 2: Initialize the Microsoft Graph client
    console.log('\nStep 2: Initializing Microsoft Graph client...');
    
    // Create credential using client credentials
    const credential = new ClientSecretCredential(
      process.env.TENANT_ID,
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET
    );

    // Create authentication provider
    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default']
    });

    // Initialize the Graph client
    const client = Client.initWithMiddleware({
      authProvider,
      debugLogging: true
    });
    
    console.log('✅ Microsoft Graph client initialized');

    // Step 3: Get drive information
    console.log('\nStep 3: Getting drive information...');
    const siteId = process.env.MICROSOFT_CHARTER_SITE_ID;
    const driveId = process.env.MICROSOFT_CHARTER_DRIVE_ID;
    
    const drive = await client.api(`/sites/${siteId}/drives/${driveId}`).get();
    console.log(`Drive: ${drive.name}`);
    console.log(`Type: ${drive.driveType}`);
    console.log(`URL: ${drive.webUrl}`);
    console.log('✅ Drive information retrieved');

    // Step 4: Check if OPERATORS folder exists
    console.log('\nStep 4: Looking for OPERATORS folder...');
    
    // Get root folder items
    const rootItems = await client.api(`/sites/${siteId}/drives/${driveId}/root/children`).get();
    
    // Find OPERATORS folder
    const operatorsFolder = rootItems.value.find(item => 
      item.name === 'OPERATORS' && item.folder);
    
    if (!operatorsFolder) {
      throw new Error('OPERATORS folder not found in the root of the specified drive. Please create it first.');
    }
    
    console.log(`✅ OPERATORS folder found! ID: ${operatorsFolder.id}`);

    // Step 5: Create a test subfolder within OPERATORS
    console.log('\nStep 5: Creating test subfolder within OPERATORS...');
    
    // Generate unique folder name with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const testFolderName = `Vendor_test_${timestamp}`;
    
    // Create folder definition
    const folderDefinition = {
      name: testFolderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename'
    };
    
    // Create the folder
    const newFolder = await client
      .api(`/sites/${siteId}/drives/${driveId}/items/${operatorsFolder.id}/children`)
      .post(folderDefinition);
    
    console.log(`✅ Test folder created: ${testFolderName}`);
    console.log(`Folder ID: ${newFolder.id}`);
    console.log(`Folder URL: ${newFolder.webUrl}`);

    // Step 6: Create a test file
    console.log('\nStep 6: Creating test file...');
    const testFilePath = path.join(__dirname, 'test-file.txt');
    const testContent = `This is a test file created at ${new Date().toISOString()}`;
    
    fs.writeFileSync(testFilePath, testContent);
    console.log('✅ Test file created locally');

    // Step 7: Upload the test file to the test folder
    console.log('\nStep 7: Uploading test file to SharePoint...');
    
    const fileContent = fs.readFileSync(testFilePath);
    const fileName = 'test-file.txt';
    
    const uploadResponse = await client
      .api(`/sites/${siteId}/drives/${driveId}/items/${newFolder.id}/children/${fileName}/content`)
      .put(fileContent);
    
    console.log('✅ Test file uploaded successfully!');
    console.log(`File name: ${uploadResponse.name}`);
    console.log(`File ID: ${uploadResponse.id}`);
    console.log(`File URL: ${uploadResponse.webUrl}`);

    // Clean up the test file
    fs.unlinkSync(testFilePath);
    console.log('Deleted local test file');

    console.log('\n✅ Test completed successfully!');
    console.log(`You can verify the upload by checking: ${newFolder.webUrl}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.statusCode) {
      console.error(`Status code: ${error.statusCode}`);
    }
    
    if (error.response && error.response.body) {
      try {
        const errorDetails = JSON.parse(error.response.body);
        console.error('Error details:', JSON.stringify(errorDetails, null, 2));
      } catch {
        console.error('Response body:', error.response.body);
      }
    }
    
    // Provide troubleshooting tips based on error
    if (error.statusCode === 401) {
      console.error('\nAuthentication error (401): Check your credentials in .env file.');
      console.error('Make sure TENANT_ID, CLIENT_ID, and CLIENT_SECRET are correct.');
    } else if (error.statusCode === 403) {
      console.error('\nPermission error (403): The application does not have sufficient permissions.');
      console.error('Ensure that the app has Sites.ReadWrite.All permission and admin consent has been granted.');
    } else if (error.statusCode === 404) {
      console.error('\nResource not found error (404): The specified resource could not be found.');
      console.error('Verify your MICROSOFT_SITE_ID, MICROSOFT_DRIVE_ID values.');
      console.error('Make sure the OPERATORS folder exists in the specified drive.');
    }
  }
}

// Run the test
testUploadToOperators().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});