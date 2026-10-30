import { query } from '../helpers/db.helper.js'
import { newId } from '../../src/shared/ids.js'

export async function createTestWorkspace({
  name = 'POISONGUARD_E2E_Workspace',
  ownerId,
} = {}) {
  const wsId = newId('ws')
  const slug = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  
  await query(
    `INSERT INTO workspaces (id, name, slug, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'active', now(), now())`,
    [wsId, name, slug]
  )

  if (ownerId) {
    const memId = newId('mem')
    await query(
      `INSERT INTO memberships (id, workspace_id, user_id, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'owner', 'active', now(), now())`,
      [memId, wsId, ownerId]
    )
  }

  return { id: wsId, name, slug }
}

export async function addMemberToWorkspace({
  workspaceId,
  userId,
  role = 'member',
} = {}) {
  const memId = newId('mem')
  await query(
    `INSERT INTO memberships (id, workspace_id, user_id, role, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'active', now(), now())
     ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = $4, status = 'active'`,
    [memId, workspaceId, userId, role]
  )
  return { id: memId, workspaceId, userId, role }
}

