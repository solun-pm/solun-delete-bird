require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');
const fs = require('fs').promises;
const path = require('path');

const url = process.env.MONGODB_URL;
const client = new MongoClient(url);

const dbName = 'solun';
const collectionName = 'files';

const deletionTimes = {
  '1d': 1 * 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
  '3m': 3 * 30 * 24 * 60 * 60 * 1000,
  '6m': 6 * 30 * 24 * 60 * 60 * 1000,
  '1y': 365 * 24 * 60 * 60 * 1000,
};

async function run() {
  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const cursor = collection.find({
      auto_delete: {
        $nin: ['download', 'never']
      }
    });

    while (await cursor.hasNext()) {
      const file = await cursor.next();
      const createdAtTimestamp = new Date(file.createdAt).getTime();
      const deletionTime = createdAtTimestamp + deletionTimes[file.auto_delete];
      const remainingTimeMs = deletionTime - Date.now();
      const remainingTimeMin = Math.ceil(remainingTimeMs / (1000 * 60));
      const remainingTimeHours = Math.ceil(remainingTimeMin / 60);
      const remainingTimeDays = Math.ceil(remainingTimeHours / 24);
      console.log(`File in Scope: ${(file.file_id).substring(0, 3)}... - Auto Delete in: ${remainingTimeMin} Minutes`);
      // If the file should be deleted
      if (remainingTimeMin <= 0) {
        try {
          // Delete the file from the disk
          await fs.unlink(path.resolve(file.raw_file_path.replace('/app/public/uploads/files//', '/opt/solun/files/')));
          console.log(`Deleted file at ${file.raw_file_path.replace('/app/public/uploads/files//', '/opt/solun/files/')}`);

          // Delete the file entry from MongoDB
          await collection.deleteOne({ _id: file._id });
          console.log(`Deleted file entry with id ${file._id}`);
        } catch (err) {
          console.error(`Error deleting file: ${err}`);
        }
      }
    }
  } finally {
    console.log("### Script End @", new Date(), "###");
    await client.close();
  }
}

console.log("### Solun Delete Bird ###");
console.log("### Script Start @", new Date(), "###");
run().catch(console.dir);

setInterval(async () => {
  console.log("### Script Restart @", new Date(), "###");
  await run().catch(console.dir);
}, 60000); // 60000 milliseconds = 1 minute
