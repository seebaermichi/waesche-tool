<script setup>
// Anleitung zum Entkalken plus Einstellung, nach wie vielen Wäschen die App erinnert.
import { computed, ref } from 'vue'
import { formatDuration, programLabel } from '../programs.js'
import { DESCALE_INTERVAL_DAYS, MAX_THRESHOLD, MIN_THRESHOLD } from '../composables/useDescaling.js'

const props = defineProps({
  /** Das Entkalkungsprogramm des Geräts */
  program: { type: Object, required: true },
  /** Geräteprofil `descale`: { programId, temperature?, afterwards? } */
  descale: { type: Object, required: true },
  /** Effektive Dauer des Programms inkl. Feintuning */
  minutes: { type: Number, required: true },
  washes: { type: Number, required: true },
  threshold: { type: Number, required: true },
  lastDescaledAt: { type: Number, default: null },
  dueAt: { type: Number, required: true },
})

const emit = defineEmits([
  'choose',
  'done',
  'close',
  'update:threshold',
  'update:washes',
  'update:lastDescaledAt',
])

const showCorrection = ref(false)

/** Lokales Datum als "JJJJ-MM-TT" für <input type="date">. */
function toDateValue(ts) {
  const d = new Date(ts)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const today = toDateValue(Date.now())
const lastDescaledValue = computed(() =>
  props.lastDescaledAt ? toDateValue(props.lastDescaledAt) : '',
)

function onWashesInput(event) {
  const value = Number.parseInt(event.target.value, 10)
  if (Number.isNaN(value) || value < 0) event.target.value = props.washes
  else emit('update:washes', value)
}

function onDateInput(event) {
  const value = event.target.value
  if (!value) return
  // Mittags statt Mitternacht, damit Zeitumstellungen den Tag nicht verschieben.
  const [y, m, d] = value.split('-').map(Number)
  emit('update:lastDescaledAt', new Date(y, m - 1, d, 12).getTime())
}

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' })

const status = computed(() => {
  const since = props.lastDescaledAt
    ? `seit der Entkalkung am ${dateFormat.format(new Date(props.lastDescaledAt))}`
    : 'seit Beginn der Zählung'
  return `${props.washes} von ${props.threshold} Wäschen ${since}`
})

const deadline = computed(() => dateFormat.format(new Date(props.dueAt)))
</script>

<template>
  <div class="rounded-2xl border border-slate-200 bg-white p-4">
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="text-base font-semibold text-slate-900">Maschine entkalken</h2>
      <button
        type="button"
        class="shrink-0 text-sm font-medium text-accent-600 underline underline-offset-2"
        @click="emit('close')"
      >
        schließen
      </button>
    </div>
    <p class="tnum mt-1 text-xs text-slate-500">
      {{ status }} · spätestens am {{ deadline }}
    </p>

    <ol class="mt-4 space-y-3 text-sm text-slate-700">
      <li class="flex gap-3">
        <span class="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-50 text-xs font-semibold text-accent-700">1</span>
        <span>
          Programm <span class="font-medium text-slate-900">{{ programLabel(program) }}</span>
          einstellen
          <span class="tnum text-slate-500"
            >({{ formatDuration(minutes) }}<template v-if="descale.temperature">, {{ descale.temperature }}</template>)</span
          >.
        </span>
      </li>
      <li class="flex gap-3">
        <span class="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-50 text-xs font-semibold text-accent-700">2</span>
        <span>
          <span class="font-medium text-slate-900">ca. 200 ml Essigessenz</span> oder flüssigen
          Maschinen-Entkalker aus der Drogerie direkt in die leere Trommel geben.
        </span>
      </li>
      <li class="flex gap-3">
        <span class="tnum flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-50 text-xs font-semibold text-accent-700">3</span>
        <span>Programm <span class="font-medium text-slate-900">ohne Wäsche</span> starten.</span>
      </li>
    </ol>

    <p class="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 text-sm leading-snug text-amber-800">
      <span class="font-semibold">Keine Zitronensäure!</span> Sie verbindet sich über 60 °C mit
      dem Kalk zu schwer löslichem Calciumcitrat.
    </p>

    <div v-if="descale.afterwards?.length" class="mt-4">
      <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Danach</p>
      <ul class="mt-1.5 list-disc space-y-1 pl-5 text-sm text-slate-600">
        <li v-for="step in descale.afterwards" :key="step">{{ step }}</li>
      </ul>
    </div>

    <div class="mt-5 grid grid-cols-2 gap-2">
      <button
        type="button"
        class="rounded-xl bg-accent-600 px-3 py-3 text-sm font-semibold text-white active:bg-accent-700"
        @click="emit('choose')"
      >
        {{ program.name }} wählen
      </button>
      <button
        type="button"
        class="rounded-xl border border-slate-300 px-3 py-3 text-sm font-medium text-slate-700 active:bg-slate-100"
        @click="emit('done')"
      >
        Schon entkalkt
      </button>
    </div>

    <div class="mt-5 border-t border-slate-100 pt-4">
      <button
        type="button"
        class="text-sm font-medium text-accent-600 underline underline-offset-2"
        @click="showCorrection = !showCorrection"
      >
        {{ showCorrection ? 'Stand korrigieren ausblenden' : 'Stand korrigieren' }}
      </button>

      <div v-if="showCorrection" class="mt-3 space-y-4">
        <label class="flex items-center justify-between gap-3">
          <span class="min-w-0">
            <span class="block text-sm font-medium text-slate-700">Zuletzt entkalkt am</span>
            <span class="block text-xs text-slate-400">
              Noch nie? Dann das Datum, seit dem die Maschine läuft.
            </span>
          </span>
          <input
            type="date"
            class="tnum shrink-0 rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
            :value="lastDescaledValue"
            :max="today"
            @change="onDateInput"
          />
        </label>

        <div class="flex items-center justify-between gap-3">
          <span class="min-w-0">
            <span class="block text-sm font-medium text-slate-700">Wäschen seitdem</span>
            <span class="block text-xs text-slate-400">Geschätzt reicht.</span>
          </span>
          <div class="flex shrink-0 items-center gap-2">
            <button
              type="button"
              class="h-9 w-10 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 active:bg-slate-100 disabled:opacity-40"
              :disabled="washes <= 0"
              @click="emit('update:washes', washes - 1)"
            >
              − 1
            </button>
            <input
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              aria-label="Wäschen seit der letzten Entkalkung"
              class="tnum h-9 w-12 rounded-xl border border-slate-300 bg-white text-center text-base font-semibold text-slate-900"
              :value="washes"
              @focus="$event.target.select()"
              @change="onWashesInput"
            />
            <button
              type="button"
              class="h-9 w-10 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 active:bg-slate-100"
              @click="emit('update:washes', washes + 1)"
            >
              + 1
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
      <span class="min-w-0">
        <span class="block text-sm font-medium text-slate-700">Erinnern nach</span>
        <span class="block text-xs text-slate-400">
          Wäschen – spätestens alle {{ Math.round(DESCALE_INTERVAL_DAYS / 30) }} Monate
        </span>
      </span>
      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          class="h-9 w-10 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 active:bg-slate-100 disabled:opacity-40"
          :disabled="threshold <= MIN_THRESHOLD"
          @click="emit('update:threshold', threshold - 5)"
        >
          − 5
        </button>
        <span class="tnum w-8 text-center text-base font-semibold text-slate-900">{{ threshold }}</span>
        <button
          type="button"
          class="h-9 w-10 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 active:bg-slate-100 disabled:opacity-40"
          :disabled="threshold >= MAX_THRESHOLD"
          @click="emit('update:threshold', threshold + 5)"
        >
          + 5
        </button>
      </div>
    </div>
  </div>
</template>
