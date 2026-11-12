import { Router } from "express";
import * as adminController from "../controllers/adminController.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// All admin routes require authentication and ADMIN role
router.use(authenticate);
router.use(authorize("ADMIN"));

router.get("/users", adminController.listUsers);
router.post("/users", adminController.createUser);
router.patch("/users/:id/role", adminController.updateUserRole);
router.get("/audit", adminController.listAuditLogs);

export default router;
