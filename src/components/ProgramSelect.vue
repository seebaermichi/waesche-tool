<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { formatDuration, programLabel } from '../programs.js'

const props = defineProps({
  modelValue: { type: String, required: true },
  programs: { type: Array, required: true },
  /** { [programId]: minutenDelta } – wirkt sich auf die angezeigte Dauer aus */
  adjustments: { type: Object, default: () => ({}) },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])

const open = ref(false)
const root = ref(null)
const listbox = ref(null)

const selected = computed(
  () => props.programs.find((p) => p.id === props.modelValue) ?? props.programs[0],
)

function effectiveMinutes(program) {
  return program.minutes + (props.adjustments[program.id] ?? 0)
}

function isAdjusted(program) {
  return (props.adjustments[program.id] ?? 0) !== 0
}

function toggle() {
  if (props.disabled) return
  open.value = !open.value
}

function choose(program) {
  emit('update:modelValue', program.id)
  open.value = false
}

function onPointerDown(event) {
  if (root.value && !root.value.contains(event.target)) open.value = false
}

function onKeydown(event) {
  if (event.key === 'Escape' && open.value) {
    open.value = false
    event.stopPropagation()
  }
}

watch(open, async (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeydown)
    // Die aktive Zeile ins Sichtfeld holen – die Liste ist länger als das Panel.
    await nextTick()
    listbox.value?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
  } else {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-4 text-left transition-colors disabled:opacity-50"
      :class="open ? 'border-accent-500 ring-2 ring-accent-100' : 'active:bg-slate-50'"
      :disabled="disabled"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
    >
      <span class="min-w-0">
        <span class="block truncate text-lg font-medium text-slate-900">
          {{ programLabel(selected) }}
        </span>
        <span class="tnum block text-sm text-slate-500">
          {{ formatDuration(effectiveMinutes(selected)) }}
          <template v-if="isAdjusted(selected)"> · angepasst</template>
        </span>
      </span>
      <svg
        class="size-5 shrink-0 text-slate-400 transition-transform"
        :class="{ 'rotate-180': open }"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m5 7.5 5 5 5-5" />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute inset-x-0 top-full z-20 mt-2 max-h-[60vh] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white py-1 shadow-lg shadow-slate-900/10"
    >
      <ul ref="listbox" role="listbox" aria-label="Programm">
        <li v-for="program in programs" :key="program.id">
          <button
            type="button"
            role="option"
            :aria-selected="program.id === modelValue"
            class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-slate-100"
            :class="program.id === modelValue ? 'bg-accent-50' : ''"
            @click="choose(program)"
          >
            <span class="min-w-0 truncate">
              <span
                class="text-base"
                :class="
                  program.id === modelValue
                    ? 'font-semibold text-accent-700'
                    : 'font-medium text-slate-800'
                "
              >
                {{ program.name }}
              </span>
              <span v-if="program.note" class="ml-1.5 text-sm text-slate-500">
                {{ program.note }}
              </span>
            </span>
            <span
              class="tnum shrink-0 text-sm"
              :class="isAdjusted(program) ? 'text-accent-600' : 'text-slate-500'"
            >
              {{ formatDuration(effectiveMinutes(program)) }}
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
