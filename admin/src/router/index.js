import { createRouter, createWebHistory } from 'vue-router'
import { useSession } from '../stores/session.js'
const pages = [['overview','Overview','/admin/overview'],['system/health','System health','/admin/health'],['scans','Scans','/admin/scans'],['findings','Findings','/admin/findings'],['reports','Reports','/admin/reports'],['workspaces','Workspaces','/admin/workspaces'],['access','Access','/admin/access'],['agents','Agents','/admin/agents'],['policies','Policies','/admin/policies'],['spend-incidents','Spend incidents','/admin/incidents?type=spend'],['security-incidents','Security incidents','/admin/incidents?type=security'],['audit','Audit','/admin/audit'],['proofs','Proofs','/admin/proofs'],['integrations','Integrations','/admin/integrations'],['chains','Chains','/admin/chains'],['billing','Billing','/admin/billing'],['content','Content','/admin/content'],['feature-flags','Feature flags','/admin/feature-flags'],['settings','Settings','/admin/settings']]
export const adminNav = pages.map(([p, t]) => ['/' + p, t])
const R = (path, title, endpoint) => ({ path, component: () => import('../components/ResourcePage.vue'), meta: { title, endpoint, auth: true } })
const children = [...pages.map(p => R(...p)), R('workspaces/:workspaceId', 'Workspace', '/admin/workspaces/:workspaceId')]
export const router = createRouter({ history: createWebHistory(), routes: [
  { path: '/login', component: () => import('../views/Login.vue') },
  { path: '/', component: () => import('../layouts/AdminLayout.vue'), redirect: '/overview', children },
  { path: '/:p(.*)*', redirect: '/overview' }] })
router.beforeEach(async (to) => { if (to.path === '/login') return true
  const s = useSession(); if (!s.loaded) await s.load(); return s.staff ? true : '/login' })
