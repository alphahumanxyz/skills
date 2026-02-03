// mock-sql.ts — Lightweight in-memory SQL engine for QuickJS skill tests.
// Covers the SQL subset used by skills: CREATE TABLE, INSERT, SELECT, DELETE,
// INSERT ... ON CONFLICT ... DO UPDATE. Regex-based, not a full parser.

interface MockColumn {
  name: string;
  type: string;
  primaryKey: boolean;
  autoincrement: boolean;
  notNull: boolean;
}

interface MockTable {
  name: string;
  columns: MockColumn[];
  rows: unknown[][];
  autoIncrementCounter: number;
  primaryKeyIndex: number; // column index of PK, or -1
}

// Exported as a global so other scripts can access it
(globalThis as any).__mockTables = {} as Record<string, MockTable>;

function __sqlGetTables(): Record<string, MockTable> {
  return (globalThis as any).__mockTables;
}

function __sqlResetTables(): void {
  (globalThis as any).__mockTables = {};
}

// ---------------------------------------------------------------------------
// CREATE TABLE
// ---------------------------------------------------------------------------

function __sqlCreateTable(sql: string): void {
  const match = sql.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\((.+)\)/is,
  );
  if (!match) throw new Error(`[mock-sql] Cannot parse CREATE TABLE: ${sql}`);

  const tableName = match[1];
  const tables = __sqlGetTables();

  if (tables[tableName]) return; // IF NOT EXISTS

  const columnDefs = __sqlSplitColumns(match[2]);
  const columns: MockColumn[] = [];

  for (const def of columnDefs) {
    const trimmed = def.trim();
    // Skip standalone constraints like PRIMARY KEY(...)
    if (/^(PRIMARY\s+KEY|UNIQUE|CHECK|FOREIGN\s+KEY|CONSTRAINT)\b/i.test(trimmed)) continue;

    const colMatch = trimmed.match(/^(\w+)\s+(\w+)/i);
    if (!colMatch) continue;

    columns.push({
      name: colMatch[1],
      type: colMatch[2].toUpperCase(),
      primaryKey: /PRIMARY\s+KEY/i.test(trimmed),
      autoincrement: /AUTOINCREMENT/i.test(trimmed),
      notNull: /NOT\s+NULL/i.test(trimmed),
    });
  }

  const pkIndex = columns.findIndex((c) => c.primaryKey);

  tables[tableName] = {
    name: tableName,
    columns,
    rows: [],
    autoIncrementCounter: 0,
    primaryKeyIndex: pkIndex,
  };
}

/** Split column definitions respecting nested parentheses. */
function __sqlSplitColumns(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of inner) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

// ---------------------------------------------------------------------------
// INSERT
// ---------------------------------------------------------------------------

function __sqlInsert(sql: string, params: unknown[]): void {
  // INSERT INTO table (cols) VALUES (?, ...) [ON CONFLICT(...) DO UPDATE SET ...]
  const match = sql.match(
    /INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)(?:\s+ON\s+CONFLICT\s*\(([^)]+)\)\s+DO\s+UPDATE\s+SET\s+(.+))?/is,
  );
  if (!match) throw new Error(`[mock-sql] Cannot parse INSERT: ${sql}`);

  const tableName = match[1];
  const tables = __sqlGetTables();
  const table = tables[tableName];
  if (!table) throw new Error(`[mock-sql] Table not found: ${tableName}`);

  const colNames = match[2].split(",").map((c) => c.trim());
  const valuePlaceholders = match[3].split(",").map((v) => v.trim());
  const onConflictCol = match[4]?.trim();
  const updateSetClause = match[5]?.trim();

  // Build row from column order
  const newRow: unknown[] = new Array(table.columns.length).fill(null);
  let paramIdx = 0;

  for (let i = 0; i < colNames.length; i++) {
    const colIdx = table.columns.findIndex((c) => c.name === colNames[i]);
    if (colIdx === -1) continue;

    if (valuePlaceholders[i] === "?") {
      newRow[colIdx] = params[paramIdx++];
    } else {
      // Literal value
      newRow[colIdx] = __sqlParseLiteral(valuePlaceholders[i]);
    }
  }

  // Handle autoincrement PK
  if (table.primaryKeyIndex >= 0 && table.columns[table.primaryKeyIndex].autoincrement) {
    if (newRow[table.primaryKeyIndex] === null || newRow[table.primaryKeyIndex] === undefined) {
      table.autoIncrementCounter++;
      newRow[table.primaryKeyIndex] = table.autoIncrementCounter;
    }
  }

  // ON CONFLICT handling (upsert)
  if (onConflictCol) {
    const conflictColIdx = table.columns.findIndex((c) => c.name === onConflictCol);
    if (conflictColIdx >= 0) {
      const conflictValue = newRow[conflictColIdx];
      const existingIdx = table.rows.findIndex(
        (row) => row[conflictColIdx] === conflictValue,
      );
      if (existingIdx >= 0) {
        // DO UPDATE SET — parse and apply
        if (updateSetClause) {
          __sqlApplyUpdateSet(table, existingIdx, updateSetClause, newRow, params, paramIdx);
        }
        return;
      }
    }
  }

  table.rows.push(newRow);
}

function __sqlApplyUpdateSet(
  table: MockTable,
  rowIdx: number,
  setClause: string,
  newRow: unknown[],
  _params: unknown[],
  _paramIdx: number,
): void {
  // Parse "col1 = excluded.col1, col2 = excluded.col2" or "col1 = ?"
  const assignments = setClause.split(",").map((a) => a.trim());
  for (const assignment of assignments) {
    const eqMatch = assignment.match(/(\w+)\s*=\s*(.+)/);
    if (!eqMatch) continue;
    const colName = eqMatch[1].trim();
    const valueExpr = eqMatch[2].trim();
    const colIdx = table.columns.findIndex((c) => c.name === colName);
    if (colIdx === -1) continue;

    if (valueExpr.startsWith("excluded.")) {
      // Use value from the new row being inserted
      const srcCol = valueExpr.replace("excluded.", "");
      const srcIdx = table.columns.findIndex((c) => c.name === srcCol);
      if (srcIdx >= 0) {
        table.rows[rowIdx][colIdx] = newRow[srcIdx];
      }
    } else if (valueExpr === "?") {
      table.rows[rowIdx][colIdx] = _params[_paramIdx++];
    } else {
      table.rows[rowIdx][colIdx] = __sqlParseLiteral(valueExpr);
    }
  }
}

// ---------------------------------------------------------------------------
// SELECT
// ---------------------------------------------------------------------------

interface SelectParsed {
  columns: string[]; // ["*"] or ["col1", "AVG(col) as alias", ...]
  table: string;
  where: string | null;
  orderBy: string | null;
  orderDir: "ASC" | "DESC";
  limit: number | null;
}

function __sqlSelect(
  sql: string,
  params: unknown[],
): Record<string, unknown>[] {
  const parsed = __sqlParseSelect(sql);
  const tables = __sqlGetTables();
  const table = tables[parsed.table];
  if (!table) throw new Error(`[mock-sql] Table not found: ${parsed.table}`);

  // Filter rows with WHERE clause
  let rows = table.rows;
  if (parsed.where) {
    rows = __sqlFilterWhere(table, rows, parsed.where, params);
  }

  // Check for aggregate functions
  const hasAggregate = parsed.columns.some((c) =>
    /^(AVG|SUM|COUNT|MIN|MAX)\s*\(/i.test(c),
  );

  if (hasAggregate) {
    return [__sqlComputeAggregates(table, rows, parsed.columns)];
  }

  // ORDER BY
  if (parsed.orderBy) {
    const orderColIdx = table.columns.findIndex(
      (c) => c.name === parsed.orderBy,
    );
    if (orderColIdx >= 0) {
      rows = [...rows].sort((a, b) => {
        const va = a[orderColIdx] as number;
        const vb = b[orderColIdx] as number;
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return parsed.orderDir === "DESC" ? -cmp : cmp;
      });
    }
  }

  // LIMIT
  if (parsed.limit !== null) {
    rows = rows.slice(0, parsed.limit);
  }

  // Project columns
  return rows.map((row) => __sqlProjectRow(table, row, parsed.columns));
}

function __sqlParseSelect(sql: string): SelectParsed {
  // Normalize whitespace
  const norm = sql.replace(/\s+/g, " ").trim();

  // Extract parts
  const selectMatch = norm.match(
    /SELECT\s+(.+?)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(\w+)(?:\s+(ASC|DESC))?)?(?:\s+LIMIT\s+(\?|\d+))?$/i,
  );
  if (!selectMatch)
    throw new Error(`[mock-sql] Cannot parse SELECT: ${sql}`);

  return {
    columns: selectMatch[1].split(",").map((c) => c.trim()),
    table: selectMatch[2],
    where: selectMatch[3] || null,
    orderBy: selectMatch[4] || null,
    orderDir: (selectMatch[5]?.toUpperCase() as "ASC" | "DESC") || "ASC",
    limit: selectMatch[6]
      ? selectMatch[6] === "?"
        ? null // resolved from params in caller
        : parseInt(selectMatch[6])
      : null,
  };
}

function __sqlFilterWhere(
  table: MockTable,
  rows: unknown[][],
  whereClause: string,
  params: unknown[],
): unknown[][] {
  // Support: col = ? AND col2 = ?
  const conditions = whereClause.split(/\s+AND\s+/i);
  let paramIdx = 0;

  return rows.filter((row) => {
    let localParamIdx = paramIdx;
    const passes = conditions.every((cond) => {
      const m = cond.trim().match(/(\w+)\s*(=|!=|<|>|<=|>=)\s*(\?|'[^']*'|\d+)/);
      if (!m) return true; // skip unparseable conditions
      const colIdx = table.columns.findIndex((c) => c.name === m[1]);
      if (colIdx === -1) return true;

      let value: unknown;
      if (m[3] === "?") {
        value = params[localParamIdx++];
      } else {
        value = __sqlParseLiteral(m[3]);
      }

      const rowVal = row[colIdx];
      switch (m[2]) {
        case "=":
          return rowVal == value;
        case "!=":
          return rowVal != value;
        case "<":
          return (rowVal as number) < (value as number);
        case ">":
          return (rowVal as number) > (value as number);
        case "<=":
          return (rowVal as number) <= (value as number);
        case ">=":
          return (rowVal as number) >= (value as number);
        default:
          return true;
      }
    });
    // Advance the shared param counter
    paramIdx = localParamIdx;
    return passes;
  });
}

function __sqlComputeAggregates(
  table: MockTable,
  rows: unknown[][],
  selectCols: string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const expr of selectCols) {
    const aggMatch = expr.match(
      /(AVG|SUM|COUNT|MIN|MAX)\s*\((\w+)\)\s*(?:as\s+(\w+))?/i,
    );
    if (!aggMatch) continue;

    const fn = aggMatch[1].toUpperCase();
    const colName = aggMatch[2];
    const alias = aggMatch[3] || `${fn.toLowerCase()}_${colName}`;
    const colIdx = table.columns.findIndex((c) => c.name === colName);

    if (colIdx === -1) {
      result[alias] = null;
      continue;
    }

    const values = rows
      .map((r) => r[colIdx])
      .filter((v) => v !== null && v !== undefined) as number[];

    if (values.length === 0) {
      result[alias] = null;
      continue;
    }

    switch (fn) {
      case "AVG":
        result[alias] =
          values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case "SUM":
        result[alias] = values.reduce((a, b) => a + b, 0);
        break;
      case "COUNT":
        result[alias] = values.length;
        break;
      case "MIN":
        result[alias] = Math.min(...values);
        break;
      case "MAX":
        result[alias] = Math.max(...values);
        break;
    }
  }

  return result;
}

function __sqlProjectRow(
  table: MockTable,
  row: unknown[],
  selectCols: string[],
): Record<string, unknown> {
  if (selectCols.length === 1 && selectCols[0] === "*") {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < table.columns.length; i++) {
      obj[table.columns[i].name] = row[i];
    }
    return obj;
  }

  const obj: Record<string, unknown> = {};
  for (const col of selectCols) {
    // Handle "col as alias"
    const aliasMatch = col.match(/^(\w+)\s+as\s+(\w+)$/i);
    const colName = aliasMatch ? aliasMatch[1] : col.trim();
    const alias = aliasMatch ? aliasMatch[2] : col.trim();
    const idx = table.columns.findIndex((c) => c.name === colName);
    if (idx >= 0) {
      obj[alias] = row[idx];
    }
  }
  return obj;
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

function __sqlDelete(sql: string, params: unknown[]): void {
  const match = sql.match(
    /DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/is,
  );
  if (!match) throw new Error(`[mock-sql] Cannot parse DELETE: ${sql}`);

  const tableName = match[1];
  const tables = __sqlGetTables();
  const table = tables[tableName];
  if (!table) throw new Error(`[mock-sql] Table not found: ${tableName}`);

  if (!match[2]) {
    // DELETE all
    table.rows = [];
    return;
  }

  const before = table.rows.length;
  const kept = __sqlFilterWhere(table, table.rows, match[2], params);
  // __sqlFilterWhere returns rows that MATCH — for DELETE we want to REMOVE matches
  // Actually we want to keep rows that DON'T match. Invert the filter.
  const whereClause = match[2];
  const conditions = whereClause.split(/\s+AND\s+/i);
  let paramIdx = 0;

  table.rows = table.rows.filter((row) => {
    let localParamIdx = paramIdx;
    const matches = conditions.every((cond) => {
      const m = cond.trim().match(/(\w+)\s*(=|!=|<|>|<=|>=)\s*(\?|'[^']*'|\d+)/);
      if (!m) return false;
      const colIdx = table.columns.findIndex((c) => c.name === m[1]);
      if (colIdx === -1) return false;

      let value: unknown;
      if (m[3] === "?") {
        value = params[localParamIdx++];
      } else {
        value = __sqlParseLiteral(m[3]);
      }

      const rowVal = row[colIdx];
      switch (m[2]) {
        case "=":
          return rowVal == value;
        case "!=":
          return rowVal != value;
        default:
          return false;
      }
    });
    paramIdx = localParamIdx;
    // Keep rows that DON'T match the WHERE clause
    return !matches;
  });

  void before;
  void kept;
}

// ---------------------------------------------------------------------------
// Public API (installed as globals for mock-bridge)
// ---------------------------------------------------------------------------

function __sqlExec(sql: string, params: unknown[]): void {
  const trimmed = sql.trim();
  if (/^CREATE\s+TABLE/i.test(trimmed)) {
    __sqlCreateTable(trimmed);
  } else if (/^INSERT\s+INTO/i.test(trimmed)) {
    __sqlInsert(trimmed, params || []);
  } else if (/^DELETE\s+FROM/i.test(trimmed)) {
    __sqlDelete(trimmed, params || []);
  } else {
    throw new Error(`[mock-sql] Unsupported SQL for exec: ${trimmed.substring(0, 60)}`);
  }
}

function __sqlGet(
  sql: string,
  params: unknown[],
): Record<string, unknown> | null {
  const results = __sqlSelectWithParams(sql, params);
  return results.length > 0 ? results[0] : null;
}

function __sqlAll(
  sql: string,
  params: unknown[],
): Record<string, unknown>[] {
  return __sqlSelectWithParams(sql, params);
}

/** Select with param-based LIMIT support. */
function __sqlSelectWithParams(
  sql: string,
  params: unknown[],
): Record<string, unknown>[] {
  // Resolve LIMIT ? from params
  let resolvedSql = sql;
  const limitQMatch = sql.match(/LIMIT\s+\?/i);
  if (limitQMatch) {
    // The LIMIT ? param is always the last one
    const limitVal = params[params.length - 1];
    resolvedSql = sql.replace(/LIMIT\s+\?/i, `LIMIT ${limitVal}`);
    params = params.slice(0, -1);
  }
  return __sqlSelect(resolvedSql, params || []);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function __sqlParseLiteral(val: string): unknown {
  if (val === "null" || val === "NULL") return null;
  if (/^'.*'$/.test(val)) return val.slice(1, -1);
  if (/^\d+$/.test(val)) return parseInt(val);
  if (/^\d+\.\d+$/.test(val)) return parseFloat(val);
  return val;
}

// Expose globals
(globalThis as any).__sqlExec = __sqlExec;
(globalThis as any).__sqlGet = __sqlGet;
(globalThis as any).__sqlAll = __sqlAll;
(globalThis as any).__sqlResetTables = __sqlResetTables;
