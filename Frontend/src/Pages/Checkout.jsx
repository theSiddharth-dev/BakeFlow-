import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import "./Checkout.css";

const CART_URL = import.meta.env.VITE_CART_SERVICE_URL;
const ORDER_URL = import.meta.env.VITE_ORDER_SERVICE_URL;

const formatPrice = (amount, currency = "INR") => {
  if (amount === undefined || amount === null) return "₹0.00";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹${amount}`;
  }
};

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const incomingData = location.state?.checkoutData || null;

  const token = localStorage.getItem("token");
  const rawAuthUser = localStorage.getItem("authUser");

  let authUser = null;
  try {
    authUser = rawAuthUser ? JSON.parse(rawAuthUser) : null;
  } catch {
    authUser = null;
  }

  const customerName =
    [authUser?.firstName, authUser?.lastName].filter(Boolean).join(" ") ||
    authUser?.username ||
    "Customer";

  const [address, setAddress] = useState({
    street: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
  });
  const [summary, setSummary] = useState({
    itemsTotal: 0,
    deliveryFee: 0,
    tax: 0,
    total: 0,
    currency: "INR",
  });
  const [editingAddress, setEditingAddress] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);

  useEffect(() => {
    const savedAddress = localStorage.getItem("checkoutShippingAddress");
    if (savedAddress) {
      try {
        const parsed = JSON.parse(savedAddress);
        setAddress((prev) => ({ ...prev, ...parsed }));
        setEditingAddress(false);
      } catch {
        setEditingAddress(true);
      }
    }
  }, []);

  useEffect(() => {
    if (incomingData) {
      setSummary({
        itemsTotal: Number(incomingData.itemsTotal || 0),
        deliveryFee: Number(incomingData.deliveryFee || 0),
        tax: Number(incomingData.tax || 0),
        total: Number(incomingData.total || 0),
        itemCount: Number(incomingData.itemCount || 1),
        itemTitle: incomingData.itemTitle || "",
        currency: incomingData.currency || "INR",
      });
      return;
    }

    const fetchCartSummary = async () => {
      setLoadingSummary(true);
      try {
        const res = await axios.get(`${CART_URL}/items`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const items = res.data?.items || [];
        const itemsTotal = items.reduce(
          (sum, item) =>
            sum + Number(item.price || 0) * Number(item.quantity || 0),
          0,
        );
        const tax = Math.round(itemsTotal * 0.18);
        const deliveryFee = 0;

        setSummary({
          itemsTotal,
          deliveryFee,
          tax,
          total: itemsTotal + tax,
          itemCount: items.length,
          currency: "INR",
        });
      } catch {
        setSummary({
          itemsTotal: 0,
          deliveryFee: 0,
          tax: 0,
          total: 0,
          currency: "INR",
        });
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchCartSummary();
  }, [incomingData, token]);

  const isAddressComplete = useMemo(() => {
    return (
      Boolean(address.street.trim()) &&
      Boolean(address.city.trim()) &&
      Boolean(address.state.trim()) &&
      Boolean(address.pincode.trim()) &&
      Boolean(address.country.trim())
    );
  }, [address]);

  const validateAddress = () => {
    if (!isAddressComplete) {
      toast.error("Please fill all shipping address fields");
      return false;
    }

    if (!/^\d{6}$/.test(address.pincode.trim())) {
      toast.error("Pincode must be a valid 6-digit Indian pincode");
      return false;
    }

    return true;
  };

  const handleSaveAddress = () => {
    if (!validateAddress()) return;
    localStorage.setItem("checkoutShippingAddress", JSON.stringify(address));
    setEditingAddress(false);
    toast.success("Shipping address saved");
  };

  const placeOrder = async () => {
    if (!ORDER_URL) {
      toast.error("Order service URL is not configured");
      return;
    }

    if (!validateAddress()) return;

    setPlacingOrder(true);
    try {
      const res = await axios.post(
        `${ORDER_URL}/api/orders/`,
        {
          shippingAddress: {
            street: address.street.trim(),
            city: address.city.trim(),
            state: address.state.trim(),
            pincode: address.pincode.trim(),
            country: address.country.trim(),
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      toast.success(res?.data?.message || "Order placed successfully");
      navigate("/create-order", {
        state: {
          orderData: {
            orderId: res?.data?.order?._id,
            totalAmount: summary.total,
            currency: summary.currency,
            email: authUser?.email || "",
          },
        },
      });
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Your order could not be placed. Please review your cart and try again.",
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <h1 className="checkout-title">Checkout</h1>

        <section className="checkout-card">
          <div className="checkout-card-head">
            <h2>Shipping Address</h2>
            {!editingAddress && (
              <button
                type="button"
                className="checkout-link-btn"
                onClick={() => setEditingAddress(true)}
              >
                Edit
              </button>
            )}
          </div>

          {editingAddress ? (
            <div className="checkout-form-grid">
              <input
                type="text"
                placeholder="Street"
                value={address.street}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, street: e.target.value }))
                }
              />
              <input
                type="text"
                placeholder="City"
                value={address.city}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, city: e.target.value }))
                }
              />
              <input
                type="text"
                placeholder="State"
                value={address.state}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, state: e.target.value }))
                }
              />
              <input
                type="text"
                placeholder="Pincode"
                maxLength={6}
                value={address.pincode}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, pincode: e.target.value }))
                }
              />
              <input
                type="text"
                placeholder="Country"
                value={address.country}
                onChange={(e) =>
                  setAddress((prev) => ({ ...prev, country: e.target.value }))
                }
              />

              <button
                type="button"
                className="checkout-save-address"
                onClick={handleSaveAddress}
              >
                Save Address
              </button>
            </div>
          ) : (
            <div className="checkout-address-preview">
              <p className="checkout-name">{customerName}</p>
              <p>{address.street}</p>
              <p>
                {address.city} - {address.pincode}
              </p>
              <p>
                {address.state}, {address.country}
              </p>
            </div>
          )}
        </section>

        <section className="checkout-card">
          <h2>Order Summary</h2>
          {loadingSummary ? (
            <p className="checkout-muted">Loading summary...</p>
          ) : (
            <>
              <div className="checkout-summary-row">
                <span>Items Total</span>
                <strong>
                  {formatPrice(summary.itemsTotal, summary.currency)}
                </strong>
              </div>
              <div className="checkout-summary-row">
                <span>Delivery Fee</span>
                <strong>
                  {formatPrice(summary.deliveryFee, summary.currency)}
                </strong>
              </div>
              <div className="checkout-summary-row">
                <span>Tax (18%)</span>
                <strong>{formatPrice(summary.tax, summary.currency)}</strong>
              </div>
              <div className="checkout-summary-row checkout-summary-total">
                <span>Total</span>
                <strong>{formatPrice(summary.total, summary.currency)}</strong>
              </div>
            </>
          )}
        </section>

        <section className="checkout-card">
          <h2>Payment Method</h2>
          <div className="checkout-payment-placeholder">
            Online Payment (Razorpay)
          </div>

          <button
            type="button"
            className="checkout-place-order"
            onClick={placeOrder}
            disabled={placingOrder || loadingSummary}
          >
            {placingOrder ? "Placing..." : "Place Order"}
          </button>
        </section>
      </div>
    </div>
  );
};

export default Checkout;
