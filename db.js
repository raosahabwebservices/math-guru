require("dotenv").config();

const { MongoClient } = require("mongodb");

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "mathguru";

let client;
let database;

async function connectDB() {
  if (database) return database;

  if (!MONGO_URI) {
    throw new Error("MONGO_URI missing in Render Environment");
  }

  client = new MongoClient(MONGO_URI);
  await client.connect();

  database = client.db(DB_NAME);

  console.log("MongoDB connected:", DB_NAME);
  return database;
}

async function getCollection(name) {
  const db = await connectDB();
  return db.collection(name);
}

async function readJson(name, defaultValue = []) {
  try {
    const collection = await getCollection(name);

    const docs = await collection
      .find({})
      .sort({ _sort: -1, createdAt: -1 })
      .toArray();

    return docs.map((doc) => {
      const { _id, ...rest } = doc;
      return rest;
    });
  } catch (err) {
    console.error(`readJson error [${name}]:`, err.message);
    return defaultValue;
  }
}

async function writeJson(name, data) {
  if (!Array.isArray(data)) {
    throw new Error("writeJson data must be an array");
  }

  const collection = await getCollection(name);

  await collection.deleteMany({});

  if (data.length > 0) {
    await collection.insertMany(
      data.map((item, index) => ({
        ...item,
        _sort: data.length - index,
        updatedAt: item.updatedAt || new Date().toISOString()
      }))
    );
  }

  return true;
}

module.exports = {
  connectDB,
  readJson,
  writeJson
};
