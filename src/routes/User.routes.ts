import { Router } from "express";
import { authenticate } from "../middleware/auth";

const router = Router();
//@ts-ignore
router.get("/", authenticate, (req, res) => {
	res.json({ user: req.user });
});

export default router;
