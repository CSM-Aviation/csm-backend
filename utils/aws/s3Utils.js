const AWS = require('aws-sdk');
const dotenv = require('dotenv');

dotenv.config();

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

/**
 * Generates a pre-signed URL for an S3 object
 * @param {string} key - The key of the S3 object
 * @param {number} expirationInSeconds - URL expiration time in seconds (default: 300 seconds / 5 minutes)
 * @returns {Promise<string>} - A promise that resolves to the pre-signed URL
 */
exports.generateS3Url = async (key, expirationInSeconds = 300) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Expires: expirationInSeconds
  };

  try {
    const url = await s3.getSignedUrlPromise('getObject', params);
    return url;
  } catch (error) {
    console.error('Error generating S3 URL:', error);
    throw error;
  }
};

/**
 * Lists objects in an S3 bucket
 * @param {string} prefix - The prefix to filter objects (optional)
 * @param {number} maxKeys - The maximum number of keys to return (optional)
 * @returns {Promise<AWS.S3.ListObjectsV2Output>} - A promise that resolves to the list of objects
 */
exports.listS3Objects = async (prefix = '', maxKeys = 1000) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Prefix: prefix,
    MaxKeys: maxKeys
  };

  try {
    return await s3.listObjectsV2(params).promise();
  } catch (error) {
    console.error('Error listing S3 objects:', error);
    throw error;
  }
};

/**
 * Deletes an object from S3
 * @param {string} key - The key of the S3 object to delete
 * @returns {Promise<AWS.S3.DeleteObjectOutput>} - A promise that resolves when the object is deleted
 */
exports.deleteS3Object = async (key) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key
  };

  try {
    return await s3.deleteObject(params).promise();
  } catch (error) {
    console.error('Error deleting S3 object:', error);
    throw error;
  }
};

/**
 * Lists objects in an S3 bucket with a specific prefix
 * @param {string} prefix - The prefix to filter objects (e.g., "images/N30GT/")
 * @param {number} maxKeys - The maximum number of keys to return (optional)
 * @returns {Promise<AWS.S3.ListObjectsV2Output>} - A promise that resolves to the list of objects
 */
exports.listS3ObjectsWithPrefix = async (prefix, maxKeys = 1000) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Prefix: prefix,
    MaxKeys: maxKeys
  };

  try {
    return await s3.listObjectsV2(params).promise();
  } catch (error) {
    console.error('Error listing S3 objects:', error);
    throw error;
  }
};

/**
 * Generates pre-signed URLs for an array of S3 object keys
 * @param {string[]} keys - Array of S3 object keys
 * @param {number} expirationInSeconds - URL expiration time in seconds (default: 3600 seconds / 1 hour)
 * @returns {Promise<string[]>} - A promise that resolves to an array of pre-signed URLs
 */
exports.generateMultipleS3Urls = async (keys, expirationInSeconds = 3600) => {
  try {
    const urls = await Promise.all(keys
      .filter(key => {
        const parts = key.split('/');
        return parts.length > 2 && parts[parts.length - 1] !== '';
      })
      .map(key => this.generateS3Url(key, expirationInSeconds))
    );
    return urls;
  } catch (error) {
    console.error('Error generating multiple S3 URLs:', error);
    throw error;
  }
};