interface Skill {
  tools: ToolDefinition[];
  init: () => void;
  start: () => void;
  stop: () => void;
  onCronTrigger: (scheduleId: string) => void;
  onSetupStart: () => SetupStartResult;
  onSetupSubmit: (args: { stepId: string; values: Record<string, unknown> }) => SetupSubmitResult;
  onSetupCancel: () => void;
  onListOptions: () => { options: SkillOption[] };
  onSetOption: (args: { name: string; value: unknown }) => void;
  onSessionStart: (args: { sessionId: string }) => void;
  onSessionEnd: (args: { sessionId: string }) => void;
}
