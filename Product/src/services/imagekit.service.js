import ImageKit from "imagekit";
import { v4 as uuidv4 } from "uuid";

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
        thumbnail: result.thumbnailUrl,
        id: result.fileId,
      };
    })
  );
  return imageUploads;
};

export default { uploadImages };