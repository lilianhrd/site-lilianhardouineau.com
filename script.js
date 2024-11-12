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
                type: links.length > 1 ? 'carousel' : 'single' // Définit le type en fonction du nombre de liens
            };
        });
    }

    function formatVimeoUrl(url) {
        return `https://player.vimeo.com/video/${url.split('/').pop()}`;
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
        textContainer.innerHTML = `<span class="video-title">${project.title}</span><span class="video-subtitle">${project.subtitle}</span>`;

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
        textContainer.innerHTML = `<span class="video-title">${project.title}</span><span class="video-subtitle">${project.subtitle}</span>`;

        div.appendChild(textContainer);
        return div;
    }

    window.openVideo = function (videoUrl) {
        const modal = document.getElementById('videoModal');
        const videoFrame = document.getElementById('videoFrame');
        
        // Masquer le carrousel et les boutons pour une vidéo unique
        document.getElementById('carouselThumbnails').style.display = "none";
        document.getElementById('previousButton').style.display = "none";
        document.getElementById('nextButton').style.display = "none";

        // Charger la vidéo unique
        videoFrame.src = `${formatVimeoUrl(videoUrl)}?autoplay=1`;
        modal.style.display = "flex";
    };

    window.closeVideo = function () {
        const modal = document.getElementById('videoModal');
        const videoFrame = document.getElementById('videoFrame');
        videoFrame.src = "";
        modal.style.display = "none";
    };

    // Fonction pour ouvrir un carrousel avec les miniatures
    window.openCarousel = function (project) {
        const modal = document.getElementById('videoModal');
        const carouselThumbnails = document.getElementById('carouselThumbnails');
        const videoFrame = document.getElementById('videoFrame');
        let currentVideoIndex = 0;

        // Charge la première vidéo du carrousel dans le lecteur principal
        playVideoAtIndex(currentVideoIndex);

        if (project.links.length > 1) { // Affiche les miniatures uniquement si le projet a plusieurs vidéos
            carouselThumbnails.innerHTML = '';
            carouselThumbnails.style.display = 'flex';

            project.links.forEach((link, index) => {
                const videoId = link.split('/').pop();
                const thumbnail = document.createElement('img');
                
                // Utilise l'URL de l'image de couverture Vimeo
                thumbnail.src = `https://vumbnail.com/${videoId}.jpg`;
                thumbnail.classList.add('carousel-thumbnail');

                thumbnail.onerror = () => {
                    thumbnail.src = 'images/placeholder.jpg'; // Image par défaut si le chargement échoue
                };

                if (index === currentVideoIndex) thumbnail.classList.add('active');
                
                thumbnail.onclick = () => {
                    currentVideoIndex = index;
                    playVideoAtIndex(currentVideoIndex);
                    updateActiveThumbnail();
                };
                carouselThumbnails.appendChild(thumbnail);
            });

            // Affiche les boutons de navigation uniquement si le projet contient plusieurs vidéos
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
            // Si le projet n'est pas en carrousel (une seule vidéo), masque les miniatures et les boutons
            carouselThumbnails.style.display = 'none';
            document.getElementById('previousButton').style.display = 'none';
            document.getElementById('nextButton').style.display = 'none';
        }

        modal.style.display = "flex";

        // Fonction pour jouer la vidéo à un index spécifique
        function playVideoAtIndex(index) {
            videoFrame.src = `${formatVimeoUrl(project.links[index])}?autoplay=1`;
        }

        // Fonction pour mettre à jour l'apparence des miniatures
        function updateActiveThumbnail() {
            carouselThumbnails.querySelectorAll('.carousel-thumbnail').forEach((thumb, idx) => {
                thumb.classList.toggle('active', idx === currentVideoIndex);
            });
        }
    };

    loadProjects();
});

// Fonction pour fermer la vidéo lorsque l'utilisateur clique sur la page sombre
document.getElementById('videoModal').addEventListener('click', function(event) {
    // Vérifie si l'événement a eu lieu en dehors de la zone du lecteur vidéo
    if (event.target === document.getElementById('videoModal')) {
        closeVideo(); // Ferme la vidéo
    }
});
