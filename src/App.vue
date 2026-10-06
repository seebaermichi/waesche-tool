<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ProgramSelect from './components/ProgramSelect.vue'
import DelayRadios from './components/DelayRadios.vue'
import DurationAdjust from './components/DurationAdjust.vue'
import DescaleGuide from './components/DescaleGuide.vue'
import SettingsPage from './components/SettingsPage.vue'
import { formatDuration, programLabel } from './programs.js'
import { countsAsWash, findMachine, findProgram, schedule } from './machines/index.js'
import { useAlarm } from './composables/useAlarm.js'
import { useWakeLock } from './composables/useWakeLock.js'
import { usePush } from './composables/usePush.js'
import { useAppliances } from './composables/useAppliances.js'
import {
  countWash,
  markDescaled,
  setLastDescaledAt,
  setThreshold,
  setWashes,
  snooze,
  useDescaling,
} from './composables/useDescaling.js'
import { clearTimer, loadSettings, loadTimer, saveSettings, saveTimer } from './composables/useStorage.js'

/** Aus package.json, beim Build eingesetzt (vite.config.js) */
const appVersion = __APP_VERSION__

const alarm = useAlarm()
const wakeLock = useWakeLock()
const push = usePush()

const settings = ref(loadSettings())
const showSettings = ref(false)

// --- Gewählte Maschine ------------------------------------------------------

const appliances = useAppliances()
const appliance = computed(() => appliances.active.value)
const machine = computed(() => appliances.modelOf(appliance.value))
const programs = computed(() => machine.value.programs)

function initialProgramId() {
  return findProgram(machine.value, appliance.value.lastProgramId)?.id ?? programs.value[0].id
}

const programId = ref(initialProgramId())
const delayHours = ref(0)
const showAdjust = ref(false)

/**
 * Laufender Timer:
 * { applianceId, machineId, programId, delayHours, minutes, startedAt, startsAt, endsAt,
 *   descale, counted }
 */
const timer = ref(null)
const done = ref(false)
const now = ref(Date.now())

const descaling = useDescaling(
  now,
  computed(() => appliance.value.care),
)
const care = computed(() => appliance.value.care)
const showGuide = ref(false)
/** Läuft das Entkalkungsprogramm mit Entkalker? Dann setzt es am Ende den Wäschezähler zurück. */
const descaleRun = ref(true)

let tickId = null

/** Feintuning der gewählten Maschine: { [programId]: minutenDelta } */
const machineAdjustments = computed(() => appliance.value.adjustments)

const selectedProgram = computed(
  () => findProgram(machine.value, programId.value) ?? programs.value[0],
)
const selectedDelta = computed(() => machineAdjustments.value[selectedProgram.value.id] ?? 0)
const selectedMinutes = computed(() => selectedProgram.value.minutes + selectedDelta.value)

/** Entkalken gibt es nur, wenn das Geräteprofil ein Programm dafür nennt. */
const descaleProgram = computed(() =>
  machine.value.descale ? findProgram(machine.value, machine.value.descale.programId) : null,
)
const descaleMinutes = computed(() =>
  descaleProgram.value ? appliances.minutesOf(appliance.value, descaleProgram.value.id) : 0,
)
const isDescaleProgram = computed(() => selectedProgram.value.id === descaleProgram.value?.id)

/** Für die Einstellungsseite: Entkalken der gewählten Maschine oder null. */
const descaleInfo = computed(() =>
  descaleProgram.value
    ? {
        program: descaleProgram.value,
        profile: machine.value.descale,
        minutes: descaleMinutes.value,
        dueAt: descaling.dueAt.value,
      }
    : null,
)

// --- Maschine des laufenden Timers ------------------------------------------
// Sie kann eine andere sein als die gewählte. Timer aus 1.0/1.1 kennen noch keine Maschine.

const timerAppliance = computed(
  () => (timer.value && appliances.byId(timer.value.applianceId)) || appliance.value,
)
const timerMachine = computed(
  () =>
    (timer.value && findMachine(timer.value.machineId)) || appliances.modelOf(timerAppliance.value),
)
const timerProgram = computed(() =>
  timer.value ? findProgram(timerMachine.value, timer.value.programId) : null,
)
const timerDescaling = useDescaling(
  now,
  computed(() => timerAppliance.value.care),
)

const hasSeveral = computed(() => appliances.list.value.length > 1)

const running = computed(() => timer.value !== null && !done.value)

/** Vorschau im Ruhezustand: Wann wäre die Maschine fertig, wenn ich jetzt starte? */
const previewEndsAt = computed(
  () => schedule(machine.value, now.value, delayHours.value, selectedMinutes.value).endsAt,
)

const machineStartsAt = computed(() => {
  if (!timer.value) return null
  return timer.value.startsAt ?? timer.value.startedAt + timer.value.delayHours * 3600_000
})

const delayPending = computed(
  () => machineStartsAt.value !== null && now.value < machineStartsAt.value,
)

const remainingMs = computed(() => (timer.value ? Math.max(0, timer.value.endsAt - now.value) : 0))

const progress = computed(() => {
  if (!timer.value) return 0
  const total = timer.value.endsAt - timer.value.startedAt
  if (total <= 0) return 1
  return Math.min(1, Math.max(0, (now.value - timer.value.startedAt) / total))
})

// --- Zeitformatierung -------------------------------------------------------

const clockFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })
const weekdayFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'long' })

function formatClock(ts) {
  return clockFormat.format(new Date(ts))
}

/** null bei heute, sonst "morgen" bzw. der Wochentag. */
function dayPrefix(ts) {
  const target = new Date(ts)
  const today = new Date(now.value)
  const days = Math.round(
    (new Date(target.getFullYear(), target.getMonth(), target.getDate()) -
      new Date(today.getFullYear(), today.getMonth(), today.getDate())) /
      86_400_000,
  )
  if (days <= 0) return null
  if (days === 1) return 'morgen'
  return weekdayFormat.format(target)
}

function descaleReason(careState, status) {
  const { washes, lastDescaledAt } = careState
  if (status.dueByCount.value) {
    return `${washes} Wäschen seit ${lastDescaledAt ? 'der letzten Entkalkung' : 'Beginn der Zählung'}.`
  }
  return lastDescaledAt
    ? 'Die letzte Entkalkung ist über 3 Monate her.'
    : 'Seit 3 Monaten keine Entkalkung vermerkt.'
}

function formatRemaining(ms) {
  const totalMinutes = Math.ceil(ms / 60_000)
  if (totalMinutes <= 0) return 'gleich fertig'
  if (totalMinutes < 60) return `noch ${totalMinutes} Min.`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (m === 0) return `noch ${h} Std.`
  return `noch ${h} Std. ${m} Min.`
}

// --- Timer-Steuerung --------------------------------------------------------

async function start() {
  // Audio muss synchron in der Nutzergeste freigeschaltet werden, sonst bleibt iOS stumm.
  alarm.unlock()

  const minutes = selectedMinutes.value
  const startedAt = Date.now()
  const record = {
    applianceId: appliance.value.id,
    machineId: machine.value.id,
    programId: selectedProgram.value.id,
    delayHours: delayHours.value,
    minutes,
    startedAt,
    ...schedule(machine.value, startedAt, delayHours.value, minutes),
    descale: isDescaleProgram.value && descaleRun.value,
    counted: false,
  }

  // Steht nach diesem Waschgang das Entkalken an, sagt es schon die Fertig-Mitteilung.
  const hint =
    machine.value.descale &&
    countsAsWash(machine.value, record.programId) &&
    descaling.dueAfterNextWash()
      ? 'Die Maschine sollte entkalkt werden – Anleitung in der App.'
      : ''

  timer.value = record
  done.value = false
  now.value = startedAt
  showAdjust.value = false
  showGuide.value = false
  saveTimer(record)

  appliances.rememberProgram(record.applianceId, record.programId)

  if (settings.value.keepAwake) wakeLock.request()

  if (await push.enable()) {
    await push.schedule(record.endsAt, programLabel(selectedProgram.value), hint)
  }
}

/**
 * Einen Timer genau einmal verbuchen: Waschgang mitzählen bzw. Entkalkung vermerken.
 * `complete` ist false, wenn er vor dem Ende gestoppt wurde.
 */
function bookTimer(complete) {
  const t = timer.value
  if (!t || t.counted) return
  const id = timerAppliance.value.id
  if (t.descale) {
    // Eine abgebrochene Entkalkung zählt nicht als erledigt.
    if (!complete) return
    appliances.update(id, (a) => markDescaled(a.care))
  } else if (countsAsWash(timerMachine.value, t.programId)) {
    appliances.update(id, (a) => countWash(a.care))
  }
  timer.value = { ...t, counted: true }
  saveTimer(timer.value)
}

async function stop() {
  alarm.stop()
  // Läuft die Maschine schon, hat sie gewaschen – auch wenn der Timer vorzeitig gestoppt wird.
  // Während der Startzeitvorwahl ist dagegen noch nichts passiert.
  if (timer.value && !delayPending.value) bookTimer(done.value)
  timer.value = null
  done.value = false
  clearTimer()
  wakeLock.release()
  await push.cancel()
}

function tick() {
  now.value = Date.now()
  if (timer.value && !done.value && now.value >= timer.value.endsAt) {
    done.value = true
    bookTimer(true)
    alarm.start()
  }
}

function toggleKeepAwake() {
  settings.value.keepAwake = !settings.value.keepAwake
  saveSettings(settings.value)
  if (settings.value.keepAwake && running.value) wakeLock.request()
  else wakeLock.release()
}

function chooseDescaleProgram() {
  programId.value = descaleProgram.value.id
  delayHours.value = 0
  descaleRun.value = true
  showGuide.value = false
  showSettings.value = false
}

function confirmDescaled() {
  appliances.update(appliance.value.id, (a) => markDescaled(a.care))
  showGuide.value = false
}

const careSetters = { washes: setWashes, lastDescaledAt: setLastDescaledAt, threshold: setThreshold }

function updateCare(field, value) {
  appliances.update(appliance.value.id, (a) => careSetters[field](a.care, value))
}

function snoozeReminder() {
  appliances.update(appliance.value.id, (a) => snooze(a.care))
}

function openSettings() {
  showSettings.value = true
  window.scrollTo({ top: 0 })
}

function closeSettings() {
  showSettings.value = false
  showGuide.value = false
  window.scrollTo({ top: 0 })
}

function openGuide() {
  showGuide.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function openGuideFromDone() {
  await stop()
  openGuide()
}

// Andere Maschine gewählt oder ihr Modell geändert: Programm und Zeitvorwahl passen nicht mehr.
watch(
  () => [appliance.value.id, appliance.value.modelId],
  () => {
    programId.value = initialProgramId()
    delayHours.value = 0
    showAdjust.value = false
  },
)

// Nach einem Neuladen ist der Audio-Context nicht mehr freigeschaltet – dann bliebe der
// Signalton stumm. Die nächstbeste Nutzergeste nachträglich dafür nutzen.
function unlockAudioOnce() {
  alarm.unlock()
}

onMounted(() => {
  const stored = loadTimer()
  if (stored) {
    timer.value = stored
    // Ist die Zeit während der App-Pause abgelaufen, direkt in den Fertig-Zustand –
    // aber ohne Dauerton, den will niemand Stunden später noch hören.
    done.value = Date.now() >= stored.endsAt
    if (done.value) bookTimer(true)
    else {
      document.addEventListener('pointerdown', unlockAudioOnce, { once: true })
      if (settings.value.keepAwake) wakeLock.request()
    }
  }

  tickId = setInterval(tick, 1000)
  push.init()
})

onBeforeUnmount(() => {
  if (tickId) clearInterval(tickId)
  document.removeEventListener('pointerdown', unlockAudioOnce)
})

// Nach dem Zurückkommen aus dem Hintergrund sofort neu rechnen, statt bis zum
// nächsten Intervall-Tick eine veraltete Zeit zu zeigen.
function onVisibilityChange() {
  if (document.visibilityState === 'visible') tick()
}
document.addEventListener('visibilitychange', onVisibilityChange)
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibilityChange))

// Beim Programmwechsel das Feintuning-Panel schließen, sonst springt es inhaltlich um.
watch(programId, (id) => {
  showAdjust.value = false
  if (id === descaleProgram.value?.id) descaleRun.value = true
})

// --- Hinweistext zur Benachrichtigung ---------------------------------------

/** Auf dem Startbildschirm nur, wenn etwas zu tun ist – "aktiv" steht in den Einstellungen. */
const pushNeedsAttention = computed(() => push.state.value !== 'granted')

const pushHint = computed(() => {
  switch (push.state.value) {
    case 'granted':
      return { tone: 'ok', text: 'Benachrichtigung ist aktiv.' }
    case 'default':
      return { tone: 'info', text: 'Beim Start wird nach der Erlaubnis für Mitteilungen gefragt.' }
    case 'denied':
      return {
        tone: 'warn',
        text: 'Mitteilungen sind blockiert. In den iPhone-Einstellungen unter „Wäsche“ erlauben.',
      }
    case 'needs-install':
      return {
        tone: 'info',
        text: 'Für Mitteilungen: unten auf Teilen tippen und „Zum Home-Bildschirm“ wählen.',
      }
    case 'unconfigured':
      return { tone: 'warn', text: 'Push ist nicht konfiguriert (VAPID-Schlüssel fehlt).' }
    default:
      return { tone: 'warn', text: 'Dieser Browser unterstützt keine Mitteilungen.' }
  }
})
</script>

<template>
  <SettingsPage
    v-if="showSettings"
    v-model:open-guide="showGuide"
    :appliances="appliances"
    :busy-id="timer ? timerAppliance.id : null"
    :keep-awake="settings.keepAwake"
    :wake-lock-supported="wakeLock.supported"
    :push-hint="pushHint"
    :version="appVersion"
    :descale="descaleInfo"
    @close="closeSettings"
    @toggle-keep-awake="toggleKeepAwake"
    @test-alarm="alarm.test()"
    @choose-descale="chooseDescaleProgram"
    @descaled="confirmDescaled"
    @update:care="updateCare"
  />

  <div v-else class="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-6">
    <header class="flex min-h-9 items-center justify-between gap-3">
      <h1 class="text-sm font-semibold uppercase tracking-widest text-slate-400">Wäsche</h1>
      <div class="flex min-w-0 items-center gap-1">
        <!-- Schnellwechsel, sobald es mehr als eine eigene Maschine gibt -->
        <template v-if="hasSeveral">
          <span v-if="timer" class="truncate text-sm font-medium text-slate-500">
            {{ appliances.displayName(timerAppliance) }}
          </span>
          <label v-else class="relative min-w-0">
            <span class="sr-only">Waschmaschine</span>
            <select
              class="max-w-48 appearance-none truncate rounded-full border border-slate-300 bg-white py-1.5 pl-3 pr-7 text-sm font-medium text-slate-700"
              :value="appliance.id"
              @change="appliances.select($event.target.value)"
            >
              <option v-for="a in appliances.list.value" :key="a.id" :value="a.id">
                {{ appliances.displayName(a) }}
              </option>
            </select>
            <svg
              class="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </label>
        </template>
        <button
          type="button"
          class="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 active:bg-slate-200"
          aria-label="Einstellungen"
          @click="openSettings"
        >
          <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10.3 3.3a1.7 1.7 0 0 1 3.4 0 1.7 1.7 0 0 0 2.6 1.1 1.7 1.7 0 0 1 2.4 2.4 1.7 1.7 0 0 0 1.1 2.6 1.7 1.7 0 0 1 0 3.4 1.7 1.7 0 0 0-1.1 2.6 1.7 1.7 0 0 1-2.4 2.4 1.7 1.7 0 0 0-2.6 1.1 1.7 1.7 0 0 1-3.4 0 1.7 1.7 0 0 0-2.6-1.1 1.7 1.7 0 0 1-2.4-2.4 1.7 1.7 0 0 0-1.1-2.6 1.7 1.7 0 0 1 0-3.4 1.7 1.7 0 0 0 1.1-2.6 1.7 1.7 0 0 1 2.4-2.4 1.7 1.7 0 0 0 2.6-1.1Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </header>

    <!-- ---------------------------------------------------------------- Ruhe -->
    <template v-if="!timer">
      <div class="mt-6 space-y-6">
        <DescaleGuide
          v-if="showGuide && descaleProgram"
          :program="descaleProgram"
          :descale="machine.descale"
          :minutes="descaleMinutes"
          :washes="care.washes"
          :threshold="care.threshold"
          :last-descaled-at="care.lastDescaledAt"
          :due-at="descaling.dueAt.value"
          @choose="chooseDescaleProgram"
          @done="confirmDescaled"
          @close="showGuide = false"
          @update:threshold="updateCare('threshold', $event)"
          @update:washes="updateCare('washes', $event)"
          @update:last-descaled-at="updateCare('lastDescaledAt', $event)"
        />

        <section
          v-else-if="descaleProgram && descaling.remind.value && !(isDescaleProgram && descaleRun)"
          class="rounded-2xl border border-amber-200 bg-amber-50 p-4"
        >
          <p class="font-semibold text-amber-900">Zeit zum Entkalken</p>
          <p class="mt-1 text-sm text-amber-800">{{ descaleReason(care, descaling) }}</p>
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              class="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-amber-700"
              @click="openGuide"
            >
              Anleitung
            </button>
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 text-sm font-medium text-amber-800 active:bg-amber-100"
              @click="snoozeReminder"
            >
              später
            </button>
          </div>
        </section>

        <section>
          <div class="mb-2 flex items-baseline justify-between">
            <h2 class="text-sm font-medium text-slate-500">Programm</h2>
            <button
              type="button"
              class="text-sm font-medium text-accent-600 underline underline-offset-2"
              @click="showAdjust = !showAdjust"
            >
              {{ showAdjust ? 'fertig' : 'anpassen' }}
            </button>
          </div>
          <ProgramSelect
            v-model="programId"
            :programs="programs"
            :adjustments="machineAdjustments"
          />
          <DurationAdjust
            v-if="showAdjust"
            class="mt-3"
            :program="selectedProgram"
            :delta="selectedDelta"
            @update:delta="appliances.setDelta(appliance.id, selectedProgram.id, $event)"
          />

          <div
            v-if="isDescaleProgram"
            class="mt-3 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <button
              type="button"
              class="flex w-full items-center justify-between gap-3 text-left"
              @click="descaleRun = !descaleRun"
            >
              <span>
                <span class="block text-sm font-medium text-slate-700">Mit Entkalker</span>
                <span class="block text-xs text-slate-400">
                  Setzt am Ende den Wäschezähler zurück.
                </span>
              </span>
              <span
                class="flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors"
                :class="descaleRun ? 'bg-accent-600' : 'bg-slate-300'"
                aria-hidden="true"
              >
                <span
                  class="size-5 rounded-full bg-white transition-transform"
                  :class="descaleRun ? 'translate-x-5' : 'translate-x-0'"
                />
              </span>
            </button>
            <p v-if="descaleRun" class="mt-3 text-sm leading-snug text-slate-600">
              200 ml Essigessenz oder Maschinen-Entkalker in die
              <span class="font-medium">leere</span> Trommel, ohne Wäsche starten.
              <span class="font-medium text-amber-700">Keine Zitronensäure.</span>{{ ' ' }}
              <button
                v-if="!showGuide"
                type="button"
                class="font-medium text-accent-600 underline underline-offset-2"
                @click="openGuide"
              >
                Anleitung
              </button>
            </p>
          </div>
        </section>

        <section>
          <h2 class="mb-2 text-sm font-medium text-slate-500">
            {{ machine.delay.mode === 'end' ? 'Endzeitvorwahl' : 'Startzeitvorwahl' }}
          </h2>
          <DelayRadios v-model="delayHours" :hours="machine.delay.hours" :mode="machine.delay.mode" />
        </section>

        <section class="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center">
          <p class="text-sm text-slate-500">Wäre fertig um</p>
          <p class="tnum mt-0.5 text-3xl font-semibold text-slate-900">
            <span v-if="dayPrefix(previewEndsAt)" class="text-xl font-medium text-slate-500">
              {{ dayPrefix(previewEndsAt) }}
            </span>
            {{ formatClock(previewEndsAt) }}
          </p>
        </section>
      </div>

      <div class="grow" />

      <button
        type="button"
        class="mt-8 w-full rounded-2xl bg-accent-600 py-4 text-lg font-semibold text-white active:bg-accent-700"
        @click="start"
      >
        Start
      </button>
    </template>

    <!-- ------------------------------------------------------------- Läuft -->
    <template v-else-if="running">
      <div class="mt-10 text-center">
        <p class="text-sm text-slate-500">Fertig um</p>
        <p class="tnum mt-1 text-6xl font-semibold tracking-tight text-slate-900">
          {{ formatClock(timer.endsAt) }}
        </p>
        <p v-if="dayPrefix(timer.endsAt)" class="mt-1 text-lg text-slate-500">
          {{ dayPrefix(timer.endsAt) }}
        </p>
        <p class="tnum mt-3 text-lg text-slate-600">{{ formatRemaining(remainingMs) }}</p>
      </div>

      <div class="mt-8 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          class="h-full rounded-full bg-accent-500 transition-[width] duration-1000 ease-linear"
          :style="{ width: `${progress * 100}%` }"
        />
      </div>

      <dl class="mt-6 space-y-2 text-sm">
        <div class="flex justify-between gap-3">
          <dt class="text-slate-500">Programm</dt>
          <dd class="text-right font-medium text-slate-800">
            {{ programLabel(timerProgram) }} · {{ formatDuration(timer.minutes) }}
          </dd>
        </div>
        <div v-if="timer.descale" class="flex justify-between gap-3">
          <dt class="text-slate-500">Entkalkung</dt>
          <dd class="text-right font-medium text-slate-800">wird am Ende vermerkt</dd>
        </div>
        <div v-if="delayPending" class="flex justify-between gap-3">
          <dt class="text-slate-500">Maschine startet</dt>
          <dd class="tnum text-right font-medium text-slate-800">
            um {{ formatClock(machineStartsAt) }}
          </dd>
        </div>
        <div v-else-if="machineStartsAt > timer.startedAt" class="flex justify-between gap-3">
          <dt class="text-slate-500">Maschine läuft seit</dt>
          <dd class="tnum text-right font-medium text-slate-800">
            {{ formatClock(machineStartsAt) }}
          </dd>
        </div>
      </dl>

      <p class="mt-4 text-xs leading-relaxed text-slate-400">
        Die Zeiten stammen aus dem Handbuch und sind laut Hersteller Richtwerte.
        {{ timerMachine.timingNote }}
      </p>

      <div class="grow" />

      <button
        type="button"
        class="mt-8 w-full rounded-2xl border border-slate-300 bg-white py-4 text-lg font-semibold text-slate-700 active:bg-slate-100"
        @click="stop"
      >
        Stopp
      </button>
    </template>

    <!-- ------------------------------------------------------------ Fertig -->
    <template v-else>
      <div class="mt-10 text-center">
        <p class="text-5xl">🧺</p>
        <p class="mt-4 text-4xl font-semibold text-slate-900">Fertig!</p>
        <p class="mt-2 text-slate-600">
          {{ programLabel(timerProgram) }} · fertig um
          <span class="tnum">{{ formatClock(timer.endsAt) }}</span>
        </p>
      </div>

      <section
        v-if="timer.descale"
        class="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"
      >
        <p class="font-semibold text-emerald-900">Entkalkung vermerkt</p>
        <ul
          v-if="timerMachine.descale?.afterwards?.length"
          class="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-snug text-emerald-800"
        >
          <li v-for="step in timerMachine.descale.afterwards" :key="step">{{ step }}</li>
        </ul>
      </section>

      <section
        v-else-if="timerMachine.descale && timerDescaling.remind.value"
        class="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4"
      >
        <p class="font-semibold text-amber-900">Zeit zum Entkalken</p>
        <p class="mt-1 text-sm text-amber-800">
          {{ descaleReason(timerAppliance.care, timerDescaling) }}
        </p>
        <button
          type="button"
          class="mt-3 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-amber-700"
          @click="openGuideFromDone"
        >
          Anleitung
        </button>
      </section>

      <div class="mt-8">
        <p class="mb-2 text-sm font-medium text-slate-500">Stimmte die Zeit?</p>
        <DurationAdjust
          v-if="timerProgram"
          :program="timerProgram"
          :delta="timerAppliance.adjustments[timerProgram.id] ?? 0"
          @update:delta="appliances.setDelta(timerAppliance.id, timerProgram.id, $event)"
        />
        <p class="mt-2 text-xs leading-relaxed text-slate-400">
          Die Korrektur wird gespeichert und beim nächsten Mal mitgerechnet.
        </p>
      </div>

      <div class="grow" />

      <button
        type="button"
        class="mt-8 w-full rounded-2xl bg-accent-600 py-4 text-lg font-semibold text-white active:bg-accent-700"
        @click="stop"
      >
        Stopp
      </button>
    </template>

    <!-- ------------------------------------------------------------- Fußzeile -->
    <div class="mt-6 flex items-end justify-between gap-3">
      <p
        v-if="pushNeedsAttention"
        class="text-xs leading-relaxed"
        :class="pushHint.tone === 'warn' ? 'text-amber-600' : 'text-slate-400'"
      >
        {{ pushHint.text }}
      </p>
      <span class="tnum ml-auto shrink-0 text-xs text-slate-300">v{{ appVersion }}</span>
    </div>
  </div>
</template>
