// server-ping/index.js
// Comprehensive demo skill showcasing all QuickJS runtime capabilities:
//   Setup flow, DB (SQLite), Store (KV), State (frontend pub), Data (file I/O),
//   Net (HTTP), Cron (scheduling), Platform (OS/notify), Skills (interop),
//   Options, Tools, and Session lifecycle.

// ---------------------------------------------------------------------------
// Configuration (populated by setup flow, persisted in store)
// ---------------------------------------------------------------------------

var CONFIG = {
  serverUrl: "",
  pingIntervalSec: 10,
  notifyOnDown: true,
  notifyOnRecover: true,
  verboseLogging: false,
};

var PING_COUNT = 0;
var FAIL_COUNT = 0;
var CONSECUTIVE_FAILS = 0;
var WAS_DOWN = false;
var ACTIVE_SESSIONS = [];

// ---------------------------------------------------------------------------
// Lifecycle hooks
// ---------------------------------------------------------------------------

function init() {
  console.log("[server-ping] Initializing on " + platform.os());

  // Create DB table for ping history
  db.exec(
    "CREATE TABLE IF NOT EXISTS ping_log (" +
      "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
      "timestamp TEXT NOT NULL, " +
      "url TEXT NOT NULL, " +
      "status INTEGER, " +
      "latency_ms INTEGER, " +
      "success INTEGER NOT NULL, " +
      "error TEXT" +
      ")",
    []
  );

  // Load persisted config from store
  var saved = store.get("config");
  if (saved) {
    CONFIG.serverUrl = saved.serverUrl || CONFIG.serverUrl;
    CONFIG.pingIntervalSec = saved.pingIntervalSec || CONFIG.pingIntervalSec;
    CONFIG.notifyOnDown =
      saved.notifyOnDown !== undefined ? saved.notifyOnDown : CONFIG.notifyOnDown;
    CONFIG.notifyOnRecover =
      saved.notifyOnRecover !== undefined ? saved.notifyOnRecover : CONFIG.notifyOnRecover;
    CONFIG.verboseLogging =
      saved.verboseLogging !== undefined ? saved.verboseLogging : CONFIG.verboseLogging;
  }

  // Load counters from store
  var counters = store.get("counters");
  if (counters) {
    PING_COUNT = counters.pingCount || 0;
    FAIL_COUNT = counters.failCount || 0;
  }

  console.log("[server-ping] Config loaded — target: " + CONFIG.serverUrl);
}

function start() {
  if (!CONFIG.serverUrl) {
    console.warn("[server-ping] No server URL configured — waiting for setup");
    return;
  }

  var cronExpr = "*/" + CONFIG.pingIntervalSec + " * * * * *";
  console.log(
    "[server-ping] Starting — ping every " +
      CONFIG.pingIntervalSec +
      "s (" + cronExpr + ")"
  );
  cron.register("ping", cronExpr);

  // Publish initial state to frontend
  publishState();
}

function stop() {
  console.log("[server-ping] Stopping");
  cron.unregister("ping");

  // Persist counters
  store.set("counters", {
    pingCount: PING_COUNT,
    failCount: FAIL_COUNT,
  });

  state.set("status", "stopped");
}

// ---------------------------------------------------------------------------
// Setup flow (multi-step)
// ---------------------------------------------------------------------------

function onSetupStart() {
  // Pre-fill with the host's backend URL so the user doesn't have to type it
  var defaultUrl = platform.env("BACKEND_URL") || "";

  return {
    step: {
      id: "server-config",
      title: "Server Configuration",
      description: "Enter the server URL to monitor and choose a ping interval.",
      fields: [
        {
          name: "serverUrl",
          type: "text",
          label: "Server URL",
          description: "Full URL to ping (e.g. https://api.example.com/health)",
          required: true,
          default: defaultUrl,
          placeholder: "https://api.example.com/health",
        },
        {
          name: "pingIntervalSec",
          type: "select",
          label: "Ping Interval",
          description: "How often to check the server",
          required: true,
          default: "10",
          options: [
            { label: "Every 5 seconds", value: "5" },
            { label: "Every 10 seconds", value: "10" },
            { label: "Every 30 seconds", value: "30" },
            { label: "Every 60 seconds", value: "60" },
          ],
        },
      ],
    },
  };
}

function onSetupSubmit(args) {
  var stepId = args.stepId;
  var values = args.values;

  if (stepId === "server-config") {
    // Validate URL
    var url = (values.serverUrl || "").trim();
    if (!url) {
      return {
        status: "error",
        errors: [{ field: "serverUrl", message: "Server URL is required" }],
      };
    }
    if (url.indexOf("http") !== 0) {
      return {
        status: "error",
        errors: [
          { field: "serverUrl", message: "URL must start with http:// or https://" },
        ],
      };
    }

    // Store values and move to next step
    CONFIG.serverUrl = url;
    CONFIG.pingIntervalSec = parseInt(values.pingIntervalSec) || 10;

    return {
      status: "next",
      nextStep: {
        id: "notification-config",
        title: "Notification Preferences",
        description: "Choose when to receive desktop notifications.",
        fields: [
          {
            name: "notifyOnDown",
            type: "boolean",
            label: "Notify when server goes down",
            description: "Send a desktop notification when the server becomes unreachable",
            required: false,
            default: true,
          },
          {
            name: "notifyOnRecover",
            type: "boolean",
            label: "Notify when server recovers",
            description: "Send a desktop notification when the server comes back online",
            required: false,
            default: true,
          },
        ],
      },
    };
  }

  if (stepId === "notification-config") {
    CONFIG.notifyOnDown =
      values.notifyOnDown !== undefined ? values.notifyOnDown : true;
    CONFIG.notifyOnRecover =
      values.notifyOnRecover !== undefined ? values.notifyOnRecover : true;

    // Persist full config to store
    store.set("config", CONFIG);

    // Write a human-readable config file to data dir
    data.write(
      "config.json",
      JSON.stringify(CONFIG, null, 2)
    );

    console.log("[server-ping] Setup complete — monitoring " + CONFIG.serverUrl);

    return { status: "complete" };
  }

  return {
    status: "error",
    errors: [{ field: "", message: "Unknown setup step: " + stepId }],
  };
}

function onSetupCancel() {
  console.log("[server-ping] Setup cancelled");
}

// ---------------------------------------------------------------------------
// Options (runtime-configurable)
// ---------------------------------------------------------------------------

function onListOptions() {
  return {
    options: [
      {
        name: "notifyOnDown",
        type: "boolean",
        label: "Notify on server down",
        description: "Send desktop notification when server is unreachable",
        value: CONFIG.notifyOnDown,
      },
      {
        name: "notifyOnRecover",
        type: "boolean",
        label: "Notify on recovery",
        description: "Send desktop notification when server recovers",
        value: CONFIG.notifyOnRecover,
      },
      {
        name: "verboseLogging",
        type: "boolean",
        label: "Verbose logging",
        description: "Log every ping result to console",
        value: CONFIG.verboseLogging,
      },
    ],
  };
}

function onSetOption(args) {
  var name = args.name;
  var value = args.value;

  if (name === "notifyOnDown") CONFIG.notifyOnDown = !!value;
  else if (name === "notifyOnRecover") CONFIG.notifyOnRecover = !!value;
  else if (name === "verboseLogging") CONFIG.verboseLogging = !!value;

  // Persist updated config
  store.set("config", CONFIG);
  console.log("[server-ping] Option '" + name + "' set to " + value);
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

function onSessionStart(args) {
  var sid = args.sessionId;
  ACTIVE_SESSIONS.push(sid);
  console.log(
    "[server-ping] Session started: " + sid +
    " (active: " + ACTIVE_SESSIONS.length + ")"
  );
}

function onSessionEnd(args) {
  var sid = args.sessionId;
  ACTIVE_SESSIONS = ACTIVE_SESSIONS.filter(function (s) { return s !== sid; });
  console.log(
    "[server-ping] Session ended: " + sid +
    " (active: " + ACTIVE_SESSIONS.length + ")"
  );
}

// ---------------------------------------------------------------------------
// Cron handler — the main ping logic
// ---------------------------------------------------------------------------

function onCronTrigger(scheduleId) {
  if (scheduleId !== "ping") return;
  doPing();
}

function doPing() {
  PING_COUNT++;
  var timestamp = new Date().toISOString();
  var startTime = Date.now();

  try {
    var response = net.fetch(CONFIG.serverUrl, {
      method: "GET",
      timeout: 10,
    });

    var latencyMs = Date.now() - startTime;
    var success = response.status >= 200 && response.status < 400;

    if (!success) {
      FAIL_COUNT++;
      CONSECUTIVE_FAILS++;
    } else {
      // Check if recovering from downtime
      if (WAS_DOWN && CONFIG.notifyOnRecover) {
        sendNotification(
          "Server Recovered",
          CONFIG.serverUrl + " is back online (was down for " +
          CONSECUTIVE_FAILS + " checks)"
        );
      }
      CONSECUTIVE_FAILS = 0;
      WAS_DOWN = false;
    }

    if (CONFIG.verboseLogging) {
      console.log(
        "[server-ping] #" + PING_COUNT + " " +
        response.status + " " + latencyMs + "ms"
      );
    }

    // Log to DB
    db.exec(
      "INSERT INTO ping_log (timestamp, url, status, latency_ms, success, error) " +
      "VALUES (?, ?, ?, ?, ?, ?)",
      [timestamp, CONFIG.serverUrl, response.status, latencyMs, success ? 1 : 0, null]
    );
  } catch (e) {
    var latencyMs = Date.now() - startTime;
    FAIL_COUNT++;
    CONSECUTIVE_FAILS++;

    console.error("[server-ping] #" + PING_COUNT + " FAILED: " + e);

    // Log failure to DB
    db.exec(
      "INSERT INTO ping_log (timestamp, url, status, latency_ms, success, error) " +
      "VALUES (?, ?, ?, ?, ?, ?)",
      [timestamp, CONFIG.serverUrl, 0, latencyMs, 0, String(e)]
    );

    // Notify on first failure
    if (CONSECUTIVE_FAILS === 1 && CONFIG.notifyOnDown) {
      WAS_DOWN = true;
      sendNotification(
        "Server Down",
        CONFIG.serverUrl + " is unreachable: " + e
      );
    }
  }

  // Persist counters periodically (every 10 pings)
  if (PING_COUNT % 10 === 0) {
    store.set("counters", { pingCount: PING_COUNT, failCount: FAIL_COUNT });
  }

  // Publish state to frontend
  publishState();

  // Append to data log file (last 100 entries summary)
  appendDataLog(timestamp);
}

// ---------------------------------------------------------------------------
// State publishing (real-time frontend updates)
// ---------------------------------------------------------------------------

function publishState() {
  var uptimePct = PING_COUNT > 0
    ? Math.round(((PING_COUNT - FAIL_COUNT) / PING_COUNT) * 10000) / 100
    : 100;

  // Get latest latency from DB
  var latest = db.get(
    "SELECT latency_ms, status, success FROM ping_log ORDER BY id DESC LIMIT 1",
    []
  );

  state.setPartial({
    status: CONSECUTIVE_FAILS > 0 ? "down" : "healthy",
    pingCount: PING_COUNT,
    failCount: FAIL_COUNT,
    consecutiveFails: CONSECUTIVE_FAILS,
    uptimePercent: uptimePct,
    lastLatencyMs: latest ? latest.latency_ms : null,
    lastStatus: latest ? latest.status : null,
    serverUrl: CONFIG.serverUrl,
    activeSessions: ACTIVE_SESSIONS.length,
    platform: platform.os(),
  });
}

// ---------------------------------------------------------------------------
// Data file logging
// ---------------------------------------------------------------------------

function appendDataLog(timestamp) {
  var recent = db.all(
    "SELECT timestamp, status, latency_ms, success, error " +
    "FROM ping_log ORDER BY id DESC LIMIT 20",
    []
  );

  var lines = ["# Ping Log (last 20 entries)", "# Generated: " + timestamp, ""];
  for (var i = 0; i < recent.length; i++) {
    var r = recent[i];
    var statusStr = r.success ? "OK " + r.status : "FAIL";
    lines.push(r.timestamp + " | " + statusStr + " | " + r.latency_ms + "ms" +
      (r.error ? " | " + r.error : ""));
  }
  data.write("ping-log.txt", lines.join("\n"));
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function sendNotification(title, body) {
  var os = platform.os();
  if (os === "android" || os === "ios") {
    console.log("[server-ping] Notification (mobile, skipped): " + title + " — " + body);
    return;
  }
  try {
    platform.notify(title, body);
  } catch (e) {
    console.warn("[server-ping] Notification failed: " + e);
  }
}

// ---------------------------------------------------------------------------
// Tools (callable by AI and other skills)
// ---------------------------------------------------------------------------

globalThis.tools = [
  {
    name: "get-ping-stats",
    description: "Get current ping statistics including uptime, total pings, failures, and latest latency.",
    input_schema: {
      type: "object",
      properties: {},
    },
    execute: function () {
      var uptimePct = PING_COUNT > 0
        ? Math.round(((PING_COUNT - FAIL_COUNT) / PING_COUNT) * 10000) / 100
        : 100;
      var latest = db.get(
        "SELECT latency_ms, status, timestamp FROM ping_log ORDER BY id DESC LIMIT 1",
        []
      );
      var avgLatency = db.get(
        "SELECT AVG(latency_ms) as avg_ms FROM ping_log WHERE success = 1",
        []
      );
      return JSON.stringify({
        serverUrl: CONFIG.serverUrl,
        totalPings: PING_COUNT,
        totalFailures: FAIL_COUNT,
        consecutiveFailures: CONSECUTIVE_FAILS,
        uptimePercent: uptimePct,
        lastPing: latest
          ? { latencyMs: latest.latency_ms, status: latest.status, at: latest.timestamp }
          : null,
        avgLatencyMs: avgLatency ? Math.round(avgLatency.avg_ms) : null,
        platform: platform.os(),
      });
    },
  },

  {
    name: "get-ping-history",
    description: "Get recent ping history from the database. Returns the last N ping results.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of recent pings to return (default 20, max 100)",
        },
      },
    },
    execute: function (args) {
      var limit = Math.min(Math.max(parseInt(args.limit) || 20, 1), 100);
      var rows = db.all(
        "SELECT timestamp, url, status, latency_ms, success, error " +
        "FROM ping_log ORDER BY id DESC LIMIT ?",
        [limit]
      );
      return JSON.stringify({ count: rows.length, history: rows });
    },
  },

  {
    name: "ping-now",
    description: "Trigger an immediate ping to the configured server and return the result.",
    input_schema: {
      type: "object",
      properties: {},
    },
    execute: function () {
      var before = PING_COUNT;
      doPing();
      var latest = db.get(
        "SELECT timestamp, status, latency_ms, success, error " +
        "FROM ping_log ORDER BY id DESC LIMIT 1",
        []
      );
      return JSON.stringify({
        triggered: true,
        pingNumber: PING_COUNT,
        result: latest,
      });
    },
  },

  {
    name: "list-peer-skills",
    description: "List all other running skills in the system (demonstrates inter-skill communication).",
    input_schema: {
      type: "object",
      properties: {},
    },
    execute: function () {
      try {
        var peers = skills.list();
        return JSON.stringify({ skills: peers });
      } catch (e) {
        return JSON.stringify({ error: String(e), skills: [] });
      }
    },
  },

  {
    name: "update-server-url",
    description: "Change the monitored server URL at runtime.",
    input_schema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "New server URL to monitor",
        },
      },
      required: ["url"],
    },
    execute: function (args) {
      var url = (args.url || "").trim();
      if (!url || url.indexOf("http") !== 0) {
        return JSON.stringify({ error: "Invalid URL — must start with http:// or https://" });
      }
      var oldUrl = CONFIG.serverUrl;
      CONFIG.serverUrl = url;
      store.set("config", CONFIG);
      console.log("[server-ping] Server URL changed: " + oldUrl + " -> " + url);
      publishState();
      return JSON.stringify({ success: true, oldUrl: oldUrl, newUrl: url });
    },
  },

  {
    name: "read-config",
    description: "Read the current skill configuration from the data directory (demonstrates data file I/O).",
    input_schema: {
      type: "object",
      properties: {},
    },
    execute: function () {
      try {
        var raw = data.read("config.json");
        return raw || JSON.stringify({ error: "No config file found" });
      } catch (e) {
        return JSON.stringify({ error: "Failed to read config: " + e });
      }
    },
  },
];
