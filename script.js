document.querySelectorAll("[data-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("active");
  });
});

const MQTT_RELAY_CONFIG = {
  url: "wss://broker.hivemq.com:8884/mqtt",
  options: {
    clientId: `smartplant_ui_${Math.random().toString(16).slice(2)}`,
    clean: true,
    connectTimeout: 6000,
    reconnectPeriod: 3000,
  },
  topics: {
    pump: "smartplantation/control/pump",
    fan: "smartplantation/control/fan",
    status: "smartplantation/status/relay",
    cameraCommand: "smartplantation/camera/command",
    cameraStatus: "smartplantation/camera/status",
    cameraLatest: "smartplantation/camera/latest",
  },
};

let relayClient = null;

function setRelayConnectionStatus(text, isConnected = false) {
  const element = document.getElementById("relay-mqtt-status");
  if (!element) return;
  element.textContent = text;
  element.classList.toggle("is-offline", !isConnected);
}

function setActuatorState(name, isOn) {
  const button = document.querySelector(`[data-actuator="${name}"]`);
  const status = document.getElementById(`${name}-relay-status`);

  if (button) {
    button.classList.toggle("active", isOn);
    button.setAttribute("aria-pressed", String(isOn));
  }

  if (status) {
    status.textContent = isOn ? "ON" : "OFF";
  }
}

function publishRelayCommand(name, isOn) {
  const topic = MQTT_RELAY_CONFIG.topics[name];
  if (!topic || !relayClient || !relayClient.connected) {
    setRelayConnectionStatus("MQTT offline", false);
    return;
  }

  relayClient.publish(topic, isOn ? "ON" : "OFF", { qos: 0, retain: false }, (error) => {
    if (error) {
      console.error(error);
      setRelayConnectionStatus("MQTT publish failed", false);
    }
  });
}

function handleRelayStatus(payload) {
  let status = payload;
  if (typeof status === "string") {
    try {
      status = JSON.parse(status);
    } catch (error) {
      console.warn("Relay status is not JSON", payload);
      return;
    }
  }

  if (status.pump) {
    const isOn = String(status.pump).toUpperCase() === "ON";
    setActuatorState("pump", isOn);
    const pumpRule = document.querySelector('[data-rule-actuator="pump"]');
    const pumpLabel = document.getElementById("schedule-pump-rule-status");
    if (pumpRule) pumpRule.classList.toggle("active", isOn);
    if (pumpRule) pumpRule.setAttribute("aria-pressed", String(isOn));
    if (pumpLabel) pumpLabel.textContent = `Pump ${isOn ? "ON" : "OFF"}`;
  }
  if (status.fan) {
    const isOn = String(status.fan).toUpperCase() === "ON";
    setActuatorState("fan", isOn);
    const fanRule = document.querySelector('[data-rule-actuator="fan"]');
    const fanLabel = document.getElementById("schedule-fan-rule-status");
    if (fanRule) fanRule.classList.toggle("active", isOn);
    if (fanRule) fanRule.setAttribute("aria-pressed", String(isOn));
    if (fanLabel) fanLabel.textContent = `Fan ${isOn ? "ON" : "OFF"}`;
  }
}

function initRelayMqttControls() {
  const actuatorButtons = document.querySelectorAll("[data-actuator-toggle]");
  const ruleButtons = document.querySelectorAll("[data-rule-actuator]");
  if (!actuatorButtons.length && !ruleButtons.length) return;

  actuatorButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.actuator;
      const nextState = !button.classList.contains("active");
      setActuatorState(name, nextState);
      publishRelayCommand(name, nextState);
    });
  });

  ruleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.dataset.ruleActuator;
      const nextState = !button.classList.contains("active");
      button.classList.toggle("active", nextState);
      button.setAttribute("aria-pressed", String(nextState));
      const label = document.getElementById(`schedule-${name}-rule-status`);
      if (label) label.textContent = `${name === "pump" ? "Pump" : "Fan"} ${nextState ? "ON" : "OFF"}`;
      publishRelayCommand(name, nextState);
    });
  });

  if (!window.mqtt) {
    setRelayConnectionStatus("MQTT library missing", false);
    return;
  }

  setRelayConnectionStatus("MQTT connecting", false);
  relayClient = window.mqtt.connect(MQTT_RELAY_CONFIG.url, MQTT_RELAY_CONFIG.options);

  relayClient.on("connect", () => {
    setRelayConnectionStatus("MQTT connected", true);
    relayClient.subscribe(MQTT_RELAY_CONFIG.topics.status);
    relayClient.subscribe(MQTT_RELAY_CONFIG.topics.cameraStatus);
    relayClient.subscribe(MQTT_RELAY_CONFIG.topics.cameraLatest);
  });

  relayClient.on("reconnect", () => setRelayConnectionStatus("MQTT reconnecting", false));
  relayClient.on("offline", () => setRelayConnectionStatus("MQTT offline", false));
  relayClient.on("error", (error) => {
    console.error(error);
    setRelayConnectionStatus("MQTT error", false);
  });

  relayClient.on("message", (topic, payload) => {
    const text = payload.toString();
    if (topic === MQTT_RELAY_CONFIG.topics.status) {
      handleRelayStatus(text);
    }
    if (topic === MQTT_RELAY_CONFIG.topics.cameraStatus) {
      handleCameraStatus(text);
    }
    if (topic === MQTT_RELAY_CONFIG.topics.cameraLatest) {
      handleCameraLatest(text);
    }
  });
}

document.querySelectorAll(".segmented").forEach((group) => {
  group.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLButtonElement)) return;

    group.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("active", button === event.target);
    });
  });
});

document.querySelectorAll(".days button").forEach((day) => {
  day.addEventListener("click", () => {
    document.querySelectorAll(".days button").forEach((button) => {
      button.classList.toggle("selected", button === day);
    });
  });
});


let leafWebcamStream = null;

function setWebcamStatus(message) {
  setText("webcam-status", message);
}

function publishCameraCommand(command) {
  if (!relayClient || !relayClient.connected) {
    setWebcamStatus("MQTT offline. Start Node-RED and check internet connection.");
    return;
  }

  relayClient.publish(MQTT_RELAY_CONFIG.topics.cameraCommand, command, { qos: 0, retain: false }, (error) => {
    if (error) {
      console.error(error);
      setWebcamStatus("Camera command failed");
      return;
    }
    setWebcamStatus(`${command} sent to Node-RED laptop camera`);
  });
}

function stopLeafWebcam() {
  const video = document.getElementById("laptop-live-preview");
  const placeholder = document.getElementById("laptop-live-placeholder");

  if (leafWebcamStream) {
    leafWebcamStream.getTracks().forEach((track) => track.stop());
    leafWebcamStream = null;
  }

  if (video) {
    video.pause();
    video.srcObject = null;
    video.classList.remove("has-image");
  }

  if (placeholder) placeholder.hidden = false;
}

function handleCameraStatus(payload) {
  let status = payload;
  if (typeof status === "string") {
    try {
      status = JSON.parse(status);
    } catch (error) {
      setWebcamStatus(status);
      return;
    }
  }

  setWebcamStatus(status.message || (status.previewing ? "Laptop camera is previewing" : "Waiting for laptop camera"));
}

function handleCameraLatest(payload) {
  let latest = payload;
  if (typeof latest === "string") {
    try {
      latest = JSON.parse(latest);
    } catch (error) {
      latest = { image: latest };
    }
  }

  const image = document.getElementById("leaf-captured-image");
  const placeholder = document.getElementById("leaf-captured-placeholder");
  const imageSrc = latest.image || latest.latest_image || latest.payload;
  if (!image || !imageSrc) return;

  image.src = imageSrc;
  image.classList.add("has-image");
  if (placeholder) placeholder.hidden = true;

  const capturedAt = latest.captured_at ? new Date(latest.captured_at).toLocaleTimeString() : new Date().toLocaleTimeString();
  setWebcamStatus(`Laptop camera is previewing. Latest update: ${capturedAt}`);
}

async function startLeafWebcam() {
  const video = document.getElementById("laptop-live-preview");
  const placeholder = document.getElementById("laptop-live-placeholder");
  if (!video) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    setWebcamStatus("This browser cannot open a camera preview.");
    return;
  }

  try {
    setWebcamStatus("Requesting camera permission...");
    stopLeafWebcam();
    leafWebcamStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    video.srcObject = leafWebcamStream;
    await video.play();
    video.classList.add("has-image");
    if (placeholder) placeholder.hidden = true;
    setWebcamStatus("Live camera preview is showing.");
  } catch (error) {
    console.error(error);
    setWebcamStatus("Camera failed. Allow camera permission and check that the webcam is connected.");
  }
}

function captureLeafPhoto() {
  const video = document.getElementById("laptop-live-preview");
  const canvas = document.getElementById("leaf-webcam-canvas");
  const image = document.getElementById("leaf-captured-image");
  const placeholder = document.getElementById("leaf-captured-placeholder");

  if (!video?.srcObject || !canvas || !image || !video.videoWidth || !video.videoHeight) {
    setWebcamStatus("Start the live camera preview before capturing.");
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  image.src = canvas.toDataURL("image/jpeg", 0.9);
  image.classList.add("has-image");
  if (placeholder) placeholder.hidden = true;
  setWebcamStatus("Snapshot captured from the live camera.");
}

function clearLeafPhoto() {
  const image = document.getElementById("leaf-captured-image");
  const placeholder = document.getElementById("leaf-captured-placeholder");
  if (image) {
    image.removeAttribute("src");
    image.classList.remove("has-image");
  }
  if (placeholder) placeholder.hidden = false;
  setWebcamStatus("Captured image cleared");
}

function initLeafWebcam() {
  const startButton = document.getElementById("start-webcam");
  const stopButton = document.getElementById("stop-webcam");
  const captureButton = document.getElementById("capture-leaf-photo");
  const clearButton = document.getElementById("clear-leaf-photo");
if (!startButton || !stopButton) return;

startButton.addEventListener("click", startLeafWebcam);
  stopButton.addEventListener("click", () => {
    stopLeafWebcam();
    setWebcamStatus("Live camera preview stopped.");
  });
  captureButton?.addEventListener("click", captureLeafPhoto);
  clearButton?.addEventListener("click", clearLeafPhoto);
setWebcamStatus("Press Start Laptop Camera to show the live preview here.");
}

const WEATHER_CONFIG = {
  location: "Kuala Lumpur",
  forecastUrl: "https://api.data.gov.my/weather/forecast",
  warningUrl: "https://api.data.gov.my/weather/warning",
  earthquakeUrl: "https://api.data.gov.my/weather/warning/earthquake",
};

const forecastTranslations = {
  "berjerebu": "Hazy",
  "jerebu": "Hazy",
  "tiada hujan": "No rain",
  "hujan": "Rain",
  "hujan di beberapa tempat": "Scattered rain",
  "hujan di satu dua tempat": "Isolated rain",
  "hujan di satu dua tempat di kawasan pantai": "Isolated rain over coastal areas",
  "hujan di satu dua tempat di kawasan pedalaman": "Isolated rain over inland areas",
  "ribut petir": "Thunderstorms",
  "ribut petir di beberapa tempat": "Scattered thunderstorms",
  "ribut petir di beberapa tempat di kawasan pedalaman": "Scattered thunderstorms inland",
  "ribut petir di satu dua tempat": "Isolated thunderstorms",
  "ribut petir di satu dua tempat di kawasan pantai": "Isolated coastal thunderstorms",
  "ribut petir di satu dua tempat di kawasan pedalaman": "Isolated inland thunderstorms",
};

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function translateForecast(value) {
  if (!value) return "No forecast available";
  return forecastTranslations[String(value).toLowerCase()] || value;
}

function formatDate(value) {
  if (!value) return "Today";
  return new Intl.DateTimeFormat("en-MY", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "No timestamp";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Weather API failed: ${response.status}`);
  return response.json();
}

function pickForecast(records) {
  if (!Array.isArray(records) || records.length === 0) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return records
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .find((record) => new Date(record.date) >= today) || records[0];
}

function latestRecord(records, datePath) {
  if (!Array.isArray(records) || records.length === 0) return null;
  return records.slice().sort((a, b) => new Date(datePath(b)) - new Date(datePath(a)))[0];
}

const SUPABASE_CONFIG = {
  url: "https://ntvknrblgmjauaznenpk.supabase.co",
  key: "sb_publishable_7Kgk2nj4WLTAuX86ucXDKw_CQ3J18lh",
  table: "plant_sensor_readings",
  limit: 500,
};

let cachedSupabaseReadings = [];
let analyticsRange = "7";

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= -900) return null;
  return number;
}

function formatNumber(value, digits = 1) {
  const number = numberOrNull(value);
  if (number === null) return "--";
  return number.toFixed(digits);
}

function formatPercent(value) {
  const number = numberOrNull(value);
  if (number === null || number < 0) return "--%";
  return `${Math.round(number)}%`;
}

function formatReadingTime(value) {
  if (!value) return "--";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function waterStatus(reading) {
  if (reading?.water_level_status) return reading.water_level_status;
  const level = Number(reading?.water_level);
  if (!Number.isFinite(level)) return "--";
  return level >= 80 ? "full" : "not full";
}

function setRingValue(name, value) {
  const ring = document.querySelector(`[data-ring="${name}"]`);
  if (!ring) return;

  const number = numberOrNull(value);
  ring.style.setProperty("--value", number !== null && number >= 0 ? Math.max(0, Math.min(100, number)) : 0);
}

function updateLiveSensorUI(readings) {
  const latest = readings[0];
  if (!latest) {
    setText("sensor-sync-summary", "No Supabase readings yet. Insert data from Node-RED first.");
    setText("sensor-history-status", "No rows found");
    return;
  }

  const syncTime = formatReadingTime(latest.created_at);
  const water = waterStatus(latest);

  setText("sensor-sync-summary", `Latest reading synced from Supabase at ${syncTime}.`);
  setText("live-last-sync", syncTime);
  setText("live-water-status", water);
  setText("live-soil-moisture", formatPercent(latest.soil_moisture));
  setText("live-water-level", formatPercent(latest.water_level));
  setText("live-temperature", `${formatNumber(latest.temperature)}°`);
  setText("sensor-history-status", `Showing ${Math.min(readings.length, 8)} latest readings`);

  setRingValue("soil_moisture", latest.soil_moisture);
  setRingValue("water_level", latest.water_level);
  const temperature = numberOrNull(latest.temperature);
  setRingValue("temperature", temperature === null ? null : temperature * 2);
}

function updateDashboardReadingsTable(readings) {
  const table = document.getElementById("latest-readings-table");
  if (!table) return;

  if (!readings.length) {
    table.innerHTML = `<tr><td colspan="6">No readings found in Supabase</td></tr>`;
    return;
  }

  table.innerHTML = readings.slice(0, 8).map((reading) => `
    <tr>
      <td>${formatReadingTime(reading.created_at)}</td>
      <td>${formatNumber(reading.temperature)} C</td>
      <td>${formatNumber(reading.humidity)}%</td>
      <td>${formatPercent(reading.soil_moisture)}</td>
      <td>${waterStatus(reading)}</td>
      <td>${formatNumber(reading.water_distance_cm)} cm</td>
    </tr>
  `).join("");
}

function numericReadings(readings, field) {
  return readings
    .map((reading) => numberOrNull(reading[field]))
    .filter((number) => number !== null);
}

function average(values) {
  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentFor(value, max) {
  const number = numberOrNull(value);
  if (number === null) return 0;
  return Math.max(0, Math.min(100, (number / max) * 100));
}

function filterReadingsByRange(readings) {
  if (analyticsRange === "ytd") {
    const start = new Date(new Date().getFullYear(), 0, 1);
    return readings.filter((reading) => new Date(reading.created_at) >= start);
  }

  const days = Number(analyticsRange);
  const start = new Date();
  start.setDate(start.getDate() - days);
  return readings.filter((reading) => new Date(reading.created_at) >= start);
}

function buildTrendPath(points, field) {
  const values = points.map((reading) => numberOrNull(reading[field]));
  const validValues = values.filter((value) => value !== null);
  if (validValues.length < 2) return "";

  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const range = max - min || 1;
  const width = 640;
  const height = 240;
  const left = 80;
  const top = 58;

  return points.map((reading, index) => {
    const value = numberOrNull(reading[field]) ?? min;
    const x = left + (index / Math.max(1, points.length - 1)) * width;
    const y = top + height - ((value - min) / range) * height;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function updateAnalyticsSummary(readings) {
  const chart = document.getElementById("analytics-sensor-chart");
  if (!chart) return;

  const filtered = filterReadingsByRange(readings);
  const chronological = filtered.slice().reverse();
  const latest = filtered[0];

  setText("analytics-sync-status", readings.length ? `Connected to Supabase • Last sync: ${formatReadingTime(readings[0].created_at)}` : "Connected to Supabase • No readings yet");
  setText("analytics-chart-subtitle", filtered.length ? `${filtered.length} readings from Supabase` : "No readings for selected range");

  const tempAvg = average(numericReadings(filtered, "temperature"));
  const humidityAvg = average(numericReadings(filtered, "humidity"));
  const soilAvg = average(numericReadings(filtered, "soil_moisture"));
  const waterAvg = average(numericReadings(filtered, "water_level"));
  const distanceAvg = average(numericReadings(filtered, "water_distance_cm"));

  setText("avg-temperature", tempAvg === null ? "-- C" : `${formatNumber(tempAvg)} C`);
  setText("avg-humidity", humidityAvg === null ? "--%" : `${formatNumber(humidityAvg)}%`);
  setText("avg-soil", soilAvg === null ? "--%" : `${Math.round(soilAvg)}%`);
  setText("avg-water-level", waterAvg === null ? "--" : `${Math.round(waterAvg)}%`);
  setText("water-analytics-detail", distanceAvg === null ? "No ultrasonic reading" : `Avg distance ${formatNumber(distanceAvg)} cm`);

  const tempBar = document.getElementById("avg-temperature-bar");
  const humidityBar = document.getElementById("avg-humidity-bar");
  const soilBar = document.getElementById("avg-soil-bar");
  if (tempBar) tempBar.style.width = `${percentFor(tempAvg, 50)}%`;
  if (humidityBar) humidityBar.style.width = `${percentFor(humidityAvg, 100)}%`;
  if (soilBar) soilBar.style.width = `${percentFor(soilAvg, 100)}%`;

  const firstSoil = Number(chronological[0]?.soil_moisture);
  const latestSoil = Number(latest?.soil_moisture);
  const trend = Number.isFinite(firstSoil) && Number.isFinite(latestSoil) ? latestSoil - firstSoil : null;
  setText("analytics-trend-badge", trend === null ? "--" : `${trend >= 0 ? "+" : ""}${Math.round(trend)}% soil`);

  if (chronological.length < 2) {
    chart.innerHTML = '<text x="260" y="180">Need at least 2 Supabase readings for trend chart</text>';
    return;
  }

  const soilPath = buildTrendPath(chronological, "soil_moisture");
  const waterPath = buildTrendPath(chronological, "water_level");
  const tempPath = buildTrendPath(chronological, "temperature");
  chart.innerHTML = `
    <path class="grid-line" d="M60 58H730M60 145H730M60 235H730M60 318H730" />
    <text x="0" y="62">High</text>
    <text x="0" y="239">Low</text>
    <text x="80" y="350">Oldest</text>
    <text x="650" y="350">Latest</text>
    <path class="trend" d="${soilPath}" />
    <path class="target-line" d="${waterPath}" />
    <path class="grid-line" d="${tempPath}" style="stroke:#7bc9b3;stroke-width:4;stroke-dasharray:none;" />
    <circle cx="720" cy="58" r="6" fill="#40dacb" />
    <text x="600" y="32">Soil / Water / Temp</text>
  `;
}

function exportSensorCsv() {
  const readings = filterReadingsByRange(cachedSupabaseReadings);
  if (!readings.length) return;

  const columns = ["created_at", "temperature", "humidity", "soil_moisture", "soil_digital", "water_level", "water_level_status", "water_distance_cm", "soil_raw"];
  const lines = [
    columns.join(","),
    ...readings.map((reading) => columns.map((column) => JSON.stringify(reading[column] ?? "")).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `plant-sensor-readings-${analyticsRange}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function initAnalyticsControls() {
  document.querySelectorAll("[data-analytics-range]").forEach((button) => {
    button.addEventListener("click", () => {
      analyticsRange = button.dataset.analyticsRange || "7";
      document.querySelectorAll("[data-analytics-range]").forEach((item) => item.classList.toggle("active", item === button));
      updateAnalyticsSummary(cachedSupabaseReadings);
      updateAnalyticsReadingsTable(filterReadingsByRange(cachedSupabaseReadings));
    });
  });

  const exportButton = document.getElementById("export-sensor-csv");
  if (exportButton) exportButton.addEventListener("click", exportSensorCsv);
}

function updateAnalyticsReadingsTable(readings) {
  const table = document.getElementById("analytics-readings-table");
  if (!table) return;

  setText("analytics-sync-status", readings.length ? `Connected to Supabase • Last sync: ${formatReadingTime(readings[0].created_at)}` : "Connected to Supabase • No readings yet");
  setText("analytics-table-foot", readings.length ? `Showing ${readings.length} latest sensor readings` : "No Supabase records found");

  if (!readings.length) {
    table.innerHTML = `<tr><td colspan="5">No readings found in Supabase</td></tr>`;
    return;
  }

  table.innerHTML = readings.map((reading) => `
    <tr>
      <td>${formatReadingTime(reading.created_at)}</td>
      <td><i data-lucide="activity"></i>Sensor Reading</td>
      <td>Plant Unit</td>
      <td>Temp ${formatNumber(reading.temperature)} C • Humidity ${formatNumber(reading.humidity)}% • Soil ${formatPercent(reading.soil_moisture)} • Water ${waterStatus(reading)}</td>
      <td><span class="badge ok">Stored</span></td>
    </tr>
  `).join("");
}

async function fetchSupabaseReadings() {
  const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?select=*&order=created_at.desc&limit=${SUPABASE_CONFIG.limit}`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: SUPABASE_CONFIG.key,
      Authorization: `Bearer ${SUPABASE_CONFIG.key}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase fetch failed: ${response.status}`);
  }

  return response.json();
}

async function loadSupabaseSensorData() {
  const needsSensorData = document.getElementById("latest-readings-table")
    || document.getElementById("analytics-readings-table")
    || document.getElementById("live-soil-moisture");

  if (!needsSensorData) return;

  try {
    const readings = await fetchSupabaseReadings();
    cachedSupabaseReadings = readings;
    const analyticsReadings = filterReadingsByRange(readings);
    updateLiveSensorUI(readings);
    updateDashboardReadingsTable(readings);
    updateAnalyticsSummary(readings);
    updateAnalyticsReadingsTable(analyticsReadings);

    if (window.lucide) {
      window.lucide.createIcons({ attrs: { "stroke-width": 2 } });
    }
  } catch (error) {
    console.error(error);
    setText("sensor-sync-summary", "Could not load Supabase readings. Check table policies and API key.");
    setText("sensor-history-status", "Supabase fetch failed");
    setText("analytics-sync-status", "Supabase fetch failed");
  }
}


function updateWeeklyForecastUI(records) {
  const buttons = document.querySelectorAll("[data-weather-day]");
  if (!buttons.length) return;

  if (!Array.isArray(records) || records.length === 0) {
    buttons.forEach((button) => {
      const label = button.querySelector("em");
      const range = button.querySelector("b");
      if (label) label.textContent = "Unavailable";
      if (range) range.textContent = "-- / --°C";
    });
    return;
  }

  const sorted = records
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, buttons.length);

  buttons.forEach((button, index) => {
    const forecast = sorted[index];
    if (!forecast) return;

    const date = new Date(forecast.date);
    const dayName = new Intl.DateTimeFormat("en-MY", { weekday: "short" }).format(date);
    const dayNumber = new Intl.DateTimeFormat("en-MY", { day: "2-digit" }).format(date);
    const summary = translateForecast(forecast.summary_forecast);
    const rangeText = `${forecast.min_temp ?? "--"} / ${forecast.max_temp ?? "--"}°C`;

    const dayLabel = button.querySelector("span");
    const dayValue = button.querySelector("strong");
    const forecastLabel = button.querySelector("em");
    const range = button.querySelector("b");

    if (dayLabel) dayLabel.textContent = dayName;
    if (dayValue) dayValue.textContent = dayNumber;
    if (forecastLabel) forecastLabel.textContent = summary;
    if (range) range.textContent = rangeText;
  });
}
function currentDaySituation(forecast) {
  if (!forecast) return "Current weather unavailable";

  const morning = translateForecast(forecast.morning_forecast);
  const afternoon = translateForecast(forecast.afternoon_forecast);
  const night = translateForecast(forecast.night_forecast);
  return `Morning: ${morning} • Afternoon: ${afternoon} • Night: ${night}`;
}
function updateForecastUI(forecast) {
  if (!forecast) {
    setText("weather-summary", "Forecast unavailable");
    setText("weather-forecast", "Unable to load forecast");
    setText("schedule-weather-forecast", "Forecast unavailable");
    setText("weather-warning", "Current weather unavailable");
    setText("schedule-weather-warning", "Current weather unavailable");
    setText("schedule-weather-warning-detail", "Forecast API returned no current day data");
    return;
  }

  const locationName = forecast.location?.location_name || WEATHER_CONFIG.location;
  const minTemp = forecast.min_temp ?? "--";
  const maxTemp = forecast.max_temp ?? "--";
  const displayTemp = maxTemp !== "--" ? `${maxTemp}°C` : "--°C";
  const range = `${minTemp} / ${maxTemp}°C`;
  const summary = translateForecast(forecast.summary_forecast);
  const when = forecast.summary_when ? ` (${forecast.summary_when})` : "";

  setText("weather-location", locationName);
  setText("weather-temp", displayTemp);
  setText("weather-summary", "Outdoor forecast");
  setText("weather-date", formatDate(forecast.date));
  setText("weather-range", range);
  setText("weather-forecast", `${summary}${when}`);

  setText("schedule-weather-location", `${locationName} forecast from MET Malaysia`);
  setText("schedule-weather-forecast", `${summary}${when}`);
  setText("schedule-weather-range", range);
  setText("weather-warning", translateForecast(forecast.summary_forecast));
  setText("schedule-weather-warning", "Current day situation");
  setText("schedule-weather-warning-detail", currentDaySituation(forecast));
}

function updateWarningUI(warnings) {
  const warning = latestRecord(warnings, (record) => record.warning_issue?.issued || record.valid_from);
  const title = warning?.warning_issue?.title_en || warning?.heading_en;

  if (title) {
    setText("weather-warning", "Active alert");
    setText("schedule-weather-sync", "Alert");
  }
}

function updateEarthquakeUI(records) {
  const quake = latestRecord(records, (record) => record.localdatetime || record.utcdatetime);
  if (!quake) {
    setText("schedule-earthquake-status", "No recent bulletin");
    setText("schedule-earthquake-detail", "Earthquake endpoint returned no visible event");
    return;
  }

  const magnitude = quake.magdefault ? `M${quake.magdefault}` : "Magnitude n/a";
  const status = quake.status || "Latest bulletin";
  const location = quake.location_original || quake.location || "Unknown location";
  const time = formatDateTime(quake.localdatetime || quake.utcdatetime);

  setText("schedule-earthquake-status", `${status} • ${magnitude}`);
  setText("schedule-earthquake-detail", `${location} • ${time}`);
}

async function loadWeatherData() {
  const needsDashboard = document.querySelector("[data-weather-dashboard]");
  const needsSchedule = document.querySelector("[data-weather-schedule]");
  if (!needsDashboard && !needsSchedule) return;

  const forecastQuery = new URLSearchParams({
    contains: `${WEATHER_CONFIG.location}@location__location_name`,
    limit: "7",
  });

  try {
    const [forecastRecords, warningRecords, earthquakeRecords] = await Promise.all([
      fetchJson(`${WEATHER_CONFIG.forecastUrl}?${forecastQuery}`),
      fetchJson(`${WEATHER_CONFIG.warningUrl}?limit=5`),
      fetchJson(`${WEATHER_CONFIG.earthquakeUrl}?limit=5`),
    ]);

    updateWeeklyForecastUI(forecastRecords);
    updateForecastUI(pickForecast(forecastRecords));
    updateEarthquakeUI(earthquakeRecords);
    setText("schedule-weather-sync", "Live");
    updateWarningUI(warningRecords);
  } catch (error) {
    console.error(error);
    setText("weather-summary", "API offline");
    setText("weather-forecast", "Could not reach data.gov.my");
    setText("weather-warning", "Unavailable");
    updateWeeklyForecastUI([]);
    setText("schedule-weather-forecast", "Could not reach data.gov.my");
    setText("schedule-weather-warning", "Warning API unavailable");
    setText("schedule-weather-warning-detail", "Check your connection or try again later");
    setText("schedule-earthquake-status", "Earthquake API unavailable");
    setText("schedule-earthquake-detail", "Check your connection or try again later");
    setText("schedule-weather-sync", "Offline");
  }
}

initRelayMqttControls();
initLeafWebcam();
initAnalyticsControls();
loadWeatherData();
loadSupabaseSensorData();
setInterval(loadSupabaseSensorData, 10000);

if (window.lucide) {
  window.lucide.createIcons({
    attrs: {
      "stroke-width": 2,
    },
  });
}