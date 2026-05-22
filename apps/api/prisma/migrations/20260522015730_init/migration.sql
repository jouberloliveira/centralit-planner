-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WorkItemType" AS ENUM ('EPIC', 'FEATURE', 'USER_STORY', 'TASK');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_items" (
    "id" UUID NOT NULL,
    "type" "WorkItemType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "WorkItemStatus" NOT NULL DEFAULT 'BACKLOG',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "project_id" UUID NOT NULL,
    "parent_id" UUID,
    "assignee_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "work_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "projects_key_key" ON "projects"("key");

-- CreateIndex
CREATE INDEX "work_items_project_id_type_idx" ON "work_items"("project_id", "type");

-- CreateIndex
CREATE INDEX "work_items_parent_id_idx" ON "work_items"("parent_id");

-- CreateIndex
CREATE INDEX "work_items_assignee_id_idx" ON "work_items"("assignee_id");

-- CreateIndex
CREATE INDEX "work_items_status_idx" ON "work_items"("status");

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "work_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Parent-type validity rules (enforced at row level via subquery in CHECK is not
-- supported by Postgres directly, so we use a trigger).
--
-- Rules (per CEN-7 plan):
--   EPIC        : parent must be NULL
--   FEATURE     : parent must be EPIC or NULL
--   USER_STORY  : parent must be FEATURE, EPIC, or NULL
--   TASK        : parent must be USER_STORY, FEATURE, EPIC, or NULL
--
-- Additional rule: parent (when present) must belong to the same project.

CREATE OR REPLACE FUNCTION validate_work_item_parent()
RETURNS TRIGGER AS $$
DECLARE
    parent_type "WorkItemType";
    parent_project UUID;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT type, project_id INTO parent_type, parent_project
    FROM work_items
    WHERE id = NEW.parent_id;

    IF parent_type IS NULL THEN
        RAISE EXCEPTION 'parent work_item % not found', NEW.parent_id;
    END IF;

    IF parent_project <> NEW.project_id THEN
        RAISE EXCEPTION 'parent work_item % belongs to a different project', NEW.parent_id;
    END IF;

    CASE NEW.type
        WHEN 'EPIC' THEN
            RAISE EXCEPTION 'EPIC work item cannot have a parent';
        WHEN 'FEATURE' THEN
            IF parent_type <> 'EPIC' THEN
                RAISE EXCEPTION 'FEATURE parent must be EPIC, got %', parent_type;
            END IF;
        WHEN 'USER_STORY' THEN
            IF parent_type NOT IN ('FEATURE', 'EPIC') THEN
                RAISE EXCEPTION 'USER_STORY parent must be FEATURE or EPIC, got %', parent_type;
            END IF;
        WHEN 'TASK' THEN
            IF parent_type NOT IN ('USER_STORY', 'FEATURE', 'EPIC') THEN
                RAISE EXCEPTION 'TASK parent must be USER_STORY, FEATURE, or EPIC, got %', parent_type;
            END IF;
    END CASE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_items_validate_parent
    BEFORE INSERT OR UPDATE OF parent_id, type, project_id ON work_items
    FOR EACH ROW
    EXECUTE FUNCTION validate_work_item_parent();
