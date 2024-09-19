const fileUpload = require('express-fileupload');

module.exports = fileUpload({
    limits: { fileSize: 100 * 1024 * 1024 }, // 50 MB max file size
    useTempFiles: true,
    tempFileDir: '/tmp/',
    debug: process.env.NODE_ENV === 'development',
    safeFileNames: true,
    preserveExtension: true,
    abortOnLimit: true,
    responseOnLimit: 'File size limit has been reached',
});