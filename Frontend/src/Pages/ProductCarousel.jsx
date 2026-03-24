import { useEffect, useState } from "react";
import "../ProductCarousel.css";

function ProductCarousel() {
  const slides = [
    {
      image:
        "https://images.pexels.com/photos/1835765/pexels-photo-1835765.jpeg",
      title: "Freshly Baked Every Morning",
      description:
        "Soft breads, crispy crusts, and bakery classics made with premium ingredients.",
    },
    {
      image: "https://images.pexels.com/photos/851204/pexels-photo-851204.jpeg",
      title: "Delicious Celebration Cakes",
      description:
        "Handcrafted cakes for birthdays and special occasions with rich flavors.",
    },
    {
      image:
        "https://images.pexels.com/photos/1414234/pexels-photo-1414234.jpeg",
      title: "Pastries You’ll Love",
      description:
        "Layered, buttery, and perfectly sweet pastries baked to perfection.",
    },
  ];

  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [disableTransition, setDisableTransition] = useState(false);

  const loopSlides = [...slides, slides[0]];
  const visibleSlide = activeSlide === slides.length ? 0 : activeSlide;

  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setActiveSlide((prev) => prev + 1);
    }, 3800);

    return () => clearInterval(timer);
  }, [isPaused, slides.length]);

  const goToPrevious = () => {
    setDisableTransition(false);
    setActiveSlide((prev) => {
      if (prev === 0) return slides.length - 1;
      if (prev === slides.length) return slides.length - 1;
      return prev - 1;
    });
  };

  const goToNext = () => {
    setDisableTransition(false);
    setActiveSlide((prev) => prev + 1);
  };

  const handleTrackTransitionEnd = () => {
    if (activeSlide === slides.length) {
      setDisableTransition(true);
      setActiveSlide(0);
    }
  };

  useEffect(() => {
    if (disableTransition) {
      const raf = requestAnimationFrame(() => {
        setDisableTransition(false);
      });

      return () => cancelAnimationFrame(raf);
    }
  }, [disableTransition]);

  return (
    <section
      className="pcar-root"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label="Featured products carousel"
    >
      <div
        className={`pcar-track ${disableTransition ? "pcar-track--no-transition" : ""}`}
        style={{ transform: `translateX(-${activeSlide * 100}%)` }}
        onTransitionEnd={handleTrackTransitionEnd}
      >
        {loopSlides.map((slide, index) => (
          <article
            className="pcar-slide"
            key={`${slide.image}-${index}`}
            aria-hidden={visibleSlide !== index % slides.length}
          >
            <img src={slide.image} alt={slide.title} className="pcar-image" />
            <div className="pcar-overlay" />
            <div className="pcar-caption">
              <h3>{slide.title}</h3>
              <p>{slide.description}</p>
            </div>
          </article>
        ))}
      </div>

      <button
        className="pcar-arrow pcar-arrow--left"
        onClick={goToPrevious}
        aria-label="Previous slide"
      >
        ‹
      </button>
      <button
        className="pcar-arrow pcar-arrow--right"
        onClick={goToNext}
        aria-label="Next slide"
      >
        ›
      </button>

      <div
        className="pcar-dots"
        role="tablist"
        aria-label="Carousel indicators"
      >
        {slides.map((_, index) => (
          <button
            key={index}
            className={`pcar-dot ${visibleSlide === index ? "pcar-dot--active" : ""}`}
            onClick={() => {
              setDisableTransition(false);
              setActiveSlide(index);
            }}
            aria-label={`Go to slide ${index + 1}`}
            aria-selected={visibleSlide === index}
            role="tab"
          />
        ))}
      </div>
    </section>
  );
}

export default ProductCarousel;
