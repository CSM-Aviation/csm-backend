// services/microsoftService.js

const { Client } = require("@microsoft/microsoft-graph-client");
const { ConfidentialClientApplication } = require('@azure/msal-node');
const fs = require('fs');
const path = require('path');

/**
 * Microsoft Graph API integration service
 * Handles all interactions with Microsoft services including OneDrive
 */
class MicrosoftService {
    constructor() {
        this.initialized = false;
        this.client = null;
        this.msalClient = null;
        this.tokenCachePath = path.join(__dirname, '../.token-cache.json');
    }

    /**
     * Initialize the MSAL client for authentication
     * @returns {ConfidentialClientApplication}
     */
    initMsal() {
        if (this.msalClient) {
            return this.msalClient;
        }

        // Check for required environment variables
        if (!process.env.TENANT_ID || !process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.REDIRECT_URI) {
            throw new Error('Microsoft integration requires TENANT_ID, CLIENT_ID, CLIENT_SECRET, and REDIRECT_URI environment variables');
        }

        // Load token cache from file if exists
        let tokenCache = {};
        try {
            if (fs.existsSync(this.tokenCachePath)) {
                tokenCache = JSON.parse(fs.readFileSync(this.tokenCachePath, 'utf8'));
            }
        } catch (error) {
            console.warn('Could not load token cache:', error.message);
        }

        // Configure MSAL client
        const msalConfig = {
            auth: {
                clientId: process.env.CLIENT_ID,
                authority: `https://login.microsoftonline.com/${process.env.TENANT_ID}`,
                clientSecret: process.env.CLIENT_SECRET,
                redirectUri: process.env.REDIRECT_URI,
            },
            cache: {
                cachePlugin: {
                    beforeCacheAccess: async (cacheContext) => {
                        cacheContext.tokenCache.deserialize(JSON.stringify(tokenCache));
                    },
                    afterCacheAccess: async (cacheContext) => {
                        if (cacheContext.cacheHasChanged) {
                            tokenCache = JSON.parse(cacheContext.tokenCache.serialize());
                            fs.writeFileSync(this.tokenCachePath, JSON.stringify(tokenCache));
                        }
                    }
                }
            },
            system: {
                loggerOptions: {
                    loggerCallback: (level, message, containsPii) => {
                        if (!containsPii) {
                            console.log(`MSAL (${level}): ${message}`);
                        }
                    },
                    piiLoggingEnabled: false,
                    logLevel: 3, // Info
                }
            }
        };

        this.msalClient = new ConfidentialClientApplication(msalConfig);
        return this.msalClient;
    }

    /**
     * Get the authorization URL for user login
     * @returns {string} Authorization URL
     */
    getAuthUrl() {
        const msalClient = this.initMsal();

        const authCodeUrlParameters = {
            scopes: ['Files.ReadWrite.All', 'offline_access'],
            responseMode: 'query'
        };

        return msalClient.getAuthCodeUrl(authCodeUrlParameters);
    }

    /**
     * Redeem authorization code for access token
     * @param {string} code - Authorization code from the redirect
     * @returns {Promise<Object>} Token response
     */
    async redeemAuthCode(code) {
        const msalClient = this.initMsal();

        const tokenRequest = {
            code,
            scopes: ['Files.ReadWrite.All', 'offline_access'],
            redirectUri: process.env.REDIRECT_URI,
        };

        return await msalClient.acquireTokenByCode(tokenRequest);
    }

    /**
     * Get access token for Microsoft Graph API
     * @returns {Promise<string>} Access token
     */
    async getAccessToken() {
        const msalClient = this.initMsal();

        try {
            // Try to get token silently (from cache or using refresh token)
            const account = (await msalClient.getTokenCache().getAllAccounts())[0];

            if (!account) {
                throw new Error('No authenticated accounts found. User must sign in first.');
            }

            const silentRequest = {
                account,
                scopes: ['Files.ReadWrite.All'],
            };

            const response = await msalClient.acquireTokenSilent(silentRequest);
            return response.accessToken;
        } catch (error) {
            console.error('Error acquiring token silently:', error);
            throw error;
        }
    }

    /**
     * Initialize the Microsoft Graph client
     * @returns {Promise<Client>} Microsoft Graph client instance
     */
    async initialize() {
        if (this.initialized && this.client) {
            return this.client;
        }

        try {
            // Create an auth provider using delegated auth
            const authProvider = async (done) => {
                try {
                    const token = await this.getAccessToken();
                    done(null, token);
                } catch (error) {
                    done(error, null);
                }
            };

            // Initialize the Microsoft Graph client with the auth provider
            this.client = Client.init({
                authProvider,
                debugLogging: process.env.NODE_ENV === 'development'
            });

            this.initialized = true;
            return this.client;
        } catch (error) {
            console.error('Error initializing Microsoft Graph client:', error);
            throw error;
        }
    }

    /**
     * Upload a file to a specific folder in OneDrive
     * @param {Object} fileData - File data to upload
     * @param {Buffer|Stream} fileData.content - File content as Buffer or Stream
     * @param {string} fileData.name - File name with extension
     * @param {string} fileData.contentType - File MIME type
     * @param {Object} destination - Destination information
     * @param {string} destination.folderPath - Folder path in the drive
     * @returns {Promise<Object>} Uploaded file details
     */
    async uploadFile(fileData, destination) {
        try {
            const client = await this.initialize();

            // First get drive info to determine the proper API to use
            const drive = await client.api('/me/drive').get();
            console.log(`Using drive: ${drive.id} (${drive.driveType})`);

            // Ensure the folder path exists, create it if necessary
            const folderInfo = await this.ensureFolderPath(destination.folderPath);

            // Use the folder ID for uploading
            const uploadResponse = await client
                .api(`/me/drive/items/${folderInfo.folderId}/children/${fileData.name}/content`)
                .put(fileData.content);

            return uploadResponse;
        } catch (error) {
            console.error('Error uploading file to OneDrive:', error);
            throw error;
        }
    }

    /**
     * Get a folder from OneDrive by path
     * @param {string} folderPath Path to the folder (e.g., 'Documents/MyFolder')
     * @returns {Promise<Object>} Folder information
     */
    async getFolderByPath(folderPath) {
        try {
            const client = await this.initialize();

            // Format the folder path for the API request
            const formattedPath = folderPath.replace(/^\/+|\/+$/g, '');
            const apiPath = formattedPath ? `/me/drive/root:/${formattedPath}` : '/me/drive/root';

            console.log(`Getting folder: ${apiPath}`);
            return await client.api(apiPath).get();
        } catch (error) {
            if (error.statusCode === 404) {
                return null; // Folder doesn't exist
            }
            throw error;
        }
    }

    /**
     * Create a folder in OneDrive if it doesn't exist
     * @param {string} parentFolderId Parent folder ID
     * @param {string} folderName Name of the folder to create
     * @returns {Promise<Object>} Created folder information
     */
    // In microsoftService.js, modify the createFolder function
    async createFolder(parentFolderId, folderName) {
        try {
            const client = await this.initialize();

            // First check if folder already exists
            const childrenResponse = await client.api(`/me/drive/items/${parentFolderId}/children`).get();
            const existingFolder = childrenResponse.value.find(item =>
                item.name === folderName && item.folder);

            if (existingFolder) {
                console.log(`Folder "${folderName}" already exists, using existing folder`);
                return existingFolder;
            }

            // Create new folder
            const folderDefinition = {
                name: folderName,
                folder: {},
                '@microsoft.graph.conflictBehavior': 'rename'
            };

            console.log(`Creating folder "${folderName}" in parent: ${parentFolderId}`);

            return await client
                .api(`/me/drive/items/${parentFolderId}/children`)
                .post(folderDefinition);
        } catch (error) {
            console.error(`Error creating folder "${folderName}":`, error);

            // If we can't access the parent folder, try a different approach
            if (error.statusCode === 404) {
                console.log("Parent folder not found. Attempting to create folder at root level");
                try {
                    const client = await this.initialize();
                    const rootFolder = await client.api('/me/drive/root').get();

                    const folderDefinition = {
                        name: folderName,
                        folder: {},
                        '@microsoft.graph.conflictBehavior': 'rename'
                    };

                    return await client
                        .api(`/me/drive/items/${rootFolder.id}/children`)
                        .post(folderDefinition);
                } catch (fallbackError) {
                    console.error('Error in fallback folder creation:', fallbackError);
                    throw fallbackError;
                }
            }

            throw error;
        }
    }

    /**
     * Ensure a folder path exists in OneDrive, creating it if necessary
     * @param {string} folderPath - Path to ensure (e.g., "OPERATORS/VendorName")
     * @returns {Promise<Object>} Reference to the folder
     */
    async ensureFolderPath(folderPath) {
        if (!folderPath) {
            // Return the root folder
            const rootFolder = await client.api('/me/drive/root').get();
            return {
                folderId: rootFolder.id,
                folderPath: '/',
                webUrl: rootFolder.webUrl
            };
        }

        try {
            const client = await this.initialize();

            // Clean up the path and split it
            const segments = folderPath.split('/').filter(segment => segment.trim() !== '');
            console.log(`Creating folder path with segments:`, segments);

            // Always start from the root folder for consistency
            let currentFolder = await client.api('/me/drive/root').get();

            // Process each folder segment
            for (const segment of segments) {
                try {
                    // Get all children of the current folder
                    const childrenResponse = await client.api(`/me/drive/items/${currentFolder.id}/children`).get();
                    const children = childrenResponse.value;

                    // Look for an existing folder with the same name
                    const existingFolder = children.find(item =>
                        item.name === segment && item.folder);

                    if (existingFolder) {
                        // Use the existing folder
                        currentFolder = existingFolder;
                        console.log(`Found existing folder: ${segment} (${currentFolder.id})`);
                    } else {
                        // Create the folder
                        const folderDefinition = {
                            name: segment,
                            folder: {},
                            '@microsoft.graph.conflictBehavior': 'rename'
                        };

                        currentFolder = await client
                            .api(`/me/drive/items/${currentFolder.id}/children`)
                            .post(folderDefinition);

                        console.log(`Created folder: ${segment} (${currentFolder.id})`);
                    }
                } catch (error) {
                    console.error(`Error processing folder segment "${segment}":`, error);
                    throw error;
                }
            }

            return {
                folderId: currentFolder.id,
                folderPath: folderPath,
                webUrl: currentFolder.webUrl
            };
        } catch (error) {
            console.error('Error ensuring folder path:', error);
            throw error;
        }
    }

    /**
     * Sync vendor documents to OneDrive
     * @param {Object} vendorData - Vendor information
     * @param {string} vendorData.companyName - Vendor company name
     * @param {string} vendorData._id - Vendor ID
     * @param {Object} vendorData.documents - Object containing document URLs
     * @returns {Promise<Object>} Results of the operation
     */
    async syncVendorDocumentsToOneDrive(vendorData) {
        try {
            // Format company name for folder name (remove special chars, lowercase)
            const folderName = vendorData.companyName
                .replace(/[^a-zA-Z0-9]/g, '_')
                .toLowerCase();

            // Define destination path
            const destination = {
                folderPath: `Charter_OPERATORS/${folderName}`
            };

            const results = {
                success: [],
                failed: []
            };

            // Check if documents exist
            if (!vendorData.documents || Object.keys(vendorData.documents).length === 0) {
                return {
                    message: 'No documents found for this vendor',
                    folderPath: destination.folderPath,
                    results
                };
            }

            // Process each document in the vendor's document collection
            for (const [docType, url] of Object.entries(vendorData.documents)) {
                if (!url) continue;

                try {
                    // Download the file from S3 or your current storage
                    const fileData = await this.downloadFileFromUrl(url, docType);

                    // Upload to OneDrive
                    const uploadResult = await this.uploadFile(fileData, destination);

                    results.success.push({
                        docType,
                        originalUrl: url,
                        oneDriveItem: uploadResult
                    });
                } catch (error) {
                    console.error(`Error syncing ${docType} document:`, error);
                    results.failed.push({
                        docType,
                        originalUrl: url,
                        error: error.message
                    });
                }
            }

            return {
                message: `Synced ${results.success.length} documents to OneDrive, ${results.failed.length} failed`,
                vendorId: vendorData._id,
                folderPath: destination.folderPath,
                results
            };
        } catch (error) {
            console.error('Error in vendor document sync:', error);
            throw error;
        }
    }

    /**
     * Download a file from a URL
     * @param {string} url - URL of the file to download
     * @param {string} docType - Document type (for naming)
     * @returns {Promise<Object>} File data object with content, name, and contentType
     */
    async downloadFileFromUrl(url, docType) {
        const https = require('https');
        const { parse } = require('url');

        return new Promise((resolve, reject) => {
            const parsedUrl = parse(url);
            const options = {
                hostname: parsedUrl.hostname,
                path: parsedUrl.path,
                method: 'GET'
            };

            const req = https.request(options, (res) => {
                if (res.statusCode !== 200) {
                    return reject(new Error(`Failed to download file: ${res.statusCode}`));
                }

                const data = [];

                res.on('data', (chunk) => {
                    data.push(chunk);
                });

                res.on('end', () => {
                    const buffer = Buffer.concat(data);

                    // Extract filename from URL or use docType as fallback
                    let filename = url.split('/').pop().split('?')[0];
                    if (!filename || filename.length < 3) {
                        filename = `${docType}_document${this.getFileExtensionFromContentType(res.headers['content-type']) || '.pdf'}`;
                    }

                    resolve({
                        content: buffer,
                        name: filename,
                        contentType: res.headers['content-type'] || 'application/octet-stream'
                    });
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.end();
        });
    }

    /**
     * Helper function to get file extension from content type
     * @param {string} contentType - MIME type
     * @returns {string} File extension including the dot
     */
    getFileExtensionFromContentType(contentType) {
        const types = {
            'application/pdf': '.pdf',
            'application/msword': '.doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
            'image/jpeg': '.jpg',
            'image/png': '.png',
            'application/vnd.ms-excel': '.xls',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
        };

        return types[contentType] || '';
    }
}

// Create and export a singleton instance
const microsoftService = new MicrosoftService();
module.exports = microsoftService;