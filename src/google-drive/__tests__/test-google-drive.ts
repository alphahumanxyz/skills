// test-google-drive.ts — Tests for the Google Drive skill (Drive, Sheets, Docs).
// Runs via the V8 test harness. Globals: describe, it, assert*, setupSkillTest, callTool.

const _describe = (globalThis as any).describe as (name: string, fn: () => void) => void;
const _it = (globalThis as any).it as (name: string, fn: () => void) => void;
const _assert = (globalThis as any).assert as (cond: unknown, msg?: string) => void;
const _assertEqual = (globalThis as any).assertEqual as (
  a: unknown,
  b: unknown,
  msg?: string
) => void;
const _assertNotNull = (globalThis as any).assertNotNull as (v: unknown, msg?: string) => void;
const _assertContains = (globalThis as any).assertContains as (
  h: string,
  n: string,
  msg?: string
) => void;
const _setup = (globalThis as any).setupSkillTest as (opts?: any) => void;
const _callTool = (globalThis as any).callTool as (name: string, args?: any) => any;

const SAMPLE_FILES_LIST = {
  files: [
    {
      id: 'file1',
      name: 'Doc1',
      mimeType: 'application/vnd.google-apps.document',
      modifiedTime: '2025-02-10T12:00:00Z',
      webViewLink: 'https://docs.google.com/document/d/file1/edit',
    },
    {
      id: 'file2',
      name: 'Sheet1',
      mimeType: 'application/vnd.google-apps.spreadsheet',
      modifiedTime: '2025-02-10T11:00:00Z',
    },
  ],
  nextPageToken: null,
};

const SAMPLE_FILE_META = {
  id: 'file1',
  name: 'Doc1',
  mimeType: 'application/vnd.google-apps.document',
  modifiedTime: '2025-02-10T12:00:00Z',
  webViewLink: 'https://docs.google.com/document/d/file1/edit',
};

const SAMPLE_SPREADSHEET = {
  spreadsheetId: 'sheet1',
  properties: { title: 'My Sheet' },
  sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }],
};

const SAMPLE_VALUES = {
  range: 'Sheet1!A1:B2',
  values: [
    ['Name', 'Value'],
    ['A', '1'],
  ],
};

const SAMPLE_DOCUMENT = {
  documentId: 'doc1',
  title: 'My Doc',
  body: { content: [{ paragraph: { elements: [{ textRun: { content: 'Hello world\n' } }] } }] },
};

const SAMPLE_CREATED_FILE = {
  id: 'file-new',
  name: 'New Doc',
  webViewLink: 'https://docs.google.com/document/d/file-new/edit',
};

function setupAuthenticatedDriveTest(overrides?: {
  oauthFetchResponses?: Record<string, { status: number; body: string }>;
}): void {
  const defaultOauth: Record<string, { status: number; body: string }> = {
    '/files?q=%27root%27%20in%20parents%20and%20trashed%20%3D%20false&pageSize=50&orderBy=modifiedTime%20desc&fields=nextPageToken%2C%20files(id%2C%20name%2C%20mimeType%2C%20size%2C%20modifiedTime%2C%20webViewLink%2C%20parents)':
      { status: 200, body: JSON.stringify(SAMPLE_FILES_LIST) },
    '/files/file1?fields=id,name,mimeType,size,modifiedTime,webViewLink,parents,createdTime': {
      status: 200,
      body: JSON.stringify(SAMPLE_FILE_META),
    },
    '/files?q=name%20contains%20%27test%27&pageSize=50&fields=nextPageToken%2C%20files(id%2C%20name%2C%20mimeType%2C%20size%2C%20modifiedTime%2C%20webViewLink%2C%20parents)':
      { status: 200, body: JSON.stringify(SAMPLE_FILES_LIST) },
    '/spreadsheets/sheet1': { status: 200, body: JSON.stringify(SAMPLE_SPREADSHEET) },
    '/spreadsheets/sheet1/values/Sheet1!A1:B2': {
      status: 200,
      body: JSON.stringify(SAMPLE_VALUES),
    },
    '/spreadsheets/sheet1/values/Sheet1!A1:B2?valueInputOption=USER_ENTERED': {
      status: 200,
      body: JSON.stringify({ updatedCells: 4, updatedRows: 2 }),
    },
    '/documents/doc1': { status: 200, body: JSON.stringify(SAMPLE_DOCUMENT) },
    '/files': { status: 200, body: JSON.stringify(SAMPLE_CREATED_FILE) },
  };
  _setup({
    stateData: { config: { credentialId: 'test', userEmail: 'test@example.com' } },
    oauthCredential: {
      credentialId: 'test',
      provider: 'google',
      scopes: [],
      isValid: true,
      createdAt: Date.now(),
      accountLabel: 'test@example.com',
    },
    oauthFetchResponses: { ...defaultOauth, ...overrides?.oauthFetchResponses },
  });
  (globalThis as any).init();
}

function setupUnauthenticatedDriveTest(): void {
  _setup({ stateData: {}, oauthFetchResponses: {} });
  (globalThis as any).init();
}

_describe('Google Drive Skill', () => {
  _describe('Initialization', () => {
    _it('should initialize with default config when no stored config', () => {
      setupUnauthenticatedDriveTest();
      const state = globalThis.getGoogleDriveSkillState();
      _assertNotNull(state);
      _assertEqual(state.config.credentialId, '');
      _assertEqual(state.config.userEmail, '');
    });

    _it('should load stored config on init', () => {
      setupAuthenticatedDriveTest();
      const state = globalThis.getGoogleDriveSkillState();
      _assertEqual(state.config.credentialId, 'test');
      _assertEqual(state.config.userEmail, 'test@example.com');
    });
  });

  _describe('List Files Tool', () => {
    _it('should list files when authenticated', () => {
      setupAuthenticatedDriveTest();
      const result = _callTool('google-drive-list-files', {});
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
      _assertNotNull(response.files);
      _assertEqual(response.files.length, 2);
      _assertEqual(response.files[0].id, 'file1');
      _assertEqual(response.files[0].name, 'Doc1');
    });

    _it('should fail when not connected', () => {
      setupUnauthenticatedDriveTest();
      const result = _callTool('google-drive-list-files', {});
      const response = JSON.parse(result);
      _assertEqual(response.success, false);
      _assertContains(response.error, 'not connected');
    });
  });

  _describe('Get File Tool', () => {
    _it('should get file metadata by id', () => {
      setupAuthenticatedDriveTest();
      const result = _callTool('google-drive-get-file', { file_id: 'file1' });
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
      _assertEqual(response.file.id, 'file1');
      _assertEqual(response.file.name, 'Doc1');
      _assertEqual(response.file.mimeType, 'application/vnd.google-apps.document');
    });

    _it('should require file_id', () => {
      setupAuthenticatedDriveTest();
      const result = _callTool('google-drive-get-file', {});
      const response = JSON.parse(result);
      _assertEqual(response.success, false);
      _assertContains(response.error, 'file_id');
    });
  });

  _describe('Search Files Tool', () => {
    _it('should search files by query', () => {
      setupAuthenticatedDriveTest();
      const result = _callTool('google-drive-search-files', { query: "name contains 'test'" });
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
      _assertNotNull(response.files);
    });

    _it('should require query', () => {
      setupAuthenticatedDriveTest();
      const result = _callTool('google-drive-search-files', {});
      const response = JSON.parse(result);
      _assertEqual(response.success, false);
      _assertContains(response.error, 'query');
    });
  });

  _describe('Get Spreadsheet Tool', () => {
    _it('should get spreadsheet metadata', () => {
      setupAuthenticatedDriveTest();
      const result = _callTool('google-drive-get-spreadsheet', { spreadsheet_id: 'sheet1' });
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
      _assertEqual(response.spreadsheetId, 'sheet1');
      _assertEqual(response.title, 'My Sheet');
      _assertEqual(response.sheets.length, 1);
      _assertEqual(response.sheets[0], 'Sheet1');
    });

    _it('should require spreadsheet_id', () => {
      setupAuthenticatedDriveTest();
      const result = _callTool('google-drive-get-spreadsheet', {});
      const response = JSON.parse(result);
      _assertEqual(response.success, false);
      _assertContains(response.error, 'spreadsheet_id');
    });
  });

  _describe('Get Sheet Values Tool', () => {
    _it('should get range values', () => {
      setupAuthenticatedDriveTest();
      const result = _callTool('google-drive-get-sheet-values', {
        spreadsheet_id: 'sheet1',
        range: 'Sheet1!A1:B2',
      });
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
      _assertNotNull(response.values);
      _assertEqual(response.values.length, 2);
      _assertEqual(response.values[0][0], 'Name');
    });

    _it('should require spreadsheet_id and range', () => {
      setupAuthenticatedDriveTest();
      const result = _callTool('google-drive-get-sheet-values', { spreadsheet_id: 'sheet1' });
      const response = JSON.parse(result);
      _assertEqual(response.success, false);
      _assertContains(response.error, 'range');
    });
  });

  _describe('Update Sheet Values Tool', () => {
    _it('should update cells', () => {
      setupAuthenticatedDriveTest();
      const result = _callTool('google-drive-update-sheet-values', {
        spreadsheet_id: 'sheet1',
        range: 'Sheet1!A1:B2',
        values: [
          ['X', 'Y'],
          ['Z', 'W'],
        ],
      });
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
      _assertEqual(response.updatedCells, 4);
    });

    _it('should require values', () => {
      setupAuthenticatedDriveTest();
      const result = _callTool('google-drive-update-sheet-values', {
        spreadsheet_id: 'sheet1',
        range: 'Sheet1!A1:B2',
      });
      const response = JSON.parse(result);
      _assertEqual(response.success, false);
      _assertContains(response.error, 'values');
    });
  });

  _describe('Get Document Tool', () => {
    _it('should get document content', () => {
      setupAuthenticatedDriveTest();
      const result = _callTool('google-drive-get-document', { document_id: 'doc1' });
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
      _assertEqual(response.documentId, 'doc1');
      _assertEqual(response.title, 'My Doc');
      _assertContains(response.content, 'Hello world');
    });

    _it('should require document_id', () => {
      setupAuthenticatedDriveTest();
      const result = _callTool('google-drive-get-document', {});
      const response = JSON.parse(result);
      _assertEqual(response.success, false);
      _assertContains(response.error, 'document_id');
    });
  });

  _describe('Create Document Tool', () => {
    _it('should create new doc', () => {
      setupAuthenticatedDriveTest();
      const result = _callTool('google-drive-create-document', { name: 'New Doc' });
      const response = JSON.parse(result);
      _assertEqual(response.success, true);
      _assertEqual(response.id, 'file-new');
      _assertEqual(response.name, 'New Doc');
      _assertNotNull(response.webViewLink);
    });

    _it('should require name', () => {
      setupAuthenticatedDriveTest();
      const result = _callTool('google-drive-create-document', {});
      const response = JSON.parse(result);
      _assertEqual(response.success, false);
      _assertContains(response.error, 'name');
    });
  });
});
