const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

const s3 = new AWS.S3();

const uploadToS3 = async (file) => {
  const fileExtension = file.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExtension}`;

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: `videos/${fileName}`,
    Body: file.data,
    ContentType: file.mimetype,
    // Remove the ACL setting
  };

  try {
    const result = await s3.upload(params).promise();
    return {
      Key: result.Key,
      Location: result.Location
    };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
};

module.exports = { uploadToS3 };