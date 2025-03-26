const dbService = require('../services/dbService');
const kpiService = require('../services/kpiUpdateService');

async function main() {
    try {
        // Update KPIs
        await dbService.connectToDatabase();
        await kpiService.updateKPISheet();
        console.log('KPI update completed successfully');
    } catch (error) {
        console.error('Error updating KPIs:', error);
        process.exit(1);
    }
}

main().catch(console.error);
