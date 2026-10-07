// splitStatements cuts a pasted script into the single statements the server
// accepts one at a time.
//
// The data plane refuses stacked statements ("only one statement may be sent
// per request"), and that rule is the security boundary — it is what stops
// "SELECT 1; DROP TABLE users" from riding one prepared statement into SQLite.
// So a script that creates two tables becomes two requests: the console splits
// here and runs them in order, which is the same shape a SQL shell has without
// asking the server to loosen anything.
//
// A semicolon only splits when it sits outside a string literal or a comment,
// tracked here the same way the server's tokenizer does. CREATE TRIGGER bodies
// are not special-cased: the server declines triggers outright, so no input
// that reaches the split could need one.
export function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let buffer = "";
  let index = 0;

  const flush = () => {
    if (hasSQLContent(buffer)) statements.push(buffer.trim());
    buffer = "";
  };

  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];

    // Line comment: the semicolons inside it are prose.
    if (char === "-" && next === "-") {
      const end = sql.indexOf("\n", index);
      const stop = end === -1 ? sql.length : end;
      buffer += sql.slice(index, stop);
      index = stop;
      continue;
    }

    // Block comment: same, across newlines.
    if (char === "/" && next === "*") {
      const end = sql.indexOf("*/", index + 2);
      const stop = end === -1 ? sql.length : end + 2;
      buffer += sql.slice(index, stop);
      index = stop;
      continue;
    }

    // Quoted runs — 'single', "double", `backtick`. SQL escapes a quote by
    // doubling it, so the pair is consumed together rather than closing early.
    if (char === "'" || char === '"' || char === "`") {
      let cursor = index + 1;
      while (cursor < sql.length) {
        if (sql[cursor] === char) {
          if (sql[cursor + 1] === char) {
            cursor += 2;
            continue;
          }
          cursor += 1;
          break;
        }
        cursor += 1;
      }
      buffer += sql.slice(index, cursor);
      index = cursor;
      continue;
    }

    if (char === ";") {
      flush();
      index += 1;
      continue;
    }

    buffer += char;
    index += 1;
  }

  flush();
  return statements;
}

// hasSQLContent reports whether a fragment holds anything but whitespace and
// comments. A trailing semicolon followed by an explanation in comments must
// not become a statement of its own; the server would answer
// "no SQL statement was provided" and the run would stop for no reason.
function hasSQLContent(statement: string): boolean {
  let index = 0;
  while (index < statement.length) {
    const char = statement[index];
    if (char === "-" && statement[index + 1] === "-") {
      const end = statement.indexOf("\n", index);
      index = end === -1 ? statement.length : end + 1;
      continue;
    }
    if (char === "/" && statement[index + 1] === "*") {
      const end = statement.indexOf("*/", index + 2);
      index = end === -1 ? statement.length : end + 2;
      continue;
    }
    if (/\S/.test(char)) return true;
    index += 1;
  }
  return false;
}
