const PRODUCT_URL = import.meta.env.VITE_PRODUCT_SERVICE_URL;
import { useCallback, useEffect, useState } from "react";
import "../Products.css";
import CreateProduct from "./CreateProduct";
import { Outlet, useNavigate } from "react-router-dom";
import axios from "axios";
import { ThreeDots } from "react-loader-spinner";
import ProductCarousel from "./ProductCarousel";

const parseJwtPayload = (token) => {
  try {
    const payloadPart = token?.split(".")?.[1];
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const CATEGORIES = [
  "All Products",
  "Breads",
  "Cakes",
  "Pastries",
  "Cookies",
  "Seasonal",
  "Beverages",
];

const Product = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All Products");
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const rawAuthUser = localStorage.getItem("authUser");

  let authUser = null;
  try {
    authUser = rawAuthUser ? JSON.parse(rawAuthUser) : null;
  } catch {
    authUser = null;
  }

  const jwtPayload = parseJwtPayload(token);
  const role = authUser?.role || jwtPayload?.role || "user";
  const canCreateProduct = role === "owner";
  const showUserSidebarAnchor = role === "user";

  const PAGE_SIZE = 20;

  const fetchProducts = useCallback(
    async (skipVal = 0, append = false, category = activeCategory) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);

        const selectedCategory =
          category && category !== "All Products" ? category : undefined;

        const res = await axios.get(`${PRODUCT_URL}/api/products/`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          params: {
            skip: skipVal,
            limit: PAGE_SIZE,
            category: selectedCategory,
          },
        });

        const list = res.data?.data ?? [];

        if (append) {
          setProducts((prev) => [...prev, ...list]);
        } else {
          setProducts(list);
        }

        setSkip(skipVal + list.length);
        setHasMore(list.length === PAGE_SIZE);
      } catch (err) {
        console.error(
          "Error fetching products:",
          err?.response?.data || err.message,
        );
        if (!append) setProducts([]);
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [activeCategory],
  );

  const handleLoadMore = useCallback(() => {
    fetchProducts(skip, true, activeCategory);
  }, [activeCategory, fetchProducts, skip]);

  useEffect(() => {
    fetchProducts(0, false, activeCategory);
  }, [activeCategory, fetchProducts]);

  const filtered = products.filter((p) => {
    const stock = Number(p?.stock ?? 0);
    const inStock = stock > 0;
    const matchSearch = p?.title
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return inStock && matchSearch;
  });

  return (
    <div className="prod-root">
      {/* ── MAIN CONTENT ────────────────────────────────────── */}
      <main className="prod-main">
        {/* Title row */}
        <div className="prod-title-row">
          <div className="prod-title-with-menu">
            {showUserSidebarAnchor && (
              <div id="user-sidebar-anchor" className="user-sidebar-anchor" />
            )}
            <h1 className="prod-title">Products</h1>
          </div>
          <div className="prod-title-actions">
            <div className="prod-search-wrap">
              <span className="prod-search-icon">🔍</span>
              <input
                className="prod-search"
                type="text"
                placeholder="Search product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {canCreateProduct && (
              <button
                className="prod-add-btn"
                onClick={() => setShowCreate(true)}
              >
                <span>＋</span> Add New Product
              </button>
            )}
            {showCreate && canCreateProduct && (
              <div
                className="modal-backdrop"
                onClick={() => setShowCreate(false)}
              >
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                  <CreateProduct
                    onClose={() => setShowCreate(false)}
                    onCreated={() => fetchProducts(0, false, activeCategory)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <ProductCarousel />

        {/* Category tabs */}
        <div className="prod-tabs">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`prod-tab ${activeCategory === cat ? "prod-tab--active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product grid */}
        {loading ? (
          <div className="prod-loading">
            <span className="spinner" />
            <ThreeDots height="80" width="80" color="#e87c2a" visible={true} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="prod-empty">
            <span>🔎</span>
            <p>No products found</p>
          </div>
        ) : (
          <div className="prod-grid">
            {filtered.map((p) => (
              <div
                key={p._id}
                className="prod-card"
                onClick={() => navigate(`/products/${p._id}`)}
              >
                <div
                  className="prod-card-img"
                  style={{
                    backgroundImage: `url(${p.image?.[0]?.url})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <button className="prod-card-arrow" aria-label="View product">
                    ↗
                  </button>
                </div>

                <div className="prod-card-body">
                  <p className="prod-card-name">{p.title}</p>

                  <p className="prod-card-price">₹ {p.price?.amount}</p>

                  <div className="prod-card-meta">
                    <span>
                      Stock <strong>{p.stock}</strong>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading &&
          hasMore &&
          activeCategory === "All Products" &&
          !searchQuery.trim() && (
            <div className="prod-load-more">
              <button
                className="prod-load-more-btn"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading..." : "Load More Products"}
              </button>
            </div>
          )}

        <Outlet />
      </main>
    </div>
  );
};

export default Product;
