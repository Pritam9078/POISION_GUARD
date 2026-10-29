# What roles are there in a workspace?
Owner, Admin, Approver, Operator and Auditor. Permissions are enforced by the server; hiding a button in the app is not the security control.
Owner: everything, including billing and workspace deletion requests. Admin: everything except billing management and deletion. Approver: approves or rejects spend intents, verifies trusted recipients, can freeze agents, views most data. Operator: manages wallets and recipients, runs scans, creates and executes spend intents; cannot approve. Auditor: read-only, including the full audit log and proof verification.

# Can I approve my own spend request?
No. Separation of duties is enforced: you cannot approve or reject an intent you requested, the owner of an agent cannot approve that agent's spend (unless a policy explicitly allows it), each approver counts once, and approvals bind to the exact transaction parameters. AI agents can never approve anything — they can only propose; approvals always come from human members.

# What protects the last owner?
The last active owner cannot be removed, demoted or suspended. Only owners can grant or change the owner role. Members cannot change their own role.

# What is the access review?
Team & roles → Access review lists active members with flags: inactive for 90 days, privileged (owner/admin) and time-bound access. Memberships can be given an expiry.

# Can PoisonGuard staff see or change my workspace?
Platform staff use a separate admin console with separate accounts and mandatory two-factor sign-in. Staff cannot approve or reject your spend intents, sign or broadcast transactions, edit your policies or impersonate you. Inspecting your workspace requires a written justification and is recorded in your own audit timeline as "platform staff inspect", and staff see metadata only (masked member emails, counts, policy names) — never trusted-recipient details, intents or knowledge-base documents. In an emergency, staff can suspend a workspace or freeze a compromised agent, with a reason recorded on both audit chains.
