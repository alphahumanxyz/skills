interface Skill {
  info: {
    id: string;
    name: string;
    version: string;
    description: string;
    auto_start: boolean;
    setup: { required: boolean; label: string };
  };
  tools: ToolDefinition[];
  init: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  onCronTrigger?: (scheduleId: string) => Promise<void>;
  onSetupStart?: () => Promise<SetupStartResult>;
  onSetupSubmit?: (args: {
    stepId: string;
    values: Record<string, unknown>;
  }) => Promise<SetupSubmitResult>;
  onSetupCancel?: () => Promise<void>;
  onOAuthComplete?: (args: OAuthCompleteArgs) => Promise<unknown>;
  onDisconnect?: () => Promise<void>;
  publishState?: () => Promise<void>;
  onOAuthRevoked?: (args: OAuthRevokedArgs) => Promise<void>;
  onListOptions?: () => Promise<{ options: SkillOption[] }>;
  onSetOption?: (args: { name: string; value: unknown }) => Promise<void>;
  onSessionStart?: (args: { sessionId: string }) => Promise<void>;
  onSessionEnd?: (args: { sessionId: string }) => Promise<void>;
  onTick?: () => Promise<void>;
  onSync?: () => Promise<void>;
  onPing?: () => Promise<PingResult>;
  /** Called when the frontend sends load params (e.g. wallet address for wallet skill). */
  onLoad?: (params: Record<string, unknown>) => Promise<void>;
  onRpc?: (args: { method: string; params: unknown }) => unknown;
  onServerEvent?: (event: string, data: unknown) => Promise<void>;
  onDisconnect?: () => Promise<void>;
  /**
   * Called when an unhandled error occurs during async operations
   * (e.g. TDLib auth failures, network errors, promise rejections).
   * Skills should use this to update their state and surface the error to the user.
   */
  onError?: (args: SkillErrorArgs) => Promise<void>;
}
