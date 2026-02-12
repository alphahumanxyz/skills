import { getGmailSkillState } from '../state';
import { gmailFetch } from './index';

export async function loadGmailProfile(): Promise<void> {
  const response = await gmailFetch('/users/me/profile');
  if (response.success) {
    const s = getGmailSkillState();
    s.profile = {
      emailAddress: response.data.emailAddress,
      messagesTotal: response.data.messagesTotal || 0,
      threadsTotal: response.data.threadsTotal || 0,
      historyId: response.data.historyId,
    };

    if (!s.config.userEmail) {
      s.config.userEmail = response.data.emailAddress;
      state.set('config', s.config);
    }

    console.log(`[gmail] Profile loaded for ${s.profile.emailAddress}`);
  }
}
