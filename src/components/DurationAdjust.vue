<script setup>
// Die Handbuchzeiten sind laut Hersteller nur Richtwerte. Hier lässt sich die Dauer eines
// Programms dauerhaft nachjustieren – die Korrektur wirkt auf den nächsten Start.
import { computed } from 'vue'
import { formatDuration, programLabel } from '../programs.js'

const props = defineProps({
  program: { type: Object, required: true },
  delta: { type: Number, default: 0 },
})

const emit = defineEmits(['update:delta'])

const effective = computed(() => props.program.minutes + props.delta)

const deltaLabel = computed(() => {
  if (props.delta === 0) return null
  const sign = props.delta > 0 ? '+' : '−'
  return `${sign}${Math.abs(props.delta)} Min. gegenüber Handbuch (${formatDuration(props.program.minutes)})`
})

function change(step) {
  // Mindestens eine Minute – eine Dauer von 0 wäre sinnlos.
  const next = Math.max(1 - props.program.minutes, props.delta + step)
  emit('update:delta', next)
}
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-4">
    <p class="text-sm text-slate-600">
      Dauer für <span class="font-medium text-slate-800">{{ programLabel(program) }}</span> anpassen
    </p>

    <div class="mt-3 flex items-center justify-between gap-2">
      <button
        type="button"
        class="h-11 w-14 shrink-0 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 active:bg-slate-100"
        @click="change(-5)"
      >
        − 5
      </button>
      <button
        type="button"
        class="h-11 w-14 shrink-0 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 active:bg-slate-100"
        @click="change(-1)"
      >
        − 1
      </button>

      <span class="tnum grow text-center text-lg font-semibold text-slate-900">
        {{ formatDuration(effective) }}
      </span>

      <button
        type="button"
        class="h-11 w-14 shrink-0 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 active:bg-slate-100"
        @click="change(1)"
      >
        + 1
      </button>
      <button
        type="button"
        class="h-11 w-14 shrink-0 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 active:bg-slate-100"
        @click="change(5)"
      >
        + 5
      </button>
    </div>

    <div v-if="delta !== 0" class="mt-3 flex items-center justify-between gap-3">
      <span class="text-xs text-slate-500">{{ deltaLabel }}</span>
      <button
        type="button"
        class="shrink-0 text-sm font-medium text-accent-600 underline underline-offset-2"
        @click="emit('update:delta', 0)"
      >
        zurücksetzen
      </button>
    </div>
  </div>
</template>
