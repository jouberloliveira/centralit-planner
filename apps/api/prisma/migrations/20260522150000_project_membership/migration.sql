-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'WRITER', 'READER');

-- CreateTable
CREATE TABLE "project_memberships" (
    "user_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "role" "ProjectRole" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_memberships_pkey" PRIMARY KEY ("user_id", "project_id")
);

-- CreateIndex
CREATE INDEX "project_memberships_project_id_idx" ON "project_memberships"("project_id");

-- AddForeignKey
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_memberships" ADD CONSTRAINT "project_memberships_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: grant any existing user that has work items in a project OWNER
-- role on those projects. For projects without any work items, no membership
-- exists yet — POST /projects from a future request will create owner rows.
-- This keeps legacy creators (pre-CEN-21) able to access their own data.
INSERT INTO "project_memberships" ("user_id", "project_id", "role")
SELECT DISTINCT wi."assignee_id", wi."project_id", 'OWNER'
FROM "work_items" wi
WHERE wi."assignee_id" IS NOT NULL
ON CONFLICT DO NOTHING;
