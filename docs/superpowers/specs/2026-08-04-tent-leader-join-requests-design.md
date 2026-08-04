# Tent leader + join requests

## Goal
Creator is tent leader. Instant join is replaced by join requests the leader approves/rejects. Invites stay as a pull flow (leader only). Leader can remove members. Leadership transfers to the oldest remaining member on leave; empty tents are deleted.

## Data
- `camp_tents.leader_id` → `camp_participants(id)` (fix broken FK to `auth.users`)
- On create: `leader_id = created_by = actor`
- `camp_invites.kind` ∈ (`invite`, `join_request`), default `invite`
- Both kinds reserve capacity while `pending`

## Rules
- `join_tent` creates pending `join_request` (no auto-assign)
- `invite_to_tent` / create-time invites: leader only
- `respond_invite`: invitee for `invite`; leader for `join_request`
- `cancel_invite`: invitee/requester or leader
- `remove_from_tent`: leader removes another member
- `leave_tent`: if leader leaves and others remain → oldest assignment becomes leader

## UI
- Non-member: “Cere să intri”
- Leader: accept/reject join requests, invite, Scoate on members
- Members: leave only; no invite/kick
