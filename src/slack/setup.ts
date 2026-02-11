// Setup wizard for Slack skill
import { SLACK_BASE_URL } from './types';

async function onSetupStart(): Promise<SetupStartResult> {
  return {
    step: {
      id: 'bot_token',
      title: 'Connect Slack',
      description:
        'Enter your Slack Bot User OAuth Token (xoxb-...). ' +
        'Create an app at https://api.slack.com/apps and install it to your workspace. ' +
        'Find the token under OAuth & Permissions > Bot User OAuth Token.',
      fields: [
        {
          name: 'bot_token',
          type: 'password',
          label: 'Bot Token',
          description: 'Your Slack bot token (starts with xoxb-)',
          required: true,
          placeholder: 'xoxb-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        },
      ],
    },
  };
}

async function onSetupSubmit(args: {
  stepId: string;
  values: Record<string, unknown>;
}): Promise<SetupSubmitResult> {
  const { stepId, values } = args;

  if (stepId !== 'bot_token') {
    return { status: 'error', errors: [{ field: '', message: `Unknown setup step: ${stepId}` }] };
  }

  const rawToken = ((values.bot_token as string) ?? '').trim();

  if (!rawToken) {
    return { status: 'error', errors: [{ field: 'bot_token', message: 'Bot token is required' }] };
  }

  if (!rawToken.startsWith('xoxb-')) {
    return {
      status: 'error',
      errors: [
        {
          field: 'bot_token',
          message: "Bot token should start with 'xoxb-'. Check your Slack app settings.",
        },
      ],
    };
  }

  // Validate token by calling auth.test
  try {
    const response = await net.fetch(`${SLACK_BASE_URL}/auth.test`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${rawToken}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    if (response.status !== 200) {
      const responseBody = await response.body;
      return {
        status: 'error',
        errors: [{ field: 'bot_token', message: `Slack API error: ${responseBody}` }],
      };
    }

    const auth = JSON.parse(await response.body) as {
      ok?: boolean;
      team?: string;
      url?: string;
      error?: string;
    };
    if (!auth.ok) {
      const err = auth.error || 'invalid_auth';
      return {
        status: 'error',
        errors: [
          {
            field: 'bot_token',
            message:
              err === 'invalid_auth'
                ? 'Invalid bot token. Please check your token.'
                : `Slack error: ${err}`,
          },
        ],
      };
    }

    const workspaceName = (auth.team as string) || (auth.url as string) || '';
    const s = globalThis.getSlackSkillState();
    s.config.botToken = rawToken;
    s.config.workspaceName = workspaceName;
    state.set('config', s.config);
    data.write('config.json', JSON.stringify({ workspaceName }, null, 2));

    console.log(`[slack] Setup complete — connected to ${workspaceName || 'workspace'}`);
    globalThis.slackPublishState();
    return { status: 'complete' };
  } catch (e) {
    return {
      status: 'error',
      errors: [
        {
          field: 'bot_token',
          message: `Failed to connect: ${globalThis.slackApi.formatApiError(e)}`,
        },
      ],
    };
  }
}

async function onSetupCancel(): Promise<void> {
  console.log('[slack] Setup cancelled');
}

declare global {
  var slackSetup: {
    onSetupStart: typeof onSetupStart;
    onSetupSubmit: typeof onSetupSubmit;
    onSetupCancel: typeof onSetupCancel;
  };
}
globalThis.slackSetup = { onSetupStart, onSetupSubmit, onSetupCancel };

export { onSetupStart, onSetupSubmit, onSetupCancel };
