<script setup lang="ts">
// غلاف موحّد لحوار PrimeVue عبر كل النظام:
// - draggable=false: الحوار لا يتحرك (لا يُسحب).
// - dismissableMask: النقر خارج الحوار (على التعتيم) يغلقه.
// يمرّر كل السمات والفتحات (slots) كما هي، فيُستعمل تماماً كـ <Dialog>.
import Dialog from 'primevue/dialog'

defineOptions({ inheritAttrs: false })
</script>

<template>
  <Dialog v-bind="$attrs" :draggable="false" :dismissable-mask="true">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </Dialog>
</template>
