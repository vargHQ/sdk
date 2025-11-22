#!/usr/bin/env bun
/**
 * higgsfield client wrapper for soul image generation and character creation
 * usage: bun run lib/higgsfield.ts <command> <args>
 */

import { HiggsfieldClient, SoulSize, SoulQuality, BatchSize, InputImage, InputImageType } from "@higgsfield/client"

const client = new HiggsfieldClient({
  apiKey: process.env.HIGGSFIELD_API_KEY || process.env.HF_API_KEY,
  apiSecret: process.env.HIGGSFIELD_SECRET || process.env.HF_API_SECRET,
})

export interface GenerateSoulArgs {
  prompt: string
  widthAndHeight?: typeof SoulSize[keyof typeof SoulSize]
  quality?: typeof SoulQuality[keyof typeof SoulQuality]
  styleId?: string
  batchSize?: typeof BatchSize[keyof typeof BatchSize]
  enhancePrompt?: boolean
}

export interface CreateSoulIdArgs {
  name: string
  imageUrls: string[]
}

export async function generateSoul(args: GenerateSoulArgs) {
  console.log(`[higgsfield] generating soul image`)
  console.log(`[higgsfield] prompt: ${args.prompt}`)
  
  try {
    const jobSet = await client.generate('/v1/text2image/soul', {
      prompt: args.prompt,
      width_and_height: args.widthAndHeight || SoulSize.PORTRAIT_1152x2048,
      quality: args.quality || SoulQuality.HD,
      style_id: args.styleId,
      batch_size: args.batchSize || BatchSize.SINGLE,
      enhance_prompt: args.enhancePrompt ?? false,
    })
    
    console.log(`[higgsfield] job created: ${jobSet.id}`)
    console.log(`[higgsfield] completed: ${jobSet.isCompleted}`)
    
    return jobSet
  } catch (error) {
    console.error(`[higgsfield] error:`, error)
    throw error
  }
}

export async function listSoulStyles() {
  console.log(`[higgsfield] fetching soul styles`)
  
  try {
    const styles = await client.getSoulStyles()
    return styles
  } catch (error) {
    console.error(`[higgsfield] error:`, error)
    throw error
  }
}

export async function createSoulId(args: CreateSoulIdArgs) {
  console.log(`[higgsfield] creating soul id: ${args.name}`)
  console.log(`[higgsfield] images: ${args.imageUrls.length}`)
  
  try {
    const soulId = await client.createSoulId({
      name: args.name,
      input_images: args.imageUrls.map(url => ({
        type: InputImageType.IMAGE_URL,
        image_url: url,
      })),
    })
    
    console.log(`[higgsfield] soul id created: ${soulId.id}`)
    return soulId
  } catch (error) {
    console.error(`[higgsfield] error:`, error)
    throw error
  }
}

export async function listSoulIds(page = 1, pageSize = 20) {
  console.log(`[higgsfield] listing soul ids`)
  
  try {
    const soulIds = await client.listSoulIds(page, pageSize)
    return soulIds
  } catch (error) {
    console.error(`[higgsfield] error:`, error)
    throw error
  }
}

// cli runner
if (import.meta.main) {
  const [command, ...args] = process.argv.slice(2)
  
  switch (command) {
    case "generate_soul": {
      if (!args[0]) {
        console.log(`
usage:
  bun run lib/higgsfield.ts generate_soul <prompt> [styleId]
        `)
        process.exit(1)
      }
      const soulResult = await generateSoul({
        prompt: args[0],
        styleId: args[1],
      })
      
      // print job status and results
      console.log(`\njob id: ${soulResult.id}`)
      console.log(`status: completed=${soulResult.isCompleted}, failed=${soulResult.isFailed}`)
      
      if (soulResult.isCompleted && soulResult.jobs.length > 0) {
        for (const job of soulResult.jobs) {
          if (job.results) {
            console.log(`\nimage url: ${job.results.raw.url}`)
          }
        }
      }
      break
    }
      
    case "list_styles": {
      const styles = await listSoulStyles()
      console.log(JSON.stringify(styles, null, 2))
      break
    }
      
    case "create_soul_id": {
      if (!args[0] || !args[1]) {
        console.log(`
usage:
  bun run lib/higgsfield.ts create_soul_id <name> <imageUrl1> [imageUrl2...]
        `)
        process.exit(1)
      }
      const imageUrls = args.slice(1)
      const soulIdResult = await createSoulId({
        name: args[0],
        imageUrls,
      })
      console.log(JSON.stringify(soulIdResult, null, 2))
      break
    }
      
    case "list_soul_ids": {
      const soulIds = await listSoulIds()
      console.log(JSON.stringify(soulIds, null, 2))
      break
    }
      
    default:
      console.log(`
usage:
  bun run lib/higgsfield.ts generate_soul <prompt> [styleId]
  bun run lib/higgsfield.ts list_styles
  bun run lib/higgsfield.ts create_soul_id <name> <imageUrl1> [imageUrl2...]
  bun run lib/higgsfield.ts list_soul_ids
      `)
      process.exit(1)
  }
}
