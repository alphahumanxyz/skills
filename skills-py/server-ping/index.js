// server-ping/index.js
// Pings the backend server every 5 seconds to verify background execution.

var BACKEND_URL = "http://10.0.2.2:5005";
var PING_COUNT = 0;

function init() {
  console.log("[server-ping] Initializing — target: " + BACKEND_URL);
}

function start() {
  console.log("[server-ping] Started — registering 5s cron");
  cron.register("ping", "*/5 * * * * *");
}

function stop() {
  console.log("[server-ping] Stopping — unregistering cron");
  cron.unregister("ping");
}

function onCronTrigger(scheduleId) {
  if (scheduleId !== "ping") return;

  PING_COUNT++;
  console.log("[server-ping] Ping #" + PING_COUNT + " -> GET " + BACKEND_URL + "/");

  try {
    var response = net.fetch(BACKEND_URL + "/", {
      method: "GET",
      timeout: 5,
    });
    console.log(
      "[server-ping] Pong #" + PING_COUNT + " <- " + response.status
    );
  } catch (e) {
    console.error("[server-ping] Ping #" + PING_COUNT + " failed: " + e);
  }
}

globalThis.tools = [];
