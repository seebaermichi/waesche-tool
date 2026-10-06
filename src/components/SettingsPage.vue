<script setup>
// Einstellungen als Vollbild-Seite: eigene Waschmaschinen, Entkalken, Signalton,
// Benachrichtigung, Version. Alles, was man selten braucht, damit der Startbildschirm
// nur das Starten zeigt.
import { computed, ref } from 'vue'
import DescaleGuide from './DescaleGuide.vue'
import { machineLabel, machines } from '../machines/index.js'

const REPO_URL = 'https://github.com/seebaermichi/waesche-tool'

const props = defineProps({
  /** useAppliances() */
  appliances: { type: Object, required: true },
  /** Id der Maschine, für die gerade ein Timer läuft – oder null */
  busyId: { type: String, default: null },
  keepAwake: { type: Boolean, required: true },
  wakeLockSupported: { type: Boolean, required: true },
  pushHint: { type: Object, required: true },
  version: { type: String, required: true },
  /** Entkalken der aktiven Maschine – null, wenn das Modell kein Reinigungsprogramm hat */
  descale: { type: Object, default: null },
  openGuide: { type: Boolean, default: false },
})

const emit = defineEmits([
  'close',
  'toggle-keep-awake',
  'test-alarm',
  'choose-descale',
  'descaled',
  'update:care',
  'update:openGuide',
])

const app = props.appliances
const active = computed(() => app.active.value)

// --- Maschinen bearbeiten ----------------------------------------------------

const editingId = ref(null)
const confirmRemove = ref(false)
const adding = ref(false)
const newModelId = ref(machines[0].id)
const newName = ref('')

function toggleEdit(id) {
  editingId.value = editingId.value === id ? null : id
  confirmRemove.value = false
  adding.value = false
}

function startAdding() {
  adding.value = true
  editingId.value = null
  newModelId.value = active.value.modelId
  newName.value = ''
}

function confirmAdd() {
  app.add(newModelId.value, newName.value)
  adding.value = false
}

function remove(id) {
  app.remove(id)
  editingId.value = null
  confirmRemove.value = false
}

function subtitle(appliance) {
  const model = app.modelOf(appliance)
  return appliance.name ? `${machineLabel(model)} · ${model.description}` : model.description
}

// --- Entkalken ----------------------------------------------------------------

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })

const careSummary = computed(() => {
  const { washes, threshold, lastDescaledAt } = active.value.care
  const last = lastDescaledAt ? `zuletzt am ${dateFormat.format(new Date(lastDescaledAt))}` : 'noch nicht vermerkt'
  return `${washes} von ${threshold} Wäschen · ${last}`
})
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-6">
    <header class="flex items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold text-slate-900">Einstellungen</h1>
      <button
        type="button"
        class="rounded-xl px-3 py-1.5 text-base font-semibold text-accent-600 active:bg-accent-50"
        @click="emit('close')"
      >
        Fertig
      </button>
    </header>

    <!-- ------------------------------------------------------ Waschmaschinen -->
    <section class="mt-6">
      <h2 class="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        Meine Waschmaschinen
      </h2>
      <ul class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <li v-for="appliance in app.list.value" :key="appliance.id">
          <div class="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              class="flex min-w-0 grow items-center gap-3 text-left"
              :aria-pressed="appliance.id === active.id"
              @click="app.select(appliance.id)"
            >
              <span
                class="flex size-5 shrink-0 items-center justify-center rounded-full border-2"
                :class="appliance.id === active.id ? 'border-accent-600' : 'border-slate-300'"
                aria-hidden="true"
              >
                <span v-if="appliance.id === active.id" class="size-2.5 rounded-full bg-accent-600" />
              </span>
              <span class="min-w-0">
                <span class="block truncate text-base font-medium text-slate-800">
                  {{ app.displayName(appliance) }}
                </span>
                <span class="block truncate text-xs text-slate-400">
                  {{ subtitle(appliance) }}<template v-if="appliance.id === busyId"> · Timer läuft</template>
                </span>
              </span>
            </button>
            <button
              type="button"
              class="shrink-0 text-sm font-medium text-accent-600 underline underline-offset-2"
              @click="toggleEdit(appliance.id)"
            >
              {{ editingId === appliance.id ? 'fertig' : 'bearbeiten' }}
            </button>
          </div>

          <div v-if="editingId === appliance.id" class="space-y-3 border-t border-slate-100 bg-slate-50 px-4 py-3">
            <label class="block">
              <span class="block text-xs font-medium text-slate-500">Name</span>
              <input
                type="text"
                maxlength="30"
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-800"
                placeholder="z. B. Zuhause, Ferienhaus"
                :value="appliance.name"
                @change="app.rename(appliance.id, $event.target.value)"
              />
            </label>
            <label class="block">
              <span class="block text-xs font-medium text-slate-500">Modell</span>
              <select
                class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-800 disabled:opacity-50"
                :value="appliance.modelId"
                :disabled="appliance.id === busyId"
                @change="app.changeModel(appliance.id, $event.target.value)"
              >
                <option v-for="m in machines" :key="m.id" :value="m.id">
                  {{ machineLabel(m) }} ({{ m.description }})
                </option>
              </select>
              <span v-if="appliance.id === busyId" class="mt-1 block text-xs text-slate-400">
                Während der Timer läuft, lässt sich das Modell nicht ändern.
              </span>
              <span v-else class="mt-1 block text-xs text-slate-400">
                Beim Modellwechsel werden die Zeitkorrekturen zurückgesetzt.
              </span>
            </label>

            <div v-if="app.list.value.length > 1 && appliance.id !== busyId">
              <button
                v-if="!confirmRemove"
                type="button"
                class="text-sm font-medium text-red-600"
                @click="confirmRemove = true"
              >
                Waschmaschine entfernen
              </button>
              <div v-else class="flex flex-wrap items-center gap-2">
                <span class="text-sm text-slate-700">Zähler und Korrekturen gehen verloren.</span>
                <button
                  type="button"
                  class="rounded-xl bg-red-600 px-3 py-1.5 text-sm font-semibold text-white active:bg-red-700"
                  @click="remove(appliance.id)"
                >
                  Entfernen
                </button>
                <button
                  type="button"
                  class="rounded-xl px-3 py-1.5 text-sm font-medium text-slate-600 active:bg-slate-100"
                  @click="confirmRemove = false"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        </li>

        <li v-if="adding" class="space-y-3 bg-slate-50 px-4 py-3">
          <label class="block">
            <span class="block text-xs font-medium text-slate-500">Modell</span>
            <select
              v-model="newModelId"
              class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-800"
            >
              <option v-for="m in machines" :key="m.id" :value="m.id">
                {{ machineLabel(m) }} ({{ m.description }})
              </option>
            </select>
          </label>
          <label class="block">
            <span class="block text-xs font-medium text-slate-500">Name (optional)</span>
            <input
              v-model="newName"
              type="text"
              maxlength="30"
              class="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-slate-800"
              placeholder="z. B. Ferienhaus"
            />
          </label>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded-xl bg-accent-600 px-4 py-2 text-sm font-semibold text-white active:bg-accent-700"
              @click="confirmAdd"
            >
              Hinzufügen
            </button>
            <button
              type="button"
              class="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 active:bg-slate-100"
              @click="adding = false"
            >
              Abbrechen
            </button>
          </div>
        </li>
        <li v-else>
          <button
            type="button"
            class="w-full px-4 py-3 text-left text-base font-medium text-accent-600 active:bg-slate-50"
            @click="startAdding"
          >
            + Waschmaschine hinzufügen
          </button>
        </li>
      </ul>
      <p class="mt-2 px-1 text-xs leading-relaxed text-slate-400">
        Jede Maschine hat ihren eigenen Wäschezähler und eigene Zeitkorrekturen. Dein Modell
        fehlt?
        <a
          :href="`${REPO_URL}/blob/main/CONTRIBUTING.md`"
          target="_blank"
          rel="noopener"
          class="underline underline-offset-2"
          >So kommt es dazu.</a
        >
      </p>
    </section>

    <!-- ------------------------------------------------------------ Entkalken -->
    <section v-if="descale" class="mt-6">
      <h2 class="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        Entkalken · {{ app.displayName(active) }}
      </h2>
      <DescaleGuide
        v-if="openGuide"
        :program="descale.program"
        :descale="descale.profile"
        :minutes="descale.minutes"
        :washes="active.care.washes"
        :threshold="active.care.threshold"
        :last-descaled-at="active.care.lastDescaledAt"
        :due-at="descale.dueAt"
        @choose="emit('choose-descale')"
        @done="emit('descaled')"
        @close="emit('update:openGuide', false)"
        @update:threshold="emit('update:care', 'threshold', $event)"
        @update:washes="emit('update:care', 'washes', $event)"
        @update:last-descaled-at="emit('update:care', 'lastDescaledAt', $event)"
      />
      <div v-else class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <span class="tnum min-w-0 text-sm text-slate-600">{{ careSummary }}</span>
        <button
          type="button"
          class="shrink-0 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 active:bg-slate-100"
          @click="emit('update:openGuide', true)"
        >
          Anleitung
        </button>
      </div>
    </section>

    <!-- ------------------------------------------------- Signalton & Mitteilung -->
    <section class="mt-6">
      <h2 class="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        Signal und Mitteilung
      </h2>
      <div class="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        <button
          v-if="wakeLockSupported"
          type="button"
          class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          :aria-pressed="keepAwake"
          @click="emit('toggle-keep-awake')"
        >
          <span>
            <span class="block text-sm font-medium text-slate-700">Display anlassen</span>
            <span class="block text-xs text-slate-400">Nötig, damit der Signalton erklingt.</span>
          </span>
          <span
            class="flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors"
            :class="keepAwake ? 'bg-accent-600' : 'bg-slate-300'"
            aria-hidden="true"
          >
            <span
              class="size-5 rounded-full bg-white transition-transform"
              :class="keepAwake ? 'translate-x-5' : 'translate-x-0'"
            />
          </span>
        </button>

        <div class="flex items-center justify-between gap-3 px-4 py-3">
          <span class="min-w-0">
            <span class="block text-sm font-medium text-slate-700">Signalton</span>
            <span class="block text-xs text-slate-400">
              Bleibt stumm, wenn der seitliche Schalter am iPhone auf lautlos steht.
            </span>
          </span>
          <button
            type="button"
            class="shrink-0 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 active:bg-slate-100"
            @click="emit('test-alarm')"
          >
            testen
          </button>
        </div>

        <p
          class="px-4 py-3 text-sm leading-snug"
          :class="{
            'text-emerald-600': pushHint.tone === 'ok',
            'text-slate-500': pushHint.tone === 'info',
            'text-amber-600': pushHint.tone === 'warn',
          }"
        >
          {{ pushHint.text }}
        </p>
      </div>
    </section>

    <!-- ----------------------------------------------------------------- Über -->
    <section class="mt-6">
      <h2 class="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-slate-400">Über</h2>
      <div class="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white text-sm">
        <div class="flex justify-between gap-3 px-4 py-3">
          <span class="text-slate-700">Version</span>
          <span class="tnum text-slate-500">{{ version }}</span>
        </div>
        <a
          :href="REPO_URL"
          target="_blank"
          rel="noopener"
          class="flex justify-between gap-3 px-4 py-3 text-slate-700 active:bg-slate-50"
        >
          <span>Quellcode auf GitHub</span>
          <span class="text-slate-400" aria-hidden="true">↗</span>
        </a>
        <p class="px-4 py-3 text-xs leading-relaxed text-slate-400">
          Open Source unter MIT-Lizenz. Die Laufzeiten stammen aus den Handbüchern der Hersteller
          und sind Richtwerte.
        </p>
      </div>
    </section>
  </div>
</template>
