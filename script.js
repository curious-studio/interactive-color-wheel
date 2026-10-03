const root = document.documentElement;
const sampleCard = document.getElementById("sampleCard");
const hueValue = document.getElementById("hueValue");
const lightValue = document.getElementById("lightValue");
const satValue = document.getElementById("satValue");
const statusLine = document.getElementById("statusLine");
const hueControl = document.getElementById("hueControl");
const tintControl = document.getElementById("tintControl");
const satControl = document.getElementById("satControl");
const addSwatchButton = document.getElementById("addSwatchButton");
const sensorButton = document.getElementById("sensorButton");
const calibrateButton = document.getElementById("calibrateButton");
const copyButton = document.getElementById("copyButton");
const swatchesElement = document.getElementById("swatches");
const MAX_SWATCHES = 4;

function makeId() {
  return globalThis.crypto?.randomUUID?.() ?? `swatch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const state = {
  hue: 350,
  saturation: 88,
  lightness: 50,
  tintOffset: 0,
  headingOffset: 0,
  lastHeading: 0,
  selectedSwatchId: null,
  sensorsEnabled: false,
  swatches: [
    { id: makeId(), hue: 350, saturation: 88, lightness: 50 }
  ]
};

const swatchGesture = {
  button: null,
  id: null,
  index: -1,
  pointerId: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  longPressTimer: null,
  isEditing: false,
  didDrag: false
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function wrapHue(value) {
  return ((Math.round(value) % 360) + 360) % 360;
}

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    hue < 60 ? [c, x, 0] :
    hue < 120 ? [x, c, 0] :
    hue < 180 ? [0, c, x] :
    hue < 240 ? [0, x, c] :
    hue < 300 ? [x, 0, c] :
    [c, 0, x];

  return [r1, g1, b1]
    .map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
    .padStart(6, "0")
    .replace(/^/, "#");
}

function currentHex() {
  return hslToHex(state.hue, state.saturation, state.lightness);
}

function colorLabel(color = state) {
  return `HSL ${wrapHue(color.hue)} degrees, ${Math.round(color.saturation)} percent saturation, ${Math.round(color.lightness)} percent lightness`;
}

function setColor(next) {
  state.hue = wrapHue(next.hue ?? state.hue);
  state.saturation = clamp(Math.round(next.saturation ?? state.saturation), 35, 100);
  state.lightness = clamp(Math.round(next.lightness ?? state.lightness), 0, 100);

  const hex = currentHex();
  root.style.setProperty("--hue", state.hue);
  root.style.setProperty("--sat", `${state.saturation}%`);
  root.style.setProperty("--light", `${state.lightness}%`);
  root.style.setProperty("--selected-hex", hex);
  sampleCard.setAttribute("aria-label", `Current selected color ${hex}, ${colorLabel()}`);
  hueValue.textContent = `${state.hue}°`;
  lightValue.textContent = `${state.lightness}%`;
  satValue.textContent = `${state.saturation}%`;
  hueControl.value = state.hue;
  tintControl.value = state.tintOffset;
  satControl.value = state.saturation;
}

function renderSwatches(selectedHex = currentHex()) {
  const slots = Array.from({ length: MAX_SWATCHES }, (_, index) => {
    const slot = document.createElement("div");
    const swatch = state.swatches[index];
    slot.className = "swatch-slot";
    slot.dataset.index = index;

    if (!swatch) {
      slot.classList.add("is-empty");
      slot.setAttribute("aria-hidden", "true");
      return slot;
    }

    const button = document.createElement("button");
    const hex = hslToHex(swatch.hue, swatch.saturation, swatch.lightness);
    button.className = "swatch";
    button.type = "button";
    button.dataset.id = swatch.id;
    button.dataset.index = index;
    button.style.setProperty("--swatch-color", hex);
    button.dataset.hex = hex.toLowerCase();
    button.setAttribute("aria-label", `Use swatch ${hex}, ${colorLabel(swatch)}`);
    button.setAttribute("aria-current", swatch.id === state.selectedSwatchId || hex === selectedHex ? "true" : "false");
    button.addEventListener("click", (event) => {
      if (swatchGesture.didDrag) {
        event.preventDefault();
        return;
      }

      state.selectedSwatchId = swatch.id;
      state.tintOffset = swatch.lightness - 50;
      setColor(swatch);
      renderSwatches(hex);
      statusLine.textContent = `${hex} loaded from your swatches.`;
    });
    button.addEventListener("pointerdown", startSwatchGesture);
    slot.append(button);
    return slot;
  });

  swatchesElement.replaceChildren(...slots);
}

function selectedSwatchIndex() {
  return state.swatches.findIndex((swatch) => swatch.id === swatchGesture.id);
}

function captureSwatchPointer(button, pointerId) {
  try {
    button.setPointerCapture?.(pointerId);
  } catch (error) {
    // Some synthetic and interrupted pointer paths do not allow capture.
  }
}

function startSwatchGesture(event) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }

  clearTimeout(swatchGesture.longPressTimer);
  swatchGesture.button = event.currentTarget;
  swatchGesture.id = swatchGesture.button.dataset.id;
  swatchGesture.index = Number(swatchGesture.button.dataset.index);
  swatchGesture.pointerId = event.pointerId;
  swatchGesture.startX = event.clientX;
  swatchGesture.startY = event.clientY;
  swatchGesture.currentX = event.clientX;
  swatchGesture.currentY = event.clientY;
  swatchGesture.isEditing = false;
  swatchGesture.didDrag = false;
  state.selectedSwatchId = swatchGesture.id;

  swatchGesture.longPressTimer = window.setTimeout(() => {
    swatchGesture.isEditing = true;
    swatchGesture.didDrag = true;
    captureSwatchPointer(swatchGesture.button, event.pointerId);
    swatchesElement.classList.add("is-editing");
    swatchGesture.button.classList.add("is-lifted");
    statusLine.textContent = "Move left or right to rearrange. Push upward to delete.";
  }, 420);

  swatchGesture.button.addEventListener("pointermove", moveSwatchGesture);
  swatchGesture.button.addEventListener("pointerup", endSwatchGesture);
  swatchGesture.button.addEventListener("pointercancel", cancelSwatchGesture);
}

function moveSwatchGesture(event) {
  const dx = event.clientX - swatchGesture.startX;
  const dy = event.clientY - swatchGesture.startY;

  swatchGesture.currentX = event.clientX;
  swatchGesture.currentY = event.clientY;

  if (!swatchGesture.isEditing && Math.hypot(dx, dy) > 10) {
    clearTimeout(swatchGesture.longPressTimer);
  }

  if (!swatchGesture.isEditing) {
    return;
  }

  event.preventDefault();
  swatchGesture.didDrag = true;
  swatchGesture.button.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
  swatchGesture.button.classList.toggle("is-delete-target", dy < -64);
  reorderDraggedSwatch(event.clientX);
}

function reorderDraggedSwatch(pointerX) {
  const fromIndex = selectedSwatchIndex();
  const swatchElements = [...swatchesElement.querySelectorAll(".swatch:not(.is-lifted)")];
  const targetElement = swatchElements.find((element) => {
    const rect = element.getBoundingClientRect();
    return pointerX < rect.left + rect.width / 2;
  });
  const rawToIndex = targetElement ? Number(targetElement.dataset.index) : state.swatches.length - 1;
  const toIndex = rawToIndex > fromIndex ? rawToIndex - 1 : rawToIndex;

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    return;
  }

  const [moved] = state.swatches.splice(fromIndex, 1);
  state.swatches.splice(toIndex, 0, moved);
  renderSwatches();
  swatchGesture.button = swatchesElement.querySelector(`[data-id="${swatchGesture.id}"]`);
  swatchGesture.button.classList.add("is-lifted");
  swatchGesture.button.style.transform = `translate(${swatchGesture.currentX - swatchGesture.startX}px, ${swatchGesture.currentY - swatchGesture.startY}px) scale(1.06)`;
  swatchGesture.button.classList.toggle("is-delete-target", swatchGesture.currentY - swatchGesture.startY < -64);
  swatchGesture.button.addEventListener("pointermove", moveSwatchGesture);
  swatchGesture.button.addEventListener("pointerup", endSwatchGesture);
  swatchGesture.button.addEventListener("pointercancel", cancelSwatchGesture);
  captureSwatchPointer(swatchGesture.button, swatchGesture.pointerId);
  swatchGesture.index = toIndex;
}

function endSwatchGesture(event) {
  clearTimeout(swatchGesture.longPressTimer);

  if (swatchGesture.isEditing) {
    const dy = event.clientY - swatchGesture.startY;

    if (dy < -64 && state.swatches.length > 1) {
      state.swatches = state.swatches.filter((swatch) => swatch.id !== swatchGesture.id);
      state.selectedSwatchId = null;
      statusLine.textContent = "Swatch deleted.";
    } else if (dy < -64) {
      statusLine.textContent = "Keep at least one swatch in the tray.";
    } else {
      statusLine.textContent = "Swatches rearranged.";
    }
  }

  finishSwatchGesture();
  renderSwatches();
}

function cancelSwatchGesture() {
  clearTimeout(swatchGesture.longPressTimer);
  finishSwatchGesture();
  renderSwatches();
}

function finishSwatchGesture() {
  if (swatchGesture.button) {
    swatchGesture.button.style.transform = "";
    swatchGesture.button.classList.remove("is-lifted", "is-delete-target");
    swatchGesture.button.removeEventListener("pointermove", moveSwatchGesture);
    swatchGesture.button.removeEventListener("pointerup", endSwatchGesture);
    swatchGesture.button.removeEventListener("pointercancel", cancelSwatchGesture);
  }

  swatchesElement.classList.remove("is-editing");
  swatchGesture.button = null;
  swatchGesture.id = null;
  swatchGesture.index = -1;
  swatchGesture.pointerId = null;
  swatchGesture.isEditing = false;

  window.setTimeout(() => {
    swatchGesture.didDrag = false;
  }, 0);
}

function headingFromEvent(event) {
  if (typeof event.webkitCompassHeading === "number") {
    return event.webkitCompassHeading;
  }

  if (typeof event.alpha === "number") {
    return 360 - event.alpha;
  }

  return null;
}

function handleOrientation(event) {
  const heading = headingFromEvent(event);
  const tiltFrontBack = typeof event.beta === "number" ? event.beta : 0;
  const tiltSide = typeof event.gamma === "number" ? event.gamma : 0;
  const hue = heading === null ? state.hue : heading - state.headingOffset;
  state.lastHeading = heading ?? state.lastHeading;
  const lightness = clamp(((tiltFrontBack - 60) / 60) * 100, 0, 100);
  const saturation = clamp(92 - Math.abs(tiltSide) * 0.85, 42, 100);

  state.tintOffset = Math.round(lightness - 50);
  setColor({
    hue,
    saturation,
    lightness
  });

  statusLine.textContent = "Compass is steering hue. Upright is 50% light; tilt down to darken and up to brighten.";
}

async function enableSensors() {
  try {
    if (typeof DeviceOrientationEvent === "undefined") {
      statusLine.textContent = "This browser does not expose motion sensors. Manual controls are ready.";
      return;
    }

    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== "granted") {
        statusLine.textContent = "Motion access was not granted. Manual controls are ready.";
        return;
      }
    }

    window.addEventListener("deviceorientation", handleOrientation, true);
    state.sensorsEnabled = true;
    sensorButton.textContent = "Sensors On";
    statusLine.textContent = "Sensors enabled. Face different directions and tilt the phone.";
  } catch (error) {
    statusLine.textContent = "Sensors could not start here. Manual controls are ready.";
  }
}

function addSwatch() {
  const swatch = {
    id: makeId(),
    hue: state.hue,
    saturation: state.saturation,
    lightness: state.lightness
  };
  const hex = currentHex();
  state.selectedSwatchId = swatch.id;
  state.swatches = [swatch, ...state.swatches.filter((saved) => hslToHex(saved.hue, saved.saturation, saved.lightness) !== hex)].slice(0, MAX_SWATCHES);
  renderSwatches(hex);
  statusLine.textContent = `${hex} added to your swatches.`;
}

async function copyHex() {
  const hex = currentHex();

  try {
    await navigator.clipboard.writeText(hex);
    statusLine.textContent = `${hex} copied.`;
  } catch (error) {
    statusLine.textContent = hex;
  }
}

hueControl.addEventListener("input", () => {
  setColor({ hue: Number(hueControl.value) });
  renderSwatches();
});

tintControl.addEventListener("input", () => {
  state.tintOffset = Number(tintControl.value);
  setColor({ lightness: 50 + state.tintOffset });
  renderSwatches();
});

satControl.addEventListener("input", () => {
  setColor({ saturation: Number(satControl.value) });
  renderSwatches();
});

sensorButton.addEventListener("click", enableSensors);
addSwatchButton.addEventListener("click", addSwatch);
copyButton.addEventListener("click", copyHex);
calibrateButton.addEventListener("click", () => {
  state.headingOffset = state.lastHeading;
  statusLine.textContent = "Current direction calibrated as the start of the wheel.";
});

setColor(state);
renderSwatches();
