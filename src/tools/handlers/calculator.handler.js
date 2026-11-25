import { z } from "zod";

const calculatorInputSchema = z
  .object({
    expression: z
      .string()
      .trim()
      .min(1, "Expression cannot be empty")
      .max(200, "Expression exceeds maximum length of 200 characters"),
  })
  .strict();

/**
 * Tokenizes a mathematical expression into numbers, operators, and parentheses.
 */
function tokenize(expression) {
  const tokens = [];
  let i = 0;

  while (i < expression.length) {
    const ch = expression[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let numStr = "";
      let dotCount = 0;

      while (i < expression.length && /[0-9.]/.test(expression[i])) {
        if (expression[i] === ".") {
          dotCount++;
          if (dotCount > 1) {
            throw new Error("INVALID_EXPRESSION: Invalid decimal number");
          }
        }
        numStr += expression[i];
        i++;
      }

      if (numStr === ".") {
        throw new Error("INVALID_EXPRESSION: Standalone decimal point");
      }

      tokens.push({ type: "NUMBER", value: Number(numStr) });
      continue;
    }

    if ("+-*/%()".includes(ch)) {
      tokens.push({ type: "OPERATOR", value: ch });
      i++;
      continue;
    }

    throw new Error(`INVALID_EXPRESSION: Unsupported character '${ch}'`);
  }

  return tokens;
}

/**
 * Recursive-descent parser with standard operator precedence:
 *   expression := term (('+' | '-') term)*
 *   term       := factor (('*' | '/' | '%') factor)*
 *   factor     := ('+' | '-') factor | primary
 *   primary    := NUMBER | '(' expression ')'
 */
function evaluateTokens(tokens) {
  let pos = 0;

  function peek() {
    return tokens[pos] || null;
  }

  function consume() {
    return tokens[pos++];
  }

  function parseExpression() {
    let left = parseTerm();

    while (
      peek() &&
      peek().type === "OPERATOR" &&
      (peek().value === "+" || peek().value === "-")
    ) {
      const op = consume().value;
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
    }

    return left;
  }

  function parseTerm() {
    let left = parseFactor();

    while (
      peek() &&
      peek().type === "OPERATOR" &&
      (peek().value === "*" || peek().value === "/" || peek().value === "%")
    ) {
      const op = consume().value;
      const right = parseFactor();

      if ((op === "/" || op === "%") && right === 0) {
        throw new Error("DIVISION_BY_ZERO: Cannot divide by zero");
      }

      if (op === "*") left *= right;
      else if (op === "/") left /= right;
      else left %= right;
    }

    return left;
  }

  function parseFactor() {
    const token = peek();

    if (
      token &&
      token.type === "OPERATOR" &&
      (token.value === "+" || token.value === "-")
    ) {
      consume();
      const operand = parseFactor();
      return token.value === "-" ? -operand : operand;
    }

    return parsePrimary();
  }

  function parsePrimary() {
    const token = peek();

    if (!token) {
      throw new Error("INVALID_EXPRESSION: Unexpected end of expression");
    }

    if (token.type === "NUMBER") {
      consume();
      return token.value;
    }

    if (token.type === "OPERATOR" && token.value === "(") {
      consume();
      const value = parseExpression();
      const closing = peek();

      if (!closing || closing.type !== "OPERATOR" || closing.value !== ")") {
        throw new Error("INVALID_EXPRESSION: Missing closing parenthesis");
      }

      consume();
      return value;
    }

    throw new Error(`INVALID_EXPRESSION: Unexpected token '${token.value}'`);
  }

  const result = parseExpression();

  if (pos < tokens.length) {
    throw new Error(
      `INVALID_EXPRESSION: Unexpected trailing token '${tokens[pos].value}'`
    );
  }

  if (!Number.isFinite(result)) {
    throw new Error("INVALID_EXPRESSION: Result is not a finite number");
  }

  // Normalize floating-point noise (e.g., 0.1 + 0.2 -> 0.3)
  return Math.round(result * 1e12) / 1e12;
}

/**
 * Safe calculator tool handler.
 */
export async function executeCalculator(rawArgs) {
  const parsed = calculatorInputSchema.safeParse(rawArgs);
  if (!parsed.success) {
    throw new Error(
      `TOOL_VALIDATION_ERROR: ${parsed.error.issues[0]?.message || "Invalid input"}`
    );
  }

  const tokens = tokenize(parsed.data.expression);
  if (tokens.length === 0) {
    throw new Error("INVALID_EXPRESSION: Expression has no tokens");
  }

  const result = evaluateTokens(tokens);

  return {
    expression: parsed.data.expression,
    result,
  };
}