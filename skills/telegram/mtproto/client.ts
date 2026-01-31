/**
 * MTProto client wrapper for the Telegram runtime skill.
 *
 * Ported from src/lib/telegram/services/mtprotoService.ts.
 * Manages the TelegramClient lifecycle, connection, authentication,
 * and FLOOD_WAIT handling.
 */

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import type { UserAuthParams, BotAuthParams } from "telegram/client/auth";
import { FloodWaitError } from "telegram/errors";
import * as store from "../state/store.js";
import createDebug from "debug";

const log = createDebug("skill:telegram:client");

type LoginOptions = UserAuthParams | BotAuthParams;

export type QrLoginStatus =
  | { type: "token"; token: Buffer; expires: number; serverTime: number }
  | { type: "scanning_complete" }
  | { type: "dc_migration"; dcId: number }
  | { type: "2fa_required"; hint?: string }
  | { type: "success" }
  | { type: "error"; error: Error };

class MTProtoClient {
  private client: TelegramClient | undefined;
  private isInitialized = false;
  private isConnected = false;
  private sessionString = "";
  private readonly apiId: number;
  private readonly apiHash: string;

  // In-flight promise guards
  private initializePromise: Promise<void> | null = null;
  private connectPromise: Promise<void> | null = null;

  // QR login guards
  private isScanningComplete = false;
  private isQrFlowInProgress = false;
  private isDcMigrating = false;

  constructor(apiId: number, apiHash: string) {
    this.apiId = apiId;
    this.apiHash = apiHash;
  }

  /** Initialize with an optional session string (from host state). */
  async initialize(sessionString?: string): Promise<void> {
    if (this.isInitialized && this.client) return;
    if (this.initializePromise) return this.initializePromise;

    this.initializePromise = this._doInitialize(sessionString ?? "").finally(
      () => {
        this.initializePromise = null;
      },
    );
    return this.initializePromise;
  }

  private async _doInitialize(session: string): Promise<void> {
    try {
      const stringSession = new StringSession(session);
      this.sessionString = session;

      this.client = new TelegramClient(
        stringSession,
        this.apiId,
        this.apiHash,
        {
          connectionRetries: 5,
          requestRetries: 5,
          floodSleepThreshold: 60,
        },
      );

      this.isInitialized = true;
      log("MTProto client initialized");
    } catch (error) {
      log("Failed to initialize MTProto client: %O", error);
      throw error;
    }
  }

  /** Connect to Telegram servers. */
  async connect(): Promise<void> {
    if (!this.client) {
      throw new Error("MTProto client not initialized. Call initialize() first.");
    }
    if (this.isConnected) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this._doConnect().finally(() => {
      this.connectPromise = null;
    });
    return this.connectPromise;
  }

  private async _doConnect(): Promise<void> {
    try {
      await this.client!.connect();
      this.isConnected = true;
      log("Connected to Telegram");
      this.saveSessionIfChanged();
    } catch (error) {
      log("Failed to connect: %O", error);
      throw error;
    }
  }

  /** Start authentication. */
  async start(options: LoginOptions): Promise<void> {
    if (!this.client) {
      throw new Error("MTProto client not initialized.");
    }
    try {
      await this.client.start(options);
      this.saveSessionIfChanged();
      log("Authentication successful");
    } catch (error) {
      log("Authentication failed: %O", error);
      throw error;
    }
  }

  /** Sign in with QR code. */
  async signInWithQrCode(
    qrCodeCallback: (qrCode: { token: Buffer; expires: number }) => void,
    passwordCallback?: (hint?: string) => Promise<string>,
    onError?: (err: Error) => Promise<boolean> | void,
    onStatus?: (status: QrLoginStatus) => void,
  ): Promise<unknown> {
    if (!this.client) {
      throw new Error("MTProto client not initialized.");
    }

    this.isScanningComplete = false;
    this.isQrFlowInProgress = true;
    this.isDcMigrating = false;

    try {
      const user = await this.client.signInUserWithQrCode(
        { apiId: this.apiId, apiHash: this.apiHash },
        {
          qrCode: async (qrCode) => {
            if (this.isScanningComplete) return;
            const serverTimeApprox = Math.floor(Date.now() / 1000);
            qrCodeCallback(qrCode);
            onStatus?.({
              type: "token",
              token: qrCode.token,
              expires: qrCode.expires,
              serverTime: serverTimeApprox,
            });
          },
          password: passwordCallback
            ? async (hint?: string) => {
                this.isScanningComplete = true;
                onStatus?.({ type: "2fa_required", hint });
                return passwordCallback(hint);
              }
            : undefined,
          onError: async (err: Error): Promise<boolean> => {
            const errorMessage = err.message || "";

            if (
              errorMessage.includes("NETWORK_MIGRATE_") ||
              errorMessage.includes("MIGRATE_")
            ) {
              const dcMatch = errorMessage.match(/(?:NETWORK_)?MIGRATE_(\d+)/);
              if (dcMatch) {
                this.isDcMigrating = true;
                onStatus?.({
                  type: "dc_migration",
                  dcId: Number(dcMatch[1]),
                });
                setTimeout(() => {
                  this.isDcMigrating = false;
                }, 10000);
              }
              return false;
            }

            if (
              errorMessage.includes("SESSION_PASSWORD_NEEDED") &&
              passwordCallback
            ) {
              this.isScanningComplete = true;
              onStatus?.({ type: "2fa_required" });
              if (onError) {
                const result = await onError(err);
                return result ?? false;
              }
              return false;
            }

            onStatus?.({ type: "error", error: err });
            if (onError) {
              const result = await onError(err);
              return result ?? false;
            }
            log("QR code auth error: %O", err);
            return false;
          },
        },
      );

      this.isScanningComplete = true;
      this.isQrFlowInProgress = false;
      this.isDcMigrating = false;
      onStatus?.({ type: "scanning_complete" });
      this.saveSessionIfChanged();
      onStatus?.({ type: "success" });
      return user;
    } catch (error) {
      this.isScanningComplete = true;
      this.isQrFlowInProgress = false;
      this.isDcMigrating = false;
      throw error;
    }
  }

  /** Get the raw TelegramClient instance. */
  getClient(): TelegramClient {
    if (!this.client || !this.isInitialized) {
      throw new Error("MTProto client not initialized.");
    }
    return this.client;
  }

  isReady(): boolean {
    return this.isInitialized && this.client !== undefined;
  }

  isClientConnected(): boolean {
    return this.isConnected && this.isReady();
  }

  getSessionString(): string {
    return this.sessionString;
  }

  shouldBlockExternalCalls(): boolean {
    return this.isQrFlowInProgress || this.isDcMigrating;
  }

  /** Check connection + authorization. */
  async checkConnection(): Promise<boolean> {
    try {
      if (!this.isInitialized || !this.client) return false;
      if (!this.isConnected) await this.connect();

      const isAuthorized = await this.client!.checkAuthorization();
      if (!isAuthorized) return false;

      await this.withFloodWaitHandling(async () => {
        await this.client!.getMe();
      });
      return true;
    } catch (error) {
      if (error instanceof FloodWaitError) {
        log("Connection check: FLOOD_WAIT %ds", error.seconds);
      } else {
        log("Connection check failed: %O", error);
      }
      return false;
    }
  }

  /** Disconnect from Telegram. */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.disconnect();
        this.isConnected = false;
        log("Disconnected from Telegram");
      } catch (error) {
        log("Error disconnecting: %O", error);
        throw error;
      }
    }
  }

  /** Clear session and disconnect. */
  async clearSessionAndDisconnect(): Promise<void> {
    await this.disconnect();
    this.client = undefined;
    this.isInitialized = false;
    this.isConnected = false;
    this.sessionString = "";
    this.isScanningComplete = false;
    this.isQrFlowInProgress = false;
    this.isDcMigrating = false;
  }

  /** Invoke a raw Telegram API method with FLOOD_WAIT handling. */
  async invoke<T = unknown>(
    request: Parameters<TelegramClient["invoke"]>[0],
  ): Promise<T> {
    const client = this.getClient();
    if (!this.isClientConnected()) await this.connect();
    return this.withFloodWaitHandling(async () => {
      return client.invoke(request) as Promise<T>;
    });
  }

  /** Execute with FLOOD_WAIT retry. */
  async withFloodWaitHandling<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    retryCount = 0,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof FloodWaitError) {
        const waitSeconds = error.seconds;
        if (waitSeconds > 300) {
          throw new Error(
            `FLOOD_WAIT: Too long wait time (${waitSeconds}s). Please try again later.`,
          );
        }
        if (retryCount >= maxRetries) {
          throw new Error(
            `FLOOD_WAIT: Maximum retries exceeded. Wait ${waitSeconds}s before trying again.`,
          );
        }
        log(
          "FLOOD_WAIT: Waiting %ds before retry (attempt %d/%d)",
          waitSeconds,
          retryCount + 1,
          maxRetries,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, waitSeconds * 1000),
        );
        return this.withFloodWaitHandling(operation, maxRetries, retryCount + 1);
      }
      throw error;
    }
  }

  /** Send a message with FLOOD_WAIT handling. */
  async sendMessage(entity: string, message: string): Promise<void> {
    const client = this.getClient();
    if (!this.isClientConnected()) await this.connect();
    return this.withFloodWaitHandling(async () => {
      await client.sendMessage(entity, { message });
    });
  }

  private saveSessionIfChanged(): void {
    if (!this.client) return;
    const newSession = this.client.session.save() as string | undefined;
    if (newSession && newSession !== this.sessionString) {
      this.sessionString = newSession;
      store.setSessionString(newSession);
      log("Session updated and saved");
    }
  }
}

// Singleton — created by index.ts with API credentials from env
let instance: MTProtoClient | null = null;

export function createClient(apiId: number, apiHash: string): MTProtoClient {
  instance = new MTProtoClient(apiId, apiHash);
  return instance;
}

export function getClient(): MTProtoClient {
  if (!instance) throw new Error("MTProto client not created yet.");
  return instance;
}

export { MTProtoClient };
