// Die eigenen Waschmaschinen ("Zuhause", "Ferienhaus" …). Jede verweist auf ein Geräteprofil
// aus src/machines/ und hat ihr eigenes Feintuning und ihren eigenen Entkalkungsstand.
//
// Begriffe im Code: `machine` ist das Modell (Profil), `appliance` die konkrete Maschine.

import { computed, ref } from 'vue'
import { findMachine, findProgram, machineLabel, machines } from '../machines/index.js'
import { newCare } from './useDescaling.js'
import { loadAppliances, loadLegacy, saveAppliances } from './useStorage.js'

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

function createAppliance(modelId, name = '') {
  return { id: newId(), modelId, name: name.trim(), lastProgramId: null, adjustments: {}, care: newCare() }
}

/** Erster Start nach 1.1.0 oder ganz neu: eine Maschine aus dem bisherigen Stand anlegen. */
function initialState() {
  const legacy = loadLegacy()
  const appliance = createAppliance(findMachine(legacy.machineId)?.id ?? machines[0].id)
  appliance.lastProgramId = legacy.lastProgramId
  appliance.adjustments = legacy.adjustments
  if (legacy.care) appliance.care = { ...appliance.care, ...legacy.care }
  return { activeId: appliance.id, list: [appliance] }
}

export function useAppliances() {
  const state = ref(loadAppliances() ?? initialState())
  persist()

  function persist() {
    saveAppliances(state.value)
  }

  const list = computed(() => state.value.list)
  const active = computed(() => byId(state.value.activeId) ?? state.value.list[0])

  function byId(id) {
    return state.value.list.find((a) => a.id === id) ?? null
  }

  /** Das Geräteprofil einer Maschine – fällt auf das erste zurück, falls es entfernt wurde. */
  function modelOf(appliance) {
    return findMachine(appliance?.modelId) ?? machines[0]
  }

  /** Eigener Name, sonst das Modell: "Ferienhaus" bzw. "hanseatic HTW510C". */
  function displayName(appliance) {
    return appliance?.name || machineLabel(modelOf(appliance))
  }

  /** Änderung an einer Maschine vornehmen und speichern. */
  function update(id, change) {
    const appliance = byId(id)
    if (!appliance) return
    change(appliance)
    persist()
  }

  function select(id) {
    if (!byId(id)) return
    state.value.activeId = id
    persist()
  }

  function add(modelId, name) {
    const appliance = createAppliance(modelId, name)
    state.value.list.push(appliance)
    state.value.activeId = appliance.id
    persist()
    return appliance
  }

  function rename(id, name) {
    update(id, (a) => {
      a.name = name.trim()
    })
  }

  /** Falsches Modell gewählt? Programme passen dann nicht mehr – Feintuning verwerfen. */
  function changeModel(id, modelId) {
    update(id, (a) => {
      if (a.modelId === modelId) return
      a.modelId = modelId
      a.adjustments = {}
      a.lastProgramId = null
    })
  }

  function remove(id) {
    if (state.value.list.length <= 1) return
    state.value.list = state.value.list.filter((a) => a.id !== id)
    if (state.value.activeId === id) state.value.activeId = state.value.list[0].id
    persist()
  }

  function setDelta(id, programId, delta) {
    update(id, (a) => {
      if (delta === 0) delete a.adjustments[programId]
      else a.adjustments[programId] = delta
    })
  }

  function rememberProgram(id, programId) {
    update(id, (a) => {
      a.lastProgramId = programId
    })
  }

  /** Effektive Dauer eines Programms auf dieser Maschine, inkl. Feintuning. */
  function minutesOf(appliance, programId) {
    const program = findProgram(modelOf(appliance), programId)
    return program ? program.minutes + (appliance.adjustments[programId] ?? 0) : 0
  }

  return {
    list,
    active,
    byId,
    modelOf,
    displayName,
    update,
    select,
    add,
    rename,
    changeModel,
    remove,
    setDelta,
    rememberProgram,
    minutesOf,
  }
}
