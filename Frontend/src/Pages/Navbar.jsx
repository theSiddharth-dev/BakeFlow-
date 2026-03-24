import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../Navbar.css";
import { toast } from "react-toastify";
import axios from "axios";

const PRODUCT_URL = import.meta.env.VITE_PRODUCT_SERVICE_URL;
const NOTIFICATION_POLL_INTERVAL_MS = 10000;

const parseJwtPayload = (token) => {
  try {
    const payloadPart = token?.split(".")?.[1];
    if (!payloadPart) return null;
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [cartBadge, setCartBadge] = useState({ visible: false, count: 0 });
  const [lowStockCount, setLowStockCount] = useState(0);
  const dropdownRef = useRef(null);

  const token = localStorage.getItem("token");
  const rawAuthUser = localStorage.getItem("authUser");

  const authUser = useMemo(() => {
    try {
      return rawAuthUser ? JSON.parse(rawAuthUser) : null;
    } catch {
      return null;
    }
  }, [rawAuthUser]);

  const jwtPayload = useMemo(() => parseJwtPayload(token), [token]);
  const isLoggedIn = Boolean(token);
  const isHomePage = location.pathname === "/";
  const isOwnerRoute = location.pathname.startsWith("/owner");

  const role = authUser?.role || jwtPayload?.role || "user";
  const email = authUser?.email || jwtPayload?.email || "";
  const username =
    authUser?.username ||
    [authUser?.firstName, authUser?.lastName].filter(Boolean).join(" ") ||
    jwtPayload?.username ||
    jwtPayload?.name ||
    "User";

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleCartBadge = (event) => {
      const count = Number(event?.detail?.count || 0);
      setCartBadge({
        visible: count > 0,
        count,
      });
    };

    window.addEventListener("cart-badge", handleCartBadge);
    return () => {
      window.removeEventListener("cart-badge", handleCartBadge);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("authUser");
    setCartBadge({ visible: false, count: 0 });
    setIsDropdownOpen(false);
    navigate(role === "owner" ? "/login?role=owner" : "/login");
    toast.success("Logged out successfully");
  };

  const handleSignIn = () => {
    navigate(isOwnerRoute ? "/login?role=owner" : "/login");
  };

  const handleSignUp = () => {
    navigate(isOwnerRoute ? "/owner/register" : "/register");
  };

  const handleOpenCart = () => {
    setCartBadge((prev) => ({ ...prev, visible: false }));
    navigate("/cart");
  };

  const handleOpenDashboard = () => {
    setIsDropdownOpen(false);
    navigate(role === "owner" ? "/owner/dashboard" : "/products");
  };

  const fetchLowStockCount = useCallback(async () => {
    if (!isLoggedIn || role !== "owner" || !PRODUCT_URL) {
      setLowStockCount(0);
      return;
    }

    try {
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

      setLowStockCount(Number(response?.data?.count || 0));
    } catch {
      setLowStockCount(0);
    }
  }, [isLoggedIn, role, token]);

  useEffect(() => {
    if (!isLoggedIn || role !== "owner") return undefined;

    const initialFetchTimeout = window.setTimeout(() => {
      fetchLowStockCount();
    }, 0);

    const onOwnerDataChanged = () => {
      fetchLowStockCount();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchLowStockCount();
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchLowStockCount();
      }
    }, NOTIFICATION_POLL_INTERVAL_MS);

    window.addEventListener("owner-data-changed", onOwnerDataChanged);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearTimeout(initialFetchTimeout);
      window.clearInterval(intervalId);
      window.removeEventListener("owner-data-changed", onOwnerDataChanged);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [fetchLowStockCount, isLoggedIn, role]);

  const handleOpenNotifications = () => {
    if (role === "owner") {
      navigate("/owner/notifications");
    }
  };

  const homeActionLabel = role === "owner" ? "Dashboard" : "Get Started";

  return (
    <nav className="navbar">
      {/* Left: Logo */}
      <div className="nav-left">
        <div className="logo">
          <img src="/logo.png" alt="Bakeflow Logo" className="logo-img" />
          <span className="logo-text">Bakeflow</span>
        </div>
      </div>

      {/* Right: Notification + Cart + Profile */}
      <div className="nav-right">
        {isLoggedIn ? (
          <>
            {isHomePage && (
              <button
                type="button"
                className="auth-btn auth-btn-primary"
                onClick={handleOpenDashboard}
              >
                {homeActionLabel}
              </button>
            )}
            <button
              type="button"
              className="notification-icon-btn"
              aria-label={
                role === "owner" ? "Open owner notifications" : "Notifications"
              }
              onClick={handleOpenNotifications}
            >
              <span className="icon">🔔</span>
              {role === "owner" && lowStockCount > 0 && (
                <span className="notification-red-dot" />
              )}
            </button>
            {role !== "owner" && (
              <button
                className="cart-icon-btn"
                onClick={handleOpenCart}
                aria-label="Open cart"
              >
                <span className="icon">🛒</span>
                {cartBadge.visible && cartBadge.count > 0 && (
                  <span className="cart-icon-badge">
                    {cartBadge.count > 99 ? "99+" : cartBadge.count}
                  </span>
                )}
              </button>
            )}
            <div className="profile-wrapper" ref={dropdownRef}>
              <button
                type="button"
                className="profile-trigger"
                onClick={() => setIsDropdownOpen((prev) => !prev)}
              >
                {username}
              </button>

              {isDropdownOpen && (
                <div className="profile-dropdown">
                  <p className="profile-name">{username}</p>
                  <p className="profile-email">{email || "No email found"}</p>
                  <button className="logout-btn" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="auth-actions">
            <button
              className="auth-btn auth-btn-secondary"
              onClick={handleSignIn}
            >
              Sign In
            </button>
            <button
              className="auth-btn auth-btn-primary"
              onClick={handleSignUp}
            >
              Sign Up
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
