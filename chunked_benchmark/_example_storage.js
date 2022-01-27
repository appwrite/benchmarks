class Storage extends Service {
 /**
  * Create File
  *
  * Create a new file. The user that creates the file will automatically be
  * granted read and write permissions unless they have passed custom values
  * for read and write permissions.
  *
  * Larger files should be uploaded using multiple requests with the
  * [content-range](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Range)
  * header to send a partial request with a maximum supported chunk of `5MB`.
  * The `content-range` header values should always be in bytes.
  *
  * When the first request is sent, the server will return the **File** object,
  * and the subsequent part request must include the file's **id** in
  * `x-appwrite-upload-id` header to allow the server to know that the partial
  * upload is for the existing file and not for a new one.
  *
  * If you're creating a new file using one the Appwrite SDKs, all the chunking
  * logic will be managed by the SDK internally.
  *
  *
  * @param {string} bucketId
  * @param {string} fileId
  * @param {File} file
  * @param {string[]} read
  * @param {string[]} write
  * @throws {AppwriteException}
  * @returns {Promise}
  */
 async createFile(bucketId, fileId, file, read, write, onProgress = () => {}) {
  if (typeof bucketId === "undefined") {
   throw new AppwriteException('Missing required parameter: "bucketId"');
  }

  if (typeof fileId === "undefined") {
   throw new AppwriteException('Missing required parameter: "fileId"');
  }

  if (typeof file === "undefined") {
   throw new AppwriteException('Missing required parameter: "file"');
  }

  let path = "/storage/buckets/{bucketId}/files".replace(
   "{bucketId}",
   bucketId
  );
  let payload = {};

  if (typeof fileId !== "undefined") {
   payload["fileId"] = fileId;
  }

  if (typeof file !== "undefined") {
   payload["file"] = file;
  }

  if (typeof read !== "undefined") {
   payload["read"] = read;
  }

  if (typeof write !== "undefined") {
   payload["write"] = write;
  }

  const { size: size } = await promisify(fs.stat)(file);

  if (size <= client.CHUNK_SIZE) {
   payload["file"] = fs.createReadStream(file);

   return await this.client.call(
    "post",
    path,
    {
     "content-type": "multipart/form-data",
    },
    payload
   );
  } else {
   let id = undefined;
   let response = undefined;

   const totalCounters = Math.ceil(size / client.CHUNK_SIZE);

   for (let counter = 0; counter < totalCounters; counter++) {
    const start = counter * client.CHUNK_SIZE;
    const end = Math.min(
     counter * client.CHUNK_SIZE + client.CHUNK_SIZE - 1,
     size
    );
    const headers = {
     "content-type": "multipart/form-data",
     "content-range": "bytes " + start + "-" + end + "/" + size,
    };

    if (id) {
     headers["x-appwrite-id"] = id;
    }

    const stream = fs.createReadStream(file, {
     start,
     end,
    });
    payload["file"] = stream;

    response = await this.client.call("post", path, headers, payload);

    if (!id) {
     id = response["$id"];
    }

    if (onProgress !== null) {
     onProgress(
      (Math.min((counter + 1) * client.CHUNK_SIZE, size) / size) * 100
     );
    }
   }

   return response;
  }
 }
}
