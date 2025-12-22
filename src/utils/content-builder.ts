/**
 * ContentBuilder - Fluent API for building CLI output content
 */

/**
 * Options for ContentBuilder
 */
export interface ContentBuilderOptions {
  /** Function to create headers */
  headerFn?: (title: string) => string;
  /** Function to create separators */
  separatorFn?: () => string;
  /** Function to wrap content in a box */
  boxFn?: (title: string, content: string[]) => string;
  /** Default indentation */
  indent?: string;
}

/**
 * Fluent builder for CLI output content
 * Provides a clean API for constructing formatted output
 */
export class ContentBuilder {
  private lines: string[] = [""];
  private options: Required<ContentBuilderOptions>;

  constructor(options: ContentBuilderOptions = {}) {
    this.options = {
      headerFn: options.headerFn ?? ((title) => `  ${title}`),
      separatorFn: options.separatorFn ?? (() => "  ─".repeat(20)),
      boxFn: options.boxFn ?? ((_, content) => content.join("\n")),
      indent: options.indent ?? "    ",
    };
  }

  /**
   * Add a line of content
   */
  add(line: string): this {
    this.lines.push(line);
    return this;
  }

  /**
   * Add multiple lines of content
   */
  addAll(lines: string[]): this {
    this.lines.push(...lines);
    return this;
  }

  /**
   * Add an indented line
   */
  indent(line: string): this {
    this.lines.push(`${this.options.indent}${line}`);
    return this;
  }

  /**
   * Add a blank line
   */
  blank(): this {
    this.lines.push("");
    return this;
  }

  /**
   * Add a section header
   */
  section(title: string): this {
    this.lines.push(this.options.headerFn(title));
    this.lines.push("");
    return this;
  }

  /**
   * Add a separator line
   */
  separator(): this {
    this.lines.push(this.options.separatorFn());
    return this;
  }

  /**
   * Add content conditionally
   */
  when(condition: boolean, fn: (builder: this) => void): this {
    if (condition) {
      fn(this);
    }
    return this;
  }

  /**
   * Add a key-value pair
   */
  keyValue(key: string, value: string, keyWidth = 15): this {
    this.lines.push(`${this.options.indent}${key.padEnd(keyWidth)} ${value}`);
    return this;
  }

  /**
   * Add a list of items with bullet points
   */
  list(items: string[], bullet = "•"): this {
    for (const item of items) {
      this.lines.push(`${this.options.indent}${bullet} ${item}`);
    }
    return this;
  }

  /**
   * Add numbered items
   */
  numbered(items: string[]): this {
    items.forEach((item, i) => {
      this.lines.push(`${this.options.indent}${i + 1}. ${item}`);
    });
    return this;
  }

  /**
   * Get the raw lines array
   */
  getLines(): string[] {
    return [...this.lines, ""];
  }

  /**
   * Build and return the content as a string
   */
  build(): string {
    return [...this.lines, ""].join("\n");
  }

  /**
   * Print the content wrapped in a box
   */
  print(title: string): void {
    const content = [...this.lines, ""];
    console.log(this.options.boxFn(title, content));
  }

  /**
   * Print the content as-is (without box)
   */
  printRaw(): void {
    console.log(this.build());
  }
}

/**
 * Create a new ContentBuilder with options
 */
export function createContentBuilder(
  options?: ContentBuilderOptions,
): ContentBuilder {
  return new ContentBuilder(options);
}
