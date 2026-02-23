import ImageKit from "imagekit";
const { v4: uuidv4 } = require("uuid");

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

const uploadImages = async (files) => {
  const folder = "/products"; // Specify your desired folder path
  const imageUploads = await Promise.all(
    files.map(async (file) => {
      const result = await imagekit.upload({
        file: file.buffer,
        fileName: uuidv4(),
        folder,
      });
      return {
        url: result.url,
        thumbnail: result.thumbnail,
        id: result.fileId,
      };
    })
  );
  return imageUploads;
};

module.exports = { uploadImages };
