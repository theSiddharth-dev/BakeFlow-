import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "./OwnerOrders.css";

const ORDER_URL = import.meta.env.VITE_ORDER_SERVICE_URL;
const ORDER_API_BASE = `${ORDER_URL}/api/orders`;
const OWNER_ORDERS_POLL_INTERVAL_MS = 4000;
const OWNER_STATUS_SEQUENCE = [
  "CONFIRMED",
  "PROCESSING",
  "READY",
  "SHIPPED",
  "COMPLETED",
];

const formatAmount = (amount, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  } catch {
    return `₹${Number(amount || 0)}`;
  }
};

const formatDateTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const OwnerOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [openingReceiptId, setOpeningReceiptId] = useState("");
  const [downloadingReceiptId, setDownloadingReceiptId] = useState("");
  const [activeReceiptOrderId, setActiveReceiptOrderId] = useState("");
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");
  const isFetchingRef = useRef(false);

  const token = localStorage.getItem("token");

  const fetchOwnerOrders = useCallback(async () => {
    if (isFetchingRef.current) return;

    if (!ORDER_URL) {
      setError("Order service URL is not configured");
      setLoading(false);
      return;
    }

    try {
      isFetchingRef.current = true;
      const response = await axios.get(`${ORDER_API_BASE}/owner`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setOrders(response?.data?.orders || []);
      setError("");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Owner orders could not be loaded. Please refresh and try again.",
      );
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOwnerOrders();
  }, [fetchOwnerOrders]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchOwnerOrders();
      }
    }, OWNER_ORDERS_POLL_INTERVAL_MS);

    const onTabFocus = () => {
      fetchOwnerOrders();
    };

    document.addEventListener("visibilitychange", onTabFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onTabFocus);
    };
  }, [fetchOwnerOrders]);

  const getNextRawStatus = (rawStatus) => {
    const currentIndex = OWNER_STATUS_SEQUENCE.indexOf(rawStatus);
    if (
      currentIndex === -1 ||
      currentIndex === OWNER_STATUS_SEQUENCE.length - 1
    ) {
      return null;
    }

    return OWNER_STATUS_SEQUENCE[currentIndex + 1];
  };

  const getDisplayStatusFromRaw = (rawStatus) => {
    if (rawStatus === "CONFIRMED") return "PENDING";
    return rawStatus;
  };

  const handleOrderStatusClick = async (order) => {
    const orderId = order?._id;
    const nextStatus = getNextRawStatus(order?.orderStatusRaw);

    if (!orderId || !nextStatus) return;
    if (String(order?.paymentStatus || "").toUpperCase() !== "PAID") return;

    try {
      setUpdatingOrderId(orderId);
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order._id === orderId
            ? {
                ...order,
                ownerOrderStatus: getDisplayStatusFromRaw(nextStatus),
                orderStatusRaw: nextStatus,
              }
            : order,
        ),
      );

      const response = await axios.patch(
        `${ORDER_API_BASE}/${orderId}/owner-status`,
        { status: nextStatus },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      toast.success(response?.data?.message || "Order updated");
      window.dispatchEvent(new Event("owner-data-changed"));
      await fetchOwnerOrders();
    } catch (err) {
      await fetchOwnerOrders();
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Order status could not be updated. Please try again.",
      );
    } finally {
      setUpdatingOrderId("");
    }
  };

  const closeReceiptModal = () => {
    if (receiptPreviewUrl) {
      window.URL.revokeObjectURL(receiptPreviewUrl);
    }
    setReceiptPreviewUrl("");
    setActiveReceiptOrderId("");
  };

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) {
        window.URL.revokeObjectURL(receiptPreviewUrl);
      }
    };
  }, [receiptPreviewUrl]);

  const handleViewReceipt = async (orderId) => {
    if (!orderId) return;

    try {
      setOpeningReceiptId(orderId);
      const response = await axios.get(`${ORDER_API_BASE}/${orderId}/receipt`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      if (receiptPreviewUrl) {
        window.URL.revokeObjectURL(receiptPreviewUrl);
      }

      const url = window.URL.createObjectURL(blob);
      setReceiptPreviewUrl(url);
      setActiveReceiptOrderId(orderId);
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Receipt preview could not be opened. Please try again.",
      );
    } finally {
      setOpeningReceiptId("");
    }
  };

  const handleDownloadFromModal = async () => {
    if (!activeReceiptOrderId) return;

    try {
      setDownloadingReceiptId(activeReceiptOrderId);

      const response = await axios.get(
        `${ORDER_API_BASE}/${activeReceiptOrderId}/receipt`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `receipt-${activeReceiptOrderId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Receipt download failed. Please try again.",
      );
    } finally {
      setDownloadingReceiptId("");
    }
  };

  return (
    <div className="user-panel-page owner-orders-page">
      <div className="owner-orders-head">
        <div>
          <h1>Orders and Sales</h1>
        </div>
      </div>

      {loading ? (
        <p className="owner-orders-feedback">Loading orders...</p>
      ) : error ? (
        <p className="owner-orders-feedback owner-orders-feedback--error">
          {error}
        </p>
      ) : orders.length === 0 ? (
        <p className="owner-orders-feedback">
          No confirmed orders available right now.
        </p>
      ) : (
        <div className="owner-orders-table-wrap">
          <table className="owner-orders-table">
            <thead>
              <tr>
                <th>Sr.no</th>
                <th>Order name</th>
                <th>Date and time</th>
                <th>Items quantity</th>
                <th>Amount</th>
                <th>Payment status</th>
                <th>Order status</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => {
                const isUpdating = updatingOrderId === order._id;
                const nextStatus = getNextRawStatus(order.orderStatusRaw);
                const isPaid =
                  String(order.paymentStatus || "").toUpperCase() === "PAID";
                const canAdvance = Boolean(nextStatus) && isPaid;

                return (
                  <tr key={order._id}>
                    <td>{index + 1}</td>
                    <td>{order.orderName || "-"}</td>
                    <td>{formatDateTime(order.createdAt)}</td>
                    <td>{order.itemsQuantity || 0}</td>
                    <td>
                      {formatAmount(
                        order?.amount?.amount,
                        order?.amount?.currency,
                      )}
                    </td>
                    <td>
                      <span
                        className={`owner-orders-pill owner-orders-pill--${String(order.paymentStatus || "").toLowerCase()}`}
                      >
                        {order.paymentStatus || "-"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`owner-orders-pill owner-orders-status-btn owner-orders-pill--${String(order.ownerOrderStatus || "").toLowerCase()} ${canAdvance ? "owner-orders-status-btn--interactive" : ""}`}
                        disabled={isUpdating || !canAdvance}
                        onClick={() => handleOrderStatusClick(order)}
                        title={
                          canAdvance
                            ? `Click to move to ${getDisplayStatusFromRaw(nextStatus)}`
                            : "No further status update"
                        }
                      >
                        {isUpdating
                          ? "Updating..."
                          : order.ownerOrderStatus || "-"}
                      </button>
                      <span
                        className="owner-orders-status-hint"
                        aria-hidden="true"
                      ></span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="owner-orders-btn owner-orders-btn--receipt"
                        onClick={() => handleViewReceipt(order._id)}
                        disabled={
                          openingReceiptId === order._id ||
                          !order.receiptAvailable
                        }
                      >
                        {openingReceiptId === order._id
                          ? "Loading..."
                          : "View Receipt"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeReceiptOrderId && receiptPreviewUrl && (
        <div
          className="owner-orders-receipt-modal-backdrop"
          onClick={closeReceiptModal}
        >
          <div
            className="owner-orders-receipt-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="owner-orders-receipt-preview-wrap">
              <iframe
                title={`Receipt ${activeReceiptOrderId}`}
                src={receiptPreviewUrl}
                className="owner-orders-receipt-preview"
              />
            </div>

            <div className="owner-orders-receipt-modal-actions">
              <button
                type="button"
                className="owner-orders-btn owner-orders-btn--receipt"
                onClick={handleDownloadFromModal}
                disabled={downloadingReceiptId === activeReceiptOrderId}
              >
                {downloadingReceiptId === activeReceiptOrderId
                  ? "Downloading..."
                  : "Download Receipt"}
              </button>

              <button
                type="button"
                className="owner-orders-btn owner-orders-btn--close"
                onClick={closeReceiptModal}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerOrders;
