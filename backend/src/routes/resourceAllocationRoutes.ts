import { Router } from "express";
import * as controller from "../controllers/resourceAllocationController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

router.get("/recommendations/:incidentId", authenticate, controller.getRecommendations);
router.post("/allocate", authenticate, controller.allocate);
router.post("/deallocate/:resourceId", authenticate, controller.deallocate);

export default router;
