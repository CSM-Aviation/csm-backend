const apiKeyMiddleware = (req, res, next) => {
    if (req.path.startsWith('/api/surveys/approve/') || req.path.startsWith('/api/surveys/reject/') || req.path.startsWith('/api/vendor-form/approve/') || req.path.startsWith('/api/vendor-form/reject/') || req.path.startsWith('/api/vendor-form/reject-form/') || req.path.startsWith('/api/auth/microsoft/callback')) {
        return next();
    }
    const apiKey = req.get('X-API-Key');

    if (!apiKey || apiKey !== process.env.API_KEY) {
        return res.status(401).json({ error: 'Invalid API Key' });
    }

    next();
};

module.exports = apiKeyMiddleware;