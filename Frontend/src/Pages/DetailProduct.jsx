import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./DetailProduct.css";
import { toast } from "react-toastify";

const PRODUCT_URL = import.meta.env.VITE_PRODUCT_SERVICE_URL;
const CART_URL = import.meta.env.VITE_CART_SERVICE_URL;

const getRoleFromToken = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    return decoded?.role || null;
  } catch {
    return null;
  }
};

const formatPrice = (amount, currency) => {
  if (amount === undefined || amount === null) return "N/A";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹ ${amount}`;
  }
};

const DetailProduct = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [product, setProduct] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    amount: "",
  });

  const persistToCart = async ({ showSuccessToast = true } = {}) => {
    if (!product?._id) return false;

    try {
      const res = await axios.post(
        `${CART_URL}/items`,
        { productId: product._id, qty: 1 },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        },
      );

      const uniqueCount = res?.data?.cart?.items?.length || 0;
      window.dispatchEvent(
        new CustomEvent("cart-badge", { detail: { count: uniqueCount } }),
      );
      if (showSuccessToast) {
        toast.success("Product added to cart");
      }
      return true;
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Product could not be added to cart. Please try again.",
      );
      return false;
    }
  };

  const handleOrderNow = async () => {
    if (!product?._id) return;

    const added = await persistToCart({ showSuccessToast: false });
    if (!added) {
      return;
    }

    navigate("/checkout", {
      state: {
        checkoutData: {
          itemsTotal: Number(product?.price?.amount || 0),
          deliveryFee: 0,
          tax: Math.round(Number(product?.price?.amount || 0) * 0.18),
          total:
            Number(product?.price?.amount || 0) +
            Math.round(Number(product?.price?.amount || 0) * 0.18),
          itemCount: 1,
          itemTitle: product?.title || "",
          currency: product?.price?.currency || "INR",
        },
      },
    });
  };

  const handleDeleteProduct = async () => {
    if (!id) return;

    setDeleting(true);

    try {
      await axios.delete(`${PRODUCT_URL}/api/products/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      setShowDeleteModal(false);
      toast.success("Product deleted successfully 🎉");
      navigate("/products", {
        replace: true,
        state: { refreshAt: Date.now() },
      });
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Product could not be deleted. Please try again.",
      );
      setShowDeleteModal(false);
    } finally {
      setDeleting(false);
    }
  };

  const openUpdateModal = () => {
    if (!product) return;

    setEditForm({
      title: product.title || "",
      description: product.description || "",
      amount: String(product?.price?.amount ?? ""),
    });
    setShowUpdateModal(true);
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();

    if (!id) return;

    const amountValue = Number(editForm.amount);
    if (!editForm.title.trim() || !editForm.description.trim()) {
      toast.error("Title and description are required");
      return;
    }

    if (Number.isNaN(amountValue) || amountValue < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setUpdating(true);

    try {
      const payload = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        price: {
          amount: amountValue,
          currency: product?.price?.currency || "INR",
        },
      };

      const res = await axios.patch(`${PRODUCT_URL}/api/products/${id}`, payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const updatedProduct = res.data?.product || null;
      if (updatedProduct) {
        setProduct(updatedProduct);
      }

      setShowUpdateModal(false);
      toast.success("Product updated successfully 🎉");
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Product could not be updated. Please try again.",
      );
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchProduct = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await axios.get(`${PRODUCT_URL}/api/products/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        });

        if (!isMounted) return;

        const item = res.data?.product || res.data?.data || null;

        setProduct(item);
        setSelectedImage(0);

        if (item?._id) {
          try {
            const category = String(item.category || "").trim();
            const tokenHeader = {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            };

            const relatedRes = await axios.get(`${PRODUCT_URL}/api/products/`, {
              headers: tokenHeader,
              params: {
                category: category || undefined,
                limit: 8,
              },
            });

            if (!isMounted) return;

            const categoryProducts = relatedRes.data?.data || [];
            let filteredRelated = categoryProducts
              .filter((p) => p?._id && p._id !== item._id)
              .slice(0, 4);

            if (filteredRelated.length === 0) {
              const fallbackRes = await axios.get(`${PRODUCT_URL}/api/products/`, {
                headers: tokenHeader,
                params: {
                  limit: 12,
                },
              });

              if (!isMounted) return;

              filteredRelated = (fallbackRes.data?.data || [])
                .filter((p) => p?._id && p._id !== item._id)
                .slice(0, 4);
            }

            setRelatedProducts(filteredRelated);
          } catch {
            if (isMounted) setRelatedProducts([]);
          }
        }
      } catch (err) {
        if (!isMounted) return;

        setError(
          err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            "Product details could not be loaded. Please refresh and try again.",
        );
        setProduct(null);
        setRelatedProducts([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (id) fetchProduct();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const images = useMemo(() => product?.image || [], [product]);
  const activeImage = images[selectedImage]?.url || images[0]?.url || "";
  const role = getRoleFromToken();
  const isOwner = role === "owner";
  const isUser = role === "user";

  if (loading) {
    return (
      <div className="detail-page">
        <div className="detail-status">Loading product details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="detail-page">
        <div className="detail-status detail-status--error">
          <p>{error}</p>
          <button
            className="detail-back-btn"
            onClick={() => navigate("/products")}
          >
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="detail-page">
        <div className="detail-status">Product not found</div>
      </div>
    );
  }

  return (
    <div className="detail-page">
      <div className="detail-wrap">
        <div className="detail-card">
          <section className="detail-media">
            {activeImage ? (
              <img
                className="detail-main-image"
                src={activeImage}
                alt={product.title}
              />
            ) : (
              <div className="detail-main-image detail-main-image--empty">
                No image available
              </div>
            )}

            {images.length > 1 && (
              <div className="detail-thumbs">
                {images.map((img, index) => (
                  <button
                    key={img.id || img.url || index}
                    className={`detail-thumb ${selectedImage === index ? "detail-thumb--active" : ""}`}
                    onClick={() => setSelectedImage(index)}
                    aria-label={`View image ${index + 1}`}
                  >
                    <img
                      src={img.thumbnail || img.url}
                      alt={`${product.title} ${index + 1}`}
                    />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="detail-content">
            <div className="detail-topbar">
              <button
                className="detail-back-link"
                onClick={() => navigate("/products")}
              >
                ← Products
              </button>
            </div>

            <h1 className="detail-title">{product.title}</h1>

            <p className="detail-price">
              {formatPrice(product?.price?.amount, product?.price?.currency)}
            </p>

            {product.description && (
              <p className="detail-description">{product.description}</p>
            )}

            <div className="detail-meta-grid">
              <div className="detail-meta-item">
                <span>Category</span>
                <strong>{product.category || "N/A"}</strong>
              </div>

              <div className="detail-meta-item">
                <span>Stock</span>
                <strong>{product.stock ?? 0}</strong>
              </div>

              <div className="detail-meta-item">
                <span>Currency</span>
                <strong>{product?.price?.currency || "INR"}</strong>
              </div>

              <div className="detail-meta-item">
                <span>Status</span>
                <strong>
                  {(product.stock ?? 0) > 0 ? "In Stock" : "Out of Stock"}
                </strong>
              </div>
            </div>

            <div className="detail-actions">
              {isUser && (
                <>
                  <button
                    className="detail-action-btn detail-action-btn--primary"
                    onClick={handleOrderNow}
                    disabled={(product.stock ?? 0) <= 0}
                  >
                    Buy Now
                  </button>
                  <button
                    className="detail-action-btn detail-action-btn--secondary"
                    onClick={persistToCart}
                    disabled={(product.stock ?? 0) <= 0}
                  >
                    Add to Cart
                  </button>
                </>
              )}
              {isOwner && (
                <button
                  className="detail-action-btn detail-action-btn--outline"
                  onClick={openUpdateModal}
                  disabled={updating}
                >
                  Update Product
                </button>
              )}
              {isOwner && (
                <button
                  className="detail-action-btn detail-action-btn--danger"
                  onClick={() => setShowDeleteModal(true)}
                  disabled={deleting}
                >
                  Delete Product
                </button>
              )}
            </div>
          </section>
        </div>

        {showDeleteModal && (
          <div
            className="detail-modal-backdrop"
            onClick={() => setShowDeleteModal(false)}
          >
            <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Delete this product?</h3>
              <p>Are you sure to delete this product?</p>
              <div className="detail-modal-actions">
                <button
                  className="detail-modal-btn"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="detail-modal-btn detail-modal-btn--danger"
                  onClick={handleDeleteProduct}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showUpdateModal && (
          <div
            className="detail-modal-backdrop"
            onClick={() => setShowUpdateModal(false)}
          >
            <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
              <h3>Update Product</h3>
              <form className="detail-edit-form" onSubmit={handleUpdateProduct}>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="Title"
                />
                <textarea
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Description"
                  rows={4}
                />
                <input
                  type="number"
                  min="0"
                  value={editForm.amount}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  placeholder="Price (INR)"
                />

                <div className="detail-modal-actions">
                  <button
                    type="button"
                    className="detail-modal-btn"
                    onClick={() => setShowUpdateModal(false)}
                    disabled={updating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="detail-modal-btn detail-modal-btn--confirm"
                    disabled={updating}
                  >
                    {updating ? "Updating..." : "Update"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <section className="detail-related">
          <div className="detail-related-head">
            <h2>Related Products</h2>
            <p>
              {product.category
                ? `${product?.category} picks for you`
                : "Products you may like"}
            </p>
          </div>

          {relatedProducts.length === 0 ? (
            <div className="detail-related-empty">
              No related products available right now.
            </div>
          ) : (
            <div className="detail-related-grid">
              {relatedProducts.map((item) => (
                <article
                  key={item._id}
                  className="detail-related-card"
                  onClick={() => navigate(`/products/${item._id}`)}
                >
                  <div className="detail-related-image-wrap">
                    {item?.image?.[0]?.url ? (
                      <img
                        src={item.image[0].url}
                        alt={item.title}
                        className="detail-related-image"
                      />
                    ) : (
                      <div className="detail-related-image detail-related-image--empty">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="detail-related-body">
                    <h3>{item.title}</h3>
                    <p className="detail-related-price">
                      {formatPrice(item?.price?.amount, item?.price?.currency)}
                    </p>
                    <span className="detail-related-stock">
                      {(item.stock ?? 0) > 0 ? "In Stock" : "Out of Stock"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default DetailProduct;
