<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../stores/session.js'
const s = useSession(), router = useRouter(), f = reactive({ email: '', password: '', otp: '' }), err = ref('')
async function go() { err.value = ''; try { await s.login(f.email, f.password, f.otp); router.push('/overview') } catch (e) { err.value = e.message } }
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
      <div class="field"><label>Password</label><input type="password" v-model="f.password" required/></div>
      <p v-if="err" class="err">{{ err }}</p>
      <button class="btn" style="width:100%;margin-top:1rem;padding:0.75rem;">Sign in</button>
    </form>
  </div>
</template>
