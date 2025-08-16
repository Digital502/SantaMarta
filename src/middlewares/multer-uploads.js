import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "cloudinary";
import { extname } from "path";


cloudinary.v2.config({
  cloud_name: "ddchtdi5y",
  api_key: "598451487432635",
  api_secret: "GSjR--r38TGbNrbWcJizcdOe0ys",
});

const profileImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary.v2,
  params: {
    folder: "profileUserKivora",
    public_id: (req, file) => {
      const flieExtension = extname(file.originalname);
      const fileName = file.originalname.split(flieExtension)[0];
      return `${fileName}-${Date.now()}`;
    },
  },
});


export const uploadProfilePicture = multer({
  storage: profileImageStorage,
  fileFilter: (req, file, cb) => {
    cb(null, true); 
  },
  limits: {
    fileSize: 10000000,
  },
});
