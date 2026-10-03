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

const state = {
  hue: 350,
  saturation: 88,
  lightness: 50,
  tintOffset: 0,
  headingOffset: 0,
  lastHeading: 0,
  sensorsEnabled: false,
  swatches: [
    { hue: 13, saturation: 100, lightness: 63 },
    { hue: 38, saturation: 96, lightness: 60 },
    { hue: 357, saturation: 68, lightness: 48 },
    { hue: 299, saturation: 96, lightness: 18 }
  ]
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
  state.lightness = clamp(Math.round(next.lightness ?? state.lightness), 8, 92);

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
  swatchesElement.replaceChildren(...state.swatches.map((swatch) => {
    const button = document.createElement("button");
    const hex = hslToHex(swatch.hue, swatch.saturation, swatch.lightness);
    button.className = "swatch";
    button.type = "button";
    button.style.setProperty("--swatch-color", hex);
    button.dataset.hex = hex;
    button.setAttribute("aria-label", `Use swatch ${hex}, ${colorLabel(swatch)}`);
    button.setAttribute("aria-current", hex === selectedHex ? "true" : "false");
    button.addEventListener("click", () => {
      state.tintOffset = swatch.lightness - 50;
      setColor(swatch);
      renderSwatches(hex);
      statusLine.textContent = `${hex} loaded from your swatches.`;
    });
    return button;
  }));
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
  const tintOffset = clamp(tiltFrontBack * 0.7, -42, 42);
  const saturation = clamp(92 - Math.abs(tiltSide) * 0.85, 42, 100);

  state.tintOffset = Math.round(tintOffset);
  setColor({
    hue,
    saturation,
    lightness: 50 + tintOffset
  });

  statusLine.textContent = "Compass is steering hue. Tilt forward and back for tint, side to side for saturation.";
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
    hue: state.hue,
    saturation: state.saturation,
    lightness: state.lightness
  };
  const hex = currentHex();
  state.swatches = [swatch, ...state.swatches.filter((saved) => hslToHex(saved.hue, saved.saturation, saved.lightness) !== hex)].slice(0, 12);
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
