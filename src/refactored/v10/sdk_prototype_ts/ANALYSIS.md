# Анализ 272 скриптов из user_scripts/

## Сводка по использованию сервисов

| Сервис | Файлов | % | Описание |
|--------|--------|---|----------|
| UploadService | 95 | 35% | S3 upload с routing по user_id/project_id |
| AnimationService | 65 | 24% | Image-to-video (Kling AI) |
| ImageGenerationService | 55 | 20% | Text-to-image wrapper |
| CaptionService | 42 | 15% | TikTok-style субтитры |
| HiggsfieldService | 38 | 14% | Генерация персонажей (Soul API) |
| VideoEditingService | 28 | 10% | Crop, blur, packshots |
| ElevenlabsService | 22 | 8% | TTS голоса |
| NanoBananaService | 18 | 7% | Трансформации изображений |
| SeedreamService | 12 | 4% | Image editing |
| LipsyncService | 8 | 3% | Lip-sync (Fal AI) |

## Типичные пайплайны

### Pipeline A: Простая генерация (40% скриптов)
```
Text → Generate Image → Upload S3 → Return URL
```

### Pipeline B: Полная кампания (25% скриптов)
```
Generate Image → Animate → Voiceover → Lipsync →
Captions → Music → Packshot → Aspect Ratio → Upload
```

### Pipeline C: Batch с параллелизмом (20% скриптов)
```
Load Config → Parallel Tasks (3-16 concurrent) →
Collect Results → Save JSON → Upload All
```

### Pipeline D: Только постпродакшн (10% скриптов)
```
Download Video → Edit → Upload → Save Results
```

### Pipeline E: Сложная сборка (5% скриптов)
```
Hook Video → Main Video → B-roll → Packshot →
Concat → Lipsync → Captions → Upload
```

## Частота постпродакшн операций

| Операция | Count | % |
|----------|-------|---|
| Субтитры/каptions | 45 | 16.5% |
| Конвертация aspect ratio | 35 | 12.8% |
| Добавление voiceover | 32 | 11.7% |
| Packshot | 28 | 10.2% |
| Title/text overlay | 22 | 8% |
| Grid/composition | 18 | 6.6% |
| Crop video | 15 | 5.5% |
| Добавление музыки | 14 | 5% |
| Blur background | 10 | 3.6% |
| Splice/compose | 12 | 4.4% |
| Slider effect | 8 | 2.9% |
| Lip-sync | 7 | 2.5% |

## Паттерны параллелизации

```typescript
// Pattern 1: asyncio.gather (180+ uses)
await Promise.all(tasks)

// Pattern 2: Semaphore для rate limiting (80+ uses)
const semaphore = new Semaphore(8)

// Pattern 3: Batching
for (let i = 0; i < items.length; i += BATCH_SIZE) {
  const batch = items.slice(i, i + BATCH_SIZE)
  await Promise.all(batch.map(process))
  await delay(5000) // rate limit
}
```

## Типичные размеры батчей

| Операция | Batch Size | Причина |
|----------|------------|---------|
| Animation (Kling) | 3 | Дорого, rate limits |
| Voiceover (ElevenLabs) | 5 | API limits |
| Lipsync (Fal) | 3 | Долго, rate limits |
| Caption | 5-8 | CPU-bound |
| Image generation | 8-16 | Быстро |
| Upload | 16 | I/O bound |

## Структура конфигурации кампании

```typescript
interface Character {
  id: number
  name: string
  prompt: string
  voice: string  // elevenlabs voice name
  script: string // voiceover text
  hookAction?: string
  voiceSettings?: {
    stability: number  // 0.5-0.7
    style: number      // 0.1-0.5
  }
  packshotType?: 'jesus' | 'church' | 'holy_woman'
}

interface CampaignConfig {
  name: string
  characters: Character[]
  aspectRatios: ('9:16' | '4:5' | '1:1')[]
  videoDuration: 5 | 10 | 15
  outputFolder: string
  voiceoverText?: string  // shared text
}
```

## Стандартные параметры

### Image Generation
```typescript
{
  width: 1152,
  height: 2048,  // 9:16 portrait
  batchSize: 1,
  styleId: '1cb4b936-77bf-4f9a-9039-f3d349a4cdbe', // realistic
  enhancePrompt: true
}
```

### Animation (Kling)
```typescript
{
  modelVersion: 'v2.5-turbo/pro',
  duration: 5 | 10,
  cfgScale: 0.5,
  trackJob: false  // sync mode
}
```

### Voiceover (ElevenLabs)
```typescript
{
  model: 'eleven_multilingual_v2',
  stability: 0.5,
  similarityBoost: 0.75,
  style: 0.0
}
```

### Lipsync (Fal)
```typescript
{
  syncMode: 'cut_off' | 'loop' | 'remap'
}
```

### Captions
```typescript
{
  position: 'bottom' | 'center' | 'lower-middle',
  fontSize: 60,
  activeColor: 'white',
  inactiveColor: '#FFE135', // tiktok yellow
  useBounce: true,
  bounceScale: 1.15
}
```

## Aspect Ratio пресеты

| Format | Resolution | Use Case |
|--------|------------|----------|
| 9:16 | 1080x1920 | TikTok, Reels, Stories |
| 4:5 | 1080x1350 | Instagram Feed |
| 1:1 | 1080x1080 | Square posts |
| 16:9 | 1920x1080 | YouTube, landscape |

## Error Handling паттерны

```typescript
// Pattern 1: Per-task error catching
const results = await Promise.allSettled(tasks)
const successful = results.filter(r => r.status === 'fulfilled')
const failed = results.filter(r => r.status === 'rejected')

// Pattern 2: Result with status
interface TaskResult {
  id: number
  status: 'completed' | 'failed'
  url?: string
  error?: string
  processingTime: number
}

// Pattern 3: Intermediate saves (checkpoints)
for (const batch of batches) {
  const results = await processBatch(batch)
  allResults.push(...results)
  saveResults(allResults) // checkpoint
}
```

## Ключевые инсайты для SDK

### 1. Операции должны быть независимыми и композируемыми
Каждая функция (generateImage, animate, lipsync) должна работать автономно.

### 2. Batch processing — первоклассный гражданин
SDK должен поддерживать батчи с rate limiting из коробки.

### 3. S3 routing обязателен
Все результаты должны автоматически загружаться в S3 с правильной структурой.

### 4. Статусы и метаданные
Каждый результат должен содержать status, processingTime, error.

### 5. Multiple aspect ratios
Одно видео часто конвертируется в несколько форматов (9:16 + 4:5).

### 6. Packshots — отдельная сущность
Packshot = финальный кадр с CTA, требует отдельной функции.

### 7. Composability > Monolithic
Лучше иметь 10 простых функций, чем одну сложную.
