document.addEventListener('DOMContentLoaded', async function () {
    const videoGallery = document.querySelector('.video-gallery');
    const confirmedCarousels = ["LOUIS VUITTON/SS23", "AGAR AGAR/Teaser", "CYDFLM", "COURRÈGES/Loop Bag FW22", "LOUIS VUITTON/show.s", "SIMILI GUM/Dedipix + T pas si triste"];

    async function loadProjects() {
        try {
            const response = await fetch('projects.txt');
            if (!response.ok) throw new Error('Erreur lors du chargement de projects.txt');
            const data = await response.text();

            const projects = parseProjects(data);
            projects.forEach(project => {
                if (project.type === 'single') {
                    videoGallery.appendChild(createSingleProjectElement(project));
                } else if (project.type === 'carousel' && confirmedCarousels.includes(`${project.title}/${project.subtitle}`)) {
                    videoGallery.appendChild(createCarouselProjectElement(project));
                }
            });
        } catch (error) {
            console.error('Erreur de chargement:', error);
        }
    }

    function parseProjects(data) {
        const lines = data.split('\n').filter(line => line.trim() !== '');
        return lines.map(line => {
            const parts = line.split('/');
            const title = parts[0].trim();
            const subtitle = parts[1].trim();
            const thumbnail = parts[2].trim();
            const links = parts.slice(3).join('/').replace('carrousel:', '').split(',');

            return {
                title,
                subtitle,
                thumbnail,
                links,
                type: links.length > 1 ? 'carousel' : 'single'
            };
        });
    }

    function formatVideoUrl(url) {
    if (url.includes('vimeo')) {
        const videoId = url.split('/').pop();
        return `https://player.vimeo.com/video/${videoId}`;
    } else if (url.includes('youtu.be')) {
        const videoId = url.split('/').pop().split('?')[0];
        return `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('youtube.com')) {
        const urlObj = new URL(url);
        const videoId = urlObj.searchParams.get('v');
        return `https://www.youtube.com/embed/${videoId}`;
    }
    return url;
}

    }

    function createSingleProjectElement(project) {
        const div = document.createElement('div');
        div.classList.add('video-thumbnail');
        div.onclick = () => openVideo(project.links[0]);

        const img = document.createElement('img');
        img.src = `images/${project.thumbnail}`;
        img.alt = `Miniature ${project.title}`;
        div.appendChild(img);

        const textContainer = document.createElement('div');
        textContainer.classList.add('video-text-container');
        textContainer.innerHTML = `<span class=\"video-title\">${project.title}</span><span class=\"video-subtitle\">${project.subtitle}</span>`;

        div.appendChild(textContainer);
        return div;
    }

    function createCarouselProjectElement(project) {
        const div = document.createElement('div');
        div.classList.add('video-thumbnail');
        div.onclick = () => openCarousel(project);

        const img = document.createElement('img');
        img.src = `images/${project.thumbnail}`;
        img.alt = `Miniature ${project.title}`;
        div.appendChild(img);

        const textContainer = document.createElement('div');
        textContainer.classList.add('video-text-container');
        textContainer.innerHTML = `<span class=\"video-title\">${project.title}</span><span class=\"video-subtitle\">${project.subtitle}</span>`;

        div.appendChild(textContainer);
        return div;
    }

    window.openVideo = function (videoUrl) {
        const modal = document.getElementById('videoModal');
        const videoFrame = document.getElementById('videoFrame');

        document.getElementById('carouselThumbnails').style.display = "none";
        document.getElementById('previousButton').style.display = "none";
        document.getElementById('nextButton').style.display = "none";

        videoFrame.src = `${formatVideoUrl(videoUrl)}?autoplay=1`;
        modal.style.display = "flex";
    };

    window.closeVideo = function () {
        const modal = document.getElementById('videoModal');
        const videoFrame = document.getElementById('videoFrame');
        videoFrame.src = "";
        modal.style.display = "none";
    };

    window.openCarousel = function (project) {
        const modal = document.getElementById('videoModal');
        const carouselThumbnails = document.getElementById('carouselThumbnails');
        const videoFrame = document.getElementById('videoFrame');
        let currentVideoIndex = 0;

        playVideoAtIndex(currentVideoIndex);

        if (project.links.length > 1) {
            carouselThumbnails.innerHTML = '';
            carouselThumbnails.style.display = 'flex';

            project.links.forEach((link, index) => {
                const thumbnail = document.createElement('img');
                thumbnail.src = link.includes('vimeo') ? `https://vumbnail.com/${link.split('/').pop()}.jpg` : 'images/youtube-placeholder.jpg';
                thumbnail.classList.add('carousel-thumbnail');

                thumbnail.onclick = () => {
                    currentVideoIndex = index;
                    playVideoAtIndex(currentVideoIndex);
                    updateActiveThumbnail();
                };
                carouselThumbnails.appendChild(thumbnail);
            });

            document.getElementById('previousButton').style.display = 'block';
            document.getElementById('nextButton').style.display = 'block';

            document.getElementById('previousButton').onclick = () => {
                currentVideoIndex = (currentVideoIndex - 1 + project.links.length) % project.links.length;
                playVideoAtIndex(currentVideoIndex);
                updateActiveThumbnail();
            };

            document.getElementById('nextButton').onclick = () => {
                currentVideoIndex = (currentVideoIndex + 1) % project.links.length;
                playVideoAtIndex(currentVideoIndex);
                updateActiveThumbnail();
            };

            updateActiveThumbnail();
        } else {
            carouselThumbnails.style.display = 'none';
            document.getElementById('previousButton').style.display = 'none';
            document.getElementById('nextButton').style.display = 'none';
        }

        modal.style.display = "flex";

        function playVideoAtIndex(index) {
            videoFrame.src = `${formatVideoUrl(project.links[index])}?autoplay=1`;
        }

        function updateActiveThumbnail() {
            carouselThumbnails.querySelectorAll('.carousel-thumbnail').forEach((thumb, idx) => {
                thumb.classList.toggle('active', idx === currentVideoIndex);
            });
        }
    };

    loadProjects();

    document.getElementById('videoModal').addEventListener('click', function(event) {
        if (event.target === document.getElementById('videoModal')) closeVideo();
    });
});
