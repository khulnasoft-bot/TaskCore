import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@taskcore/db";
import { budgetPolicies, agentRuntimeState, agents } from "@taskcore/db";
import { logger } from "../middleware/logger.js";
import { logActivity } from "./activity-log.js";

export const circuitBreakerService = (db: Db, budgetService: any) => {
  return {
    async checkAndEnforce(agentId: string) {
      const agent = await db.query.agents.findFirst({
        where: eq(agents.id, agentId),
      });
      if (!agent) return;

      const runtime = await db.query.agentRuntimeState.findFirst({
        where: eq(agentRuntimeState.agentId, agentId),
      });
      if (!runtime) return;

      const policies = await db.query.budgetPolicies.findMany({
        where: and(
          eq(budgetPolicies.companyId, agent.companyId),
          eq(budgetPolicies.isActive, true)
        ),
      });

      for (const policy of policies) {
        if (!policy.circuitBreakerJson) continue;

        const config = policy.circuitBreakerJson;
        
        // Scope check: if policy is agent-scoped, must match agentId.
        // If company-scoped, it applies to all.
        if (policy.scopeType === "agent" && policy.scopeId !== agentId) continue;

        if (runtime.consecutiveFailures >= config.failureThreshold) {
          if (config.autoPause) {
            logger.warn({ agentId, consecutiveFailures: runtime.consecutiveFailures, threshold: config.failureThreshold }, "Circuit breaker tripped: auto-pausing agent");
            
            await budgetService.pauseAgent(agent.companyId, agentId, "budget"); // Using 'budget' as pause reason for now

            await logActivity(db, {
              companyId: agent.companyId,
              actorType: "system",
              actorId: "circuit_breaker",
              action: "agent.paused",
              entityType: "agent",
              entityId: agentId,
              agentId,
              details: {
                reason: "circuit_breaker_tripped",
                consecutiveFailures: runtime.consecutiveFailures,
                threshold: config.failureThreshold,
                policyId: policy.id
              }
            });
            break; // Stop after first trip
          }
        }
      }
    },

    checkCompanyBreaker: async (companyId: string) => {
      // Check if multiple agents in this company have tripped breakers recently.
      const threshold = 3; // trip company if 3+ agents have tripped
      const windowMs = 15 * 60 * 1000; // 15 minutes

      const recentBreakers = await db
        .select()
        .from(budgetIncidents)
        .where(
          and(
            eq(budgetIncidents.companyId, companyId),
            eq(budgetIncidents.type, "circuit_breaker"),
            gt(budgetIncidents.createdAt, new Date(Date.now() - windowMs))
          )
        );

      const uniqueAgents = new Set(recentBreakers.map(b => b.agentId).filter(Boolean));

      if (uniqueAgents.size >= threshold) {
        // Trip company breaker
        await db.update(companies).set({ pausedAt: new Date() }).where(eq(companies.id, companyId));
        
        await db.insert(budgetIncidents).values({
          companyId,
          type: "circuit_breaker",
          amount: "0",
          currency: "USD",
          details: {
            reason: "Multiple agents tripped circuit breakers",
            agentCount: uniqueAgents.size,
            agents: Array.from(uniqueAgents)
          }
        });

        logger.error({ companyId, agentCount: uniqueAgents.size }, "Company circuit breaker tripped");
        return true;
      }

      return false;
    }
  };
};
