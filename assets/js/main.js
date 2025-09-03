// Enhanced Portfolio JavaScript
document.addEventListener('DOMContentLoaded', function() {
    
    // Typewriter Effect
    const typewriterElement = document.querySelector('.typewriter');
    if (typewriterElement) {
        const text = typewriterElement.dataset.text;
        let i = 0;
        typewriterElement.innerHTML = '';
        typewriterElement.style.borderRight = '2px solid rgba(255, 255, 255, 0.7)';
        
        function typeWriter() {
            if (i < text.length) {
                typewriterElement.innerHTML += text.charAt(i);
                i++;
                setTimeout(typeWriter, 100);
            } else {
                // Blinking cursor
                setInterval(() => {
                    typewriterElement.style.borderRight = 
                        typewriterElement.style.borderRight === '2px solid transparent' 
                        ? '2px solid rgba(255, 255, 255, 0.7)' 
                        : '2px solid transparent';
                }, 750);
            }
        }
        
        setTimeout(typeWriter, 2000);
    }
    
    // Particles Background
    function createParticles() {
        const particlesContainer = document.getElementById('particles');
        if (!particlesContainer) return;
        
        const particleCount = 50;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'absolute';
            particle.style.width = Math.random() * 4 + 1 + 'px';
            particle.style.height = particle.style.width;
            particle.style.background = `rgba(${Math.random() * 100 + 100}, ${Math.random() * 100 + 150}, 255, ${Math.random() * 0.5 + 0.2})`;
            particle.style.borderRadius = '50%';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.animation = `floatParticle ${Math.random() * 10 + 10}s linear infinite`;
            particle.style.animationDelay = Math.random() * 10 + 's';
            
            particlesContainer.appendChild(particle);
        }
        
        // Add CSS for particle animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes floatParticle {
                0% {
                    transform: translateY(100vh) rotate(0deg);
                    opacity: 0;
                }
                10% {
                    opacity: 1;
                }
                90% {
                    opacity: 1;
                }
                100% {
                    transform: translateY(-100px) rotate(360deg);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    createParticles();
    
    // Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const targetPosition = targetElement.offsetTop - 100;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });


    // Scroll Animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Counter animation for stats
                if (entry.target.classList.contains('stat-number')) {
                    animateCounter(entry.target);
                }
            }
        });
    }, observerOptions);

    // Add fade-in class to elements and observe them
    const animatedElements = document.querySelectorAll('section > div, .project-card-3d, .skill-card, .stat-item');
    animatedElements.forEach((element, index) => {
        element.classList.add('fade-in');
        element.style.transitionDelay = `${index * 0.1}s`;
        observer.observe(element);
    });

    // Counter Animation for Stats
    function animateCounter(element) {
        const target = element.textContent;
        const isInfinity = target === '∞';
        
        if (isInfinity) return;
        
        const number = parseInt(target.replace(/\D/g, ''));
        const duration = 2000;
        const step = number / (duration / 16);
        let current = 0;
        
        const counter = setInterval(() => {
            current += step;
            if (current >= number) {
                element.textContent = target;
                clearInterval(counter);
            } else {
                element.textContent = Math.floor(current) + '+';
            }
        }, 16);
    }

    // Parallax Effect for Background Shapes
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const shapes = document.querySelectorAll('.shape');
        
        shapes.forEach((shape, index) => {
            const speed = (index + 1) * 0.5;
            shape.style.transform = `translateY(${scrolled * speed}px)`;
        });
    });

    // 3D Tilt Effect for Project Cards
    const projectCards = document.querySelectorAll('.project-card-3d');
    
    projectCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = (y - centerY) / centerY * -10;
            const rotateY = (x - centerX) / centerX * 10;
            
            const inner = card.querySelector('.project-card-inner');
            inner.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(20px)`;
        });
        
        card.addEventListener('mouseleave', () => {
            const inner = card.querySelector('.project-card-inner');
            inner.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
        });
    });

    // Cursor Trail Effect
    let mouseX = 0, mouseY = 0;
    let trailElements = [];
    const trailLength = 10;
    
    // Create trail elements
    for (let i = 0; i < trailLength; i++) {
        const trail = document.createElement('div');
        trail.style.position = 'fixed';
        trail.style.width = '10px';
        trail.style.height = '10px';
        trail.style.borderRadius = '50%';
        trail.style.background = `rgba(99, 102, 241, ${0.5 - i * 0.05})`;
        trail.style.pointerEvents = 'none';
        trail.style.zIndex = '9999';
        trail.style.transition = 'all 0.3s ease';
        document.body.appendChild(trail);
        trailElements.push({element: trail, x: 0, y: 0});
    }
    
    // Update mouse position
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
    
    // Animate trail
    function animateTrail() {
        let x = mouseX, y = mouseY;
        
        trailElements.forEach((trail, index) => {
            trail.element.style.left = x - 5 + 'px';
            trail.element.style.top = y - 5 + 'px';
            trail.element.style.transform = `scale(${1 - index * 0.1})`;
            
            const nextElement = trailElements[index + 1] || {x: mouseX, y: mouseY};
            x += (nextElement.x - x) * 0.3;
            y += (nextElement.y - y) * 0.3;
            trail.x = x;
            trail.y = y;
        });
        
        requestAnimationFrame(animateTrail);
    }
    
    animateTrail();

    console.log('🚀 Portfolio loaded with enhanced animations!');
});