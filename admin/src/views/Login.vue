<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../stores/session.js'

const s = useSession(), router = useRouter()
const f = reactive({ email: '', password: '' })
const err = ref(''), showPassword = ref(false), loading = ref(false)

function fillDemo(type) {
  if (type === 'admin') {
    f.email = 'admin@poisonguard.com'
    f.password = 'PoisonGuardAdmin2026!'
  } else {
    f.email = 'user@poisonguard.com'
    f.password = 'PoisonGuardUser2026!'
  }
  err.value = ''
}

async function go() {
  err.value = ''
  loading.value = true
  try {
    await s.login(f.email.trim(), f.password.trim())
    router.push('/overview')
  } catch (e) {
    err.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
<template>
  <div class="aurora">
    <form class="card" style="max-width:440px;margin:10vh auto;background:#fff;padding:2.2rem;box-shadow:0 12px 32px rgba(0,0,0,0.06);border-radius:1rem;" @submit.prevent="go">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;">
        <img src="/logo/mark.svg" alt="PoisonGuard" style="width:36px;height:36px;" />
        <div>
          <div style="font-weight:600;font-size:1.15rem;letter-spacing:-0.02em;color:#0F1115;line-height:1.2;">PoisonGuard</div>
          <div style="font-size:0.75rem;color:#6B7080;font-weight:500;">Admin Platform</div>
        </div>
      </div>
      <h2 style="margin-top:0.5rem;font-size:1.5rem;font-weight:500;letter-spacing:-0.02em;">Staff sign in</h2>
      <p class="small muted" style="margin-bottom:1.25rem;">Platform staff access. OTP is disabled for direct login.</p>

      <!-- Quick Fill Helper -->
      <div style="background:#F6F7FB;border:1px solid #E5E7EB;border-radius:0.5rem;padding:0.75rem 0.9rem;margin-bottom:1.25rem;font-size:0.8rem;">
        <div style="font-weight:600;color:#374151;margin-bottom:0.4rem;">Quick Fill Credentials:</div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <button type="button" @click="fillDemo('admin')" style="background:#4F46E5;color:#fff;border:none;border-radius:0.375rem;padding:0.35rem 0.65rem;font-size:0.75rem;cursor:pointer;font-weight:500;">Admin (admin@poisonguard.com)</button>
          <button type="button" @click="fillDemo('user')" style="background:#EEF2FF;color:#4F46E5;border:1px solid #C7D2FE;border-radius:0.375rem;padding:0.35rem 0.65rem;font-size:0.75rem;cursor:pointer;font-weight:500;">User (user@poisonguard.com)</button>
        </div>
      </div>

      <div class="field"><label>Email</label><input type="email" v-model="f.email" placeholder="admin@poisonguard.com" required/></div>
      <div class="field">
        <label>Password</label>
        <div style="position:relative;display:flex;align-items:center;">
          <input :type="showPassword ? 'text' : 'password'" v-model="f.password" style="width:100%;padding-right:2.5rem;" required/>
          <button type="button" @click="showPassword = !showPassword" style="position:absolute;right:0.6rem;background:none;border:none;cursor:pointer;color:#6B7080;display:flex;align-items:center;padding:0.25rem;" aria-label="Toggle password visibility">
            <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
          </button>
        </div>
      </div>
      <p v-if="err" class="err" style="color:#DC2626;background:#FEE2E2;padding:0.5rem 0.75rem;border-radius:0.375rem;font-size:0.8rem;margin-top:0.5rem;">{{ err }}</p>
      <button class="btn" :disabled="loading" style="width:100%;margin-top:1rem;padding:0.75rem;display:flex;justify-content:center;align-items:center;gap:0.5rem;">
        <span v-if="loading">Signing in...</span>
        <span v-else>Sign in</span>
      </button>
    </form>
  </div>
</template>
