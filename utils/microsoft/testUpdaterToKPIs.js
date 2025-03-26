// utils/microsoft/testUpdaterToKPIs.js
const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');
const dotenv = require('dotenv');

dotenv.config();

async function testUpdaterToKPIs() {
  try {
    console.log('Testing access to KPI Excel file in SharePoint...');

    // Step 1: Validate environment variables
    console.log('\nStep 1: Checking environment variables...');
    const requiredVars = [
      'TENANT_ID', 
      'CLIENT_ID', 
      'CLIENT_SECRET',
      'MICROSOFT_MARKETING_SITE_ID',
      'MICROSOFT_MARKETING_DRIVE_ID'
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
    const siteId = process.env.MICROSOFT_MARKETING_SITE_ID;
    const driveId = process.env.MICROSOFT_MARKETING_DRIVE_ID;
    
    const drive = await client.api(`/sites/${siteId}/drives/${driveId}`).get();
    console.log(`Drive: ${drive.name}`);
    console.log(`Type: ${drive.driveType}`);
    console.log(`URL: ${drive.webUrl}`);
    console.log('✅ Drive information retrieved');

    // Step 4: Get all items in the drive
    console.log('\nStep 4: Getting all items in the drive...');
    
    // Get root folder items
    const rootItems = await client.api(`/sites/${siteId}/drives/${driveId}/root/children`).get();
    
    // Display all items
    console.log('\nItems in the drive root:');
    if (rootItems.value && rootItems.value.length > 0) {
      rootItems.value.forEach((item, index) => {
        console.log(`\nItem ${index + 1}:`);
        console.log(`Name: ${item.name}`);
        console.log(`Type: ${item.folder ? 'Folder' : 'File'}`);
        console.log(`ID: ${item.id}`);
        console.log(`URL: ${item.webUrl}`);
        if (item.folder) {
          console.log(`Child count: ${item.folder.childCount}`);
        }
        if (item.file) {
          console.log(`Size: ${item.size} bytes`);
          console.log(`MIME type: ${item.file.mimeType}`);
        }
      });
      console.log(`\nTotal items: ${rootItems.value.length}`);
    } else {
      console.log('No items found in the drive root.');
    }
    
    // Step 5: Look for Excel files in the drive
    console.log('\nStep 5: Looking for Excel files in the drive...');
    
    const excelFiles = rootItems.value.filter(item => 
      item.file && item.name.toLowerCase().endsWith('.xlsx'));
    
    if (excelFiles.length > 0) {
      console.log(`\nFound ${excelFiles.length} Excel files:`);
      excelFiles.forEach((file, index) => {
        console.log(`\nExcel file ${index + 1}:`);
        console.log(`Name: ${file.name}`);
        console.log(`ID: ${file.id}`);
        console.log(`URL: ${file.webUrl}`);
      });
    } else {
      console.log('No Excel files found in the drive root.');
    }
    
    // Step 6: Get KPI's folder (if exists)
    console.log('\nStep 6: Looking for KPI\'s folder...');
    
    const kpisFolder = rootItems.value.find(item => 
      item.folder && (item.name === "KPI's" || item.name.toLowerCase() === "kpis_test"));
    
    // Initialize kpisFolderItems outside the if block
    let kpisFolderItems = { value: [] };
    
    if (kpisFolder) {
      console.log(`\nFound KPI's folder:`);
      console.log(`Name: ${kpisFolder.name}`);
      console.log(`ID: ${kpisFolder.id}`);
      console.log(`URL: ${kpisFolder.webUrl}`);
      
      // Get items in the KPI's folder
      kpisFolderItems = await client
        .api(`/sites/${siteId}/drives/${driveId}/items/${kpisFolder.id}/children`)
        .get();
      
      console.log(`\nItems in the KPI's folder:`);
      if (kpisFolderItems.value && kpisFolderItems.value.length > 0) {
        kpisFolderItems.value.forEach((item, index) => {
          console.log(`\nItem ${index + 1}:`);
          console.log(`Name: ${item.name}`);
          console.log(`Type: ${item.folder ? 'Folder' : 'File'}`);
          console.log(`ID: ${item.id}`);
          console.log(`URL: ${item.webUrl}`);
        });
      } else {
        console.log('No items found in the KPI\'s folder.');
      }
    } else {
      console.log('KPI\'s folder not found in the drive root.');
    }

    // Step 7: Read and write to specific cells in an Excel file
    console.log('\nStep 7: Reading and writing to Excel cells...');
    
    // Find the Excel file to work with (example: first Excel file in KPI's folder or root)
    let excelFile = null;
    
    // Look for the specific Excel file in the KPI's folder
    if (kpisFolder && kpisFolderItems.value && kpisFolderItems.value.length > 0) {
      excelFile = kpisFolderItems.value.find(item => 
        item.file && item.name === 'CSM_website_KPIs_test.xlsx');
      
      if (excelFile) {
        console.log(`Found target Excel file in KPI's folder: ${excelFile.name}`);
      }
    }
    
    // If no Excel file found in KPI's folder, use the first one from root
    if (!excelFile && excelFiles.length > 0) {
      excelFile = excelFiles[0];
    }
    
    if (excelFile) {
      console.log(`\nWorking with Excel file: ${excelFile.name} (ID: ${excelFile.id})`);
      
      // Get workbook object
      const workbook = await client
        .api(`/sites/${siteId}/drives/${driveId}/items/${excelFile.id}/workbook`)
        .get();
      
      console.log('Workbook accessed successfully');
      
      // Get worksheets in the workbook
      const worksheets = await client
        .api(`/sites/${siteId}/drives/${driveId}/items/${excelFile.id}/workbook/worksheets`)
        .get();
      
      console.log('\nWorksheets in the workbook:');
      worksheets.value.forEach((sheet, index) => {
        console.log(`${index + 1}. ${sheet.name} (ID: ${sheet.id})`);
      });
      
      if (worksheets.value.length > 0) {
        // Use the first worksheet
        const worksheet = worksheets.value[0];
        console.log(`\nWorking with worksheet: ${worksheet.name}`);
        
        // Example 1: Read a specific cell (e.g., A1)
        try {
          const cellA1 = await client
            .api(`/sites/${siteId}/drives/${driveId}/items/${excelFile.id}/workbook/worksheets('${worksheet.name}')/range(address='A1')`)
            .get();
          
          console.log('\nReading cell A1:');
          console.log(`Value: ${cellA1.values[0][0]}`);
        } catch (error) {
          console.error('Error reading cell A1:', error.message);
        }
        
        // Example 2: Read a range of cells (e.g., A1:C3)
        try {
          const rangeA1C3 = await client
            .api(`/sites/${siteId}/drives/${driveId}/items/${excelFile.id}/workbook/worksheets('${worksheet.name}')/range(address='A1:C3')`)
            .get();
          
          console.log('\nReading range A1:C3:');
          console.log('Values:');
          rangeA1C3.values.forEach((row, rowIndex) => {
            console.log(`Row ${rowIndex + 1}: ${JSON.stringify(row)}`);
          });
        } catch (error) {
          console.error('Error reading range A1:C3:', error.message);
        }
        
        // Example 3: Write to a specific cell (e.g., D1)
        try {
          const cellToUpdate = 'D1';
          const newValue = 'Updated: ' + new Date().toISOString();
          
          await client
            .api(`/sites/${siteId}/drives/${driveId}/items/${excelFile.id}/workbook/worksheets('${worksheet.name}')/range(address='${cellToUpdate}')`)
            .patch({
              values: [[newValue]]
            });
          
          console.log(`\nSuccessfully wrote to cell ${cellToUpdate}: "${newValue}"`);
        } catch (error) {
          console.error('Error writing to cell D1:', error.message);
        }
        
        // Example 4: Write to a range of cells (e.g., D4:F6)
        try {
          const rangeToUpdate = 'D4:F6';
          // Create a 3x3 array of values to write
          const newValues = [
            ['Row 1, Col 1', 'Row 1, Col 2', 'Row 1, Col 3'],
            ['Row 2, Col 1', 'Row 2, Col 2', 'Row 2, Col 3'],
            ['Row 3, Col 1', 'Row 3, Col 2', 'Row 3, Col 3']
          ];
          
          await client
            .api(`/sites/${siteId}/drives/${driveId}/items/${excelFile.id}/workbook/worksheets('${worksheet.name}')/range(address='${rangeToUpdate}')`)
            .patch({
              values: newValues
            });
          
          console.log(`\nSuccessfully wrote to range ${rangeToUpdate}`);
        } catch (error) {
          console.error(`Error writing to range ${rangeToUpdate}:`, error.message);
        }
        
        // Example 5: Write to specific cells by coordinates
        try {
          // Function to write to a specific cell by row and column index
          async function writeToCellByCoordinates(worksheetName, rowIndex, columnIndex, value) {
            // Convert to Excel's column notation (0 = A, 1 = B, etc.)
            const columnLetter = String.fromCharCode(65 + columnIndex); // 65 is ASCII for 'A'
            const cellAddress = `${columnLetter}${rowIndex + 1}`; // +1 because Excel is 1-indexed
            
            await client
              .api(`/sites/${siteId}/drives/${driveId}/items/${excelFile.id}/workbook/worksheets('${worksheetName}')/range(address='${cellAddress}')`)
              .patch({
                values: [[value]]
              });
            
            return cellAddress;
          }
          
          // Write to cell at row 10, column 2 (C11 in Excel)
          const cellAddress = await writeToCellByCoordinates(worksheet.name, 10, 2, 'Written by coordinates');
          console.log(`\nSuccessfully wrote to cell ${cellAddress} using coordinates`);
        } catch (error) {
          console.error('Error writing to cell by coordinates:', error.message);
        }
      } else {
        console.log('No worksheets found in the workbook.');
      }
    } else {
      console.log('No Excel files found to work with.');
    }

    console.log('\n✅ Test completed successfully!');

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
      console.error('Ensure that the app has Sites.ReadWrite.All and Files.ReadWrite.All permissions and admin consent has been granted.');
    } else if (error.statusCode === 404) {
      console.error('\nResource not found error (404): The specified resource could not be found.');
      console.error('Verify your MICROSOFT_MARKETING_SITE_ID, MICROSOFT_MARKETING_DRIVE_ID values.');
    }
  }
}

// Run the test
testUpdaterToKPIs().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});