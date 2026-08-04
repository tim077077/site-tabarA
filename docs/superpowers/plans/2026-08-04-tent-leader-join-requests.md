# Tent leader + join requests — implementation plan

> Implemented in-session after design approval.

**Goal:** Creator is leader; joins need leader approval; leader invites/removes; leadership transfers on leave.

**Done:**
1. Migration `tent_leader_join_requests` on corturi-fagarasi
2. `assets/store.js` — supabase + demo
3. `assets/app.js` — tent sheet UI
4. `supabase/schema.sql` + design spec

**Verify manually:** create tent → leader badge; second user “Cere să intri” → leader Accept; Scoate; leave transfers leader.
