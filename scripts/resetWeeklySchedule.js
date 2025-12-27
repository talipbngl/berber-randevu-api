require("dotenv").config();
const mongoose = require("mongoose");
const Schedule = require("../models/Schedule");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGODB_URI veya MONGO_URI bulunamadı.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("✅ DB bağlı");

  const start_shift = "09:30";
  const end_shift = "20:00";
  const barber_id = 1;

  // 1..7 tüm günleri upsert et (yoksa ekler, varsa düzeltir)
  const ops = [];
  for (let day = 1; day <= 7; day++) {
    ops.push({
      updateOne: {
        filter: { day_of_week: day, barber_id },
        update: { $set: { start_shift, end_shift } },
        upsert: true,
      },
    });
  }

  const result = await Schedule.bulkWrite(ops);
  console.log("✅ Weekly schedule reset ok:", {
    matched: result.matchedCount,
    modified: result.modifiedCount,
    upserted: result.upsertedCount,
  });

  await mongoose.disconnect();
  console.log("Bitti.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
