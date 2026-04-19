import { integer, pgTable, text, timestamp, uuid, index, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { agents } from "./agents.js";

export const issueArtifacts = pgTable(
  "issue_artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    issueId: uuid("issue_id").notNull().references(() => issues.id),
    artifactId: text("artifact_id").notNull(), // Logical ID for the artifact (e.g., "implementation-plan")
    version: integer("version").notNull().default(1),
    title: text("title").notNull(),
    mimeType: text("mime_type").notNull(),
    provider: text("provider").notNull(),
    objectKey: text("object_key").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    sha256: text("sha256").notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
    createdByAgentId: uuid("created_by_agent_id").references(() => agents.id),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIssueIdx: index("issue_artifacts_company_issue_idx").on(table.companyId, table.issueId),
    companyArtifactIdVersionUniqueIdx: uniqueIndex("issue_artifacts_company_artifact_version_unique_idx").on(
      table.companyId,
      table.issueId,
      table.artifactId,
      table.version
    ),
  })
);
