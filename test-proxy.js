const http = require('http');
const allAnimeService = require('./src/services/allAnimeService');

(async () => {
  // Step 1: Get the stream data
  console.log('=== Getting stream info ===');
  const slug = await allAnimeService.resolveSlug('Frieren', 'sub');
  const info = await allAnimeService.getEpisodeStreamInfo(slug, 1);
  
  if (!info?.data?.directM3u8) {
    console.log('No M3U8 URL');
    return;
  }

  const m3u8Url = info.data.directM3u8;
  console.log('M3U8 URL:', m3u8Url);

  // Step 2: Check if CDN host resolves
  const urlObj = new URL(m3u8Url);
  console.log('\nCDN Host:', urlObj.hostname);

  // Step 3: Try fetching the M3U8 with CDN headers (like the proxy does)
  console.log('\n=== Testing M3U8 fetch with CDN headers ===');
  try {
    const cdnHeaders = info.data.cdnHeaders || {};
    console.log('CDN Headers:', JSON.stringify(cdnHeaders));
    
    const m3u8Res = await allAnimeService.client.get(m3u8Url, {
      headers: { ...cdnHeaders, 'Accept-Encoding': 'identity' },
      timeout: 10000,
      responseType: 'text',
    });
    console.log('M3U8 status:', m3u8Res.status);
    
    // Parse the M3U8 to get segment/variant URLs
    const lines = m3u8Res.data.split('\n');
    console.log('\nM3U8 content:');
    lines.forEach(l => console.log(' ', l.trim()));
    
    // Step 4: Try fetching a variant playlist URL
    for (const line of lines) {
      if (line.trim() && !line.trim().startsWith('#')) {
        let segUrl = line.trim();
        if (segUrl.startsWith('/')) {
          segUrl = urlObj.origin + segUrl;
        }
        console.log('\n=== Testing variant/segment fetch ===');
        console.log('URL:', segUrl);
        try {
          const segRes = await allAnimeService.client.get(segUrl, {
            headers: { ...cdnHeaders, 'Accept-Encoding': 'identity' },
            timeout: 10000,
            responseType: 'text',
          });
          console.log('Status:', segRes.status);
          console.log('Content-Type:', segRes.headers['content-type']);
          console.log('Content (first 300):', typeof segRes.data === 'string' ? segRes.data.substring(0, 300) : 'binary');
        } catch (segErr) {
          console.error('FAILED:', segErr.message);
          if (segErr.response) {
            console.error('Status:', segErr.response.status);
          }
        }
        break; // Only test first variant
      }
    }
    
    console.log('\n=== PROXY CHAIN TEST PASSED ===');
  } catch (err) {
    console.error('M3U8 fetch FAILED:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
      console.error('Headers:', JSON.stringify(err.response.headers));
    }
  }
})();
