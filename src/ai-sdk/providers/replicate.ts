/**
 * Replicate provider - re-exports @ai-sdk/replicate
 *
 * For background removal, use:
 *   replicate.image("851-labs/background-remover")
 * or
 *   replicate.image("lucataco/remove-bg")
 *
 * Note: These are image-to-image models. Pass the input image via providerOptions:
 *
 * const { image } = await generateImage({
 *   model: replicate.image("851-labs/background-remover"),
 *   prompt: "", // not used for bg removal
 *   providerOptions: {
 *     replicate: {
 *       image: "https://example.com/image.jpg", // or base64
 *     },
 *   },
 * });
 */
export {
  createReplicate,
  type ReplicateProvider,
  type ReplicateProviderSettings,
  replicate,
} from "@ai-sdk/replicate";
