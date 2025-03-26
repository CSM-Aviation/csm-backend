const { Client } = require('@microsoft/microsoft-graph-client');
const { ClientSecretCredential } = require('@azure/identity');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');
const dotenv = require('dotenv');
const analyticsController = require('../controllers/analyticsController');

dotenv.config();

class KPIUpdateService {
    constructor() {
        // Validate environment variables
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

        this.siteId = process.env.MICROSOFT_MARKETING_SITE_ID;
        this.driveId = process.env.MICROSOFT_MARKETING_DRIVE_ID;
        this.client = null;
    }

    async initialize() {
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
        this.client = Client.initWithMiddleware({
            authProvider: authProvider
        });
    }

    async findKPIFile() {
        // Find the KPIs_test folder
        const driveItems = await this.client
            .api(`/sites/${this.siteId}/drives/${this.driveId}/root/children`)
            .get();

        const kpisFolder = driveItems.value.find(item => 
            item.name === 'KPIs_test' && item.folder);

        if (!kpisFolder) {
            throw new Error('KPIs_test folder not found');
        }

        // Find the Excel file in the KPIs folder
        const kpisFolderItems = await this.client
            .api(`/sites/${this.siteId}/drives/${this.driveId}/items/${kpisFolder.id}/children`)
            .get();

        const excelFile = kpisFolderItems.value.find(item => 
            item.name === 'CSM_website_KPIs_test.xlsx');

        if (!excelFile) {
            throw new Error('KPI Excel file not found');
        }

        return excelFile;
    }

    async updateKPISheet() {
        try {
            if (!this.client) {
                await this.initialize();
            }

            // Get the Excel file
            const excelFile = await this.findKPIFile();
            console.log(`Found Excel file: ${excelFile.name}`);

            // Get current month's data
            const currentDate = new Date();
            const currentMonth = currentDate.getMonth() + 1;
            const currentYear = currentDate.getFullYear();

            // Get analytics data
            const monthlyData = await analyticsController.getMonthlyKPIData(currentMonth, currentYear);
            console.log(`Monthly data found successfully `);
            // Map months to Excel columns
            const monthColumns = {
                1: 'D', 2: 'E', 3: 'F', 4: 'G', 5: 'H', 6: 'I',
                7: 'J', 8: 'K', 9: 'L', 10: 'M', 11: 'N', 12: 'O'
            };
            const column = monthColumns[currentMonth];

            // Write data to Excel
            console.log(`Writing data to Excel...`);
            await this.writeDataToExcel(excelFile.id, column, monthlyData);

            console.log(`Successfully updated KPI data for ${currentMonth}/${currentYear}`);
            return true;
        } catch (error) {
            console.error('Error updating KPI sheet:', error);
            throw error;
        }
    }

    async writeDataToExcel(fileId, column, data) {
        const ranges = {
            totalSessions: `${column}2`,
            newVisitors: `${column}3`,
            sourceBreakdown: `${column}4`
        };

        // Update Total Sessions
        await this.client
            .api(`/sites/${this.siteId}/drives/${this.driveId}/items/${fileId}/workbook/worksheets/Sheet1/range(address='${ranges.totalSessions}')`)
            .patch({
                values: [[data.totalSessions]]
            });

        // Update New vs Returning Visitors
        await this.client
            .api(`/sites/${this.siteId}/drives/${this.driveId}/items/${fileId}/workbook/worksheets/Sheet1/range(address='${ranges.newVisitors}')`)
            .patch({
                values: [[data.visitorBreakdown.newVisitors]]
            });

        // Update Source Breakdown
        const sourceBreakdownText = data.sourceBreakdown
            .map(source => `${source.source}: ${source.visits}`)
            .join('\n');
        
        await this.client
            .api(`/sites/${this.siteId}/drives/${this.driveId}/items/${fileId}/workbook/worksheets/Sheet1/range(address='${ranges.sourceBreakdown}')`)
            .patch({
                values: [[sourceBreakdownText]]
            });
    }
}

module.exports = new KPIUpdateService();