import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (!uri) {
  console.warn("[MongoDB] MONGODB_URI is not defined in environment variables. Database operations will fall back to in-memory mode.");
}

if (process.env.NODE_ENV === "development") {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise && uri) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise || (uri ? new MongoClient(uri, options).connect() : Promise.reject(new Error("MONGODB_URI not defined")));
} else {
  // In production mode, it's best to not use a global variable.
  if (uri) {
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  } else {
    clientPromise = Promise.reject(new Error("MONGODB_URI not defined"));
  }
}

/**
 * Get the connected MongoClient instance.
 */
export async function getMongoClient(): Promise<MongoClient> {
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is missing.");
  }
  return clientPromise;
}

/**
 * Get MongoDB Database instance (defaults to 'looplaunch').
 */
export async function getDatabase(dbName = "looplaunch"): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}

/**
 * Check if the MongoDB connection is alive.
 */
export async function checkMongoConnection(): Promise<{ ok: boolean; message: string; database?: string }> {
  try {
    if (!process.env.MONGODB_URI) {
      return { ok: false, message: "MONGODB_URI is not set." };
    }
    const client = await getMongoClient();
    const admin = client.db().admin();
    await admin.ping();
    return { ok: true, message: "Connected to MongoDB Atlas successfully", database: "looplaunch" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `MongoDB connection error: ${msg}` };
  }
}

export default clientPromise;
