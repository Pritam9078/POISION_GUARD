<script setup>
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../services/api.js'
const route = useRoute()
const rows = ref([]), loading = ref(true), error = ref(null)
async function load() {
  loading.value = true; error.value = null
  try {
    const ep = route.meta.endpoint.replace(/:(\w+)/g, (_, k) => encodeURIComponent(route.params[k] ?? ''))
    const d = await api(ep); rows.value = Array.isArray(d) ? d : (d.items ?? [d])
  } catch (e) { error.value = e } finally { loading.value = false }
}
watch(() => route.fullPath, load, { immediate: true })
const cols = () => rows.value.length ? Object.keys(rows.value[0]).filter(k => typeof rows.value[0][k] !== 'object').slice(0, 7) : []
</script>
<template>
  <div>
    <h2>{{ route.meta.title }}</h2>
    <p class="muted small">Data from <code>{{ route.meta.endpoint }}</code>. Authorization is enforced by the backend.</p>
    <div v-if="loading" class="state">Loading…</div>
    <div v-else-if="error" class="state"><b>{{ error.status === 403 ? 'Permission denied' : 'Could not load' }}</b><br/>{{ error.message }}<br/><button class="btn ghost" style="margin-top:12px" @click="load">Retry</button></div>
    <div v-else-if="!rows.length" class="state">Nothing here yet.</div>
    <div v-else class="scroll card"><table><thead><tr><th v-for="c in cols()" :key="c">{{ c }}</th></tr></thead>
      <tbody><tr v-for="(r, i) in rows" :key="r.id ?? i"><td v-for="c in cols()" :key="c">{{ r[c] }}</td></tr></tbody></table></div>
  </div>
</template>
