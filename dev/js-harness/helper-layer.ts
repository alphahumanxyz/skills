// helper-layer.ts — JS wrapper layer from skill_instance.rs:831-932.
// Wraps the raw __-prefixed bridge objects into the friendly globalThis API.
// This is a verbatim port of the Rust-evaluated JS code.

(globalThis as any).db = {
  exec: function (sql: string, params?: unknown[]) {
    return (globalThis as any).__db.exec(
      sql,
      params ? JSON.stringify(params) : undefined,
    );
  },
  get: function (sql: string, params?: unknown[]) {
    var result = (globalThis as any).__db.get(
      sql,
      params ? JSON.stringify(params) : undefined,
    );
    return JSON.parse(result);
  },
  all: function (sql: string, params?: unknown[]) {
    var result = (globalThis as any).__db.all(
      sql,
      params ? JSON.stringify(params) : undefined,
    );
    return JSON.parse(result);
  },
  kvGet: function (key: string) {
    var result = (globalThis as any).__db.kvGet(key);
    return JSON.parse(result);
  },
  kvSet: function (key: string, value: unknown) {
    return (globalThis as any).__db.kvSet(key, JSON.stringify(value));
  },
};

(globalThis as any).store = {
  get: function (key: string) {
    var result = (globalThis as any).__store.get(key);
    return JSON.parse(result);
  },
  set: function (key: string, value: unknown) {
    return (globalThis as any).__store.set(key, JSON.stringify(value));
  },
  delete: function (key: string) {
    return (globalThis as any).__store.delete(key);
  },
  keys: function () {
    var result = (globalThis as any).__store.keys();
    return JSON.parse(result);
  },
};

(globalThis as any).net = {
  fetch: function (url: string, options?: Record<string, unknown>) {
    var result = (globalThis as any).__net.fetch(
      url,
      options ? JSON.stringify(options) : "{}",
    );
    return JSON.parse(result);
  },
};

(globalThis as any).cron = {
  register: function (scheduleId: string, cronExpr: string) {
    return (globalThis as any).__cron.register(scheduleId, cronExpr);
  },
  unregister: function (scheduleId: string) {
    return (globalThis as any).__cron.unregister(scheduleId);
  },
  list: function () {
    var result = (globalThis as any).__cron.list();
    return JSON.parse(result);
  },
};

(globalThis as any).skills = {
  list: function () {
    var result = (globalThis as any).__skills.list();
    return JSON.parse(result);
  },
  callTool: function (
    skillId: string,
    toolName: string,
    args?: Record<string, unknown>,
  ) {
    var result = (globalThis as any).__skills.callTool(
      skillId,
      toolName,
      args ? JSON.stringify(args) : "{}",
    );
    return JSON.parse(result);
  },
};

(globalThis as any).platform = {
  os: function () {
    return (globalThis as any).__platform.os();
  },
  env: function (key: string) {
    return (globalThis as any).__platform.env(key);
  },
  notify: function (title: string, body?: string) {
    if (typeof (globalThis as any).__platform.notify === "function") {
      return (globalThis as any).__platform.notify(title, body || "");
    }
    throw new Error("Notifications not available");
  },
};

(globalThis as any).state = {
  get: function (key: string) {
    var result = (globalThis as any).__state.get(key);
    return JSON.parse(result);
  },
  set: function (key: string, value: unknown) {
    return (globalThis as any).__state.set(key, JSON.stringify(value));
  },
  setPartial: function (partial: Record<string, unknown>) {
    return (globalThis as any).__state.setPartial(JSON.stringify(partial));
  },
};

(globalThis as any).data = {
  read: function (filename: string) {
    return (globalThis as any).__data.read(filename);
  },
  write: function (filename: string, content: string) {
    return (globalThis as any).__data.write(filename, content);
  },
};
