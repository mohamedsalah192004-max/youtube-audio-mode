// This script runs in the main page context to access YouTube's native player API securely
(function() {
    let hooked = false;
    function hookPlayer() {
        const player = document.getElementById('movie_player');
        if (player && player.addEventListener && !hooked) {
            player.addEventListener('onPlaybackQualityChange', (quality) => {
                window.postMessage({ type: 'AM_QUALITY_CHANGE', quality: quality }, '*');
            });
            hooked = true;
        }
    }
    
    hookPlayer();
    document.addEventListener('yt-navigate-finish', hookPlayer);
    setInterval(hookPlayer, 2000);
})();