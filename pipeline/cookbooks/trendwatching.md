# trendwatching pipeline

discover viral tiktok content for any topic or hashtag using apify scrapers

## overview

use this pipeline to:
- find trending videos for a specific topic/hashtag
- analyze engagement metrics (plays, likes, shares, comments)
- get video urls for inspiration or downloading
- identify top creators in a niche

## steps

### 1. search by hashtag (save to file)

```bash
# get 10 viral videos for a hashtag, save to output/
bun run lib/apify.ts run clockworks/tiktok-scraper '{"hashtags":["relationship"],"resultsPerPage":10}' tiktok-relationship.json
```

### 2. search multiple hashtags

```bash
# search multiple related hashtags
bun run lib/apify.ts run clockworks/tiktok-scraper '{"hashtags":["viral","trending","fyp"],"resultsPerPage":5}' tiktok-viral.json
```

### 3. scrape specific profiles

```bash
# get videos from specific creators
bun run lib/apify.ts run clockworks/tiktok-scraper '{"profiles":["@username"],"resultsPerPage":10}' creator-videos.json
```

### 4. get discover page trends

```bash
# scrape tiktok discover page for trending topics
bun run lib/apify.ts run clockworks/tiktok-discover-scraper '{"hashtags":["fitness"]}' fitness-trends.json
```

### 5. download videos from saved json

download all videos from a saved json file using yt-dlp:

```bash
# download all videos to output/videos/
bun run lib/apify.ts download tiktok-relationship.json

# download to custom directory
bun run lib/apify.ts download tiktok-relationship.json output/my-videos
```

### 6. read saved results

results are saved to `output/<filename>.json` - you can read them later:

```bash
# list all video urls
cat output/tiktok-relationship.json | jq -r '.[].webVideoUrl'

# get top videos by play count
cat output/tiktok-relationship.json | jq 'sort_by(-.playCount) | .[0:3] | .[] | {url: .webVideoUrl, plays: .playCount}'
```

## output data

each video includes:
- `webVideoUrl` - tiktok video url
- `text` - video caption/description
- `playCount` - total views
- `diggCount` - likes
- `shareCount` - shares  
- `commentCount` - comments
- `collectCount` - saves/bookmarks
- `authorMeta` - creator info (name, followers, etc.)
- `musicMeta` - audio/music info
- `hashtags` - all hashtags used
- `createTimeISO` - when posted

## example output

```json
{
  "webVideoUrl": "https://www.tiktok.com/@user/video/123",
  "text": "Not the tiny violin #prank #couples #relationship",
  "playCount": 13200000,
  "diggCount": 2900000,
  "shareCount": 34700,
  "commentCount": 11000,
  "authorMeta": {
    "name": "samandmonica",
    "fans": 4000000
  }
}
```

## available scrapers

| actor | use case |
|-------|----------|
| `clockworks/tiktok-scraper` | general hashtag/profile scraping |
| `clockworks/tiktok-hashtag-scraper` | hashtag-specific scraping |
| `clockworks/tiktok-profile-scraper` | creator profile scraping |
| `clockworks/tiktok-discover-scraper` | trending topics & discover page |
| `clockworks/tiktok-video-scraper` | specific video urls |
| `clockworks/tiktok-comments-scraper` | video comments |

## pricing

apify pay-per-event pricing:
- actor start: $0.005
- per result: $0.003
- video download: $0.001 (optional)

example: 100 videos = ~$0.31

## complete workflow example

```bash
# 1. scrape viral relationship videos
bun run lib/apify.ts run clockworks/tiktok-scraper '{"hashtags":["relationship"],"resultsPerPage":5}' tiktok-relationship.json

# 2. check what we got
cat output/tiktok-relationship.json | jq -r '.[].webVideoUrl'

# 3. download all videos
bun run lib/apify.ts download tiktok-relationship.json

# 4. videos are now in output/videos/
ls output/videos/
```

## tips

- use `resultsPerPage` to limit results and costs
- combine multiple hashtags for broader search
- check `playCount` and `diggCount` ratio for engagement quality
- look at `createTimeISO` to find recent trending content
- save results to json to analyze patterns over time
- download videos for offline analysis or inspiration

## environment

requires `APIFY_TOKEN` in `.env`

```bash
APIFY_TOKEN=apify_api_xxx
```

requires `yt-dlp` for video downloads:

```bash
brew install yt-dlp
```
