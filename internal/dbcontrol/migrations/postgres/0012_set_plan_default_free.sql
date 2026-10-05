-- 0012_set_plan_default_free.sql — mark the accounts that already existed
-- before the billing_plan column landed as free.
--
-- These eleven accounts signed in before the plan column existed, and at least
-- some of them reached their accounts through Google, which proved the address
-- at the time. Re-requiring a plan would lock them out over a rule that did not
-- exist when they registered. Every account that still has no plan is set to
-- the only one billing is not going to charge for in this version.

UPDATE users
   SET billing_plan = 'free'
 WHERE billing_plan = '';

-- A fresh account created this afternoon must not have to run this query to
-- get a plan: the column default does it for us.
