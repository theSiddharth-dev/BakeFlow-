import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "./Cart.css";

const CART_URL = import.meta.env.VITE_CART_SERVICE_URL;
const PRODUCT_URL = import.meta.env.VITE_PRODUCT_SERVICE_URL;

const calculateTotals = (items) => {
  const subtotal = items.reduce(
    (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0),
    0,
  );
  const tax = Math.round(subtotal * 0.18);
  return {
    subtotal,
    tax,
    total: subtotal + tax,
  };
};

const formatPrice = (amount) => {
  if (amount === undefined || amount === null) return "₹0.00";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹${amount}`;
  }
};

const TrashIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    className="cart-trash-icon"
  >
    <path
      d="M4 7h16"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M10 11v6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M14 11v6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M6 7l1 12a2 2 0 0 0 2 1.8h6a2 2 0 0 0 2-1.8L18 7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path
      d="M9 7V5.7A1.7 1.7 0 0 1 10.7 4h2.6A1.7 1.7 0 0 1 15 5.7V7"
      stroke="currentColor"
      strokeWidth="1.8"
    />
  </svg>
);

const Cart = () => {
  const [cart, setCart] = useState([]);
  const [totals, setTotals] = useState({ subtotal: 0, tax: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const requestConfig = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const fetchCart = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setLoading(true);
      }

      try {
        const res = await axios.get(`${CART_URL}/items`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const items = res.data?.items || [];
        const hydratedItems = await Promise.all(
          items.map(async (item) => {
            try {
              const productRes = await axios.get(
                `${PRODUCT_URL}/api/products/${item.productId}`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                },
              );
              const product =
                productRes.data?.product || productRes.data?.data || {};

              return {
                ...item,
                image: product?.image?.[0]?.url || "",
                category: product?.category || "General",
                title: product?.title || item.name,
                unitPrice: product?.price?.amount ?? item.price,
              };
            } catch {
              return {
                ...item,
                image: "",
                category: "General",
                title: item.name,
                unitPrice: item.price,
              };
            }
          }),
        );

        setCart(hydratedItems);
        setTotals(res.data?.totals || calculateTotals(hydratedItems));
      } catch (err) {
        console.error(
          "Failed to fetch cart:",
          err?.response?.data || err.message,
        );
        setCart([]);
        setTotals({ subtotal: 0, tax: 0, total: 0 });
      } finally {
        if (showLoader) {
          setLoading(false);
        }
      }
    },
    [token],
  );

  const updateQty = async (productId, qty) => {
    if (qty <= 0) {
      await removeItem(productId);
      return;
    }

    setActionLoading(`qty-${productId}`);
    try {
      await axios.patch(
        `${CART_URL}/items/${productId}`,
        { qty },
        requestConfig,
      );
      setCart((prev) => {
        const nextItems = prev.map((item) =>
          item.productId === productId ? { ...item, quantity: qty } : item,
        );
        setTotals(calculateTotals(nextItems));
        return nextItems;
      });
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Quantity could not be updated. Please try again.",
      );
    } finally {
      setActionLoading("");
    }
  };

  const removeItem = async (productId) => {
    setActionLoading(`delete-${productId}`);
    try {
      await axios.delete(`${CART_URL}/items/${productId}`, requestConfig);
      setCart((prev) => {
        const nextItems = prev.filter((item) => item.productId !== productId);
        setTotals(calculateTotals(nextItems));
        return nextItems;
      });
      toast.success("Item removed from cart");
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Item could not be removed. Please try again.",
      );
    } finally {
      setActionLoading("");
    }
  };

  const handleBuyNowFromCart = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    const deliveryFee = 0;
    navigate("/checkout", {
      state: {
        checkoutData: {
          itemsTotal: totals.subtotal,
          deliveryFee,
          tax: totals.tax,
          total: totals.subtotal + totals.tax,
          itemCount: cart.length,
          currency: "INR",
        },
      },
    });
  };

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  if (loading) {
    return (
      <div className="cart-page">
        <div className="cart-container">
          <p className="cart-status">Loading cart...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-container">
        <div className="cart-head">
          <h1>My Cart</h1>
          <button className="cart-back-btn" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>

        {cart.length === 0 ? (
          <p className="cart-status">Cart is empty</p>
        ) : (
          <>
            <div className="cart-main-grid">
              <section className="cart-products-col">
                <div className="cart-table-head" aria-hidden="true">
                  <span>Product</span>
                  <span>Quantity</span>
                  <span>Price</span>
                </div>

                <div className="cart-list">
                  {cart.map((item) => (
                    <article className="cart-item" key={item.productId}>
                      <div className="cart-item-main">
                        <div className="cart-image-wrap">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.title}
                              className="cart-image"
                            />
                          ) : (
                            <div className="cart-image cart-image--empty">
                              No Image
                            </div>
                          )}
                        </div>

                        <div className="cart-item-info">
                          <h3>{item.title}</h3>
                          <p>Category: {item.category || "Cakes"}</p>
                        </div>
                      </div>

                      <div className="cart-qty-control">
                        <button
                          onClick={() =>
                            updateQty(item.productId, item.quantity - 1)
                          }
                          disabled={
                            actionLoading === `qty-${item.productId}` ||
                            actionLoading === `delete-${item.productId}`
                          }
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          onClick={() =>
                            updateQty(item.productId, item.quantity + 1)
                          }
                          disabled={
                            actionLoading === `qty-${item.productId}` ||
                            actionLoading === `delete-${item.productId}`
                          }
                        >
                          +
                        </button>
                      </div>

                      <div className="cart-price-group">
                        <strong>
                          {formatPrice(item.unitPrice * item.quantity)}
                        </strong>
                      </div>

                      <button
                        className="cart-delete-btn"
                        onClick={() => removeItem(item.productId)}
                        disabled={
                          actionLoading === `delete-${item.productId}` ||
                          actionLoading === `qty-${item.productId}`
                        }
                        aria-label={`Remove ${item.title}`}
                      >
                        <TrashIcon />
                      </button>
                    </article>
                  ))}
                </div>
              </section>

              <aside className="cart-summary-board">
                <h3>Order Summary</h3>
                <div>
                  <span>Items</span>
                  <strong>{cart.length}</strong>
                </div>
                <div>
                  <span>Subtotal</span>
                  <strong>{formatPrice(totals.subtotal)}</strong>
                </div>
                <div>
                  <span>Tax (18%)</span>
                  <strong>{formatPrice(totals.tax)}</strong>
                </div>
                <div className="cart-summary-total">
                  <span>Total</span>
                  <strong>{formatPrice(totals.total)}</strong>
                </div>

                <div className="cart-footer-actions">
                  <button
                    className="cart-action cart-action--checkout"
                    onClick={handleBuyNowFromCart}
                    disabled={cart.length === 0}
                  >
                    Buy Now
                  </button>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Cart;
