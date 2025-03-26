// controllers/microsoftAuthController.js

const microsoftService = require('../services/microsoftService');

/**
 * Start the Microsoft authentication flow by redirecting to the Microsoft login page
 */
exports.startAuth = async (req, res) => {
    try {
        const authUrl = await microsoftService.getAuthUrl();
        res.redirect(authUrl);
    } catch (error) {
        console.error('Error starting Microsoft auth flow:', error);
        res.status(500).json({ error: 'Failed to start authentication flow' });
    }
};

/**
 * Handle the Microsoft authentication callback and store the token
 */
exports.handleCallback = async (req, res) => {
    try {
        // Get authorization code from request
        const { code } = req.query;
        
        if (!code) {
            return res.status(400).json({ error: 'Authorization code is missing' });
        }

        // Exchange code for tokens
        await microsoftService.redeemAuthCode(code);
        
        // Redirect to admin dashboard or confirmation page
        res.send(`
            <html>
                <head>
                    <title>Microsoft OneDrive Authentication</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            text-align: center;
                            padding: 50px;
                            background-color: #f5f5f5;
                        }
                        .card {
                            background-color: white;
                            border-radius: 8px;
                            padding: 30px;
                            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                            max-width: 500px;
                            margin: 0 auto;
                        }
                        h1 {
                            color: #4285F4;
                        }
                        .success-icon {
                            font-size: 48px;
                            color: #34A853;
                            margin: 20px 0;
                        }
                        .btn {
                            display: inline-block;
                            background-color: #4285F4;
                            color: white;
                            padding: 10px 20px;
                            border-radius: 4px;
                            text-decoration: none;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Authentication Successful</h1>
                        <div class="success-icon">✓</div>
                        <p>You have successfully authenticated with Microsoft OneDrive.</p>
                        <p>You can now close this window and return to the application.</p>
                        <a href="/admin/dashboard" class="btn">Return to Dashboard</a>
                    </div>
                </body>
            </html>
        `);
    } catch (error) {
        console.error('Error handling Microsoft auth callback:', error);
        res.status(500).json({ error: 'Authentication failed', details: error.message });
    }
};

/**
 * Test route to check if Microsoft OneDrive authentication is working
 */
exports.testConnection = async (req, res) => {
    try {
        // Initialize client and get drive information
        const client = await microsoftService.initialize();
        const drive = await client.api('/me/drive').get();
        
        res.json({
            status: 'success',
            message: 'Connected to Microsoft OneDrive successfully',
            driveInfo: {
                name: drive.name,
                id: drive.id,
                owner: drive.owner?.user?.displayName || 'Unknown',
                webUrl: drive.webUrl
            }
        });
    } catch (error) {
        console.error('Error testing Microsoft connection:', error);
        
        if (error.message && error.message.includes('No authenticated accounts found')) {
            return res.status(401).json({
                status: 'error',
                message: 'Authentication required',
                authUrl: await microsoftService.getAuthUrl()
            });
        }
        
        res.status(500).json({
            status: 'error',
            message: 'Failed to connect to Microsoft OneDrive',
            error: error.message
        });
    }
};