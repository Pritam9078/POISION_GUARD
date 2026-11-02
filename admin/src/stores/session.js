import { defineStore } from 'pinia'
import { api } from '../services/api.js'
// Staff sessions are separate from Guard users; backend must return staff capabilities.
export const useSession = defineStore('adminSession', { state: () => ({ staff: null, loaded: false }),
  getters: { can: (s) => (cap) => !!s.staff?.capabilities?.includes(cap) },
  actions: {
    async load() { try { this.staff = (await api('/admin/session')).staff } catch { this.staff = null } this.loaded = true },
    async login(email, password, otp) {
      const res = await api('/admin/login', { method: 'POST', body: { email, password, otp } })
      if (res?.token && typeof window !== 'undefined') window.localStorage.setItem('pg_staff_token', res.token)
      await this.load()
    },
    async logout() {
      try {
        await api('/admin/logout', { method: 'POST' })
      } finally {
        if (typeof window !== 'undefined') window.localStorage.removeItem('pg_staff_token')
        this.staff = null
      }
    } } })
