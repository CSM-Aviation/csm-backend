const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');
const dotenv = require('dotenv');

dotenv.config();

async function getSiteId(sitePath) {
  try {
    // Step 1: Initialize credentials
    const credential = new ClientSecretCredential(
      process.env.TENANT_ID,
      process.env.CLIENT_ID,
      process.env.CLIENT_SECRET
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: ['https://graph.microsoft.com/.default']
    });

    const client = Client.initWithMiddleware({
      authProvider
    });

    // Step 2: Query the site by its hostname and path
    const tenantHostname = 'csmaviation.sharepoint.com'; // Replace with your tenant's hostname
    const siteRelativePath = sitePath; // e.g., '/sites/SiteName'

    const site = await client
      .api(`/sites/${tenantHostname}:${siteRelativePath}`)
      .get();

    console.log('Site found!');
    console.log(`Site Name: ${site.name}`);
    console.log(`Site ID: ${site.id}`);
    console.log(`Site URL: ${site.webUrl}`);

    return site.id;

  } catch (error) {
    console.error('Error fetching site ID:', error.message);
    if (error.statusCode === 403) {
      console.error('Permission denied. Ensure the app has Sites.Read.All permission.');
    } else if (error.statusCode === 404) {
      console.error('Site not found. Verify the tenant hostname and site path.');
    }
    throw error;
  }
}

// Example usage
getSiteId('/sites/Marketing')
  .then(siteId => {
    console.log(`Use this Site ID in your .env file: ${siteId}`);
  })
  .catch(error => {
    console.error('Failed to retrieve site ID:', error);
  });