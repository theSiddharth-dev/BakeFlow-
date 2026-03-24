import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import "./CreateOrder.css";

const PAYMENT_URL = import.meta.env.VITE_PAYMENT_SERVICE_URL;
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;
const ORDER_URL = import.meta.env.VITE_ORDER_SERVICE_URL;

const formatPrice = (amount, currency = "INR") => {
  if (amount === undefined || amount === null) return "₹0.00";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount));
  } catch {
    return `₹${amount}`;
  }
};

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const CreateOrder = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const token = localStorage.getItem("token");
  const rawAuthUser = localStorage.getItem("authUser");
  const orderData = location.state?.orderData || {};

  let authUser = null;
  try {
    authUser = rawAuthUser ? JSON.parse(rawAuthUser) : null;
  } catch {
    authUser = null;
  }

  const [isPaying, setIsPaying] = useState(false);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const orderId = orderData?.orderId;
  const totalAmount = Number(orderData?.totalAmount || 0);
  const currency = orderData?.currency || "INR";
  const customerEmail = orderData?.email || authUser?.email || "";

  const canProceed = useMemo(() => {
    return Boolean(orderId) && totalAmount > 0;
  }, [orderId, totalAmount]);

  const startPayment = async () => {
    if (!PAYMENT_URL) {
      toast.error("Payment service URL is not configured");
      return;
    }

    if (!RAZORPAY_KEY_ID) {
      toast.error("Razorpay key is missing in frontend environment");
      return;
    }

    if (!canProceed) {
      toast.error("Order details are missing. Please place order again.");
      return;
    }

    setIsPaying(true);

    try {
      const sdkLoaded = await loadRazorpayScript();
      if (!sdkLoaded || !window.Razorpay) {
        toast.error("Unable to load Razorpay. Check internet and try again.");
        return;
      }

      const createRes = await axios.post(
        `${PAYMENT_URL}/create/${orderId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const payment = createRes?.data?.payment;
      const razorpayOrderId = payment?.razorpayOrderId;
      const payableAmount = Number(payment?.price?.amount || 0);
      const payableCurrency = payment?.price?.currency || currency;

      if (!razorpayOrderId || payableAmount <= 0) {
        toast.error("Invalid payment order. Please try again.");
        return;
      }

      const razorpay = new window.Razorpay({
        key: RAZORPAY_KEY_ID,
        amount: payableAmount,
        currency: payableCurrency,
        name: "Bakeflow",
        description: `Payment for Order ${orderId}`,
        order_id: razorpayOrderId,
        prefill: {
          name:
            [authUser?.firstName, authUser?.lastName]
              .filter(Boolean)
              .join(" ") ||
            authUser?.username ||
            "Customer",
          email: customerEmail,
          contact: authUser?.phone || "",
        },
        theme: {
          color: "#e87c2a",
        },
        handler: async (response) => {
          try {
            await axios.post(
              `${PAYMENT_URL}/verify`,
              {
                razorpayOrderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": "application/json",
                },
              },
            );

            setShowSuccessModal(true);
            toast.success("Payment successful. Order placed.");
          } catch (verifyErr) {
            toast.error(
              verifyErr?.response?.data?.message ||
                verifyErr?.response?.data?.error ||
                verifyErr?.message ||
                "Payment was completed, but verification failed. Please contact support if amount was deducted.",
            );
          }
        },
        modal: {
          ondismiss: () => {
            toast.info("Payment popup closed");
          },
        },
      });

      razorpay.open();
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Payment could not be started. Please try again.",
      );
    } finally {
      setIsPaying(false);
    }
  };

  const goToOrders = () => {
    setShowSuccessModal(false);
    navigate("/orders");
  };

  const downloadReceipt = async () => {
    if (!ORDER_URL || !orderId) {
      toast.error("Receipt download is not available right now");
      return;
    }

    try {
      setIsDownloadingReceipt(true);
      const response = await axios.get(`${ORDER_URL}/${orderId}/receipt`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `receipt-${orderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          "Receipt could not be downloaded right now. Please try again.",
      );
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  return (
    <div className="create-order-page">
      <div className="create-order-card">
        <h1>Confirm Order Payment</h1>
        <p className="create-order-note">
          Complete the payment to place your order. Once payment succeeds, your
          order will appear in your orders list.
        </p>

        <section className="create-order-summary">
          <div>
            <span>Payment Method</span>
            <strong>Razorpay</strong>
          </div>
          <div>
            <span>Registered Email</span>
            <strong>{customerEmail || "-"}</strong>
          </div>
          <div>
            <span>Total Amount</span>
            <strong>{formatPrice(totalAmount, currency)}</strong>
          </div>
        </section>

        <div className="create-order-actions">
          <button
            type="button"
            className="create-order-btn create-order-btn--confirm"
            onClick={startPayment}
            disabled={isPaying || !canProceed}
          >
            {isPaying ? "Opening Payment..." : "Pay Now"}
          </button>

          <button
            type="button"
            className="create-order-btn create-order-btn--cancel"
            onClick={() => navigate("/checkout")}
            disabled={isPaying}
          >
            Back to Checkout
          </button>
        </div>
      </div>

      {showSuccessModal && (
        <div className="create-order-modal-backdrop">
          <div className="create-order-modal">
            <h2>Payment Successful!</h2>
            <p>
              Your order has been placed successfully.
              <br />
              A receipt for this transaction has been generated and sent to your
              email
              <br />
              {customerEmail || "N/A"}
            </p>

            <div className="create-order-actions">
              <button
                type="button"
                className="create-order-btn create-order-btn--confirm"
                onClick={downloadReceipt}
                disabled={isDownloadingReceipt}
              >
                {isDownloadingReceipt ? "Downloading..." : "Download Receipt"}
              </button>

              <button
                type="button"
                className="create-order-btn create-order-btn--cancel"
                onClick={goToOrders}
              >
                View My Orders
              </button>

              <button
                type="button"
                className="create-order-btn create-order-btn--cancel"
                onClick={() => {
                  setShowSuccessModal(false);
                  navigate("/products");
                }}
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateOrder;
