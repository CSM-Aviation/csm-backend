const { MongoClient } = require("mongodb");
const dotenv = require('dotenv');
dotenv.config();

const password = process.env.MONGO_PASSWORD || 'root'
const uri = `mongodb+srv://softwaredev:${password}@devcluster.bj5y39d.mongodb.net/?retryWrites=true&w=majority&appName=DevCluster`;

const client = new MongoClient(uri);

let db;

async function connectToDatabase() {
    try {
        await client.connect();
        console.log("Connected successfully to MongoDB");
        db = client.db('csm_aviation'); // Replace with your database name
        return db;
    } catch (error) {
        console.error("Could not connect to MongoDB", error);
        process.exit(1);
    }
}

module.exports = { connectToDatabase, client };