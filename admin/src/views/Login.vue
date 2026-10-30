<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../stores/session.js'
const s = useSession(), router = useRouter(), f = reactive({ email: '', password: '' }), err = ref(''), showPassword = ref(false)
async function go() { err.value = ''; try { await s.login(f.email, f.password); router.push('/overview') } catch (e) { err.value = e.message } }
</script>
<template>
  <div class="aurora">
    <form class="card" style="max-width:420px;margin:12vh auto;background:#fff;padding:2.2rem" @submit.prevent="go">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.25rem;">
        <img src="/logo/mark.svg" alt="PoisonGuard" style="width:36px;height:36px;" />
        <div>
          <div style="font-weight:600;font-size:1.15rem;letter-spacing:-0.02em;color:#0F1115;line-height:1.2;">PoisonGuard</div>
          <div style="font-size:0.75rem;color:#6B7080;font-weight:500;">Admin Platform</div>
        </div>
      </div>
      <h2 style="margin-top:0.5rem;font-size:1.5rem;font-weight:500;letter-spacing:-0.02em;">Staff sign in</h2>
      <p class="small muted" style="margin-bottom:1.25rem;">Platform staff only. A Guard account is not an administrator.</p>
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
      <p v-if="err" class="err">{{ err }}</p>
      <button class="btn" style="width:100%;margin-top:1rem;padding:0.75rem;">Sign in</button>
    </form>
  </div>
</template>
