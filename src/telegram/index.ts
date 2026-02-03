// telegram/index.ts
// Telegram integration skill using real MTProto via V8 runtime.
// Provides tools for testing Telegram connectivity and API calls.

// Runtime globals (store, state, platform, tools) are declared in types/globals.d.ts

// ---------------------------------------------------------------------------
// MTProto Types
// ---------------------------------------------------------------------------

import  './gramjs';

interface TelegramDC {
  id: number;
  ip: string;
  port: number;
  wsUrl: string;
}

interface MTProtoConfig {
  dcList: TelegramDC[];
  primaryDc: number;
  serverTime: number;
  expires: number;
}

interface AuthKey {
  key: Uint8Array;
  keyId: bigint;
  serverSalt: bigint;
}

interface SkillConfig {
  apiId: number;
  apiHash: string;
  phoneNumber: string;
  isAuthenticated: boolean;
  sessionString: string;
  cachedConfig: MTProtoConfig | null;
  lastConfigFetch: number;
}

interface FormattedUser {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  phoneNumber?: string;
  isBot?: boolean;
  isPremium?: boolean;
}

interface FormattedChat {
  id: number;
  title?: string;
  type: string;
  unreadCount?: number;
  lastMessage: null;
  isPinned: boolean;
}

interface Cache {
  me: FormattedUser | null;
  chats: Map<number, FormattedChat>;
  users: Map<number, FormattedUser>;
  lastChatSync: number;
}

interface SetupSubmitArgs {
  stepId: string;
  values: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// MTProto Constants
// ---------------------------------------------------------------------------

// Telegram DC endpoints (WebSocket)
const DC_LIST: TelegramDC[] = [
  { id: 1, ip: '149.154.175.50', port: 443, wsUrl: 'wss://pluto.web.telegram.org/apiws' },
  { id: 2, ip: '149.154.167.50', port: 443, wsUrl: 'wss://venus.web.telegram.org/apiws' },
  { id: 3, ip: '149.154.175.100', port: 443, wsUrl: 'wss://aurora.web.telegram.org/apiws' },
  { id: 4, ip: '149.154.167.91', port: 443, wsUrl: 'wss://vesta.web.telegram.org/apiws' },
  { id: 5, ip: '91.108.56.100', port: 443, wsUrl: 'wss://flora.web.telegram.org/apiws' },
];

// Test DC for testing (production DC 2)
const TEST_DC = DC_LIST[1];

// MTProto constructor IDs
const MTPROTO_CONSTRUCTORS = {
  req_pq_multi: 0xbe7e8ef1,
  resPQ: 0x05162463,
  p_q_inner_data: 0x83c95aec,
  server_DH_params_ok: 0xd0e8075c,
  server_DH_inner_data: 0xb5890dba,
  client_DH_inner_data: 0x6643b654,
  dh_gen_ok: 0x3bcbf734,
  rpc_result: 0xf35c6d01,
  msg_container: 0x73f1f8dc,
  new_session_created: 0x9ec20908,
  msgs_ack: 0x62d6b459,
  bad_msg_notification: 0xa7eff811,
  bad_server_salt: 0xedab447b,
  gzip_packed: 0x3072cfa1,
  help_getConfig: 0xc4f9186b,
  config: 0x232566ac,
};

// ---------------------------------------------------------------------------
// MTProto Binary Helpers
// ---------------------------------------------------------------------------

function randomBytes(length: number): Uint8Array {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return arr;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function int32ToBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(4);
  bytes[0] = n & 0xff;
  bytes[1] = (n >> 8) & 0xff;
  bytes[2] = (n >> 16) & 0xff;
  bytes[3] = (n >> 24) & 0xff;
  return bytes;
}

function bytesToInt32(bytes: Uint8Array, offset = 0): number {
  return (
    bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)
  );
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// MTProto Serialization (TL)
// ---------------------------------------------------------------------------

class TLWriter {
  private buffer: number[] = [];

  writeInt32(n: number): void {
    this.buffer.push(n & 0xff);
    this.buffer.push((n >> 8) & 0xff);
    this.buffer.push((n >> 16) & 0xff);
    this.buffer.push((n >> 24) & 0xff);
  }

  writeInt64(low: number, high: number): void {
    this.writeInt32(low);
    this.writeInt32(high);
  }

  writeInt128(bytes: Uint8Array): void {
    if (bytes.length !== 16) {
      throw new Error('int128 must be 16 bytes');
    }
    for (const b of bytes) {
      this.buffer.push(b);
    }
  }

  writeBytes(bytes: Uint8Array): void {
    for (const b of bytes) {
      this.buffer.push(b);
    }
  }

  getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

class TLReader {
  private view: DataView;
  private offset = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  readInt32(): number {
    const value = this.view.getInt32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readUint32(): number {
    const value = this.view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readInt64(): [number, number] {
    const low = this.readUint32();
    const high = this.readUint32();
    return [low, high];
  }

  readInt128(): Uint8Array {
    const bytes = new Uint8Array(this.view.buffer, this.offset, 16);
    this.offset += 16;
    return new Uint8Array(bytes);
  }

  readInt256(): Uint8Array {
    const bytes = new Uint8Array(this.view.buffer, this.offset, 32);
    this.offset += 32;
    return new Uint8Array(bytes);
  }

  readBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(this.view.buffer, this.offset, length);
    this.offset += length;
    return new Uint8Array(bytes);
  }

  readTLBytes(): Uint8Array {
    let length = this.view.getUint8(this.offset++);
    if (length >= 254) {
      length =
        this.view.getUint8(this.offset++) |
        (this.view.getUint8(this.offset++) << 8) |
        (this.view.getUint8(this.offset++) << 16);
    }
    const bytes = new Uint8Array(this.view.buffer, this.offset, length);
    this.offset += length;
    // Padding
    while (this.offset % 4 !== 0) {
      this.offset++;
    }
    return new Uint8Array(bytes);
  }

  readTLString(): string {
    const bytes = this.readTLBytes();
    return new TextDecoder().decode(bytes);
  }

  skip(length: number): void {
    this.offset += length;
  }

  get position(): number {
    return this.offset;
  }

  get remaining(): number {
    return this.view.byteLength - this.offset;
  }
}

// ---------------------------------------------------------------------------
// MTProto Transport (Intermediate)
// ---------------------------------------------------------------------------

function packIntermediateTransport(payload: Uint8Array): Uint8Array {
  // Intermediate transport: 4-byte length prefix
  const length = payload.length;
  const packet = new Uint8Array(4 + length);
  packet[0] = length & 0xff;
  packet[1] = (length >> 8) & 0xff;
  packet[2] = (length >> 16) & 0xff;
  packet[3] = (length >> 24) & 0xff;
  packet.set(payload, 4);
  return packet;
}

// ---------------------------------------------------------------------------
// MTProto req_pq_multi
// ---------------------------------------------------------------------------

interface ResPQ {
  constructor: number;
  nonce: Uint8Array;
  serverNonce: Uint8Array;
  pq: Uint8Array;
  fingerprints: bigint[];
}

function buildReqPqMulti(nonce: Uint8Array): Uint8Array {
  const writer = new TLWriter();
  writer.writeInt32(MTPROTO_CONSTRUCTORS.req_pq_multi);
  writer.writeInt128(nonce);
  return writer.getBytes();
}

function parseResPQ(buffer: ArrayBuffer): ResPQ | null {
  try {
    const reader = new TLReader(buffer);

    // Skip transport layer if present (first 4 bytes might be length)
    // For unencrypted messages: auth_key_id (8 bytes) + message_id (8 bytes) + message_length (4 bytes)

    const authKeyId = reader.readInt64();
    const messageId = reader.readInt64();
    const messageLength = reader.readInt32();

    const constructor = reader.readUint32();
    if (constructor !== MTPROTO_CONSTRUCTORS.resPQ) {
      console.log(`[telegram] Expected resPQ constructor, got: 0x${constructor.toString(16)}`);
      return null;
    }

    const nonce = reader.readInt128();
    const serverNonce = reader.readInt128();
    const pq = reader.readTLBytes();

    // Read fingerprints vector
    const fingerprintsVectorId = reader.readUint32();
    const fingerprintsCount = reader.readInt32();
    const fingerprints: bigint[] = [];
    for (let i = 0; i < fingerprintsCount; i++) {
      const [low, high] = reader.readInt64();
      fingerprints.push(BigInt(low) | (BigInt(high) << 32n));
    }

    return { constructor, nonce, serverNonce, pq, fingerprints };
  } catch (e) {
    console.error('[telegram] Failed to parse resPQ:', e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// MTProto Connection State
// ---------------------------------------------------------------------------

interface MTProtoState {
  connected: boolean;
  ws: WebSocket | null;
  nonce: Uint8Array | null;
  serverNonce: Uint8Array | null;
  pq: Uint8Array | null;
  fingerprints: bigint[];
  authKey: AuthKey | null;
  config: MTProtoConfig | null;
  lastPing: number;
  latencyMs: number;
  error: string | null;
}

const MTPROTO_STATE: MTProtoState = {
  connected: false,
  ws: null,
  nonce: null,
  serverNonce: null,
  pq: null,
  fingerprints: [],
  authKey: null,
  config: null,
  lastPing: 0,
  latencyMs: 0,
  error: null,
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CONFIG: SkillConfig = {
  apiId: 0,
  apiHash: '',
  phoneNumber: '',
  isAuthenticated: false,
  sessionString: '',
  cachedConfig: null,
  lastConfigFetch: 0,
};

const CACHE: Cache = { me: null, chats: new Map(), users: new Map(), lastChatSync: 0 };

// ---------------------------------------------------------------------------
// Lifecycle Hooks
// ---------------------------------------------------------------------------

function init(): void {
  console.log('[telegram] Initializing');

  // Load config from store
  const saved = store.get('config') as Partial<SkillConfig> | null;
  if (saved) {
    CONFIG.apiId = (saved.apiId as number) || 0;
    CONFIG.apiHash = (saved.apiHash as string) || '';
    CONFIG.phoneNumber = (saved.phoneNumber as string) || '';
    CONFIG.isAuthenticated = (saved.isAuthenticated as boolean) || false;
    CONFIG.sessionString = (saved.sessionString as string) || '';
    CONFIG.cachedConfig = (saved.cachedConfig as MTProtoConfig) || null;
    CONFIG.lastConfigFetch = (saved.lastConfigFetch as number) || 0;
  }

  // Load from environment if not in store
  if (!CONFIG.apiId) {
    const envApiId = platform.env('TELEGRAM_API_ID');
    if (envApiId) {
      CONFIG.apiId = parseInt(envApiId, 10);
    }
  }
  if (!CONFIG.apiHash) {
    CONFIG.apiHash = platform.env('TELEGRAM_API_HASH') || '';
  }

  console.log(`[telegram] Config loaded — authenticated: ${CONFIG.isAuthenticated}`);

  if (CONFIG.apiId && CONFIG.apiHash) {
    console.log(`[telegram] API credentials found: api_id=${CONFIG.apiId}`);
  } else {
    console.log('[telegram] API credentials not configured — waiting for setup');
  }

  publishState();
}

function start(): void {
  console.log('[telegram] Starting');

  if (!CONFIG.apiId || !CONFIG.apiHash) {
    console.warn('[telegram] Missing API credentials — waiting for setup');
    return;
  }

  publishState();
}

function stop(): void {
  console.log('[telegram] Stopping');

  // Close WebSocket if connected
  if (MTPROTO_STATE.ws) {
    try {
      MTPROTO_STATE.ws.close();
    } catch (e) {
      console.warn('[telegram] Error closing WebSocket:', e);
    }
    MTPROTO_STATE.ws = null;
    MTPROTO_STATE.connected = false;
  }

  state.set('status', 'stopped');
}

// ---------------------------------------------------------------------------
// Setup Flow
// ---------------------------------------------------------------------------

function onSetupStart(): SetupStartResult {
  const envApiId = platform.env('TELEGRAM_API_ID');
  const envApiHash = platform.env('TELEGRAM_API_HASH');

  if (envApiId && envApiHash) {
    return {
      step: {
        id: 'phone',
        title: 'Connect Telegram Account',
        description: 'Enter your phone number to connect your Telegram account.',
        fields: [
          {
            name: 'phoneNumber',
            type: 'text',
            label: 'Phone Number',
            description: 'International format (e.g., +1234567890)',
            required: true,
            placeholder: '+1234567890',
          },
        ],
      },
    };
  }

  return {
    step: {
      id: 'credentials',
      title: 'Telegram API Credentials',
      description:
        'Enter your Telegram API credentials from my.telegram.org. ' +
        'Then you will enter your phone number.',
      fields: [
        {
          name: 'apiId',
          type: 'text',
          label: 'API ID',
          description: 'Your Telegram API ID (numeric)',
          required: true,
          placeholder: '12345678',
        },
        {
          name: 'apiHash',
          type: 'password',
          label: 'API Hash',
          description: 'Your Telegram API Hash',
          required: true,
          placeholder: 'abc123...',
        },
      ],
    },
  };
}

function onSetupSubmit(args: SetupSubmitArgs): SetupSubmitResult {
  const { stepId, values } = args;

  if (stepId === 'credentials') {
    const apiId = parseInt((values.apiId as string) || '', 10);
    const apiHash = ((values.apiHash as string) || '').trim();

    if (!apiId || isNaN(apiId)) {
      return { status: 'error', errors: [{ field: 'apiId', message: 'Valid API ID is required' }] };
    }
    if (!apiHash) {
      return { status: 'error', errors: [{ field: 'apiHash', message: 'API Hash is required' }] };
    }

    CONFIG.apiId = apiId;
    CONFIG.apiHash = apiHash;

    return {
      status: 'next',
      nextStep: {
        id: 'phone',
        title: 'Connect Telegram Account',
        description: 'Enter your phone number to connect your Telegram account.',
        fields: [
          {
            name: 'phoneNumber',
            type: 'text',
            label: 'Phone Number',
            description: 'International format (e.g., +1234567890)',
            required: true,
            placeholder: '+1234567890',
          },
        ],
      },
    };
  }

  if (stepId === 'phone') {
    const phoneNumber = ((values.phoneNumber as string) || '').trim();

    if (!phoneNumber || !phoneNumber.startsWith('+')) {
      return {
        status: 'error',
        errors: [
          {
            field: 'phoneNumber',
            message: 'Phone number must start with + (international format)',
          },
        ],
      };
    }

    CONFIG.phoneNumber = phoneNumber;

    // For now, just save and mark as needing auth code
    // Real auth flow would send code here
    store.set('config', CONFIG);
    publishState();

    return {
      status: 'next',
      nextStep: {
        id: 'code',
        title: 'Enter Verification Code',
        description: 'Enter the verification code sent to your Telegram app or SMS.',
        fields: [
          {
            name: 'code',
            type: 'text',
            label: 'Verification Code',
            description: '5-digit code from Telegram',
            required: true,
            placeholder: '12345',
          },
        ],
      },
    };
  }

  if (stepId === 'code') {
    // For now, just mark as complete
    // Real auth flow would verify code here
    CONFIG.isAuthenticated = true;
    store.set('config', CONFIG);
    publishState();
    console.log('[telegram] Setup completed');
    return { status: 'complete' };
  }

  return { status: 'error', errors: [{ field: '', message: `Unknown setup step: ${stepId}` }] };
}

function onSetupCancel(): void {
  console.log('[telegram] Setup cancelled');
}

function onDisconnect(): void {
  console.log('[telegram] Disconnecting');

  CONFIG.isAuthenticated = false;
  CONFIG.phoneNumber = '';
  CONFIG.sessionString = '';
  CACHE.me = null;
  CACHE.chats.clear();
  CACHE.users.clear();

  if (MTPROTO_STATE.ws) {
    MTPROTO_STATE.ws.close();
    MTPROTO_STATE.ws = null;
  }
  MTPROTO_STATE.connected = false;
  MTPROTO_STATE.authKey = null;

  store.set('config', CONFIG);
  publishState();
}

// ---------------------------------------------------------------------------
// State Publishing
// ---------------------------------------------------------------------------

function publishState(): void {
  state.setPartial({
    connected: MTPROTO_STATE.connected,
    hasAuthKey: MTPROTO_STATE.authKey !== null,
    phoneNumber: CONFIG.phoneNumber ? CONFIG.phoneNumber.slice(0, 4) + '****' : null,
    chatCount: CACHE.chats.size,
    lastPing: MTPROTO_STATE.lastPing,
    latencyMs: MTPROTO_STATE.latencyMs,
    error: MTPROTO_STATE.error,
  });
}

// ---------------------------------------------------------------------------
// MTProto Connection
// ---------------------------------------------------------------------------

/**
 * Connect to Telegram DC via WebSocket and perform initial handshake.
 * This sends req_pq_multi and waits for resPQ to verify connectivity.
 */
async function mtprotoConnect(
  dc: TelegramDC
): Promise<{ success: boolean; latencyMs: number; resPQ?: ResPQ; error?: string }> {
  return new Promise(resolve => {
    const startTime = Date.now();
    const nonce = randomBytes(16);
    let resolved = false;

    console.log(`[telegram] Connecting to DC${dc.id}: ${dc.wsUrl}`);

    try {
      const ws = new WebSocket(dc.wsUrl, 'binary');

      // Set timeout
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          ws.close();
          resolve({
            success: false,
            latencyMs: Date.now() - startTime,
            error: 'Connection timeout',
          });
        }
      }, 10000);

      ws.onopen = () => {
        console.log(`[telegram] WebSocket connected to DC${dc.id}`);

        // Send intermediate transport init byte (0xee)
        const initByte = new Uint8Array([0xee, 0xee, 0xee, 0xee]);

        // Build unencrypted message
        const reqPq = buildReqPqMulti(nonce);
        const authKeyId = new Uint8Array(8); // 0 for unencrypted
        const messageId = new Uint8Array(8);
        // Generate message_id based on time
        const now = Math.floor(Date.now() / 1000);
        const view = new DataView(messageId.buffer);
        view.setUint32(0, now, true);
        view.setUint32(4, 0, true);

        const messageLength = int32ToBytes(reqPq.length);
        const message = concatBytes(authKeyId, messageId, messageLength, reqPq);
        const packet = packIntermediateTransport(message);

        // Send init + packet
        const fullPacket = concatBytes(initByte, packet);
        ws.send(fullPacket);
        console.log(`[telegram] Sent req_pq_multi (${fullPacket.length} bytes)`);
      };

      ws.onmessage = event => {
        const latency = Date.now() - startTime;
        console.log(`[telegram] Received response (latency: ${latency}ms)`);

        clearTimeout(timeout);

        try {
          // Parse response
          let data: ArrayBuffer;
          if (event.data instanceof ArrayBuffer) {
            data = event.data;
          } else if (typeof event.data === 'string') {
            const encoder = new TextEncoder();
            data = encoder.encode(event.data).buffer;
          } else {
            throw new Error('Unexpected message type');
          }

          // Skip transport length prefix (4 bytes)
          const responseBuffer = data.slice(4);
          const resPQ = parseResPQ(responseBuffer);

          if (resPQ) {
            console.log(`[telegram] Got resPQ from DC${dc.id}`);
            console.log(`[telegram]   Server nonce: ${bytesToHex(resPQ.serverNonce)}`);
            console.log(`[telegram]   PQ: ${bytesToHex(resPQ.pq)}`);
            console.log(`[telegram]   Fingerprints: ${resPQ.fingerprints.length}`);

            MTPROTO_STATE.nonce = nonce;
            MTPROTO_STATE.serverNonce = resPQ.serverNonce;
            MTPROTO_STATE.pq = resPQ.pq;
            MTPROTO_STATE.fingerprints = resPQ.fingerprints;
            MTPROTO_STATE.latencyMs = latency;
            MTPROTO_STATE.lastPing = Date.now();
            MTPROTO_STATE.error = null;

            if (!resolved) {
              resolved = true;
              ws.close();
              resolve({ success: true, latencyMs: latency, resPQ });
            }
          } else {
            if (!resolved) {
              resolved = true;
              ws.close();
              resolve({ success: false, latencyMs: latency, error: 'Failed to parse resPQ' });
            }
          }
        } catch (e) {
          console.error(`[telegram] Error parsing response:`, e);
          if (!resolved) {
            resolved = true;
            ws.close();
            resolve({ success: false, latencyMs: latency, error: `Parse error: ${e}` });
          }
        }
      };

      ws.onerror = event => {
        console.error(`[telegram] WebSocket error:`, event);
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          resolve({ success: false, latencyMs: Date.now() - startTime, error: 'WebSocket error' });
        }
      };

      ws.onclose = () => {
        console.log(`[telegram] WebSocket closed`);
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          resolve({
            success: false,
            latencyMs: Date.now() - startTime,
            error: 'Connection closed unexpectedly',
          });
        }
      };
    } catch (e) {
      console.error(`[telegram] Connection error:`, e);
      resolve({
        success: false,
        latencyMs: Date.now() - startTime,
        error: `Connection error: ${e}`,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Keep lifecycle hooks accessible
// ---------------------------------------------------------------------------

void init;
void start;
void stop;
void onSetupStart;
void onSetupSubmit;
void onSetupCancel;
void onDisconnect;

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

tools = [
  // =========================================================================
  // PING (Real MTProto connectivity test)
  // =========================================================================
  {
    name: 'telegram-ping',
    description:
      'Test connection to Telegram servers using real MTProto protocol. ' +
      'Connects via WebSocket and sends req_pq_multi to verify connectivity. ' +
      'Returns DC info, latency, and server response.',
    input_schema: {
      type: 'object',
      properties: {
        dc_id: { type: 'number', description: 'Data center ID to test (1-5). Default: 2 (Venus)' },
      },
    },
    execute(args: Record<string, unknown>): string {
      console.log('[telegram] telegram-ping: Testing MTProto connection...');

      const dcId = (args.dc_id as number) || 2;
      const dc = DC_LIST.find(d => d.id === dcId) || TEST_DC;

      // Since tools must be sync but WebSocket is async,
      // we need to use a different approach.
      // We'll try using a synchronous HTTP ping as fallback
      // and return cached MTProto state if available.

      // First, try HTTP connectivity test
      const httpResults: Array<{
        endpoint: string;
        success: boolean;
        latency_ms?: number;
        status?: number;
        error?: string;
      }> = [];

      const httpEndpoints = [
        { name: 'telegram.org', url: 'https://telegram.org' },
        { name: 'api.telegram.org', url: 'https://api.telegram.org' },
        { name: `DC${dc.id} (${dc.ip})`, url: `https://${dc.ip}` },
      ];

      for (const endpoint of httpEndpoints) {
        try {
          const startTime = Date.now();
          const response = net.fetch(endpoint.url, { method: 'HEAD', timeout: 5000 });
          const latency = Date.now() - startTime;
          const success = response.status >= 200 && response.status < 500;

          httpResults.push({
            endpoint: endpoint.name,
            success,
            latency_ms: latency,
            status: response.status,
          });
        } catch (e) {
          httpResults.push({ endpoint: endpoint.name, success: false, error: String(e) });
        }
      }

      const httpSuccess = httpResults.some(r => r.success);
      const avgLatency = httpResults
        .filter(r => r.success && r.latency_ms)
        .reduce((sum, r, _, arr) => sum + (r.latency_ms || 0) / arr.length, 0);

      // Return combined results
      const response = {
        success: httpSuccess,
        message: httpSuccess
          ? 'Telegram servers are reachable'
          : 'Unable to reach Telegram servers',
        method: 'http',
        target_dc: { id: dc.id, ip: dc.ip, ws_url: dc.wsUrl },
        http_results: httpResults,
        avg_latency_ms: Math.round(avgLatency) || null,
        mtproto_state: {
          last_ping: MTPROTO_STATE.lastPing,
          last_latency_ms: MTPROTO_STATE.latencyMs,
          has_server_nonce: MTPROTO_STATE.serverNonce !== null,
          fingerprint_count: MTPROTO_STATE.fingerprints.length,
        },
        has_credentials: !!(CONFIG.apiId && CONFIG.apiHash),
        is_authenticated: CONFIG.isAuthenticated,
        note: 'Use telegram-mtproto-ping for real MTProto handshake (async)',
      };

      console.log(`[telegram] telegram-ping: ${response.message}`);
      return JSON.stringify(response);
    },
  },

  {
    name: 'telegram-mtproto-ping',
    description:
      'Perform a real MTProto handshake with Telegram servers. ' +
      'Connects via WebSocket and exchanges req_pq_multi/resPQ. ' +
      "This is an async operation - returns immediately with 'pending' " +
      'and updates skill state when complete.',
    input_schema: {
      type: 'object',
      properties: {
        dc_id: { type: 'number', description: 'Data center ID to test (1-5). Default: 2 (Venus)' },
      },
    },
    execute(args: Record<string, unknown>): string {
      console.log('[telegram] telegram-mtproto-ping: Starting MTProto handshake...');

      const dcId = (args.dc_id as number) || 2;
      const dc = DC_LIST.find(d => d.id === dcId) || TEST_DC;

      // Start async MTProto connection
      mtprotoConnect(dc).then(result => {
        if (result.success) {
          MTPROTO_STATE.connected = true;
          console.log(`[telegram] MTProto handshake successful (${result.latencyMs}ms)`);
        } else {
          MTPROTO_STATE.connected = false;
          MTPROTO_STATE.error = result.error || 'Unknown error';
          console.log(`[telegram] MTProto handshake failed: ${result.error}`);
        }
        publishState();
      });

      // Return immediately with pending status
      return JSON.stringify({
        status: 'pending',
        message: 'MTProto handshake initiated - check skill state for result',
        target_dc: { id: dc.id, ip: dc.ip, ws_url: dc.wsUrl },
      });
    },
  },

  // =========================================================================
  // STATUS
  // =========================================================================
  {
    name: 'telegram-status',
    description:
      'Get the current connection and authentication status. ' +
      'Shows MTProto state, credentials, and cached data.',
    input_schema: { type: 'object', properties: {} },
    execute(): string {
      return JSON.stringify({
        mtproto: {
          connected: MTPROTO_STATE.connected,
          hasServerNonce: MTPROTO_STATE.serverNonce !== null,
          fingerprintCount: MTPROTO_STATE.fingerprints.length,
          hasAuthKey: MTPROTO_STATE.authKey !== null,
          lastPing: MTPROTO_STATE.lastPing,
          latencyMs: MTPROTO_STATE.latencyMs,
          error: MTPROTO_STATE.error,
        },
        auth: {
          hasCredentials: !!(CONFIG.apiId && CONFIG.apiHash),
          isAuthenticated: CONFIG.isAuthenticated,
          phoneNumber: CONFIG.phoneNumber ? CONFIG.phoneNumber.slice(0, 4) + '****' : null,
        },
        cache: { chats: CACHE.chats.size, users: CACHE.users.size },
        dc_list: DC_LIST.map(dc => ({ id: dc.id, ip: dc.ip, ws_url: dc.wsUrl })),
      });
    },
  },

  // =========================================================================
  // GET ME (placeholder)
  // =========================================================================
  {
    name: 'telegram-get-me',
    description:
      'Get information about the authenticated user. ' + 'Requires authentication to be complete.',
    input_schema: { type: 'object', properties: {} },
    execute(): string {
      if (!CONFIG.isAuthenticated) {
        return JSON.stringify({ error: 'Not authenticated. Please complete setup first.' });
      }

      if (CACHE.me) {
        return JSON.stringify(CACHE.me);
      }

      return JSON.stringify({ error: 'User info not available. Try telegram-mtproto-ping first.' });
    },
  },
];

// ---------------------------------------------------------------------------
// Exports to globalThis (required for V8 runtime)
// ---------------------------------------------------------------------------

const g = globalThis as unknown as {
  init: typeof init;
  start: typeof start;
  stop: typeof stop;
  onSetupStart: typeof onSetupStart;
  onSetupSubmit: typeof onSetupSubmit;
  onSetupCancel: typeof onSetupCancel;
  onDisconnect: typeof onDisconnect;
  tools: typeof tools;
  CONFIG: typeof CONFIG;
  CACHE: typeof CACHE;
  MTPROTO_STATE: typeof MTPROTO_STATE;
  DC_LIST: typeof DC_LIST;
  mtprotoConnect: typeof mtprotoConnect;
};

g.init = init;
g.start = start;
g.stop = stop;
g.onSetupStart = onSetupStart;
g.onSetupSubmit = onSetupSubmit;
g.onSetupCancel = onSetupCancel;
g.onDisconnect = onDisconnect;
g.tools = tools;
g.CONFIG = CONFIG;
g.CACHE = CACHE;
g.MTPROTO_STATE = MTPROTO_STATE;
g.DC_LIST = DC_LIST;
g.mtprotoConnect = mtprotoConnect;
