const allAnimeService = require('./src/services/allAnimeService');

(async () => {
  try {
    console.log('=== Step 1: Resolve slug ===');
    const slug = await allAnimeService.resolveSlug('Frieren', 'sub');
    console.log('Slug:', slug);

    if (!slug) { console.log('FAILED: No slug found'); return; }

    console.log('\n=== Step 2: Get episode stream info ===');
    const info = await allAnimeService.getEpisodeStreamInfo(slug, 1);
    
    if (!info?.data?.embedUrl) {
      console.log('FAILED: No embed URL');
      console.log('Full result:', JSON.stringify(info, null, 2));
      return;
    }
    console.log('Embed URL:', info.data.embedUrl);
    console.log('Direct M3U8:', info.data.directM3u8 || 'NONE');

    if (info.data.directM3u8) {
      console.log('\n=== Step 3: Verify M3U8 is accessible ===');
      try {
        const m3u8Res = await allAnimeService.client.get(info.data.directM3u8, {
          headers: info.data.cdnHeaders || {},
          timeout: 10000,
          responseType: 'text'
        });
        console.log('M3U8 status:', m3u8Res.status);
        console.log('M3U8 content (first 500 chars):', m3u8Res.data.substring(0, 500));
        console.log('\n=== ALL STEPS PASSED ===');
      } catch (m3u8Err) {
        console.error('M3U8 fetch FAILED:', m3u8Err.message);
        if (m3u8Err.response) {
          console.error('Status:', m3u8Err.response.status);
          console.error('Headers:', JSON.stringify(m3u8Err.response.headers));
        }
      }
    } else {
      console.log('\nNo direct M3U8 - only embed URL available');
      console.log('The embed URL would need to be played in an iframe');
    }
  } catch (err) {
    console.error('ERROR:', err.message);
  }
})();
