<script setup lang="ts">
import { RouterView } from 'vue-router'
import { useUiStore } from '@/stores/ui'

// تهيئة الواجهة (الثيم + اللغة + RTL) عند إقلاع التطبيق.
useUiStore()
</script>

<template>
  <RouterView />
</template>
