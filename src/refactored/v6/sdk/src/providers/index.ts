// packages/sdk/src/providers/index.ts

import type { Model, ModelType, GenerateResult, BaseGenerateParams } from '../types';

// ============================================
// PROVIDER INTERFACES
// ============================================

export interface Provider {
  readonly name: string;
}

export interface InfraProvider extends Provider {
  readonly baseURL: string;
  doGenerate(params: Record<string, unknown>, model: Model): Promise<GenerateResult>;
}

export interface ModalityProvider extends Provider {
  readonly type: ModelType;
}

export interface ModelProvider<T extends Model = Model> extends Provider {
  readonly type: ModelType;
  readonly path: string;
  readonly models: readonly string[];
  (version: string): T;
  mapParams?(params: BaseGenerateParams): Record<string, unknown>;
  doGenerate?(params: BaseGenerateParams, model: T): Promise<GenerateResult>;
}

// ============================================
// CONFIG TYPES
// ============================================

export interface InfraProviderConfig {
  name: string;
  baseURL: string;
  doGenerate(params: Record<string, unknown>, model: Model): Promise<GenerateResult>;
}

export interface ModalityProviderConfig<T extends ModelProvider = ModelProvider> {
  name: string;
  type: ModelType;
  children: Record<string, T>;
}

export interface ModelProviderConfig {
  name: string;
  type: ModelType;
  path: string;
  models: string[];
  mapParams?(params: BaseGenerateParams): Record<string, unknown>;
  doGenerate(params: Record<string, unknown>, model: Model): Promise<GenerateResult>;
}

// ============================================
// FACTORIES
// ============================================

export function createInfraProvider(config: InfraProviderConfig): InfraProvider {
  return {
    name: config.name,
    baseURL: config.baseURL,
    doGenerate: config.doGenerate,
  };
}

export function createModalityProvider<T extends ModelProvider>(
  config: ModalityProviderConfig<T>
): ModalityProvider & Record<string, T> {
  const provider: ModalityProvider = {
    name: config.name,
    type: config.type,
  };
  return Object.assign(provider, config.children);
}

export function createModelProvider(config: ModelProviderConfig): ModelProvider {
  const mapParams = config.mapParams ?? ((p) => p);

  const callable = function (version: string): Model {
    if (!config.models.includes(version)) {
      throw new Error(`Unknown version "${version}". Available: ${config.models.join(', ')}`);
    }

    const model: Model = {
      provider: config.name,
      modelId: `${config.name}/${version}`,
      path: `${config.path}/${version}`,
      type: config.type,
      async doGenerate(params: BaseGenerateParams): Promise<GenerateResult> {
        const mapped = mapParams(params);
        return config.doGenerate(mapped, model);
      },
    };
    return model;
  };

  Object.defineProperties(callable, {
    name: { value: config.name },
    type: { value: config.type },
    path: { value: config.path },
    models: { value: config.models },
  });

  return callable as ModelProvider;
}

// ============================================
// TYPE GUARDS
// ============================================

export function isInfraProvider(p: Provider): p is InfraProvider {
  return 'baseURL' in p && 'doGenerate' in p;
}

export function isModalityProvider(p: Provider): p is ModalityProvider {
  return 'type' in p && !('path' in p);
}

export function isModelProvider(p: Provider): p is ModelProvider {
  return 'type' in p && 'path' in p && 'models' in p;
}

// ============================================
// REGISTRY
// ============================================

export interface ProviderRegistry {
  providers: Map<string, InfraProvider>;
  register(provider: InfraProvider): void;
  get(name: string): InfraProvider | undefined;
}

export function createProviderRegistry(): ProviderRegistry {
  const providers = new Map<string, InfraProvider>();
  return {
    providers,
    register(provider) { providers.set(provider.name, provider); },
    get(name) { return providers.get(name); },
  };
}

export const registry = createProviderRegistry();
