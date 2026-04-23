declare global {
  namespace Express {
    interface Request {
      actor: {
        type: "none" | "board" | "agent";
        source?: string;
        userId?: string | null;
        userName?: string | null;
        userEmail?: string | null;
        companyId?: string | null;
        companyIds?: (string | null)[];
        memberships?: Array<{
          companyId: string;
          membershipRole?: string | null;
          status?: string | null;
        }>;
        isInstanceAdmin?: boolean;
        keyId?: string;
        runId?: string;
        agentId?: string;
      };
    }
  }
}

export {};