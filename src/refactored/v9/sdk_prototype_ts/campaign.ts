/**
 * VARG SDK - Campaign Pipeline Example
 *
 * Batch generation workflow based on patterns from:
 * - generate_menopause_campaign.py
 * - apostle_diet_15_creatives.py
 *
 * Usage:
 *   npx ts-node examples/sdk_prototype_ts/campaign.ts
 */

import { fal, higgsfield, elevenlabs, getVoiceId } from './providers';
import type { ImageObject, VideoObject, AudioObject } from './providers';
import {
  generateImage,
  animateImage,
  generateSpeech,
  generateLipSyncVideo,
} from './core';

// =============================================================================
// Types
// =============================================================================

interface Character {
  id: number;
  name: string;
  prompt: string;
  voice: string;
  script: string;
  hookAction?: string;
  voiceSettings?: {
    stability?: number;
    style?: number;
  };
}

interface CampaignConfig {
  name: string;
  characters: Character[];
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
  videoDuration: number;
  batchSize: number;
  outputDir: string;
}

interface CharacterResult {
  characterId: number;
  characterName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  finalUrl?: string;
  error?: string;
  processingTime?: number;
}

// =============================================================================
// Campaign Generator
// =============================================================================

class CampaignGenerator {
  private config: CampaignConfig;
  private results: CharacterResult[] = [];

  // Model instances
  private imageModel = higgsfield.image('soul');
  private videoModel = fal.video('kling');
  private lipsyncModel = fal.lipsync();

  constructor(config: CampaignConfig) {
    this.config = config;
  }

  /**
   * Generate complete video for a single character.
   */
  async generateCharacter(char: Character): Promise<CharacterResult> {
    const result: CharacterResult = {
      characterId: char.id,
      characterName: char.name,
      status: 'processing',
    };

    const startTime = Date.now();

    try {
      // Step 1: Generate image
      console.log(`  1/4 Generating image for ${char.name}...`);
      const imageResult = await generateImage({
        model: this.imageModel,
        prompt: char.prompt,
        aspectRatio: this.config.aspectRatio,
        providerOptions: {
          style_id: '1cb4b936-77bf-4f9a-9039-f3d349a4cdbe', // realistic
        },
      });
      result.imageUrl = imageResult.image.url;

      // Step 2: Animate image
      console.log(`  2/4 Animating ${char.name}...`);
      const videoResult = await animateImage({
        model: this.videoModel,
        image: imageResult.image,
        prompt: 'Person speaking naturally to camera, subtle movements',
        duration: this.config.videoDuration,
        providerOptions: {
          cfg_scale: 0.5,
        },
      });
      result.videoUrl = videoResult.video.url;

      // Step 3: Generate voiceover
      console.log(`  3/4 Generating voice for ${char.name}...`);
      const speechResult = await generateSpeech({
        model: elevenlabs.speech('multilingual_v2'),
        text: char.script,
        providerOptions: {
          voice: getVoiceId(char.voice),
          stability: char.voiceSettings?.stability ?? 0.5,
          style: char.voiceSettings?.style ?? 0.0,
        },
      });
      result.audioUrl = speechResult.speech.url;

      // Step 4: Apply lipsync
      console.log(`  4/4 Applying lipsync for ${char.name}...`);
      const lipsyncResult = await generateLipSyncVideo({
        model: this.lipsyncModel,
        video: videoResult.video,
        audio: speechResult.speech,
        syncMode: 'cut_off',
      });
      result.finalUrl = lipsyncResult.video.url;

      result.status = 'completed';
      result.processingTime = Date.now() - startTime;

      console.log(`  ✓ Completed ${char.name} in ${result.processingTime}ms`);
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      console.error(`  ✗ Failed ${char.name}: ${result.error}`);
    }

    return result;
  }

  /**
   * Generate all characters in batches.
   */
  async generateAll(): Promise<CharacterResult[]> {
    console.log('='.repeat(60));
    console.log(`Campaign: ${this.config.name}`);
    console.log(`Characters: ${this.config.characters.length}`);
    console.log(`Batch size: ${this.config.batchSize}`);
    console.log('='.repeat(60));

    const allResults: CharacterResult[] = [];

    // Process in batches
    for (let i = 0; i < this.config.characters.length; i += this.config.batchSize) {
      const batch = this.config.characters.slice(i, i + this.config.batchSize);
      const batchNum = Math.floor(i / this.config.batchSize) + 1;
      const totalBatches = Math.ceil(this.config.characters.length / this.config.batchSize);

      console.log(`\nBatch ${batchNum}/${totalBatches}`);
      console.log('-'.repeat(40));

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map((char) => this.generateCharacter(char))
      );

      allResults.push(...batchResults);

      // Delay between batches (respect rate limits)
      if (i + this.config.batchSize < this.config.characters.length) {
        console.log('\nWaiting 5s before next batch...');
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }

    this.results = allResults;
    this.printSummary();

    return allResults;
  }

  private printSummary() {
    const completed = this.results.filter((r) => r.status === 'completed');
    const failed = this.results.filter((r) => r.status === 'failed');

    console.log('\n' + '='.repeat(60));
    console.log('CAMPAIGN SUMMARY');
    console.log('='.repeat(60));
    console.log(`Completed: ${completed.length}/${this.results.length}`);
    console.log(`Failed: ${failed.length}/${this.results.length}`);

    if (completed.length > 0) {
      console.log('\nCompleted videos:');
      completed.forEach((r) => {
        console.log(`  ${r.characterId}. ${r.characterName}`);
        console.log(`     ${r.finalUrl}`);
      });
    }

    if (failed.length > 0) {
      console.log('\nFailed:');
      failed.forEach((r) => {
        console.log(`  ${r.characterId}. ${r.characterName}: ${r.error}`);
      });
    }
  }
}

// =============================================================================
// Example Campaign Definition
// =============================================================================

const fitnessCampaign: CampaignConfig = {
  name: 'Fitness Transformation 2024',
  characters: [
    {
      id: 1,
      name: 'Morning Runner',
      prompt:
        'A 45-year-old woman in running clothes, energetic smile, ' +
        'sunrise park background, speaking to phone camera, ' +
        'natural UGC style, realistic photography',
      voice: 'matilda',
      script:
        'I started running at 45 and it changed my life. ' +
        '30 pounds down and I\'ve never felt more alive.',
      voiceSettings: { stability: 0.6, style: 0.2 },
    },
    {
      id: 2,
      name: 'Gym Dad',
      prompt:
        'A 38-year-old man in gym clothes, proud expression, ' +
        'home gym background with weights, speaking to camera, ' +
        'natural lighting, realistic photo',
      voice: 'callum',
      script:
        'My kids inspired me to get in shape. ' +
        'Now I can keep up with them and then some.',
      voiceSettings: { stability: 0.7, style: 0.1 },
    },
    {
      id: 3,
      name: 'Yoga Grandma',
      prompt:
        'A 62-year-old woman with silver hair in yoga pose, ' +
        'peaceful expression, serene studio background, ' +
        'speaking to camera, realistic style',
      voice: 'dorothy',
      script:
        'Age is just a number. I started yoga at 60 ' +
        'and it\'s the best decision I ever made.',
      voiceSettings: { stability: 0.65, style: 0.2 },
    },
  ],
  aspectRatio: '9:16',
  videoDuration: 10,
  batchSize: 2,
  outputDir: './fitness_campaign_output',
};

// =============================================================================
// Main
// =============================================================================

async function main() {
  const generator = new CampaignGenerator(fitnessCampaign);
  const results = await generator.generateAll();

  console.log(`\n\nCampaign complete! Generated ${results.length} videos.`);
}

main().catch(console.error);
