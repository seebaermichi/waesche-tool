<script setup>
// Genau die Stufen, die die Zeitvorwahl der Maschine kennt (Geräteprofil `delay`).
// Wenige Stufen als Kacheln, viele (etwa 1–24 Std.) als Auswahlliste.
import { computed } from 'vue'

const MAX_TILES = 6

const props = defineProps({
  modelValue: { type: Number, required: true },
  hours: { type: Array, required: true },
  /** 'start': Start wird verschoben, 'end': "fertig in X Std." */
  mode: { type: String, default: 'start' },
  disabled: { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])

const options = computed(() =>
  props.hours.map((h) => ({
    value: h,
    label: h === 0 ? 'Jetzt' : props.mode === 'end' ? `fertig in ${h} Std.` : `in ${h} Std.`,
  })),
)
</script>

<template>
  <fieldset :disabled="disabled" class="disabled:opacity-50">
    <legend class="sr-only">Zeitvorwahl</legend>
    <select
      v-if="options.length > MAX_TILES"
      class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3.5 text-base font-medium text-slate-700"
      :value="modelValue"
      @change="$emit('update:modelValue', Number($event.target.value))"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <div v-else class="grid grid-cols-2 gap-2">
      <label
        v-for="option in options"
        :key="option.value"
        class="flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3.5 transition-colors"
        :class="
          modelValue === option.value
            ? 'border-accent-500 bg-accent-50'
            : 'border-slate-300 bg-white active:bg-slate-50'
        "
      >
        <input
          type="radio"
          name="delay"
          class="sr-only"
          :value="option.value"
          :checked="modelValue === option.value"
          @change="$emit('update:modelValue', option.value)"
        />
        <span
          class="flex size-5 shrink-0 items-center justify-center rounded-full border-2"
          :class="modelValue === option.value ? 'border-accent-600' : 'border-slate-300'"
          aria-hidden="true"
        >
          <span v-if="modelValue === option.value" class="size-2.5 rounded-full bg-accent-600" />
        </span>
        <span
          class="text-base"
          :class="
            modelValue === option.value ? 'font-semibold text-accent-700' : 'font-medium text-slate-700'
          "
        >
          {{ option.label }}
        </span>
      </label>
    </div>
  </fieldset>
</template>
