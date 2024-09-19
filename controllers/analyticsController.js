const { getDb } = require('../services/dbService');

exports.trackPageView = async (req, res) => {
    try {
        const pageViewData = {
            ...req.body,
            ip: req.ip,
            timestamp: new Date()
        };
        const db = getDb();
        await db.collection('pageviews').insertOne(pageViewData);
        res.status(200).json({ message: 'Analytics data received' });
    } catch (error) {
        console.error('Error saving analytics data:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

exports.getDashboardData = async (req, res) => {
    try {
        const db = getDb();
        const pageviews = db.collection('pageviews');

        const distinctVisitors = await pageviews.distinct('sessionId');
        const totalVisitors = distinctVisitors.length;
        const totalPageViews = await pageviews.countDocuments();

        const newUsersQuery = { pageViews: 1 };
        const distinctNewUsers = await pageviews.distinct('sessionId', newUsersQuery);
        const newUsers = distinctNewUsers.length;

        const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const pageViewsLast7Days = await pageviews.aggregate([
            { $match: { timestamp: { $gte: last7Days } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]).toArray();

        const userLocations = await pageviews.aggregate([
            { $group: { _id: { city: "$city", region: "$region", country: "$country" }, count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]).toArray();

        const pagesVisited = await pageviews.aggregate([
            { $group: { _id: "$path", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]).toArray();

        const visitorTrend = await pageviews.aggregate([
            { $match: { timestamp: { $gte: last7Days } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }, visitors: { $addToSet: "$sessionId" } } },
            { $project: { date: "$_id", visitors: { $size: "$visitors" }, _id: 0 } },
            { $sort: { date: 1 } }
        ]).toArray();

        res.json({
            totalVisitors,
            totalPageViews,
            newUsers,
            dates: pageViewsLast7Days.map(item => item._id),
            pageViews: pageViewsLast7Days.map(item => item.count),
            userLocations: Object.fromEntries(userLocations.map(item => [`${item._id.city}, ${item._id.region}, ${item._id.country}`, item.count])),
            pagesVisited: Object.fromEntries(pagesVisited.map(item => [item._id, item.count])),
            visitorTrend
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Server error' });
    }
};