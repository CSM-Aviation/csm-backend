const cron = require('node-cron');
const kpiService = require('../services/kpiUpdateService');


// Run at 23:59 on the last day of every month (using days 28-31)
cron.schedule('59 23 28-31 * *', async () => {
    try {
        console.log('Starting monthly KPI update...');
        await kpiService.updateKPISheet();
        console.log('Monthly KPI update completed successfully');
    } catch (error) {
        console.error('Error updating monthly KPIs:', error);
    }
});


// Run every minute
// cron.schedule('* * * * *', async () => {
//     console.log('Running minute cron job');
//     try {
//         console.log('Starting monthly KPI update...');
//         await kpiService.updateKPISheet();
//         console.log('Monthly KPI update completed successfully');
//     } catch (error) {
//         console.error('Error updating monthly KPIs:', error);
//     }
// });
