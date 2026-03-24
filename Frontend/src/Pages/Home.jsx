import React from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";
import salesImg from "../assets/Sales.png";
import inventoryImg from "../assets/Inventory.png";
import receiptImg from "../assets/Reciept.png";
import ordersImg from "../assets/Orders.png";

const Home = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const rawAuthUser = localStorage.getItem("authUser");
  let authUser = null;
  try {
    authUser = rawAuthUser ? JSON.parse(rawAuthUser) : null;
  } catch {
    authUser = null;
  }
  const isLoggedIn = Boolean(token);
  const username = authUser?.name?.split(" ")[0] || null;
  const currentYear = new Date().getFullYear();
  const dashboardShots = [
    {
      title: "Track Sales",
      src: salesImg,
      alt: "BakeFlow sales performance dashboard screenshot",
    },
    {
      title: "Manage Inventory",
      src: inventoryImg,
      alt: "BakeFlow inventory management table screenshot",
    },
    {
      title: "Digital Receipt",
      src: receiptImg,
      alt: "BakeFlow payment receipt screenshot",
    },
    {
      title: "Track Orders",
      src: ordersImg,
      alt: "BakeFlow orders and sales tracking screenshot",
    },
  ];

  return (
    <main className="home-page">
      <section className="hero-root">
        {/* Floating welcome tag */}
        <div className="hero-tag">
          <span className="hero-tag-dot" />
          {isLoggedIn && username
            ? `Welcome back, ${username}!`
            : "Fresh baked, every day"}
        </div>

        {/* Brand logo icon */}
        <div className="hero-logo-wrap">
          <img src="/logo.png" alt="BakeFlow" className="hero-logo-img" />
        </div>

        {/* Headline */}
        <h1 className="hero-heading">
          Experience the Future of{" "}
          <span className="hero-heading-accent">Baking</span>
        </h1>

        {/* Subtitle */}
        <p className="hero-sub">
          Streamline bakery operations manage orders track inventory and grow
          your business with Bakeflow.
        </p>

        {/* CTA buttons */}
        <div className="hero-actions">
          <button
            className="hero-btn hero-btn--primary"
            onClick={() =>
              navigate(
                isLoggedIn && authUser?.role !== "owner"
                  ? "/products"
                  : "/login",
              )
            }
          >
            <span>✦</span> Order Now
          </button>
          <button
            className="hero-btn hero-btn--secondary"
            onClick={() => navigate("/login?role=owner")}
          >
            Owner Login
          </button>
        </div>
      </section>

      <section className="home-section">
        <h2 className="home-section-title">Features</h2>
        <div className="home-grid home-grid--four">
          <article className="home-card">
            <h3>Order Management</h3>
            <p>
              Track incoming and completed bakery orders in one clear workflow.
            </p>
          </article>
          <article className="home-card">
            <h3>Inventory Tracking</h3>
            <p>
              Monitor ingredient and product stock to avoid shortages and waste.
            </p>
          </article>
          <article className="home-card">
            <h3>Payment System</h3>
            <p>
              Manage secure payments and keep transaction details organized.
            </p>
          </article>
          <article className="home-card">
            <h3>Sales Analytics</h3>
            <p>
              Understand what sells best and make smarter daily business
              decisions.
            </p>
          </article>
        </div>
      </section>

      <section className="home-section home-section--muted">
        <h2 className="home-section-title">How It Works</h2>
        <div className="home-grid home-grid--steps">
          <article className="home-step">
            <span className="home-step-number">1</span>
            <p>Customers place an order.</p>
          </article>
          <article className="home-step">
            <span className="home-step-number">2</span>
            <p>Bakery receives orders in the dashboard.</p>
          </article>
          <article className="home-step">
            <span className="home-step-number">3</span>
            <p>Owner manages products and inventory.</p>
          </article>
          <article className="home-step">
            <span className="home-step-number">4</span>
            <p>Order is processed and completed.</p>
          </article>
        </div>
      </section>

      <section className="home-section">
        <div className="home-dashboard-head">
          <h2 className="home-section-title">Dashboard</h2>
          <p className="home-dashboard-subtitle">
            Track Sales, Manage Inventory, Digital Receipt and Track Orders.
          </p>
        </div>

        <div className="home-dashboard-gallery">
          {dashboardShots.map((shot) => (
            <article className="home-dashboard-shot" key={shot.title}>
              <img src={shot.src} alt={shot.alt} loading="lazy" />
              <h3>{shot.title}</h3>
            </article>
          ))}
        </div>

        <div className="home-dashboard-panel">
          <p>
            Your BakeFlow dashboard gives a complete view of orders, products,
            inventory, and payment flow so you can run your bakery with
            confidence.
          </p>
          <button
            className="hero-btn hero-btn--secondary"
            onClick={() => navigate("/owner/dashboard")}
          >
            Open Dashboard
          </button>
        </div>
      </section>

      <section className="home-section home-section--muted">
        <h2 className="home-section-title">Benefits</h2>
        <div className="home-grid home-grid--four">
          <article className="home-card">
            <h3>Easy Order Management</h3>
            <p>Handle bakery orders quickly without manual confusion.</p>
          </article>
          <article className="home-card">
            <h3>Faster Operations</h3>
            <p>Keep your daily process smooth from order to fulfillment.</p>
          </article>
          <article className="home-card">
            <h3>Organized Inventory</h3>
            <p>Maintain better stock visibility across every product line.</p>
          </article>
          <article className="home-card">
            <h3>Better Sales Tracking</h3>
            <p>Measure performance and identify growth opportunities.</p>
          </article>
        </div>
      </section>

      <section className="home-section home-cta">
        <h2 className="home-section-title">
          Ready to Manage Your Bakery Smarter?
        </h2>
        <p>
          Start with BakeFlow today and simplify every part of your bakery
          operations.
        </p>
        <div className="hero-actions">
          <button
            className="hero-btn hero-btn--primary"
            onClick={() => navigate(isLoggedIn ? "/products" : "/register")}
          >
            Get Started
          </button>
          
        </div>
      </section>

      <footer className="home-footer">
        <div className="home-footer-links">
          <span>Contact</span>
          <span>About</span>
          <span>Copyright {currentYear} BakeFlow</span>
        </div>
      </footer>
    </main>
  );
};

export default Home;
