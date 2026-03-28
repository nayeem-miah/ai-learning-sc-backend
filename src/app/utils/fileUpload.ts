/* eslint-disable @typescript-eslint/no-explicit-any */
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import config from "../config";

const storage = multer.memoryStorage();
const upload = multer({ storage });

cloudinary.config({
    cloud_name: config.cloudinary.cloud_name,
    api_key: config.cloudinary.api_key,
    api_secret: config.cloudinary.api_secret,
});

const uploadToCloudinary = (file: Express.Multer.File): Promise<any> => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: "uploads",
                resource_type: "auto",
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );

        stream.end(file.buffer);
    });
};

export const fileUpload = {
    upload,
    uploadToCloudinary,
};