import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import "./UserOrders.css";

const ORDER_URL = import.meta.env.VITE_ORDER_SERVICE_URL;
const PRODUCT_URL = import.meta.env.VITE_PRODUCT_SERVICE_URL;
const USER_ORDERS_POLL_INTERVAL_MS = 3000;

const mapDisplayStatus = (status) => {
  if (status === "CONFIRMED") return "PENDING";
  return status || "-";
};

const formatPrice = (amount, currency = "INR") => {
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

const UserOrders = () => {
  const [orders, setOrders] = useState([]);
  const [productNameMap, setProductNameMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openingReceiptId, setOpeningReceiptId] = useState("");
  const [downloadingReceiptId, setDownloadingReceiptId] = useState("");
  const [activeReceiptOrderId, setActiveReceiptOrderId] = useState("");
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState("");
  const isFetchingRef = useRef(false);

  const token = localStorage.getItem("token");

  const fetchOrders = useCallback(async () => {
    if (isFetchingRef.current) return;

    if (!ORDER_URL) {
      setError("Order service URL is not configured");
      setLoading(false);
      return;
    }

    if (!token) {
      setError("You are not logged in. Please login again.");
      setLoading(false);
      return;
    }

    try {
      isFetchingRef.current = true;

      const res = await axios.get(`${ORDER_URL}/api/orders/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: { ts: Date.now() },
      });

      const fetchedOrders = res?.data?.orders || [];
      setOrders(fetchedOrders);

      const uniqueProductIds = [
        ...new Set(
          fetchedOrders.flatMap((order) =>
            (order.items || []).map((item) => item?.product).filter(Boolean),
          ),
        ),
      ];

      if (PRODUCT_URL && uniqueProductIds.length > 0) {
        const missingProductIds = uniqueProductIds.filter(
          (id) => !productNameMap[id],
        );

        if (missingProductIds.length > 0) {
          const productResults = await Promise.all(
            missingProductIds.map(async (id) => {
              try {
                const productRes = await axios.get(`${PRODUCT_URL}/api/products/${id}`, {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                });

                return [
                  id,
                  productRes?.data?.product?.title || "Unknown Product",
                ];
              } catch {
                return [id, "Unknown Product"];
              }
            }),
          );

          setProductNameMap((prev) => ({
            ...prev,
            ...Object.fromEntries(productResults),
          }));
        }
      } else if (uniqueProductIds.length === 0) {
        setProductNameMap({});
      }

      setError("");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "We could not load your orders. Please refresh and try again.",
      );
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, [token, productNameMap]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchOrders();
      }
    }, USER_ORDERS_POLL_INTERVAL_MS);

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        fetchOrders();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityOrFocus);
    window.addEventListener("focus", onVisibilityOrFocus);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityOrFocus);
      window.removeEventListener("focus", onVisibilityOrFocus);
    };
  }, [fetchOrders]);

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) {
        window.URL.revokeObjectURL(receiptPreviewUrl);
      }
    };
  }, [receiptPreviewUrl]);

  const closeReceiptModal = () => {
    if (receiptPreviewUrl) {
      window.URL.revokeObjectURL(receiptPreviewUrl);
    }
    setReceiptPreviewUrl("");
    setActiveReceiptOrderId("");
  };

  const handleViewReceipt = async (orderId) => {
    if (!orderId) return;

    try {
      setOpeningReceiptId(orderId);
      const response = await axios.get(`${ORDER_URL}/api/orders/${orderId}/receipt`, {
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
        `${ORDER_URL}/${activeReceiptOrderId}/receipt`,
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

  const getOrderProductSummary = (order) => {
    const names = (order.items || [])
      .map((item) => productNameMap[item?.product])
      .filter(Boolean);

    const uniqueNames = [...new Set(names)];

    if (uniqueNames.length === 0) return "-";
    if (uniqueNames.length === 1) return uniqueNames[0];
    return `${uniqueNames[0]} +${uniqueNames.length - 1} more`;
  };

  const getTotalQty = (order) => {
    return (order.items || []).reduce(
      (sum, item) => sum + Number(item?.quantity || 0),
      0,
    );
  };

  return (
    <div className="user-panel-page">
      <h1>Your Orders</h1>

      {loading ? (
        <p>Loading orders...</p>
      ) : error ? (
        <p>{error}</p>
      ) : orders.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <div className="user-orders-table-wrap">
          <table className="user-orders-table">
            <thead>
              <tr>
                <th>Sr.no</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order, index) => (
                <tr key={order._id}>
                  <td>{index + 1}</td>
                  <td>{getOrderProductSummary(order)}</td>
                  <td>{getTotalQty(order)}</td>
                  <td>
                    {formatPrice(
                      order?.totalPrice?.amount,
                      order?.totalPrice?.currency,
                    )}
                  </td>
                  <td>{mapDisplayStatus(order.status)}</td>
                  <td>
                    {new Date(order.createdAt).toLocaleDateString("en-IN")}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="user-orders-receipt-btn"
                      onClick={() => handleViewReceipt(order._id)}
                      disabled={openingReceiptId === order._id}
                    >
                      {openingReceiptId === order._id
                        ? "Loading..."
                        : "View Receipt"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeReceiptOrderId && receiptPreviewUrl && (
        <div
          className="user-orders-receipt-modal-backdrop"
          onClick={closeReceiptModal}
        >
          <div
            className="user-orders-receipt-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Receipt</h3>

            <div className="user-orders-receipt-preview-wrap">
              <iframe
                title={`Receipt ${activeReceiptOrderId}`}
                src={receiptPreviewUrl}
                className="user-orders-receipt-preview"
              />
            </div>

            <div className="user-orders-receipt-actions">
              <button
                type="button"
                className="user-orders-receipt-btn"
                onClick={handleDownloadFromModal}
                disabled={downloadingReceiptId === activeReceiptOrderId}
              >
                {downloadingReceiptId === activeReceiptOrderId
                  ? "Downloading..."
                  : "Download Receipt"}
              </button>

              <button
                type="button"
                className="user-orders-receipt-btn user-orders-receipt-btn--secondary"
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

export default UserOrders;
