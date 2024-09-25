const { getDb } = require('../services/dbService');

exports.getSeoData = async (req, res) => {
    try {
        const db = getDb();
        const page = req.params.page;
        const seoData = await db.collection('seo').findOne({ page });

        if (seoData) {
            res.json({
                title: seoData.title,
                description: seoData.description,
                keywords: seoData.keywords,
                ogImage: seoData.ogImage,
                canonicalUrl: seoData.canonicalUrl,
                robots: seoData.robots,
                author: seoData.author,
                language: seoData.language,
                siteName: seoData.siteName,
                type: seoData.type,
                twitterHandle: seoData.twitterHandle,
                publishedTime: seoData.publishedTime,
                modifiedTime: seoData.modifiedTime,
                section: seoData.section,
                tags: seoData.tags,
            });
        } else {
            res.status(404).json({ error: 'SEO data not found for this page' });
        }
    } catch (error) {
        console.error('Error fetching SEO data:', error);
        res.status(500).json({ error: 'Server error' });
    }
};