<script setup>
import { useRouter } from 'vue-router'
import { useSession } from '../stores/session.js'
import { adminNav } from '../router/index.js'
const s = useSession(), router = useRouter()
async function out() { await s.logout(); router.push('/login') }
</script>
<template><div class="aurora"><div class="float">
  <nav class="top">
    <div style="display:inline-flex;align-items:center;gap:0.6rem;">
      <img src="/logo/mark.svg" alt="PoisonGuard" style="width:26px;height:26px;" />
      <span class="logo" style="margin:0;">PoisonGuard Admin</span>
    </div>
    <span class="chip">Platform staff</span>
    <span class="sp"/>
    <span class="small muted">{{ s.staff?.email }}</span>
    <button class="btn ghost" @click="out">Log out</button>
  </nav>
  <div class="shell"><aside class="side"><RouterLink v-for="n in adminNav" :key="n[0]" :to="n[0]">{{ n[1] }}</RouterLink></aside><main><RouterView /></main></div>
</div></div></template>
