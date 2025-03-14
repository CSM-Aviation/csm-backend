// utils/getSiteInfo.js
const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');
const dotenv = require('dotenv');

dotenv.config();

async function getSiteInfo() {
  // Initialize credentials and client
  const credential = new ClientSecretCredential(
    process.env.TENANT_ID,
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default']
  });

  const client = Client.initWithMiddleware({ authProvider });

  // List all sites accessible to the app
  console.log("=== SITES ===");
  const sites = await client.api('/sites').get();
  sites.value.forEach(site => {
    console.log(`Site: ${site.name}`);
    console.log(`  ID: ${site.id}`);
    console.log(`  URL: ${site.webUrl}`);
  });

  // List drives for the first site (you can change the index as needed)
  if (sites.value.length > 0) {
    const siteId = process.env.MICROSOFT_SITE_ID;
    console.log(`\n=== DRIVES for site: ${siteId} ===`);
    const drives = await client.api(`/sites/${siteId}/drives`).get();
    drives.value.forEach(drive => {
      console.log(`Drive: ${drive.name}`);
      console.log(`  ID: ${drive.id}`);
      console.log(`  Type: ${drive.driveType}`);
      console.log(`  URL: ${drive.webUrl}`);
    });
  }
}

getSiteInfo().catch(console.error);