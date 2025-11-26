/**
 * shared types for varg cli
 * actions and models export meta objects conforming to these types
 */

export interface SchemaProperty {
  type: string;
  description: string;
  enum?: (string | number)[];
  default?: unknown;
  format?: string;
}

export interface Schema {
  input: {
    type: "object";
    required: string[];
    properties: Record<string, SchemaProperty>;
  };
  output: {
    type: string;
    format?: string;
    description: string;
  };
}

export interface ActionMeta {
  name: string;
  type: "action";
  description: string;
  inputType: string;
  outputType: string;
  schema: Schema;
  run: (options: Record<string, unknown>) => Promise<unknown>;
}

export interface ModelMeta {
  name: string;
  type: "model";
  description: string;
  inputType: string;
  outputType: string;
  providers: string[];
  defaultProvider: string;
  schema: Schema;
  run: (options: Record<string, unknown>) => Promise<unknown>;
}

export type Meta = ActionMeta | ModelMeta;
