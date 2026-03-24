import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./OwnerNotifications.css";

const PRODUCT_URL = import.meta.env.VITE_PRODUCT_SERVICE_URL;
const NOTIFICATION_REFRESH_MS = 10000;

const REORDER_MESSAGE =
  "This product is having less stock reorder it and keep the stock healthy.";

const OwnerNotifications = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [threshold, setThreshold] = useState(5);

  const fetchNotifications = useCallback(async () => {
    if (!PRODUCT_URL) {
      setError("Product service URL is not configured");
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(
        `${PRODUCT_URL}/api/products/owner/low-stock`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            ts: Date.now(),
          },
        },
      );

      const apiNotifications = Array.isArray(response?.data?.notifications)
        ? response.data.notifications
        : [];

      setNotifications(apiNotifications);
      setThreshold(Number(response?.data?.threshold || 5));
      setError("");
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Notifications could not be loaded. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    }, NOTIFICATION_REFRESH_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchNotifications();
      }
    };

    const onOwnerDataChanged = () => {
      fetchNotifications();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("owner-data-changed", onOwnerDataChanged);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("owner-data-changed", onOwnerDataChanged);
    };
  }, [fetchNotifications]);

  const totalLowStock = useMemo(() => notifications.length, [notifications]);

  return (
    <div className="owner-notification-page">
      <div className="owner-notification-head">
        <div>
          <h1>Notifications</h1>
        </div>
        <button
          type="button"
          className="owner-notification-refresh"
          onClick={fetchNotifications}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="owner-notification-feedback">Loading notifications...</p>
      ) : error ? (
        <p className="owner-notification-feedback owner-notification-feedback--error">
          {error}
        </p>
      ) : totalLowStock === 0 ? (
        <p className="owner-notification-feedback">
          No Events right now. you will be notify here when any event
          happens.{" "}
        </p>
      ) : (
        <div className="owner-notification-list" role="list">
          {notifications.map((item) => (
            <article
              className="owner-notification-card"
              key={item.productId}
              role="listitem"
            >
              <div className="owner-notification-image-wrap">
                <img
                  src={
                    item.image ||
                    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=60"
                  }
                  alt={item.title}
                  className="owner-notification-image"
                />
              </div>

              <div className="owner-notification-content">
                <h2>{item.title || "Unnamed Product"}</h2>
                <p className="owner-notification-stock">
                  Stock: <strong>{Number(item.stock || 0)}</strong>
                </p>
                <p className="owner-notification-message">
                  {item.message || REORDER_MESSAGE}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default OwnerNotifications;
