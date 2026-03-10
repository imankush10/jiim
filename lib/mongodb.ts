import { MongoClient } from "mongodb";

const options = {};

const globalWithMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

function getClientPromise() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "Missing MONGODB_URI. Add it to your environment variables.",
    );
  }

  if (process.env.NODE_ENV === "development") {
    if (!globalWithMongo._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    return globalWithMongo._mongoClientPromise;
  }

  const client = new MongoClient(uri, options);
  return client.connect();
}

export async function getDb() {
  const connectedClient = await getClientPromise();
  return connectedClient.db(process.env.MONGODB_DB_NAME || "jiim");
}
