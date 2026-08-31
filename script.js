document.querySelectorAll("[data-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("active");
  });
});

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
};

function formatNumber(value, digits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--";
  return number.toFixed(digits);
}

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "--%";
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

  const number = Number(value);
  ring.style.setProperty("--value", Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : 0);
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
  setRingValue("temperature", Number(latest.temperature) * 2);
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
  const endpoint = `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.table}?select=*&order=created_at.desc&limit=20`;
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
    updateLiveSensorUI(readings);
    updateDashboardReadingsTable(readings);
    updateAnalyticsReadingsTable(readings);

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






