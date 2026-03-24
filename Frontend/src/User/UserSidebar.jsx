import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { createPortal } from "react-dom";
import "./UserSidebar.css";

const menuItems = [
  { key: "products", label: "Products", to: "/products" },
  { key: "orders", label: "Orders", to: "/orders" },
  { key: "profile", label: "Profile", to: "/profile" },
];

const UserSidebar = () => {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const isProductsPage = pathname.startsWith("/products");

  useEffect(() => {
    if (typeof document === "undefined") return;

    const updateAnchor = () => {
      setAnchorEl(document.getElementById("user-sidebar-anchor"));
    };

    updateAnchor();
    const frameId = requestAnimationFrame(updateAnchor);

    return () => cancelAnimationFrame(frameId);
  }, [pathname]);

  const closeSidebar = () => setIsOpen(false);

  const toggleButton = (
    <button
      type="button"
      className="user-sidebar-toggle"
      aria-label="Open user menu"
      onClick={() => setIsOpen((prev) => !prev)}
    >
      ☰
    </button>
  );

  return (
    <>
      {isProductsPage
        ? anchorEl
          ? createPortal(toggleButton, anchorEl)
          : null
        : toggleButton}

      {isOpen && (
        <div className="user-sidebar-backdrop" onClick={closeSidebar} />
      )}

      <aside className={`user-sidebar ${isOpen ? "user-sidebar--open" : ""}`}>
        <div className="user-sidebar-header">
          <h2>User Panel</h2>
        </div>

        <nav className="user-sidebar-nav" aria-label="User navigation">
          {menuItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `user-sidebar-link ${isActive ? "user-sidebar-link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default UserSidebar;
