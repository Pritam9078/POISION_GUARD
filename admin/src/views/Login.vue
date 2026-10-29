<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../stores/session.js'
const s = useSession(), router = useRouter(), f = reactive({ email: '', password: '', otp: '' }), err = ref('')
async function go() { err.value = ''; try { await s.login(f.email, f.password, f.otp); router.push('/overview') } catch (e) { err.value = e.message } }
</script>
<template><div class="aurora"><form class="card" style="max-width:400px;margin:15vh auto;background:#fff" @submit.prevent="go"><h2>Staff sign in</h2>
  <p class="small muted">Platform staff only. A Guard account is not an administrator.</p>
  <div class="field"><label>Email</label><input type="email" v-model="f.email" required/></div><div class="field"><label>Password</label><input type="password" v-model="f.password" required/></div>
  <div class="field"><label>One-time code</label><input v-model="f.otp" inputmode="numeric" autocomplete="one-time-code"/></div>
  <p v-if="err" class="err">{{ err }}</p><button class="btn">Sign in</button></form></div></template>
