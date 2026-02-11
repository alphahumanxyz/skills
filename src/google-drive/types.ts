// Google Drive skill type definitions (Drive, Sheets, Docs)

export interface SkillConfig {
  credentialId: string;
  userEmail: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  parents?: string[];
}

// Sheets API
export const SHEETS_BASE = 'https://sheets.googleapis.com/v4';
export const SHEETS_MIMETYPE = 'application/vnd.google-apps.spreadsheet';

// Docs API
export const DOCS_BASE = 'https://docs.googleapis.com/v1';
export const DOCS_MIMETYPE = 'application/vnd.google-apps.document';

export interface ApiError {
  code: number;
  message: string;
  errors?: Array<{ domain: string; reason: string; message: string }>;
}
