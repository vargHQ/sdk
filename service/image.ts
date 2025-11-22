#!/usr/bin/env bun
/**
 * image generation service combining fal and higgsfield
 * usage: bun run service/image.ts <command> <args>
 */

import { generateImage } from "../lib/fal"
import { generateSoul } from "../lib/higgsfield"
import { uploadFromUrl } from "../utilities/s3"

export interface ImageGenerationResult {
  imageUrl: string
  uploaded?: string
}

export async function generateWithFal(
  prompt: string,
  options: { model?: string; upload?: boolean } = {}
): Promise<ImageGenerationResult> {
  console.log(`[service/image] generating with fal`)
  
  const result = await generateImage({ prompt, model: options.model })
  
  const imageUrl = result.data?.images?.[0]?.url
  if (!imageUrl) {
    throw new Error("no image url in result")
  }
  
  let uploaded: string | undefined
  if (options.upload) {
    const timestamp = Date.now()
    const objectKey = `images/fal/${timestamp}.png`
    uploaded = await uploadFromUrl(imageUrl, objectKey)
    console.log(`[service/image] uploaded to ${uploaded}`)
  }
  
  return { imageUrl, uploaded }
}

export async function generateWithSoul(
  prompt: string,
  options: { customReferenceId?: string; upload?: boolean } = {}
): Promise<ImageGenerationResult> {
  console.log(`[service/image] generating with higgsfield soul`)
  
  const result = await generateSoul({
    prompt,
    customReferenceId: options.customReferenceId,
  })
  
  const imageUrl = result.jobs?.[0]?.results?.raw?.url
  if (!imageUrl) {
    throw new Error("no image url in result")
  }
  
  let uploaded: string | undefined
  if (options.upload) {
    const timestamp = Date.now()
    const objectKey = `images/soul/${timestamp}.png`
    uploaded = await uploadFromUrl(imageUrl, objectKey)
    console.log(`[service/image] uploaded to ${uploaded}`)
  }
  
  return { imageUrl, uploaded }
}

// cli runner
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2)
  
  switch (command) {
    case "fal":
      const falResult = await generateWithFal(args[0], {
        model: args[1],
        upload: args[2] === "true",
      })
      console.log(JSON.stringify(falResult, null, 2))
      break
      
    case "soul":
      const soulResult = await generateWithSoul(args[0], {
        customReferenceId: args[1],
        upload: args[2] === "true",
      })
      console.log(JSON.stringify(soulResult, null, 2))
      break
      
    default:
      console.log(`
usage:
  bun run service/image.ts fal <prompt> [model] [upload]
  bun run service/image.ts soul <prompt> [customReferenceId] [upload]
      `)
      process.exit(1)
  }
}
