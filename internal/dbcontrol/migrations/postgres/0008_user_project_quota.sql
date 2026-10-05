-- 0008_user_project_quota.sql — two projects per account.
--
-- The free tier was five projects per user. It is two for now, and the limit is
-- written in three places: this column default, MOOGO_DEFAULT_MAX_PROJECTS, and
-- the landing page. They have to agree, because a user who reads five on the
-- marketing page and then cannot create a third project concludes the button is
-- broken rather than that the number changed.

-- The column default is a safety net rather than the live path: every signup
-- passes the quota explicitly from config. It still has to match, because it is
-- what a row gets when someone inserts a user by hand or a test fixture omits
-- the column.
ALTER TABLE users
    ALTER COLUMN quota_max_projects SET DEFAULT 2;

-- Existing accounts are lowered too, not only new ones.
--
-- The alternative -- leaving signed-up users on five -- means the same product
-- has two different limits depending on when an account was created, and the
-- dashboard reads the number from the row, so those users would keep seeing
-- "5 projects" advertised inside their own console.
--
-- A user who already has more than two projects keeps them. Only creation is
-- blocked, and deletion is never blocked, so nobody is locked out of their own
-- data: they delete something, then create again.
UPDATE users
   SET quota_max_projects = 2
 WHERE quota_max_projects > 2;
