const { MongoClient } = require('mongodb');

let db = null;

exports.connectToDatabase = async () => {
    if (db) return db;

    const password = process.env.MONGO_PASSWORD || 'root'
    const uri = `mongodb+srv://softwaredev:${password}@devcluster.bj5y39d.mongodb.net/?retryWrites=true&w=majority&appName=DevCluster`;

    const client = new MongoClient(uri);


    // const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    console.log("Connected successfully to MongoDB");
    db = client.db('csm_aviation'); // Replace with your database name
    return db;
};

exports.getDb = () => {
    if (!db) {
        throw new Error('Database not connected. Call connectToDatabase first.');
    }
    return db;
};