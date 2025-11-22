#!/usr/bin/env bun
/**
 * higgsfield client wrapper for soul image generation and character creation
 * usage: bun run lib/higgsfield.ts <command> <args>
 */

import { HiggsfieldClient } from "@higgsfield/client"

const client = new HiggsfieldClient({
  apiKey: process.env.HIGGSFIELD_API_KEY || process.env.HF_API_KEY,
  apiSecret: process.env.HIGGSFIELD_SECRET || process.env.HF_API_SECRET,
})

export interface GenerateSoulArgs {
  prompt: string
  widthAndHeight?: string
  styleId?: string
  customReferenceId?: string
  batchSize?: 1 | 4
}

export interface CreateCharacterArgs {
  name: string
  imageUrls: string[]
}

export async function generateSoul(args: GenerateSoulArgs) {
  console.log(`[higgsfield] generating soul image`)
  console.log(`[higgsfield] prompt: ${args.prompt}`)
  
  try {
    const jobSet = await client.text2image.soul.generate({
      params: {
        prompt: args.prompt,
        width_and_height: args.widthAndHeight || "1152x2048",
        style_id: args.styleId,
        custom_reference_id: args.customReferenceId,
        batch_size: args.batchSize || 1,
      },
    })
    
    console.log(`[higgsfield] job created: ${jobSet.id}`)
    
    // wait for completion
    const result = await client.jobs.waitForCompletion(jobSet.id)
    
    console.log(`[higgsfield] completed!`)
    return result
  } catch (error) {
    console.error(`[higgsfield] error:`, error)
    throw error
  }
}

export async function listSoulStyles() {
  console.log(`[higgsfield] fetching soul styles`)
  
  try {
    const styles = await client.text2image.soul.listStyles()
    return styles
  } catch (error) {
    console.error(`[higgsfield] error:`, error)
    throw error
  }
}

export async function createCharacter(args: CreateCharacterArgs) {
  console.log(`[higgsfield] creating character: ${args.name}`)
  console.log(`[higgsfield] images: ${args.imageUrls.length}`)
  
  try {
    const character = await client.characters.create({
      name: args.name,
      input_images: args.imageUrls.map(url => ({
        type: "image_url" as const,
        image_url: url,
      })),
    })
    
    console.log(`[higgsfield] character created: ${character.id}`)
    return character
  } catch (error) {
    console.error(`[higgsfield] error:`, error)
    throw error
  }
}

export async function getCharacter(id: string) {
  console.log(`[higgsfield] fetching character: ${id}`)
  
  try {
    const character = await client.characters.get(id)
    return character
  } catch (error) {
    console.error(`[higgsfield] error:`, error)
    throw error
  }
}

export async function listCharacters() {
  console.log(`[higgsfield] listing characters`)
  
  try {
    const characters = await client.characters.list()
    return characters
  } catch (error) {
    console.error(`[higgsfield] error:`, error)
    throw error
  }
}

// cli runner
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2)
  
  switch (command) {
    case "generate_soul":
      const soulResult = await generateSoul({
        prompt: args[0],
        customReferenceId: args[1],
      })
      console.log(JSON.stringify(soulResult, null, 2))
      break
      
    case "list_styles":
      const styles = await listSoulStyles()
      console.log(JSON.stringify(styles, null, 2))
      break
      
    case "create_character":
      const imageUrls = args.slice(1)
      const charResult = await createCharacter({
        name: args[0],
        imageUrls,
      })
      console.log(JSON.stringify(charResult, null, 2))
      break
      
    case "get_character":
      const char = await getCharacter(args[0])
      console.log(JSON.stringify(char, null, 2))
      break
      
    case "list_characters":
      const chars = await listCharacters()
      console.log(JSON.stringify(chars, null, 2))
      break
      
    default:
      console.log(`
usage:
  bun run lib/higgsfield.ts generate_soul <prompt> [customReferenceId]
  bun run lib/higgsfield.ts list_styles
  bun run lib/higgsfield.ts create_character <name> <imageUrl1> [imageUrl2...]
  bun run lib/higgsfield.ts get_character <id>
  bun run lib/higgsfield.ts list_characters
      `)
      process.exit(1)
  }
}
