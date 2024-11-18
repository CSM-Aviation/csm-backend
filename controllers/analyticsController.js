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
        const { timeframe = '7d' } = req.query;

        // Calculate date range based on timeframe
        const dateRange = getDateRange(timeframe);
        const matchStage = {
            timestamp: {
                $gte: dateRange.startDate,
                $lte: dateRange.endDate
            }
        };

        // Basic metrics
        const distinctVisitors = await pageviews.distinct('sessionId', matchStage);
        const totalVisitors = distinctVisitors.length;
        const totalPageViews = await pageviews.countDocuments(matchStage);

        // New vs Returning Users
        const newUsersQuery = { ...matchStage, pageViews: 1 };
        const distinctNewUsers = await pageviews.distinct('sessionId', newUsersQuery);
        const newUsers = distinctNewUsers.length;
        const returningUsers = totalVisitors - newUsers;

        // Engagement Metrics
        const hourlyActivity = await pageviews.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        $hour: "$timestamp"
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { "_id": 1 } }
        ]).toArray();

        // Traffic Source Analysis
        const trafficSources = await pageviews.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$referrer",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]).toArray();

        // Geographical Data
        const userLocations = await pageviews.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        city: "$city",
                        region: "$region",
                        country: "$country"
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]).toArray();

        // Page Analytics
        const pagesVisited = await pageviews.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$path",
                    views: { $sum: 1 },
                    uniqueVisitors: { $addToSet: "$sessionId" }
                }
            },
            {
                $project: {
                    path: "$_id",
                    views: 1,
                    uniqueVisitors: { $size: "$uniqueVisitors" },
                    bounceRate: {
                        $multiply: [
                            {
                                $divide: [
                                    { $subtract: ["$views", { $size: "$uniqueVisitors" }] },
                                    "$views"
                                ]
                            },
                            100
                        ]
                    }
                }
            },
            { $sort: { views: -1 } },
            { $limit: 10 }
        ]).toArray();

        // Visitor Trend
        const visitorTrend = await pageviews.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$timestamp"
                        }
                    },
                    visitors: { $addToSet: "$sessionId" },
                    pageviews: { $sum: 1 }
                }
            },
            {
                $project: {
                    date: "$_id",
                    visitors: { $size: "$visitors" },
                    pageviews: 1,
                    _id: 0
                }
            },
            { $sort: { date: 1 } }
        ]).toArray();

        res.json({
            timeframe,
            overview: {
                totalVisitors,
                totalPageViews,
                newUsers,
                returningUsers
            },
            engagement: {
                hourlyActivity,
                trafficSources: Object.fromEntries(trafficSources.map(item => [item._id || 'Direct', item.count]))
            },
            geography: {
                userLocations: userLocations.map(item => ({
                    location: `${item._id.city}, ${item._id.region}, ${item._id.country}`,
                    count: item.count
                }))
            },
            content: {
                pagesVisited
            },
            trends: {
                visitorTrend
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

function getDateRange(timeframe) {
    const endDate = new Date();
    let startDate = new Date();

    switch (timeframe) {
        case '24h':
            startDate.setHours(startDate.getHours() - 24);
            break;
        case '7d':
            startDate.setDate(startDate.getDate() - 7);
            break;
        case '30d':
            startDate.setDate(startDate.getDate() - 30);
            break;
        case '90d':
            startDate.setDate(startDate.getDate() - 90);
            break;
        default:
            startDate.setDate(startDate.getDate() - 7);
    }

    return { startDate, endDate };
}