import { Router } from "express";
const router = Router();
import multer from "multer";
import { uploadFile } from "../utils/storage";
import { authenticate } from "../middleware/auth";
import { db } from "../db";
import { books } from "../../migrations/schema";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 80 * 1024 * 1024, // 80 mb
    },
});

router.post("/", authenticate, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        } else {
            const fileBuffer = req.file.buffer;
            const fileName = `${req.user.id}-${Date.now()}-${req?.file.originalname}`;
            await uploadFile(fileName, fileBuffer);

            const [book] = await db
                .insert(books)
                .values({
                    title: req.file.originalname,
                    userId: req.user.id,
                    fileKey: fileName,
                })
                .returning();

            return res.json({
                message: "File upload succesfull",
                book,
            });
        }
    } catch (e) {
        console.error("Upload Error", e);

        return Response.json(
            {
                error: "Upload failed",
            },
            {
                status: 500,
            },
        );
    }
});

export default router;
