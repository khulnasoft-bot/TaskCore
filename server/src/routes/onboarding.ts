import { Router } from "express";
import { onboardingService } from "../services/onboarding.js";
import { badRequest } from "../errors.js";

export function onboardingRoutes() {
  const router = Router();
  const svc = onboardingService();

  router.post("/recommendation", async (req, res) => {
    const { mission } = req.body;
    if (typeof mission !== "string" || !mission.trim()) {
      throw badRequest("Mission is required");
    }

    const recommendation = await svc.generateRecommendation(mission);
    res.json(recommendation);
  });

  return router;
}
