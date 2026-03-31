/**
 * Editor setup — tab state management and CodeMirror wrapper.
 * Tab content is preserved when switching between SQL/JS/mongosh.
 */

const TAB_CONFIG = {
  sql: {
    apiMethod: 'executeSql',
    bodyKey: 'sql',
    placeholder: '-- Enter SQL here\nSELECT 1 FROM dual;',
  },
  js: {
    apiMethod: 'executeJs',
    bodyKey: 'code',
    placeholder:
      '// Enter JavaScript here\nconst result = await connection.execute("SELECT 1 FROM dual");\nresult;',
  },
  mongo: {
    apiMethod: 'executeMongo',
    bodyKey: 'command',
    placeholder: '// Enter mongosh command\nshow collections',
  },
};

export class TabManager {
  #activeTab = 'sql';
  #contents = new Map();

  getActiveTab() {
    return this.#activeTab;
  }

  switchTab(tab) {
    this.#activeTab = tab;
  }

  getContent(tab) {
    return this.#contents.get(tab) || '';
  }

  setContent(tab, content) {
    this.#contents.set(tab, content);
  }

  getApiMethod(tab) {
    return TAB_CONFIG[tab]?.apiMethod || 'executeSql';
  }

  getRequestBody(tab, content) {
    const key = TAB_CONFIG[tab]?.bodyKey || 'sql';
    return { [key]: content };
  }

  getPlaceholder(tab) {
    return TAB_CONFIG[tab]?.placeholder || '';
  }
}
