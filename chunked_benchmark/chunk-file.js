const { promisify } = require("node:util");
const fs = require("node:fs");
const path = require("node:path");

(async () => {
 const CHUNK_SIZE = 5 * 1024 * 1024;
 const file = "bigfile.bin";
 const { size: size } = await promisify(fs.stat)(file);

 if (size <= CHUNK_SIZE) {
  console.log("No need to chunk the file.");
 } else {
  const totalCounters = Math.ceil(size / CHUNK_SIZE);

  for (let counter = 0; counter < totalCounters; counter++) {
   const start = counter * CHUNK_SIZE;
   const end = Math.min(counter * CHUNK_SIZE + CHUNK_SIZE - 1, size);

   await new Promise((res, rej) => {
    fs
     .createReadStream(file, {
      start,
      end,
     })
     .pipe(
      fs.createWriteStream(
       path.join(__dirname, "chunks", "c" + counter + ".chunk")
      )
     )
     .on("close", () => {
      res(true);
     });
   });
  }
 }
})()
 .then(() => {
  console.log("✅ Done");
 })
 .catch((err) => {
  console.error("Error!");
  console.log(err);
  process.exit();
 });
