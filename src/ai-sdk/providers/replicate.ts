/**
 * Replicate provider - re-exports @ai-sdk/replicate
 *
 * For background removal, use prompt.images:
 *
 * const { image } = await generateImage({
 *   model: replicate.image("851-labs/background-remover"),
 *   prompt: { images: [imageData] },
 * });
 */
export {
  createReplicate,
  type ReplicateProvider,
  type ReplicateProviderSettings,
  replicate,
} from "@ai-sdk/replicate";
