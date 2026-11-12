import { Router } from "express";
import * as notificationController from "../controllers/notificationController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// All notification routes are protected
router.use(authenticate);

router.get("/", notificationController.getMyNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.patch("/read-all", notificationController.markAllNotificationsRead);
router.patch("/:id/read", notificationController.markNotificationRead);

export default router;
