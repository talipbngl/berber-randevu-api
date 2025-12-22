require("dotenv").config();
const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");

/**
 * SHIFT_MINUTES:
 *  -3 saat = -180
 * +3 saat = +180
 */
const SHIFT_MINUTES = Number(process.env.SHIFT_MINUTES || -180);

async function main() {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI bulunamadı (.env).");
    process.exit(1);
  }

  console.log("DB bağlanıyor...");
  await mongoose.connect(process.env.MONGO_URI);

  console.log("SHIFT_MINUTES =", SHIFT_MINUTES);
  const shiftMs = SHIFT_MINUTES * 60 * 1000;

  // Ön izleme
  const sample = await Appointment.find({}).sort({ start_time: 1 }).limit(3).lean();
  console.log("ÖRNEK (ÖNCE):");
  sample.forEach((a) => console.log(a._id, a.start_time, a.end_time));

  // ✅ Native driver ile pipeline update (Mongoose hatasını bypass)
  const result = await Appointment.collection.updateMany(
    {},
    [
      {
        $set: {
          start_time: { $toDate: { $add: ["$start_time", shiftMs] } },
          end_time: { $toDate: { $add: ["$end_time", shiftMs] } },
        },
      },
    ]
  );

  console.log("Güncellenen kayıt sayısı:", result.modifiedCount ?? result.modifiedCount);

  const sampleAfter = await Appointment.find({}).sort({ start_time: 1 }).limit(3).lean();
  console.log("ÖRNEK (SONRA):");
  sampleAfter.forEach((a) => console.log(a._id, a.start_time, a.end_time));

  await mongoose.disconnect();
  console.log("Bitti.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
